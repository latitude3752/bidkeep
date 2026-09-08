import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@netacracy/bid-core";
import { searchAwardsByProgramNumber, type GrantAward } from "@/lib/usaspending";
import { searchFundingOpportunitiesByAln, type FundingOpportunity } from "@/lib/grants-gov";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  notifyNewFundingOpportunities,
  notifyNewGrantAwards,
  notifySyncErrors,
  type NotifiableFundingOpportunity,
  type NotifiableGrantAward,
} from "@/lib/notify";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Grants.gov opportunity statuses worth alerting on -- a program that's
 * already closed or archived isn't something a customer can still apply to;
 * it should only surface once it has award data (see grant_awards). */
const ACTIONABLE_FUNDING_STATUSES = new Set(["posted", "forecasted"]);

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Registered grant programs to track, admin-managed the same way
 * naics_codes is for SAM.gov contracts. */
async function getActiveGrantProgramAlns(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("grant_programs")
    .select("aln")
    .eq("active", true);
  if (error) throw new Error(`grant_programs query failed: ${error.message}`);
  return (data ?? []).map((r) => r.aln as string);
}

/** Upserts a batch of USAspending awards, tracking which are newly-seen so
 * one notification email covers every ALN searched -- same dedup-across-
 * passes design as sync-opportunities/route.ts: an award_id already upserted
 * earlier in this run (or on a prior sync) is not re-notified. */
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
 * notification covers every ALN searched -- same dedup-across-passes design
 * as upsertAwards: an opportunity_id already
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

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  let upserted = 0;
  const errors: string[] = [];
  const newAwards: NotifiableGrantAward[] = [];
  const alns = await getActiveGrantProgramAlns(supabase);

  // Award pass: who has already been funded under each tracked program.
  for (const aln of alns) {
    try {
      const awards = await searchAwardsByProgramNumber(aln);
      const { upserted: count, error } = await upsertAwards(supabase, awards, aln, newAwards);
      if (error) errors.push(`awards ${aln}: ${error}`);
      upserted += count;
    } catch (err) {
      errors.push(`awards ${aln}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Funding-opportunity pass, per tracked ALN, across every status -- a
  // program moving from posted -> closed -> archived is exactly the signal
  // that its award data (above) is about to start appearing.
  let fundingOpportunitiesUpserted = 0;
  const newFundingOpportunities: NotifiableFundingOpportunity[] = [];
  for (const aln of alns) {
    try {
      const opps = await searchFundingOpportunitiesByAln(aln);
      const { upserted: count, error } = await upsertFundingOpportunities(
        supabase,
        opps,
        aln,
        newFundingOpportunities
      );
      if (error) errors.push(`funding-opp ${aln}: ${error}`);
      fundingOpportunitiesUpserted += count;
    } catch (err) {
      errors.push(`funding-opp ${aln}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const awardsDigestError = await notifyNewGrantAwards(newAwards);
  if (awardsDigestError) errors.push(awardsDigestError);
  const fundingDigestError = await notifyNewFundingOpportunities(newFundingOpportunities);
  if (fundingDigestError) errors.push(fundingDigestError);
  await notifySyncErrors(errors, "grants");

  const result = {
    upserted,
    notified: newAwards.length,
    fundingOpportunitiesUpserted,
    fundingOpportunitiesNotified: newFundingOpportunities.length,
    errors,
    programsChecked: alns,
  };
  if (errors.length > 0) {
    console.error("Grant sync errors:", errors);
  }
  console.log("Grant sync result:", JSON.stringify({
    upserted: result.upserted,
    notified: result.notified,
    fundingOpportunitiesUpserted: result.fundingOpportunitiesUpserted,
    fundingOpportunitiesNotified: result.fundingOpportunitiesNotified,
    errorCount: errors.length,
  }));

  return NextResponse.json(result);
}
