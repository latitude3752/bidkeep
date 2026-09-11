import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest, recordSyncRun } from "@netacracy/bid-core";
import { fetchAllBonfireOpportunities } from "@/lib/bonfire";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notifySyncErrors } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * State/local procurement teaser sync (Bonfire preview search).
 * Separate cron, separate table, separate error-notification source from
 * the SAM.gov pipeline -- a Bonfire outage or format change should never
 * mask (or be masked by) SAM.gov sync health.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { opportunities, errors } = await fetchAllBonfireOpportunities();

  const admin = getSupabaseAdmin();
  let upserted = 0;
  if (opportunities.length > 0) {
    const rows = opportunities.map((o) => ({
      dedup_key: o.dedupKey,
      title: o.title,
      state: o.state,
      status_id: o.statusId,
      date_open: o.dateOpen,
      date_close: o.dateClose,
      search_url: o.searchUrl,
      updated_at: new Date().toISOString(),
    }));
    const { error, count } = await admin
      .from("bonfire_opportunities")
      .upsert(rows, { onConflict: "dedup_key", ignoreDuplicates: false, count: "exact" });
    if (error) errors.push(`bonfire upsert: ${error.message}`);
    else upserted = count ?? rows.length;
  }

  if (errors.length > 0) await notifySyncErrors(errors, "Bonfire");
  await recordSyncRun({ source: "bonfire", fetched: opportunities.length, upserted, errors });

  return NextResponse.json({ fetched: opportunities.length, upserted, errors });
}
