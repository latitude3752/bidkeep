/**
 * Time-budgeted grant sync planner.
 *
 * Production `/api/sync-grants` used to do every active ALN's USAspending
 * pull (up to 10 sequential pages each) and only then Grants.gov. With 6
 * programs that wall-clock regularly exceeded `maxDuration = 120`, so
 * Vercel returned 504 and the funding-opportunity pass never ran.
 *
 * Work is now a queue of small units (one Grants.gov ALN, or one
 * USAspending page) that stop before the function deadline. Funding runs
 * first so a long awards pull cannot starve FO refresh. The next unit is
 * a cursor the route persists and/or follows in a continuation request.
 */

/** Leave headroom inside the route's `maxDuration = 300` for digest mail
 * + JSON response so the invocation returns 200 instead of being killed
 * mid-upsert. Next.js requires that segment config to be a literal. */
export const GRANT_SYNC_DEFAULT_BUDGET_MS = 240_000;

export const GRANT_SYNC_MAX_CONTINUE_CHUNKS = 20;

export type GrantSyncPass = "funding" | "awards";

export type GrantSyncCursor = {
  pass: GrantSyncPass;
  aln: string;
  /** 1-based USAspending page; ignored for the funding pass. */
  awardPage: number;
};

export function grantSyncBudgetMs(): number {
  const raw = process.env.GRANT_SYNC_BUDGET_MS;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return GRANT_SYNC_DEFAULT_BUDGET_MS;
}

export function serializeGrantSyncCursor(cursor: GrantSyncCursor): string {
  if (cursor.pass === "funding") return `funding:${cursor.aln}`;
  return `awards:${cursor.aln}:${cursor.awardPage}`;
}

export function parseGrantSyncCursor(raw: string | null | undefined): GrantSyncCursor | null {
  if (!raw) return null;
  const parts = raw.split(":");
  const pass = parts[0];
  const aln = parts[1];
  if (!aln) return null;
  if (pass === "funding") return { pass: "funding", aln, awardPage: 1 };
  if (pass === "awards") {
    const awardPage = Number(parts[2] ?? "1");
    if (!Number.isInteger(awardPage) || awardPage < 1) return null;
    return { pass: "awards", aln, awardPage };
  }
  return null;
}

export function parseGrantSyncChunk(raw: string | null | undefined): number {
  const n = Number(raw ?? "0");
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Stable ALN order so a cursor index from an earlier invocation still
 * points at the same program if the admin list is unchanged. */
export function sortGrantProgramAlns(alns: string[]): string[] {
  return [...alns].sort((a, b) => a.localeCompare(b));
}

export function resolveGrantSyncStartIndex(alns: string[], cursor: GrantSyncCursor | null): number {
  if (!cursor) return 0;
  const idx = alns.indexOf(cursor.aln);
  return idx === -1 ? 0 : idx;
}

export type GrantSyncAwardPage = {
  awards: unknown[];
  hasNext: boolean;
};

export type GrantSyncChunkDeps<TFunding, TAward> = {
  alns: string[];
  cursor: GrantSyncCursor | null;
  deadlineMs: number;
  now?: () => number;
  searchFunding: (aln: string) => Promise<TFunding[]>;
  searchAwardPage: (aln: string, page: number) => Promise<GrantSyncAwardPage & { awards: TAward[] }>;
  upsertFunding: (opps: TFunding[], aln: string) => Promise<{ upserted: number; error?: string }>;
  upsertAwards: (awards: TAward[], aln: string) => Promise<{ upserted: number; error?: string }>;
  /** Called after each finished unit with the cursor for the next unit
   * (or null when the sweep is complete) so the route can persist resume
   * state before starting another slow API call. */
  onProgress?: (next: GrantSyncCursor | null) => Promise<void>;
};

export type GrantSyncChunkResult = {
  upserted: number;
  fundingOpportunitiesUpserted: number;
  errors: string[];
  complete: boolean;
  nextCursor: GrantSyncCursor | null;
  programsTouched: string[];
};

function nextAfterFunding(alns: string[], alnIndex: number): GrantSyncCursor | null {
  if (alnIndex + 1 < alns.length) {
    return { pass: "funding", aln: alns[alnIndex + 1], awardPage: 1 };
  }
  if (alns.length === 0) return null;
  return { pass: "awards", aln: alns[0], awardPage: 1 };
}

function nextAfterAwardPage(
  alns: string[],
  alnIndex: number,
  page: number,
  hasNext: boolean
): GrantSyncCursor | null {
  if (hasNext) {
    return { pass: "awards", aln: alns[alnIndex], awardPage: page + 1 };
  }
  if (alnIndex + 1 < alns.length) {
    return { pass: "awards", aln: alns[alnIndex + 1], awardPage: 1 };
  }
  return null;
}

export async function runGrantSyncChunk<TFunding, TAward>(
  deps: GrantSyncChunkDeps<TFunding, TAward>
): Promise<GrantSyncChunkResult> {
  const now = deps.now ?? Date.now;
  const alns = sortGrantProgramAlns(deps.alns);
  const errors: string[] = [];
  const programsTouched: string[] = [];
  let upserted = 0;
  let fundingOpportunitiesUpserted = 0;
  let processedAny = false;

  const shouldStop = () => processedAny && now() >= deps.deadlineMs;

  const touch = (aln: string) => {
    if (!programsTouched.includes(aln)) programsTouched.push(aln);
  };

  const persist = async (next: GrantSyncCursor | null) => {
    if (!deps.onProgress) return;
    try {
      await deps.onProgress(next);
    } catch (err) {
      errors.push(
        `checkpoint: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  if (alns.length === 0) {
    await persist(null);
    return {
      upserted: 0,
      fundingOpportunitiesUpserted: 0,
      errors,
      complete: true,
      nextCursor: null,
      programsTouched,
    };
  }

  let pass: GrantSyncPass = deps.cursor?.pass ?? "funding";
  let alnIndex = resolveGrantSyncStartIndex(alns, deps.cursor);
  let awardPage = deps.cursor?.pass === "awards" ? deps.cursor.awardPage : 1;

  if (pass === "funding") {
    for (let i = alnIndex; i < alns.length; i++) {
      if (shouldStop()) {
        const nextCursor = { pass: "funding" as const, aln: alns[i], awardPage: 1 };
        return {
          upserted,
          fundingOpportunitiesUpserted,
          errors,
          complete: false,
          nextCursor,
          programsTouched,
        };
      }
      const aln = alns[i];
      try {
        const opps = await deps.searchFunding(aln);
        const { upserted: count, error } = await deps.upsertFunding(opps, aln);
        if (error) errors.push(`funding-opp ${aln}: ${error}`);
        fundingOpportunitiesUpserted += count;
      } catch (err) {
        errors.push(`funding-opp ${aln}: ${err instanceof Error ? err.message : String(err)}`);
      }
      processedAny = true;
      touch(aln);
      const next = nextAfterFunding(alns, i);
      await persist(next);
    }
    pass = "awards";
    alnIndex = 0;
    awardPage = 1;
  }

  for (let i = alnIndex; i < alns.length; i++) {
    let page = i === alnIndex ? awardPage : 1;
    while (true) {
      if (shouldStop()) {
        const nextCursor = { pass: "awards" as const, aln: alns[i], awardPage: page };
        return {
          upserted,
          fundingOpportunitiesUpserted,
          errors,
          complete: false,
          nextCursor,
          programsTouched,
        };
      }
      const aln = alns[i];
      try {
        const { awards, hasNext } = await deps.searchAwardPage(aln, page);
        const { upserted: count, error } = await deps.upsertAwards(awards, aln);
        if (error) errors.push(`awards ${aln}: ${error}`);
        upserted += count;
        processedAny = true;
        touch(aln);
        const next = nextAfterAwardPage(alns, i, page, hasNext);
        await persist(next);
        if (!hasNext) break;
        page += 1;
      } catch (err) {
        errors.push(`awards ${aln}: ${err instanceof Error ? err.message : String(err)}`);
        processedAny = true;
        touch(aln);
        const next = nextAfterAwardPage(alns, i, page, false);
        await persist(next);
        break;
      }
    }
  }

  return {
    upserted,
    fundingOpportunitiesUpserted,
    errors,
    complete: true,
    nextCursor: null,
    programsTouched,
  };
}
