import { describe, expect, it, vi } from "vitest";
import {
  parseGrantSyncChunk,
  parseGrantSyncCursor,
  runGrantSyncChunk,
  serializeGrantSyncCursor,
  sortGrantProgramAlns,
} from "./grant-sync";

describe("grant sync cursor", () => {
  it("round-trips funding and awards cursors", () => {
    const funding = { pass: "funding" as const, aln: "14.218", awardPage: 1 };
    const awards = { pass: "awards" as const, aln: "81.041", awardPage: 3 };
    expect(parseGrantSyncCursor(serializeGrantSyncCursor(funding))).toEqual(funding);
    expect(parseGrantSyncCursor(serializeGrantSyncCursor(awards))).toEqual(awards);
  });

  it("rejects malformed cursors", () => {
    expect(parseGrantSyncCursor(null)).toBeNull();
    expect(parseGrantSyncCursor("funding")).toBeNull();
    expect(parseGrantSyncCursor("awards:14.218:0")).toBeNull();
    expect(parseGrantSyncCursor("other:14.218")).toBeNull();
  });

  it("parses the continuation chunk counter", () => {
    expect(parseGrantSyncChunk(null)).toBe(0);
    expect(parseGrantSyncChunk("3")).toBe(3);
    expect(parseGrantSyncChunk("-1")).toBe(0);
  });

  it("sorts ALNs so resume order is stable", () => {
    expect(sortGrantProgramAlns(["81.041", "10.766", "14.218"])).toEqual([
      "10.766",
      "14.218",
      "81.041",
    ]);
  });
});

describe("runGrantSyncChunk", () => {
  const alns = ["14.872", "10.766"];

  function deps(overrides: {
    now?: () => number;
    deadlineMs?: number;
    cursor?: Parameters<typeof runGrantSyncChunk>[0]["cursor"];
    searchFunding?: (aln: string) => Promise<string[]>;
    searchAwardPage?: (
      aln: string,
      page: number
    ) => Promise<{ awards: string[]; hasNext: boolean }>;
    onProgress?: (next: ReturnType<typeof parseGrantSyncCursor>) => Promise<void>;
  }) {
    const fundingCalls: string[] = [];
    const awardCalls: Array<{ aln: string; page: number }> = [];
    const progress: Array<ReturnType<typeof parseGrantSyncCursor>> = [];

    return {
      fundingCalls,
      awardCalls,
      progress,
      run: () =>
        runGrantSyncChunk({
          alns,
          cursor: overrides.cursor ?? null,
          deadlineMs: overrides.deadlineMs ?? Number.POSITIVE_INFINITY,
          now: overrides.now ?? (() => 0),
          searchFunding: async (aln) => {
            fundingCalls.push(aln);
            return overrides.searchFunding ? overrides.searchFunding(aln) : [`fo-${aln}`];
          },
          searchAwardPage: async (aln, page) => {
            awardCalls.push({ aln, page });
            if (overrides.searchAwardPage) return overrides.searchAwardPage(aln, page);
            return { awards: [`aw-${aln}-${page}`], hasNext: false };
          },
          upsertFunding: async (opps) => ({ upserted: opps.length }),
          upsertAwards: async (awards) => ({ upserted: awards.length }),
          onProgress: async (next) => {
            progress.push(next);
            await overrides.onProgress?.(next);
          },
        }),
    };
  }

  it("runs every funding ALN before any awards page", async () => {
    const order: string[] = [];
    const result = await runGrantSyncChunk({
      alns,
      cursor: null,
      deadlineMs: Number.POSITIVE_INFINITY,
      searchFunding: async (aln) => {
        order.push(`funding:${aln}`);
        return [];
      },
      searchAwardPage: async (aln, page) => {
        order.push(`awards:${aln}:${page}`);
        return { awards: [], hasNext: false };
      },
      upsertFunding: async () => ({ upserted: 0 }),
      upsertAwards: async () => ({ upserted: 0 }),
    });

    expect(result.complete).toBe(true);
    expect(order).toEqual([
      "funding:10.766",
      "funding:14.872",
      "awards:10.766:1",
      "awards:14.872:1",
    ]);
  });

  it("stops before the next unit once the deadline has passed, after making progress", async () => {
    let t = 0;
    const ctx = deps({
      now: () => t,
      deadlineMs: 50,
      searchFunding: async () => {
        t += 80;
        return ["fo"];
      },
    });

    const result = await ctx.run();

    expect(result.complete).toBe(false);
    expect(ctx.fundingCalls).toEqual(["10.766"]);
    expect(ctx.awardCalls).toEqual([]);
    expect(result.nextCursor).toEqual({ pass: "funding", aln: "14.872", awardPage: 1 });
    expect(result.fundingOpportunitiesUpserted).toBe(1);
  });

  it("resumes awards without re-fetching funding already completed", async () => {
    const ctx = deps({
      cursor: { pass: "awards", aln: "14.872", awardPage: 2 },
      searchAwardPage: async (aln, page) => ({
        awards: [`${aln}-${page}`],
        hasNext: false,
      }),
    });

    const result = await ctx.run();

    expect(ctx.fundingCalls).toEqual([]);
    expect(ctx.awardCalls).toEqual([{ aln: "14.872", page: 2 }]);
    expect(result.complete).toBe(true);
    expect(result.upserted).toBe(1);
  });

  it("advances the cursor to the next awards page when hasNext is true", async () => {
    let t = 0;
    const ctx = deps({
      cursor: { pass: "awards", aln: "10.766", awardPage: 1 },
      now: () => t,
      deadlineMs: 50,
      searchAwardPage: async (aln, page) => {
        t += 80;
        return { awards: [`${aln}-${page}`], hasNext: page < 2 };
      },
    });

    const result = await ctx.run();

    expect(result.complete).toBe(false);
    expect(ctx.awardCalls).toEqual([{ aln: "10.766", page: 1 }]);
    expect(result.nextCursor).toEqual({ pass: "awards", aln: "10.766", awardPage: 2 });
  });

  it("collects a per-ALN error and continues the sweep", async () => {
    const result = await runGrantSyncChunk({
      alns,
      cursor: null,
      deadlineMs: Number.POSITIVE_INFINITY,
      searchFunding: async (aln) => {
        if (aln === "10.766") throw new Error("Grants.gov 503");
        return [];
      },
      searchAwardPage: async () => ({ awards: [], hasNext: false }),
      upsertFunding: async () => ({ upserted: 0 }),
      upsertAwards: async () => ({ upserted: 0 }),
    });

    expect(result.complete).toBe(true);
    expect(result.errors).toEqual(["funding-opp 10.766: Grants.gov 503"]);
  });

  it("persists the next cursor after each finished unit", async () => {
    const ctx = deps({});
    await ctx.run();
    expect(ctx.progress).toEqual([
      { pass: "funding", aln: "14.872", awardPage: 1 },
      { pass: "awards", aln: "10.766", awardPage: 1 },
      { pass: "awards", aln: "14.872", awardPage: 1 },
      null,
    ]);
  });
});
