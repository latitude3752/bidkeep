"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OPPORTUNITY_STATUSES, type OpportunityStatus } from "@/lib/opportunities";
import { extractSearchKeyword, searchComparableAwards } from "@/lib/contract-awards";
import { ensureOpportunityScale, reportSamGovUsage } from "@netacracy/bid-core";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/admin-auth";
import { getCurrentSeat } from "@/lib/current-seat";

/** BidHawk is the hub for the whole family's shared, non-federal SAM.gov key
 * (hard-capped at 1,000/day with no appeal process -- see the "federal
 * tier" research that ruled out asking for a higher limit). */
const SAM_USAGE_HUB_URL = "https://trybidhawk.com";

/** Neither button below gated repeat clicks at all -- every click spent
 * another request against that shared quota, so a subscriber mashing
 * "Refresh" during a slow moment could burn through it fast. A short
 * per-opportunity cooldown caps the worst case without blocking a
 * genuinely fresh look (e.g. right after a notice amendment). */
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

function reportUsage(): Promise<void> {
  return reportSamGovUsage(SAM_USAGE_HUB_URL, "bidkeep", 1);
}

/** All three actions below are invoked from the OpportunityDetail component
 * shared by /admin/opportunities/[id] and /app/opportunities/[id] -- a
 * subscriber viewing their own pipeline hits these same Server Actions, not
 * just an admin. requireAdminSession() alone (added for the admin-only
 * actions elsewhere in this codebase) rejected every subscriber click with
 * "Not authorized", surfacing as a generic server error on their own page.
 * Authorize either an admin session or a valid subscriber seat instead. */
async function requireAdminOrSubscriberSession(): Promise<void> {
  const adminToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (verifySessionToken(adminToken)) return;
  if (await getCurrentSeat()) return;
  throw new Error("Not authorized");
}

export async function updateOpportunityStatus(id: string, status: string) {
  await requireAdminOrSubscriberSession();
  if (!OPPORTUNITY_STATUSES.includes(status as OpportunityStatus)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("opportunities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/opportunities");
  revalidatePath("/app/opportunities");
  revalidatePath(`/admin/opportunities/${id}`);
  revalidatePath(`/app/opportunities/${id}`);
}

export async function researchOpportunityPrice(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdminOrSubscriberSession();
  const admin = getSupabaseAdmin();
  const { data: opp, error: fetchErr } = await admin
    .from("opportunities")
    .select("title, naics_code, price_research_at")
    .eq("id", id)
    .single();
  if (fetchErr || !opp) return { ok: false, error: fetchErr?.message ?? "Opportunity not found" };

  if (opp.price_research_at && Date.now() - new Date(opp.price_research_at).getTime() < REFRESH_COOLDOWN_MS) {
    return { ok: false, error: "Price research was just refreshed — try again in a few minutes." };
  }

  const keyword = extractSearchKeyword(opp.title);
  let result;
  try {
    result = await searchComparableAwards(opp.naics_code, keyword);
  } catch (err) {
    await reportUsage();
    // SAM.gov's Contract Awards API is rate-limited and occasionally flaky
    // (429/5xx) -- a raw throw here crashed the whole page with Next.js's
    // generic error boundary instead of a message the visitor can act on.
    const message = err instanceof Error ? err.message : "Failed to fetch price research.";
    const friendly = message.includes("429")
      ? "SAM.gov rate-limited this request — try again in a minute."
      : message;
    return { ok: false, error: friendly };
  }
  await reportUsage();

  const { error: updErr } = await admin
    .from("opportunities")
    .update({ price_research: result, price_research_at: result.researchedAt })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/opportunities");
  revalidatePath("/app/opportunities");
  revalidatePath(`/admin/opportunities/${id}`);
  revalidatePath(`/app/opportunities/${id}`);
  return { ok: true };
}

export async function refreshOpportunityScale(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdminOrSubscriberSession();
  const admin = getSupabaseAdmin();
  const { data: opp } = await admin.from("opportunities").select("scale_checked_at").eq("id", id).single();
  // scale_checked_at (unlike requirements_fetched_at) is set whether the
  // description fetch succeeded or failed, so this also cools down repeat
  // clicks during an active rate limit instead of letting them retry forever.
  if (opp?.scale_checked_at && Date.now() - new Date(opp.scale_checked_at).getTime() < REFRESH_COOLDOWN_MS) {
    return { ok: false, error: "Scale classification was just refreshed — try again in a few minutes." };
  }

  const { descriptionFetchError } = await ensureOpportunityScale(id, { force: true });
  await reportUsage();
  revalidatePath("/admin/opportunities");
  revalidatePath("/app/opportunities");
  revalidatePath(`/admin/opportunities/${id}`);
  revalidatePath(`/app/opportunities/${id}`);
  if (descriptionFetchError) {
    const friendly = descriptionFetchError.includes("429")
      ? "SAM.gov rate-limited this request — try again in a minute."
      : descriptionFetchError;
    return { ok: false, error: friendly };
  }
  return { ok: true };
}
