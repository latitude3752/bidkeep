import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabasePublic } from "@/lib/supabase/public";

export type GrantProgram = {
  aln: string;
  label: string;
  active: boolean;
};

/** Active grant programs (Assistance Listing numbers) via the anon client,
 * for the public /grants coverage page. Mirrors naics-codes.ts. */
export async function getPublicGrantPrograms(): Promise<GrantProgram[]> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase
    .from("grant_programs")
    .select("aln, label, active")
    .eq("active", true)
    .order("aln");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** All registered grant programs (including inactive), for admin management. */
export async function getAllGrantPrograms(): Promise<GrantProgram[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("grant_programs")
    .select("aln, label, active")
    .order("aln");
  if (error) throw new Error(error.message);
  return data ?? [];
}
