import { beforeEach, describe, expect, it, vi } from "vitest";

/** These three actions are invoked from OpportunityDetail, a component
 * shared by /admin/opportunities/[id] (admin) and /app/opportunities/[id]
 * (subscriber). requireAdminOrSubscriberSession() must accept either an
 * admin session OR a subscriber with a seat -- rejecting a subscriber who
 * has neither is the exact "Not authorized" bug this suite guards against. */

const { cookieGet, verifySessionToken, getCurrentSeat, from } = vi.hoisted(() => {
  const singleResult = vi.fn(async () => ({
    data: { title: "Widget supply", naics_code: "541330" },
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
  ensureOpportunityScale: vi.fn(async () => {}),
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
