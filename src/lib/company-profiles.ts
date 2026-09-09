import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCompany } from "@/lib/subscriber-org";
import type { SetAsideCertification } from "@/lib/opportunities";

export type CompanyProfile = {
  companyKey: string;
  companyName: string;
  address: string | null;
  uei: string | null;
  cage: string | null;
  certifications: SetAsideCertification[];
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export async function getCompanyProfile(companyName: string): Promise<CompanyProfile | null> {
  const key = normalizeCompany(companyName);
  if (!key) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("company_profiles")
    .select(
      "company_key, company_name, address, uei, cage, certifications, contact_name, contact_email, contact_phone"
    )
    .eq("company_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    companyKey: data.company_key,
    companyName: data.company_name,
    address: data.address,
    uei: data.uei,
    cage: data.cage,
    certifications: (data.certifications ?? []) as SetAsideCertification[],
    contactName: data.contact_name,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
  };
}

export async function upsertCompanyProfile(input: {
  companyName: string;
  address: string;
  uei: string;
  cage: string;
  certifications: SetAsideCertification[];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}): Promise<void> {
  const key = normalizeCompany(input.companyName);
  if (!key) throw new Error("Company name is required.");
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("company_profiles").upsert(
    {
      company_key: key,
      company_name: input.companyName.trim(),
      address: input.address.trim() || null,
      uei: input.uei.trim() || null,
      cage: input.cage.trim() || null,
      certifications: input.certifications,
      contact_name: input.contactName.trim() || null,
      contact_email: input.contactEmail.trim() || null,
      contact_phone: input.contactPhone.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_key" }
  );
  if (error) throw new Error(error.message);
}
