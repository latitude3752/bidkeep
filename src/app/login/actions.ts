"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearLoginAttempts,
  getLockoutRemainingMs,
  recordFailedLoginAttempt,
} from "@/lib/admin-login-attempts";
import { clientIp } from "@/lib/request-ip";
import { loginOutcome } from "@/lib/subscriber-login";
import { verifyPassword } from "@/lib/subscriber-password";
import { getSeatByEmail } from "@/lib/subscriber-seats";
import {
  SUBSCRIBER_COOKIE,
  SUBSCRIBER_TTL_MS,
  createSubscriberSessionToken,
} from "@/lib/subscriber-session";

// Keyed on email as well as IP: when clientIp() falls back to "unknown"
// (self-hosted without TRUST_PROXY_HEADERS configured), keying on IP alone
// would collapse every subscriber into one shared lockout bucket, letting
// one attacker (or one confused user) lock out every other subscriber by
// failing 5 attempts against any account. Including the email means that
// degrades to "each account has its own lockout" instead.
function subscriberLockoutKey(ip: string, email: string): string {
  return `subscriber:${ip}:${email.trim().toLowerCase()}`;
}

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const key = subscriberLockoutKey(await clientIp(), email);

  const locked = (await getLockoutRemainingMs(key)) !== null;
  const seat = locked ? null : await getSeatByEmail(email);
  const passwordOk = !!seat && verifyPassword(password, seat.password_hash);
  const outcome = loginOutcome({ locked, seat, passwordOk });

  if (!outcome.ok) {
    if (outcome.error === "locked") {
      redirect("/login?error=locked");
    }
    if (outcome.error === "invalid") {
      await recordFailedLoginAttempt(key);
      redirect("/login?error=1");
    }
    redirect("/login?error=expired");
  }

  await clearLoginAttempts(key);

  const store = await cookies();
  store.set(SUBSCRIBER_COOKIE, createSubscriberSessionToken(outcome.seatId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SUBSCRIBER_TTL_MS / 1000,
  });

  redirect("/app/opportunities");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SUBSCRIBER_COOKIE);
  redirect("/login");
}
