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

// Real isAuthorizedRelayRequest runs unmocked (exercised directly via
// SAM_RELAY_SECRET in the tests below); only the Supabase-backed reads and
// writes are replaced here.
vi.mock("@netacracy/bid-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ensureOpportunityScale,
  recordSyncRun: (run: { source: string; upserted: number; errors: string[] }) =>
    recordSyncRun(run),
}));

/** Same fake Supabase query builder as sync-opportunities/route.test.ts --
 * this route runs the identical upsert/notify/expire shape, just fed data
 * that was already fetched (by BidHawk's relay) instead of fetching it
 * itself. */
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

function req(body: unknown, secret = "test-relay-secret") {
  return new NextRequest("http://localhost/api/ingest-opportunities", {
    method: "POST",
    headers: { "x-relay-secret": secret, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ingest-opportunities", () => {
  beforeEach(() => {
    process.env.SAM_RELAY_SECRET = "test-relay-secret";
    supabaseMock = makeSupabaseAdminMock();
    notifyNewOpportunities.mockClear().mockResolvedValue(null);
    notifySyncErrors.mockClear();
    recordSyncRun.mockClear();
    ensureOpportunityScale.mockClear();
  });

  afterEach(() => {
    delete process.env.SAM_RELAY_SECRET;
  });

  it("rejects requests without a matching SAM_RELAY_SECRET", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ items: [] }, "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("upserts already-fetched results and notifies exactly the new ones", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      req({
        items: [
          { naicsCode: "561720", results: [samOpportunity({ noticeId: "n1" })] },
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toEqual([]);
    expect(supabaseMock.upsertedRows.map((r) => r.notice_id)).toEqual(["n1"]);
    expect(supabaseMock.upsertedRows[0].place_of_performance_state).toBe("TX");
    expect(supabaseMock.upsertedRows[0].radar_kind).toBeNull();
    expect(supabaseMock.upsertedRows[0].radar_classified_at).toEqual(expect.any(String));
    expect(notifyNewOpportunities).toHaveBeenCalledTimes(1);
    expect(body.notified).toBe(1);
    expect(body.upserted).toBe(1);
  });

  it("persists a recompete radar signal from the notice title", async () => {
    const { POST } = await import("./route");
    await POST(
      req({
        items: [
          {
            naicsCode: "561720",
            results: [
              samOpportunity({
                noticeId: "recomp-1",
                title: "Installation janitorial recompete",
                type: "Sources Sought",
              }),
            ],
          },
        ],
      })
    );
    expect(supabaseMock.upsertedRows[0].radar_kind).toBe("recompete");
    expect(supabaseMock.upsertedRows[0].radar_source).toBe("title");
  });

  it("dedupes a notice appearing in more than one relayed NAICS batch", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      req({
        items: [
          { naicsCode: "561720", results: [samOpportunity({ noticeId: "n1" })] },
          { naicsCode: "238170", results: [samOpportunity({ noticeId: "n1" })] },
        ],
      })
    );
    const body = await res.json();

    expect(body.notified).toBe(1);
    const notified = notifyNewOpportunities.mock.calls[0][0];
    expect(notified.map((o: { noticeId: string }) => o.noticeId)).toEqual(["n1"]);
  });

  it("surfaces a digest failure into errors and notifySyncErrors", async () => {
    notifyNewOpportunities.mockResolvedValue("digest recipient lookup failed: supabase down");
    const { POST } = await import("./route");
    const res = await POST(req({ items: [] }));
    const body = await res.json();

    expect(body.errors).toEqual(["digest recipient lookup failed: supabase down"]);
    expect(notifySyncErrors).toHaveBeenCalledWith([
      "digest recipient lookup failed: supabase down",
    ]);
  });
});
