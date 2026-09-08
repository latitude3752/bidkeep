"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminSession } from "@/lib/admin-auth";

export async function addNaicsCode(formData: FormData) {
  await requireAdminSession();
  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  if (!/^\d{6}$/.test(code) || !label) {
    throw new Error("NAICS code must be 6 digits, and label is required.");
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("naics_codes").insert({ code, label });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/naics-codes");
  revalidatePath("/opportunities");
}

export async function setNaicsCodeActive(code: string, active: boolean) {
  await requireAdminSession();
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("naics_codes").update({ active }).eq("code", code);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/naics-codes");
  revalidatePath("/opportunities");
}

export async function deleteNaicsCode(code: string) {
  await requireAdminSession();
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("naics_codes").delete().eq("code", code);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/naics-codes");
  revalidatePath("/opportunities");
}
