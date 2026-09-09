import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest, lastSuccessfulSyncRun } from "@netacracy/bid-core";
import { notifySyncErrors } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Same buffer as the /admin/sync-status staleness banner -- a full cron
 * cycle (24h) plus headroom for a slow run, not a hair-trigger. */
const STALE_HOURS = 30;

/** Runs once a day, well after BidHawk's relay should have pushed today's
 * data, and emails the founder if nothing succeeded recently -- catching a
 * silently broken relay (or this app's own fallback cron, if ever used) in
 * a day instead of however long it takes someone to notice the pipeline
 * looks thin. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const last = await lastSuccessfulSyncRun();
  const ageHours = last ? (Date.now() - new Date(last.ran_at).getTime()) / 3_600_000 : Infinity;
  const stale = ageHours > STALE_HOURS;

  if (stale) {
    const message = last
      ? `No error-free SAM.gov sync run in ${Math.round(ageHours)}h (last success was ${Math.round(ageHours)}h ago). Check /admin/sync-status and BidHawk's relay.`
      : "No error-free SAM.gov sync run has ever been recorded. Check /admin/sync-status and BidHawk's relay.";
    await notifySyncErrors([message], "sync freshness check");
  }

  return NextResponse.json({ stale, lastSuccessAgeHours: last ? Math.round(ageHours) : null });
}
