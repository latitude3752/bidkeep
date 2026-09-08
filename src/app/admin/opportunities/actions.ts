"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OPPORTUNITY_STATUSES, type OpportunityStatus } from "@/lib/opportunities";
import { extractSearchKeyword, searchComparableAwards } from "@/lib/contract-awards";
import { ensureOpportunityScale } from "@netacracy/bid-core";
import { requireAdminSession } from "@/lib/admin-auth";

export async function updateOpportunityStatus(id: string, status: string) {
  await requireAdminSession();
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

export async function researchOpportunityPrice(id: string) {
  await requireAdminSession();
  const admin = getSupabaseAdmin();
  const { data: opp, error: fetchErr } = await admin
    .from("opportunities")
    .select("title, naics_code")
    .eq("id", id)
    .single();
  if (fetchErr || !opp) throw new Error(fetchErr?.message ?? "Opportunity not found");

  const keyword = extractSearchKeyword(opp.title);
  const result = await searchComparableAwards(opp.naics_code, keyword);

  const { error: updErr } = await admin
    .from("opportunities")
    .update({ price_research: result, price_research_at: result.researchedAt })
    .eq("id", id);
  if (updErr) throw new Error(updErr.message);

  revalidatePath("/admin/opportunities");
  revalidatePath("/app/opportunities");
  revalidatePath(`/admin/opportunities/${id}`);
  revalidatePath(`/app/opportunities/${id}`);
}

export async function refreshOpportunityScale(id: string) {
  await requireAdminSession();
  await ensureOpportunityScale(id, { force: true });
  revalidatePath("/admin/opportunities");
  revalidatePath("/app/opportunities");
  revalidatePath(`/admin/opportunities/${id}`);
  revalidatePath(`/app/opportunities/${id}`);
}
