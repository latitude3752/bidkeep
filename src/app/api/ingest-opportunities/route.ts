import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedRelayRequest,
  ensureOpportunityScale,
  recordSyncRun,
  type SamGovOpportunity,
} from "@netacracy/bid-core";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ACTIONABLE_NOTICE_TYPES, classifyAcquisitionType } from "@/lib/opportunities";
import { radarPersistFields } from "@/lib/radar";
import { notifyNewOpportunities, notifySyncErrors, type NotifiableOpportunity } from "@/lib/notify";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Same eager-enrich cap as the (now relay-fed) sync path -- bound how many
 * run eagerly per ingest so a busy day can't blow past maxDuration. */
const MAX_EAGER_ENRICH = 15;

function formatCeiling(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

type PendingNotification = NotifiableOpportunity & { noticeId: string };

type IngestItem = {
  naicsCode: string;
  results: SamGovOpportunity[];
};

/** Upserts a batch of SAM.gov results (already fetched by BidHawk's relay,
 * not by this app) and tracks which are newly-discovered and actionable, so
 * a single new-opportunity email covers the whole batch. Same shape as the
 * upsertResults helper in sync-opportunities/route.ts -- kept as a separate
 * copy here rather than a shared import so this new ingest path can't
 * regress that already-working, revenue-facing route. */
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
    .select("notice_id, requirements_text")
    .in("notice_id", noticeIds);
  const existingIds = new Set((existing ?? []).map((r) => r.notice_id));
  const requirementsByNoticeId = new Map(
    (existing ?? []).map((r) => [r.notice_id as string, (r.requirements_text as string | null) ?? null])
  );

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
    ...radarPersistFields({
      title: op.title,
      noticeType: op.type,
      rawData: op,
      requirementsText: requirementsByNoticeId.get(op.noticeId) ?? null,
    }),
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

/** Receives already-fetched SAM.gov results from BidHawk's morning relay
 * (one shared pull across BidHawk/BidKeep/BidPulse instead of three
 * separate NAICS-by-NAICS calls against the same daily quota) and runs the
 * same upsert -> eager-enrich -> notify -> expire pipeline the old
 * sync-opportunities cron ran after fetching the data itself. */
export async function POST(request: NextRequest) {
  if (!isAuthorizedRelayRequest(request.headers.get("x-relay-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { items?: IngestItem[] };
  const items = body.items ?? [];

  const supabase = getSupabaseAdmin();
  let upserted = 0;
  const errors: string[] = [];
  const newOpportunities: PendingNotification[] = [];

  for (const item of items) {
    const { upserted: count, error } = await upsertResults(
      supabase,
      item.results,
      item.naicsCode,
      newOpportunities
    );
    if (error) errors.push(`naics ${item.naicsCode}: ${error}`);
    upserted += count;
  }

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
        const { scale, text } = await ensureOpportunityScale(oppId);
        const target = byNoticeId.get(op.noticeId);
        if (!target) continue;

        if (text) {
          await supabase
            .from("opportunities")
            .update(radarPersistFields({ title: op.title, requirementsText: text }))
            .eq("id", oppId);
        }

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
  await recordSyncRun({ source: "relay", upserted, errors });

  const result = {
    upserted,
    expired: expired ?? 0,
    notified: newOpportunities.length,
    errors,
    naicsCodesReceived: items.map((i) => i.naicsCode),
  };
  if (errors.length > 0) {
    console.error("SAM.gov ingest errors:", errors);
  }
  console.log("SAM.gov ingest result:", JSON.stringify({
    upserted: result.upserted,
    expired: result.expired,
    notified: result.notified,
    errorCount: errors.length,
  }));

  return NextResponse.json(result);
}
