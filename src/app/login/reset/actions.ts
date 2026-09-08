"use server";

import { redirect } from "next/navigation";
import { OPERATOR } from "@/lib/operator";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";
import { resetSeatPassword } from "@/lib/subscriber-seats";

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.includes("@")) {
    try {
      const result = await resetSeatPassword(email);
      if (result) {
        await sendPasswordResetEmail({
          to: email,
          password: result.password,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL || OPERATOR.siteUrl,
        });
      }
    } catch (err) {
      console.error("password reset failed", err);
    }
  }
  redirect("/login/reset?sent=1");
}
