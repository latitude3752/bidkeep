import { beforeEach, describe, expect, it, vi } from "vitest";

/** These three actions are invoked from OpportunityDetail, a component
 * shared by /admin/opportunities/[id] (admin) and /app/opportunities/[id]
 * (subscriber). requireAdminOrSubscriberSession() must accept either an
 * admin session OR a subscriber with a seat -- rejecting a subscriber who
 * has neither is the exact "Not authorized" bug this suite guards against. */

type OppFixture = {
  title?: string;
  naics_code?: string;
  price_research_at?: string | null;
  scale_checked_at?: string | null;
};

const { cookieGet, verifySessionToken, getCurrentSeat, from, singleResult } = vi.hoisted(() => {
  const singleResult = vi.fn(async (): Promise<{ data: OppFixture; error: null }> => ({
    data: { title: "Widget supply", naics_code: "541330", price_research_at: null, scale_checked_at: null },
    error: null,
  }));
  const eqAfterSelect = vi.fn(() => ({ single: singleResult }));
  const select = vi.fn(() => ({ eq: eqAfterSelect }));
  const eqAfterUpdate = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: eqAfterUpdate }));
  return {
    cookieGet: vi.fn(),
    verifySessionToken: vi.fn(),
    getCurrentSeat: vi.fn(),
    from: vi.fn(() => ({ select, update })),
    singleResult,
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/admin-auth", () => ({
  verifySessionToken,
  SESSION_COOKIE: "admin_session",
}));

vi.mock("@/lib/current-seat", () => ({ getCurrentSeat }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from }),
}));

vi.mock("@/lib/contract-awards", () => ({
  extractSearchKeyword: vi.fn(() => "widget"),
  searchComparableAwards: vi.fn(async () => ({ researchedAt: "2026-09-09T00:00:00Z" })),
}));

vi.mock("@netacracy/bid-core", () => ({
  ensureOpportunityScale: vi.fn(async () => ({
    text: null,
    fetchedAt: null,
    scale: { programType: null, estimatedCeiling: null },
    descriptionFetchError: null,
  })),
  reportSamGovUsage: vi.fn(async () => {}),
}));

import { updateOpportunityStatus, researchOpportunityPrice, refreshOpportunityScale } from "./actions";

describe("opportunity actions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue(undefined);
  });

  it("rejects when there is neither an admin session nor a subscriber seat", async () => {
    verifySessionToken.mockReturnValue(false);
    getCurrentSeat.mockResolvedValue(null);

    await expect(updateOpportunityStatus("opp-1", "won")).rejects.toThrow("Not authorized");
    await expect(researchOpportunityPrice("opp-1")).rejects.toThrow("Not authorized");
    await expect(refreshOpportunityScale("opp-1")).rejects.toThrow("Not authorized");
  });

  it("allows a subscriber with a valid seat and no admin session", async () => {
    verifySessionToken.mockReturnValue(false);
    getCurrentSeat.mockResolvedValue({ seatId: "seat-1" });

    await expect(updateOpportunityStatus("opp-1", "won")).resolves.not.toThrow();
    await expect(researchOpportunityPrice("opp-1")).resolves.not.toThrow();
    await expect(refreshOpportunityScale("opp-1")).resolves.not.toThrow();
  });

  it("allows an admin session with no subscriber seat", async () => {
    verifySessionToken.mockReturnValue(true);
    getCurrentSeat.mockResolvedValue(null);

    await expect(updateOpportunityStatus("opp-1", "won")).resolves.not.toThrow();
    await expect(researchOpportunityPrice("opp-1")).resolves.not.toThrow();
    await expect(refreshOpportunityScale("opp-1")).resolves.not.toThrow();
  });
});

describe("researchOpportunityPrice upstream failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue(undefined);
    verifySessionToken.mockReturnValue(true);
  });

  it("returns a soft error instead of throwing when SAM.gov rate-limits the request", async () => {
    const { searchComparableAwards } = await import("@/lib/contract-awards");
    vi.mocked(searchComparableAwards).mockRejectedValueOnce(new Error("Contract Awards API error 429"));

    const result = await researchOpportunityPrice("opp-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rate-limited/i);
  });
});

describe("refreshOpportunityScale upstream failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue(undefined);
    verifySessionToken.mockReturnValue(true);
  });

  it("returns a soft error instead of failing silently when the notice description fetch is rate-limited", async () => {
    const { ensureOpportunityScale } = await import("@netacracy/bid-core");
    vi.mocked(ensureOpportunityScale).mockResolvedValueOnce({
      text: null,
      fetchedAt: null,
      scale: { programType: null, estimatedCeiling: null },
      descriptionFetchError: "Notice description fetch failed: 429",
    });

    const result = await refreshOpportunityScale("opp-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rate-limited/i);
  });

  it("reports success when the description fetch has no error", async () => {
    const { ensureOpportunityScale } = await import("@netacracy/bid-core");
    vi.mocked(ensureOpportunityScale).mockResolvedValueOnce({
      text: "Full notice text.",
      fetchedAt: "2026-09-09T00:00:00Z",
      scale: { programType: null, estimatedCeiling: null },
      descriptionFetchError: null,
    });

    const result = await refreshOpportunityScale("opp-1");

    expect(result.ok).toBe(true);
  });
});

describe("refresh cooldown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue(undefined);
    verifySessionToken.mockReturnValue(true);
  });

  it("skips the SAM.gov call and reports a cooldown error for price research refreshed moments ago", async () => {
    singleResult.mockResolvedValueOnce({
      data: { title: "Widget supply", naics_code: "541330", price_research_at: new Date().toISOString() },
      error: null,
    });
    const { searchComparableAwards } = await import("@/lib/contract-awards");

    const result = await researchOpportunityPrice("opp-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/try again in a few minutes/i);
    expect(searchComparableAwards).not.toHaveBeenCalled();
  });

  it("skips the SAM.gov call and reports a cooldown error for scale classification refreshed moments ago", async () => {
    singleResult.mockResolvedValueOnce({
      data: { scale_checked_at: new Date().toISOString() },
      error: null,
    });
    const { ensureOpportunityScale } = await import("@netacracy/bid-core");

    const result = await refreshOpportunityScale("opp-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/try again in a few minutes/i);
    expect(ensureOpportunityScale).not.toHaveBeenCalled();
  });

  it("allows price research to proceed once the cooldown has elapsed", async () => {
    singleResult.mockResolvedValueOnce({
      data: {
        title: "Widget supply",
        naics_code: "541330",
        price_research_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      error: null,
    });

    const result = await researchOpportunityPrice("opp-1");

    expect(result.ok).toBe(true);
  });
});
