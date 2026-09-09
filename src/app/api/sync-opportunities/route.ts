import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedCronRequest,
  opportunitySearchWindow,
  searchOpportunitiesByNaics,
  SamGovQuotaExceededError,
  getActiveNaicsCodes,
  ensureOpportunityScale,
  recordSyncRun,
  type SamGovOpportunity,
} from "@netacracy/bid-core";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ACTIONABLE_NOTICE_TYPES, classifyAcquisitionType } from "@/lib/opportunities";
import { notifyNewOpportunities, notifySyncErrors, type NotifiableOpportunity } from "@/lib/notify";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Scale classification for a single newly-discovered opportunity is a
 * network round trip (fetch description) plus text parsing -- bound how
 * many run eagerly per sync so a busy day can't blow past maxDuration.
 * Anything past this cap still gets classified lazily the first time its
 * detail page is opened. */
const MAX_EAGER_ENRICH = 15;

function formatCeiling(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** A new-opportunity email candidate before eager scale enrichment fills in
 * scaleLabel (or leaves it null, for opportunities past the eager cap). */
type PendingNotification = NotifiableOpportunity & { noticeId: string };

/** Upserts a batch of SAM.gov results and tracks which are newly-discovered
 * and actionable, so a single new-opportunity email covers every search pass
 * (NAICS + set-aside + keyword). */
async function upsertResults(
  supabase: SupabaseClient,
  results: SamGovOpportunity[],
  fallbackNaicsCode: string | null,
  newOpportunities: PendingNotification[]
): Promise<{ upserted: number; error?: string }> {
  if (results.length === 0) return { upserted: 0 };

  const noticeIds = results.map((op) => op.noticeId);
  const { data: existing } = await supabase
    .from("opportunities")
    .select("notice_id")
    .in("notice_id", noticeIds);
  const existingIds = new Set((existing ?? []).map((r) => r.notice_id));

  const rows = results.map((op) => ({
    notice_id: op.noticeId,
    title: op.title,
    agency: op.fullParentPathName,
    naics_code: op.naicsCode ?? fallbackNaicsCode,
    set_aside_type: op.typeOfSetAsideDescription ?? op.setAsideCode,
    response_deadline: op.responseDeadLine || null,
    notice_url: op.uiLink,
    notice_type: op.type ?? null,
    psc_code: op.classificationCode ?? null,
    acquisition_type: classifyAcquisitionType(op.classificationCode),
    place_of_performance_state: op.placeOfPerformance?.state?.code ?? null,
    place_of_performance_zip: op.placeOfPerformance?.zip ?? null,
    raw_data: op,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("opportunities")
    .upsert(rows, { onConflict: "notice_id", ignoreDuplicates: false });

  if (error) return { upserted: 0, error: error.message };

  for (const row of rows) {
    if (!existingIds.has(row.notice_id) && ACTIONABLE_NOTICE_TYPES.includes(row.notice_type ?? "")) {
      newOpportunities.push({
        noticeId: row.notice_id,
        title: row.title,
        agency: row.agency,
        noticeUrl: row.notice_url,
        responseDeadline: row.response_deadline,
        naicsCode: row.naics_code,
        scaleLabel: null,
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
  const newOpportunities: PendingNotification[] = [];
  const registeredNaicsCodes = (await getActiveNaicsCodes()).map((c) => c.code);
  // Response deadlines from today through +90 days; posted lookback is 1 year
  // (SAM.gov's max postedFrom/postedTo span) so older still-open notices land.
  const deadlineWindow = opportunitySearchWindow();

  // Facilities NAICS codes (561210/561720/561730/561612 and adjacents)
  // name the work directly, so the NAICS search alone is the signal; no
  // title-relevance filter or wide-net keyword pass needed.
  for (const naicsCode of registeredNaicsCodes) {
    try {
      const results = await searchOpportunitiesByNaics(naicsCode);
      const { upserted: count, error } = await upsertResults(
        supabase,
        results,
        naicsCode,
        newOpportunities
      );
      if (error) errors.push(`naics ${naicsCode}: ${error}`);
      upserted += count;
    } catch (err) {
      errors.push(`naics ${naicsCode}: ${err instanceof Error ? err.message : String(err)}`);
      // The quota resets once a day -- every remaining NAICS code would fail
      // the same way, so stop instead of burning a doomed request per code.
      if (err instanceof SamGovQuotaExceededError) break;
    }
  }

  // Eagerly classify scale (BPA/IDIQ + ceiling) for brand-new opportunities,
  // up to MAX_EAGER_ENRICH, so the alert email and the pipeline list already
  // show it instead of "—" until someone happens to open each one.
  const toEnrich = newOpportunities.slice(0, MAX_EAGER_ENRICH);

  if (toEnrich.length > 0) {
    const { data: idRows } = await supabase
      .from("opportunities")
      .select("id, notice_id")
      .in(
        "notice_id",
        toEnrich.map((op) => op.noticeId)
      );
    const idByNoticeId = new Map((idRows ?? []).map((r) => [r.notice_id as string, r.id as string]));
    const byNoticeId = new Map(newOpportunities.map((op) => [op.noticeId, op]));

    for (const op of toEnrich) {
      const oppId = idByNoticeId.get(op.noticeId);
      if (!oppId) continue;
      try {
        const { scale } = await ensureOpportunityScale(oppId);
        const target = byNoticeId.get(op.noticeId);
        if (!target) continue;

        if (scale.programType || scale.estimatedCeiling !== null) {
          const kind = scale.programType?.toUpperCase() ?? null;
          const ceiling = scale.estimatedCeiling !== null ? formatCeiling(scale.estimatedCeiling) : null;
          target.scaleLabel = [kind, ceiling ? `ceiling ${ceiling}` : null].filter(Boolean).join(" · ");
        }
      } catch (err) {
        errors.push(`enrich ${op.noticeId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const digestError = await notifyNewOpportunities(newOpportunities);
  if (digestError) errors.push(digestError);

  // Move untouched opportunities whose deadline has passed out of the active
  // pipeline. Only 'new'/'reviewing' — 'bid' items are expected to pass their
  // deadline after submission, that's not "expired", it's awaiting award.
  const { count: expired, error: expireErr } = await supabase
    .from("opportunities")
    .update(
      { status: "expired", updated_at: new Date().toISOString() },
      { count: "exact" }
    )
    .in("status", ["new", "reviewing"])
    .lt("response_deadline", new Date().toISOString());

  if (expireErr) errors.push(`expire: ${expireErr.message}`);

  await notifySyncErrors(errors);
  await recordSyncRun({ source: "direct", upserted, errors });

  const result = {
    upserted,
    expired: expired ?? 0,
    notified: newOpportunities.length,
    errors,
    deadlineWindow,
    naicsCodesChecked: registeredNaicsCodes,
  };
  if (errors.length > 0) {
    console.error("SAM.gov sync errors:", errors);
  }
  console.log("SAM.gov sync result:", JSON.stringify({
    upserted: result.upserted,
    expired: result.expired,
    notified: result.notified,
    errorCount: errors.length,
    deadlineWindow,
  }));

  return NextResponse.json(result);
}
