import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const notifyNewOpportunities = vi.fn(
  async (_opps: Array<{ noticeId: string }>) => null as string | null
);
const notifySyncErrors = vi.fn(async (_errors: string[]) => {});
const ensureOpportunityScale = vi.fn(async () => ({
  scale: { programType: null, estimatedCeiling: null },
}));

vi.mock("@/lib/notify", () => ({
  notifyNewOpportunities,
  notifySyncErrors,
}));

const recordSyncRun = vi.fn(
  async (_run: { source: string; upserted: number; errors: string[] }) => {}
);

// Real SAM.gov search/quota/auth logic runs unmocked (exercised via the
// stubbed global fetch in each test below); only the Supabase-backed reads
// and writes are replaced here.
vi.mock("@netacracy/bid-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ensureOpportunityScale,
  getActiveNaicsCodes: async () => [
    { code: "561720", label: "Janitorial Services", active: true },
  ],
  recordSyncRun: (run: { source: string; upserted: number; errors: string[] }) =>
    recordSyncRun(run),
}));

/** Minimal fake of the Supabase query builder covering exactly the calls
 * route.ts makes: select(...).in(...) [existing-check and id-lookup],
 * upsert(...), and update(...).in(...).lt(...). Existing notice_ids persist
 * across calls within a test the same way a real DB would within one
 * request -- an upsert makes that row "existing" for the next pass, which
 * is what the route relies on to notify each new opportunity exactly once
 * even though the same notice can surface from more than one search pass. */
function makeSupabaseAdminMock(initialExisting: string[] = []) {
  const existing = new Set(initialExisting);
  const upsertedRows: Array<Record<string, unknown>> = [];

  const from = vi.fn((_table: string) => {
    const builder: {
      _cols: string | null;
      _isUpdate: boolean;
      select: (cols: string) => typeof builder;
      upsert: (rows: Array<Record<string, unknown>>) => Promise<{ error: null }>;
      update: (patch: unknown, opts?: unknown) => typeof builder;
      in: (col: string, vals: string[]) => typeof builder | Promise<unknown>;
      lt: (col: string, val: string) => Promise<{ count: number; error: null }>;
      eq: (col: string, val: string) => Promise<{ error: null }>;
    } = {
      _cols: null,
      _isUpdate: false,
      select(cols) {
        builder._cols = cols;
        return builder;
      },
      async upsert(rows) {
        upsertedRows.push(...rows);
        for (const row of rows) existing.add(row.notice_id as string);
        return { error: null };
      },
      update() {
        builder._isUpdate = true;
        return builder;
      },
      in(_col, vals) {
        if (builder._isUpdate) return builder;
        if (builder._cols?.includes("notice_id") && !builder._cols.includes("id")) {
          return Promise.resolve({
            data: vals
              .filter((v) => existing.has(v))
              .map((id) => ({ notice_id: id, requirements_text: null })),
          });
        }
        return Promise.resolve({
          data: vals.map((id) => ({ id: `row-${id}`, notice_id: id })),
        });
      },
      async eq() {
        return { error: null };
      },
      async lt() {
        return { count: 0, error: null };
      },
    };
    return builder;
  });

  return { from, upsertedRows, existing };
}

let supabaseMock: ReturnType<typeof makeSupabaseAdminMock>;

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => supabaseMock,
}));

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

function samOpportunity(overrides: Record<string, unknown>) {
  return {
    noticeId: "n1",
    title: "Reroof Barracks Building 412",
    fullParentPathName: "DEPT OF THE ARMY",
    naicsCode: "561720",
    typeOfSetAsideDescription: null,
    responseDeadLine: "2026-11-01T00:00:00.000Z",
    uiLink: "https://sam.gov/opp/n1",
    type: "Solicitation",
    classificationCode: "Y1DA",
    placeOfPerformance: { state: { code: "TX", name: "Texas" }, zip: "76544" },
    ...overrides,
  };
}

describe("GET /api/sync-opportunities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T13:00:00.000Z"));
    process.env.SAM_GOV_API_KEY = "test-key";
    process.env.CRON_SECRET = "test-secret";
    supabaseMock = makeSupabaseAdminMock();
    notifyNewOpportunities.mockClear().mockResolvedValue(null);
    notifySyncErrors.mockClear();
    recordSyncRun.mockClear();
    ensureOpportunityScale.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.SAM_GOV_API_KEY;
    delete process.env.CRON_SECRET;
  });

  function authedRequest() {
    return new NextRequest("http://localhost/api/sync-opportunities", {
      headers: { authorization: "Bearer test-secret" },
    });
  }

  it("rejects requests without a matching CRON_SECRET", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/sync-opportunities", {
        headers: { authorization: "Bearer wrong" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("upserts a newly-discovered NAICS-matched notice, storing its place of performance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.searchParams.get("ncode") === "561720") {
          return jsonResponse({
            totalRecords: 1,
            opportunitiesData: [samOpportunity({ noticeId: "n1" })],
          });
        }
        return jsonResponse({ totalRecords: 0, opportunitiesData: [] });
      })
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toEqual([]);
    expect(supabaseMock.upsertedRows.map((r) => r.notice_id)).toEqual(["n1"]);
    expect(supabaseMock.upsertedRows[0].place_of_performance_state).toBe("TX");
    expect(supabaseMock.upsertedRows[0].place_of_performance_zip).toBe("76544");
    expect(supabaseMock.upsertedRows[0].radar_classified_at).toEqual(expect.any(String));

    expect(notifyNewOpportunities).toHaveBeenCalledTimes(1);
    const notified = notifyNewOpportunities.mock.calls[0][0];
    expect(notified.map((o) => o.noticeId)).toEqual(["n1"]);
    expect(body.notified).toBe(1);
  });

  it("does not notify for notice types outside ACTIONABLE_NOTICE_TYPES", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          totalRecords: 1,
          opportunitiesData: [samOpportunity({ noticeId: "award-only", type: "Award Notice" })],
        })
      )
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(supabaseMock.upsertedRows.map((r) => r.notice_id)).toContain("award-only");
    expect(notifyNewOpportunities).toHaveBeenCalledWith([]);
    expect(body.notified).toBe(0);
  });

  it("collects a per-pass error instead of aborting the whole sync", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.searchParams.get("ncode") === "561720") {
          throw new Error("SAM.gov 503");
        }
        return jsonResponse({ totalRecords: 0, opportunitiesData: [] });
      })
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toEqual(["naics 561720: SAM.gov 503"]);
    expect(notifySyncErrors).toHaveBeenCalledWith(["naics 561720: SAM.gov 503"]);
  });

  it("surfaces a digest failure into errors and notifySyncErrors instead of swallowing it", async () => {
    notifyNewOpportunities.mockResolvedValue("digest recipient lookup failed: supabase down");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ totalRecords: 0, opportunitiesData: [] }))
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toEqual(["digest recipient lookup failed: supabase down"]);
    expect(notifySyncErrors).toHaveBeenCalledWith([
      "digest recipient lookup failed: supabase down",
    ]);
  });
});
