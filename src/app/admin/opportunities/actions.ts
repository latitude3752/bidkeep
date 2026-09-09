"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OPPORTUNITY_STATUSES, type OpportunityStatus } from "@/lib/opportunities";
import { extractSearchKeyword, searchComparableAwards } from "@/lib/contract-awards";
import { ensureOpportunityScale } from "@netacracy/bid-core";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/admin-auth";
import { getCurrentSeat } from "@/lib/current-seat";

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
    .select("title, naics_code")
    .eq("id", id)
    .single();
  if (fetchErr || !opp) return { ok: false, error: fetchErr?.message ?? "Opportunity not found" };

  const keyword = extractSearchKeyword(opp.title);
  let result;
  try {
    result = await searchComparableAwards(opp.naics_code, keyword);
  } catch (err) {
    // SAM.gov's Contract Awards API is rate-limited and occasionally flaky
    // (429/5xx) -- a raw throw here crashed the whole page with Next.js's
    // generic error boundary instead of a message the visitor can act on.
    const message = err instanceof Error ? err.message : "Failed to fetch price research.";
    const friendly = message.includes("429")
      ? "SAM.gov rate-limited this request — try again in a minute."
      : message;
    return { ok: false, error: friendly };
  }

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

export async function refreshOpportunityScale(id: string) {
  await requireAdminOrSubscriberSession();
  await ensureOpportunityScale(id, { force: true });
  revalidatePath("/admin/opportunities");
  revalidatePath("/app/opportunities");
  revalidatePath(`/admin/opportunities/${id}`);
  revalidatePath(`/app/opportunities/${id}`);
}
