import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const notifySyncErrors = vi.fn(async (_errors: string[], _source: string) => {});
vi.mock("@/lib/notify", () => ({ notifySyncErrors }));

const recordSyncRun = vi.fn(async (_run: { source: string; fetched?: number; upserted: number; errors: string[] }) => {});
vi.mock("@netacracy/bid-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recordSyncRun: (run: { source: string; fetched?: number; upserted: number; errors: string[] }) =>
    recordSyncRun(run),
}));

let fetchResult: { opportunities: Array<{ noticeId: string; title: string }>; errors: string[] } = {
  opportunities: [],
  errors: [],
};
vi.mock("@/lib/gpr", () => ({
  fetchGprOpportunities: () => Promise.resolve(fetchResult),
}));

/** Minimal fake covering exactly what route.ts calls: upsert(...) and
 * update({retired_at}).is("retired_at", null).lt("updated_at", ...). */
function makeSupabaseAdminMock() {
  const upsertedRows: Array<Record<string, unknown>> = [];
  let retireCall: { patch: Record<string, unknown> } | null = null;
  let upsertError: { message: string } | null = null;
  let retireError: { message: string } | null = null;
  let retireCount = 0;

  const from = vi.fn((_table: string) => ({
    async upsert(rows: Array<Record<string, unknown>>) {
      upsertedRows.push(...rows);
      return { error: upsertError, count: upsertError ? null : rows.length };
    },
    update(patch: Record<string, unknown>) {
      retireCall = { patch };
      return {
        is(_col: string, _val: null) {
          return this;
        },
        async lt(_col: string, _val: string) {
          return { count: retireError ? null : retireCount, error: retireError };
        },
      };
    },
  }));

  return {
    from,
    upsertedRows,
    getRetireCall: () => retireCall,
    setUpsertError: (e: { message: string } | null) => (upsertError = e),
    setRetireError: (e: { message: string } | null) => (retireError = e),
    setRetireCount: (n: number) => (retireCount = n),
  };
}

let supabaseMock: ReturnType<typeof makeSupabaseAdminMock>;
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => supabaseMock,
}));

function req() {
  return new NextRequest("https://example.com/api/sync-gpr", {
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("GET /api/sync-gpr", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    supabaseMock = makeSupabaseAdminMock();
    fetchResult = { opportunities: [], errors: [] };
    notifySyncErrors.mockClear();
    recordSyncRun.mockClear();
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("retires rows not touched by a successful fetch", async () => {
    fetchResult = { opportunities: [{ noticeId: "GA-1", title: "Janitorial services" }], errors: [] };
    supabaseMock.setRetireCount(3);
    const { GET } = await import("./route");
    const res = await GET(req());
    const body = await res.json();

    expect(supabaseMock.upsertedRows.map((r) => r.notice_id)).toEqual(["GA-1"]);
    expect(supabaseMock.getRetireCall()).not.toBeNull();
    expect(body.retired).toBe(3);
    expect(body.errors).toEqual([]);
    expect(recordSyncRun).toHaveBeenCalledWith({ source: "gpr", fetched: 1, upserted: 1, errors: [] });
  });

  it("never retires when the fetch itself failed", async () => {
    fetchResult = { opportunities: [], errors: ["gpr catType=Services_SpecialProjects: HTTP 500"] };
    const { GET } = await import("./route");
    const res = await GET(req());
    const body = await res.json();

    expect(supabaseMock.getRetireCall()).toBeNull();
    expect(body.retired).toBe(0);
    expect(notifySyncErrors).toHaveBeenCalled();
  });

  it("never retires when the upsert itself failed", async () => {
    fetchResult = { opportunities: [{ noticeId: "GA-1", title: "Janitorial services" }], errors: [] };
    supabaseMock.setUpsertError({ message: "connection reset" });
    const { GET } = await import("./route");
    const res = await GET(req());
    const body = await res.json();

    expect(supabaseMock.getRetireCall()).toBeNull();
    expect(body.errors).toContain("gpr upsert: connection reset");
  });

  it("skips both upsert and retirement when nothing was fetched and there are no errors", async () => {
    fetchResult = { opportunities: [], errors: [] };
    supabaseMock.setRetireCount(5);
    const { GET } = await import("./route");
    const res = await GET(req());
    const body = await res.json();

    expect(supabaseMock.upsertedRows).toEqual([]);
    expect(supabaseMock.getRetireCall()).not.toBeNull();
    expect(body.retired).toBe(5);
  });
});
