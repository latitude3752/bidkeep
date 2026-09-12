import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest, recordSyncRun } from "@netacracy/bid-core";
import { fetchGprOpportunities } from "@/lib/gpr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notifySyncErrors } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Georgia Procurement Registry sync -- separate cron, separate table,
 * separate error-notification source from both the SAM.gov pipeline and
 * the Bonfire teaser sync, so a GPR outage or format change can never
 * mask (or be masked by) either one's health.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runStartedAt = new Date().toISOString();
  const { opportunities, errors } = await fetchGprOpportunities();

  const admin = getSupabaseAdmin();
  let upserted = 0;
  if (opportunities.length > 0) {
    const rows = opportunities.map((o) => ({
      notice_id: o.noticeId,
      title: o.title,
      agency_name: o.agencyName,
      government_type: o.governmentType,
      status: o.status,
      posting_date: o.postingDate,
      closing_date: o.closingDate,
      bid_process_type: o.bidProcessType,
      sole_source: o.soleSource,
      electronic_bid: o.electronicBid,
      detail_url: o.detailUrl,
      updated_at: new Date().toISOString(),
      // A row can be retired (closed) in one run and legitimately reappear
      // in a later fetch -- GA re-lists amended or extended notices under
      // the same id. Without clearing retired_at here, a reopened listing
      // stays hidden forever behind the .is("retired_at", null) filter every
      // list query uses (Sep 12 audit).
      retired_at: null,
    }));
    const { error, count } = await admin
      .from("gpr_opportunities")
      .upsert(rows, { onConflict: "notice_id", ignoreDuplicates: false, count: "exact" });
    if (error) errors.push(`gpr upsert: ${error.message}`);
    else upserted = count ?? rows.length;
  }

  // GPR's own query only ever returns currently-open listings, so a row's
  // absence from a successful fetch is the only signal that it closed.
  // Never retire on a failed fetch -- errors.length > 0 means we don't
  // actually know what's still open, and treating that like "everything
  // closed" would be worse than the stale row it's meant to fix.
  let retired = 0;
  if (errors.length === 0) {
    const { count, error: retireErr } = await admin
      .from("gpr_opportunities")
      .update({ retired_at: runStartedAt }, { count: "exact" })
      .is("retired_at", null)
      .lt("updated_at", runStartedAt);
    if (retireErr) errors.push(`gpr retire: ${retireErr.message}`);
    else retired = count ?? 0;
  }

  if (errors.length > 0) await notifySyncErrors(errors, "GPR");
  await recordSyncRun({ source: "gpr", fetched: opportunities.length, upserted, errors });

  return NextResponse.json({ fetched: opportunities.length, upserted, retired, errors });
}
