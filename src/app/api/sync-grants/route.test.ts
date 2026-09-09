import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const notifyNewGrantAwards = vi.fn(async (_awards: unknown[]) => null as string | null);
const notifyNewFundingOpportunities = vi.fn(async (_opps: unknown[]) => null as string | null);
const notifySyncErrors = vi.fn(async (_errors: string[], _source?: string) => {});

vi.mock("@/lib/notify", () => ({
  notifyNewGrantAwards,
  notifyNewFundingOpportunities,
  notifySyncErrors,
}));

/** Same fake Supabase builder shape as sync-opportunities/route.test.ts:
 * select(...).in(...) for the existing-check, upsert(...) as the write.
 * grant_programs additionally needs a plain select().eq() (no .in()), used
 * once up front to load the active ALN list. grant_awards and
 * grant_funding_opportunities are separate tables with independent id
 * spaces, so each gets its own `existing` set and upsert log -- keyed by
 * the id column each table actually upserts on. */
function makeSupabaseAdminMock(opts: {
  activeAlns?: string[];
  initialExistingAwards?: string[];
  initialExistingFundingOpps?: string[];
}) {
  const idColumnByTable: Record<string, string> = {
    grant_awards: "award_id",
    grant_funding_opportunities: "opportunity_id",
  };
  const existingByTable: Record<string, Set<string>> = {
    grant_awards: new Set(opts.initialExistingAwards ?? []),
    grant_funding_opportunities: new Set(opts.initialExistingFundingOpps ?? []),
  };
  const upsertedRowsByTable: Record<string, Array<Record<string, unknown>>> = {
    grant_awards: [],
    grant_funding_opportunities: [],
  };

  const from = vi.fn((table: string) => {
    if (table === "grant_programs") {
      return {
        select: () => ({
          eq: async () => ({
            data: (opts.activeAlns ?? []).map((aln) => ({ aln })),
            error: null,
          }),
        }),
      };
    }

    const idColumn = idColumnByTable[table];
    const existing = existingByTable[table];
    const upsertedRows = upsertedRowsByTable[table];

    const builder: {
      _cols: string | null;
      select: (cols: string) => typeof builder;
      in: (col: string, vals: string[]) => Promise<{ data: Array<Record<string, string>> }>;
      upsert: (rows: Array<Record<string, unknown>>) => Promise<{ error: null }>;
    } = {
      _cols: null,
      select(cols) {
        builder._cols = cols;
        return builder;
      },
      async in(_col, vals) {
        return { data: vals.filter((v) => existing.has(v)).map((v) => ({ [idColumn]: v })) };
      },
      async upsert(rows) {
        upsertedRows.push(...rows);
        for (const row of rows) existing.add(row[idColumn] as string);
        return { error: null };
      },
    };
    return builder;
  });

  return {
    from,
    upsertedRows: upsertedRowsByTable.grant_awards,
    upsertedFundingOpportunities: upsertedRowsByTable.grant_funding_opportunities,
  };
}

let supabaseMock: ReturnType<typeof makeSupabaseAdminMock>;

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => supabaseMock,
}));

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

function usaspendingAward(overrides: Record<string, unknown>) {
  return {
    generated_internal_id: "award-1",
    "Award ID": "FHWA-STP-2026-05011",
    "Recipient Name": "TEXAS DEPARTMENT OF TRANSPORTATION",
    "Awarding Agency": "Department of Transportation",
    "Award Amount": 21764005,
    "Start Date": "2025-07-04",
    Description: "SURFACE TRANSPORTATION BLOCK GRANT PROGRAM",
    "Recipient Location": { state_name: "Texas", city_name: "AUSTIN", county_name: "TRAVIS" },
    ...overrides,
  };
}

function grantsGovOppHit(overrides: Record<string, unknown>) {
  return {
    id: "360833",
    number: "FHWA-STP-FY26-161",
    title: "Surface Transportation Block Grant Program",
    agency: "DOT/FHWA",
    oppStatus: "posted",
    openDate: "07/20/2026",
    closeDate: "12/05/2026",
    cfdaList: ["20.205"],
    ...overrides,
  };
}

describe("GET /api/sync-grants", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    supabaseMock = makeSupabaseAdminMock({ activeAlns: ["20.205"] });
    notifyNewGrantAwards.mockClear().mockResolvedValue(null);
    notifyNewFundingOpportunities.mockClear().mockResolvedValue(null);
    notifySyncErrors.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CRON_SECRET;
  });

  function authedRequest() {
    return new NextRequest("http://localhost/api/sync-grants", {
      headers: { authorization: "Bearer test-secret" },
    });
  }

  it("rejects requests without a matching CRON_SECRET", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/sync-grants", {
        headers: { authorization: "Bearer wrong" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("upserts a newly-seen award, stamps it with the program ALN, and notifies once", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("usaspending.gov")) {
          return jsonResponse({
            results: [usaspendingAward({})],
            page_metadata: { page: 1, hasNext: false },
          });
        }
        // grants.gov: no open funding opportunities or keyword hits in this test.
        return jsonResponse({ errorcode: 0, data: { hitCount: 0, oppHits: [] } });
      })
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toEqual([]);
    expect(supabaseMock.upsertedRows).toHaveLength(1);
    expect(supabaseMock.upsertedRows[0].program_number).toBe("20.205");
    expect(supabaseMock.upsertedRows[0].recipient_name).toBe(
      "TEXAS DEPARTMENT OF TRANSPORTATION"
    );

    expect(notifyNewGrantAwards).toHaveBeenCalledTimes(1);
    const notified = notifyNewGrantAwards.mock.calls[0][0] as Array<{ recipientName: string }>;
    expect(notified).toHaveLength(1);
    expect(body.notified).toBe(1);
  });

  it("does not re-notify an award that was already upserted on a prior sync", async () => {
    supabaseMock = makeSupabaseAdminMock({
      activeAlns: ["20.205"],
      initialExistingAwards: ["award-1"],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("usaspending.gov")) {
          return jsonResponse({
            results: [usaspendingAward({})],
            page_metadata: { page: 1, hasNext: false },
          });
        }
        return jsonResponse({ errorcode: 0, data: { hitCount: 0, oppHits: [] } });
      })
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(supabaseMock.upsertedRows).toHaveLength(1); // still upserted (refreshes the row)
    expect(notifyNewGrantAwards).toHaveBeenCalledWith([]);
    expect(body.notified).toBe(0);
  });

  it("collects a per-ALN award-search error instead of aborting the whole sync", async () => {
    supabaseMock = makeSupabaseAdminMock({ activeAlns: ["20.205"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("usaspending.gov")) {
          throw new Error("USAspending 503");
        }
        return jsonResponse({ errorcode: 0, data: { hitCount: 0, oppHits: [] } });
      })
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toEqual(["awards 20.205: USAspending 503"]);
    expect(notifySyncErrors).toHaveBeenCalledWith(["awards 20.205: USAspending 503"], "grants");
  });

  it("persists a newly-discovered posted funding opportunity, stamps its ALN, and notifies once", async () => {
    supabaseMock = makeSupabaseAdminMock({ activeAlns: ["20.205"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("usaspending.gov")) {
          return jsonResponse({ results: [], page_metadata: { page: 1, hasNext: false } });
        }
        const body = JSON.parse(String(init?.body));
        if (body.cfda === "20.205") {
          return jsonResponse({ errorcode: 0, data: { oppHits: [grantsGovOppHit({})] } });
        }
        return jsonResponse({ errorcode: 0, data: { hitCount: 0, oppHits: [] } });
      })
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toEqual([]);
    expect(supabaseMock.upsertedFundingOpportunities).toHaveLength(1);
    const row = supabaseMock.upsertedFundingOpportunities[0];
    expect(row.opportunity_id).toBe("360833");
    expect(row.program_number).toBe("20.205");
    // Grants.gov's MM/DD/YYYY is normalized to ISO before hitting a `date` column.
    expect(row.close_date).toBe("2026-12-05");

    expect(notifyNewFundingOpportunities).toHaveBeenCalledTimes(1);
    const notified = notifyNewFundingOpportunities.mock.calls[0][0] as Array<{ title: string }>;
    expect(notified).toHaveLength(1);
    expect(body.fundingOpportunitiesUpserted).toBe(1);
    expect(body.fundingOpportunitiesNotified).toBe(1);
  });

  it("persists but does not notify for an already-closed/archived funding opportunity", async () => {
    supabaseMock = makeSupabaseAdminMock({ activeAlns: ["20.205"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("usaspending.gov")) {
          return jsonResponse({ results: [], page_metadata: { page: 1, hasNext: false } });
        }
        const body = JSON.parse(String(init?.body));
        if (body.cfda === "20.205") {
          return jsonResponse({
            errorcode: 0,
            data: { oppHits: [grantsGovOppHit({ oppStatus: "archived" })] },
          });
        }
        return jsonResponse({ errorcode: 0, data: { hitCount: 0, oppHits: [] } });
      })
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(supabaseMock.upsertedFundingOpportunities).toHaveLength(1); // still persisted
    expect(notifyNewFundingOpportunities).toHaveBeenCalledWith([]); // not actionable
    expect(body.fundingOpportunitiesNotified).toBe(0);
  });

  it("surfaces a digest failure into errors and notifySyncErrors instead of swallowing it", async () => {
    supabaseMock = makeSupabaseAdminMock({ activeAlns: ["20.205"] });
    notifyNewGrantAwards.mockResolvedValue("digest recipient lookup failed: supabase down");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ errorcode: 0, data: { hitCount: 0, oppHits: [] } }))
    );

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errors).toEqual(["digest recipient lookup failed: supabase down"]);
    expect(notifySyncErrors).toHaveBeenCalledWith(
      ["digest recipient lookup failed: supabase down"],
      "grants"
    );
  });
});
