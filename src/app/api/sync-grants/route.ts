import { after, NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@netacracy/bid-core";
import { searchAwardPageByProgramNumber, type GrantAward } from "@/lib/usaspending";
import { searchFundingOpportunitiesByAln, type FundingOpportunity } from "@/lib/grants-gov";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  notifyNewFundingOpportunities,
  notifyNewGrantAwards,
  notifySyncErrors,
  type NotifiableFundingOpportunity,
  type NotifiableGrantAward,
} from "@/lib/notify";
import {
  GRANT_SYNC_MAX_CONTINUE_CHUNKS,
  GRANT_SYNC_MAX_DURATION_SECONDS,
  grantSyncBudgetMs,
  parseGrantSyncChunk,
  parseGrantSyncCursor,
  runGrantSyncChunk,
  serializeGrantSyncCursor,
  sortGrantProgramAlns,
  type GrantSyncCursor,
} from "@/lib/grant-sync";
import {
  checkpointRowToCursor,
  isGrantSyncLockFresh,
  loadGrantSyncCheckpoint,
  markGrantSyncInProgress,
  saveGrantSyncCheckpoint,
} from "@/lib/grant-sync-checkpoint";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Grants.gov opportunity statuses worth alerting on -- a program that's
 * already closed or archived isn't something a customer can still apply to;
 * it should only surface once it has award data (see grant_awards). */
const ACTIONABLE_FUNDING_STATUSES = new Set(["posted", "forecasted"]);

export const dynamic = "force-dynamic";
export const maxDuration = GRANT_SYNC_MAX_DURATION_SECONDS;

/** Registered grant programs to track, admin-managed the same way
 * naics_codes is for SAM.gov contracts. */
async function getActiveGrantProgramAlns(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("grant_programs")
    .select("aln")
    .eq("active", true);
  if (error) throw new Error(`grant_programs query failed: ${error.message}`);
  return sortGrantProgramAlns((data ?? []).map((r) => r.aln as string));
}

/** Upserts a batch of USAspending awards, tracking which are newly-seen so
 * one notification email covers every ALN searched in this invocation --
 * same dedup-across-passes design as sync-opportunities/route.ts: an
 * award_id already upserted earlier in this run (or on a prior sync) is
 * not re-notified. */
async function upsertAwards(
  supabase: SupabaseClient,
  awards: GrantAward[],
  programNumber: string,
  newAwards: NotifiableGrantAward[]
): Promise<{ upserted: number; error?: string }> {
  if (awards.length === 0) return { upserted: 0 };

  const awardIds = awards.map((a) => a.awardId);
  const { data: existing } = await supabase
    .from("grant_awards")
    .select("award_id")
    .in("award_id", awardIds);
  const existingIds = new Set((existing ?? []).map((r) => r.award_id));

  const rows = awards.map((a) => ({
    award_id: a.awardId,
    award_number: a.awardNumber,
    recipient_name: a.recipientName,
    awarding_agency: a.awardingAgency,
    amount: a.amount,
    start_date: a.startDate,
    description: a.description,
    program_number: programNumber,
    state: a.state,
    county: a.county,
    city: a.city,
    raw_data: a,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("grant_awards")
    .upsert(rows, { onConflict: "award_id", ignoreDuplicates: false });

  if (error) return { upserted: 0, error: error.message };

  for (const row of rows) {
    if (!existingIds.has(row.award_id)) {
      newAwards.push({
        recipientName: row.recipient_name,
        awardingAgency: row.awarding_agency,
        amount: row.amount,
        state: row.state,
        programNumber: row.program_number,
      });
    }
  }

  return { upserted: rows.length };
}

/** Upserts a batch of Grants.gov funding opportunities, tracking which are
 * newly-seen AND currently actionable (posted/forecasted) so one
 * notification covers every ALN searched in this invocation -- same
 * dedup-across-passes design as upsertAwards: an opportunity_id already
 * upserted earlier in this run (or on a prior sync) is not re-notified, even
 * if its status has since changed (e.g. reopened after being archived). */
async function upsertFundingOpportunities(
  supabase: SupabaseClient,
  opportunities: FundingOpportunity[],
  programNumber: string | null,
  newOpportunities: NotifiableFundingOpportunity[]
): Promise<{ upserted: number; error?: string }> {
  if (opportunities.length === 0) return { upserted: 0 };

  const oppIds = opportunities.map((o) => o.id);
  const { data: existing } = await supabase
    .from("grant_funding_opportunities")
    .select("opportunity_id")
    .in("opportunity_id", oppIds);
  const existingIds = new Set((existing ?? []).map((r) => r.opportunity_id));

  const rows = opportunities.map((o) => ({
    opportunity_id: o.id,
    opportunity_number: o.number,
    title: o.title,
    agency: o.agency,
    program_number: programNumber ?? o.alnList[0] ?? null,
    open_date: o.openDate,
    close_date: o.closeDate,
    status: o.status,
    raw_data: o,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("grant_funding_opportunities")
    .upsert(rows, { onConflict: "opportunity_id", ignoreDuplicates: false });

  if (error) return { upserted: 0, error: error.message };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!existingIds.has(row.opportunity_id) && ACTIONABLE_FUNDING_STATUSES.has(row.status ?? "")) {
      newOpportunities.push({
        title: row.title,
        agency: row.agency,
        opportunityUrl: opportunities[i].opportunityUrl,
        closeDate: row.close_date,
        programNumber: row.program_number,
      });
    }
  }

  return { upserted: rows.length };
}

function emptyResult(extra: Record<string, unknown> = {}) {
  return {
    upserted: 0,
    notified: 0,
    fundingOpportunitiesUpserted: 0,
    fundingOpportunitiesNotified: 0,
    errors: [] as string[],
    programsChecked: [] as string[],
    complete: true,
    continued: false,
    nextCursor: null as string | null,
    ...extra,
  };
}

/** Kick off the next chunk as its own invocation. Do not await the child
 * body -- that would keep this isolate alive for another full budget and
 * risk a 504. A short delay is enough for the request to leave; aborting
 * the client afterwards does not stop the child once it has started. */
function scheduleGrantSyncContinue(url: string, authorization: string): void {
  after(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    return fetch(url, {
      headers: { authorization },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => res.body?.cancel())
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Grant sync continue failed:", err);
      })
      .finally(() => clearTimeout(timer));
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const force = request.nextUrl.searchParams.get("force") === "1";
  const urlCursor = parseGrantSyncCursor(request.nextUrl.searchParams.get("cursor"));
  const chunk = parseGrantSyncChunk(request.nextUrl.searchParams.get("chunk"));

  if (!urlCursor && !force) {
    const stored = await loadGrantSyncCheckpoint(supabase);
    if (stored?.pass === "done") {
      return NextResponse.json(emptyResult({ skipped: "already-completed-today" }));
    }
    if (isGrantSyncLockFresh(stored?.locked_at)) {
      return NextResponse.json(emptyResult({ skipped: "in-progress" }));
    }
  }

  const stored = urlCursor ? null : await loadGrantSyncCheckpoint(supabase);
  const cursor: GrantSyncCursor | null =
    urlCursor ?? (stored && stored.pass !== "done" ? checkpointRowToCursor(stored) : null);

  await markGrantSyncInProgress(supabase);

  const newAwards: NotifiableGrantAward[] = [];
  const newFundingOpportunities: NotifiableFundingOpportunity[] = [];
  const alns = await getActiveGrantProgramAlns(supabase);
  const started = Date.now();

  const chunkResult = await runGrantSyncChunk({
    alns,
    cursor,
    deadlineMs: started + grantSyncBudgetMs(),
    searchFunding: searchFundingOpportunitiesByAln,
    searchAwardPage: searchAwardPageByProgramNumber,
    upsertFunding: (opps, aln) =>
      upsertFundingOpportunities(supabase, opps, aln, newFundingOpportunities),
    upsertAwards: (awards, aln) => upsertAwards(supabase, awards, aln, newAwards),
    onProgress: (next) => saveGrantSyncCheckpoint(supabase, next),
  });

  const errors = [...chunkResult.errors];
  const awardsDigestError = await notifyNewGrantAwards(newAwards);
  if (awardsDigestError) errors.push(awardsDigestError);
  const fundingDigestError = await notifyNewFundingOpportunities(newFundingOpportunities);
  if (fundingDigestError) errors.push(fundingDigestError);
  await notifySyncErrors(errors, "grants");

  let continued = false;
  const canContinue =
    !chunkResult.complete &&
    chunkResult.nextCursor !== null &&
    chunk < GRANT_SYNC_MAX_CONTINUE_CHUNKS;

  if (canContinue && chunkResult.nextCursor) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.searchParams.set("cursor", serializeGrantSyncCursor(chunkResult.nextCursor));
    nextUrl.searchParams.set("chunk", String(chunk + 1));
    nextUrl.searchParams.delete("force");
    const authorization = request.headers.get("authorization");
    if (authorization) {
      scheduleGrantSyncContinue(nextUrl.toString(), authorization);
      continued = true;
    } else {
      errors.push("grant sync continue skipped: missing Authorization header");
    }
  } else if (!chunkResult.complete && chunk >= GRANT_SYNC_MAX_CONTINUE_CHUNKS) {
    errors.push(
      `grant sync stopped after ${GRANT_SYNC_MAX_CONTINUE_CHUNKS} continuation chunks; 14:50 cron will resume`
    );
  }

  const result = {
    upserted: chunkResult.upserted,
    notified: newAwards.length,
    fundingOpportunitiesUpserted: chunkResult.fundingOpportunitiesUpserted,
    fundingOpportunitiesNotified: newFundingOpportunities.length,
    errors,
    programsChecked: chunkResult.programsTouched,
    complete: chunkResult.complete,
    continued,
    nextCursor: chunkResult.nextCursor ? serializeGrantSyncCursor(chunkResult.nextCursor) : null,
    chunk,
  };
  if (errors.length > 0) {
    console.error("Grant sync errors:", errors);
  }
  console.log(
    "Grant sync result:",
    JSON.stringify({
      upserted: result.upserted,
      notified: result.notified,
      fundingOpportunitiesUpserted: result.fundingOpportunitiesUpserted,
      fundingOpportunitiesNotified: result.fundingOpportunitiesNotified,
      errorCount: errors.length,
      complete: result.complete,
      continued: result.continued,
      nextCursor: result.nextCursor,
      chunk: result.chunk,
    })
  );

  return NextResponse.json(result);
}
