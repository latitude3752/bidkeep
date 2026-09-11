"use server";

import { redirect } from "next/navigation";
import { OPERATOR } from "@/lib/operator";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";
import { resetSeatPassword } from "@/lib/subscriber-seats";

const RESET_LIMIT = 3;
const RESET_WINDOW_MS = 60 * 60 * 1000;
// Same map-size defense as the contact form's rate limiter: without a cap,
// an attacker cycling through many target emails could grow this map
// without bound.
const RESET_MAP_MAX = 5000;
const resetAttempts = new Map<string, number[]>();

/** Keyed by the target email, not the requester's IP -- resetSeatPassword
 * unconditionally rotates the real password and emails it out on every
 * call, so an attacker who merely knows a subscriber's email (no auth
 * needed) could otherwise lock them out of their own last-known password
 * indefinitely, or mail-bomb their inbox, regardless of which IP the
 * requests come from. In-memory, per-instance sliding window -- resets on
 * cold start; acceptable for a best-effort brake on an already-narrow
 * attack surface (the response is identical either way, so this never
 * leaks whether an email has a seat). */
function resetRateLimited(email: string): boolean {
  const now = Date.now();
  const timestamps = (resetAttempts.get(email) ?? []).filter(
    (t) => now - t < RESET_WINDOW_MS,
  );
  const limited = timestamps.length >= RESET_LIMIT;
  if (!limited) {
    timestamps.push(now);
    if (resetAttempts.size >= RESET_MAP_MAX) resetAttempts.clear();
  }
  resetAttempts.set(email, timestamps);
  return limited;
}

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.includes("@") && !resetRateLimited(email)) {
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
