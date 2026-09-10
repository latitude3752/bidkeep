import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@netacracy/bid-core";
import { fetchTxEsbdOpportunities } from "@/lib/tx-esbd";
import { BONFIRE_FACILITIES_KEYWORDS } from "@/lib/bonfire";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notifySyncErrors } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 280;

/**
 * Texas Electronic State Business Daily sync -- separate cron, separate
 * table, separate error-notification source from the SAM.gov, Bonfire,
 * and GPR pipelines, so an ESBD outage or format change can never mask
 * (or be masked by) any of the others' health.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { opportunities, errors } = await fetchTxEsbdOpportunities(BONFIRE_FACILITIES_KEYWORDS);

  const admin = getSupabaseAdmin();
  let upserted = 0;
  if (opportunities.length > 0) {
    const rows = opportunities.map((o) => ({
      notice_id: o.noticeId,
      title: o.title,
      agency_name: o.agencyName,
      status_name: o.statusName,
      posting_date: o.postingDate,
      response_due: o.responseDue,
      response_time: o.responseTime,
      nigp_codes: o.nigpCodes,
      detail_url: o.detailUrl,
      updated_at: new Date().toISOString(),
    }));
    const { error, count } = await admin
      .from("tx_esbd_opportunities")
      .upsert(rows, { onConflict: "notice_id", ignoreDuplicates: false, count: "exact" });
    if (error) errors.push(`tx-esbd upsert: ${error.message}`);
    else upserted = count ?? rows.length;
  }

  if (errors.length > 0) await notifySyncErrors(errors, "TX ESBD");

  return NextResponse.json({ fetched: opportunities.length, upserted, errors });
}
