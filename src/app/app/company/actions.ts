"use server";

import { redirect } from "next/navigation";
import { getCurrentSeat } from "@/lib/current-seat";
import { upsertCompanyProfile } from "@/lib/company-profiles";
import { SET_ASIDE_CERTIFICATIONS, type SetAsideCertification } from "@/lib/opportunities";

export async function saveCompanyProfile(formData: FormData): Promise<void> {
  const seat = await getCurrentSeat();
  if (!seat?.company) redirect("/login");

  const certifications = formData
    .getAll("certifications")
    .map(String)
    .filter((c): c is SetAsideCertification =>
      (SET_ASIDE_CERTIFICATIONS as readonly string[]).includes(c)
    );

  await upsertCompanyProfile({
    companyName: seat.company,
    address: String(formData.get("address") ?? ""),
    uei: String(formData.get("uei") ?? ""),
    cage: String(formData.get("cage") ?? ""),
    certifications,
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
  });

  redirect("/app/company?saved=1");
}
