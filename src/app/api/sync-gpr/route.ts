import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@netacracy/bid-core";
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
    }));
    const { error, count } = await admin
      .from("gpr_opportunities")
      .upsert(rows, { onConflict: "notice_id", ignoreDuplicates: false, count: "exact" });
    if (error) errors.push(`gpr upsert: ${error.message}`);
    else upserted = count ?? rows.length;
  }

  if (errors.length > 0) await notifySyncErrors(errors, "GPR");

  return NextResponse.json({ fetched: opportunities.length, upserted, errors });
}
