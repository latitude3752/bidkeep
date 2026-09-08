"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifyPassword,
} from "@/lib/admin-auth";
import {
  clearLoginAttempts,
  getLockoutRemainingMs,
  recordFailedLoginAttempt,
} from "@/lib/admin-login-attempts";
import { clientIp } from "@/lib/request-ip";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin/opportunities");
  const ip = await clientIp();
  // Admin login has no per-account identifier to fall back on (one shared
  // password, no email) -- IP is the only signal lockout can key on. When
  // it resolves to "unknown" (self-hosted without TRUST_PROXY_HEADERS
  // configured), every visitor would otherwise collapse into one shared
  // bucket, letting a single attacker lock out the real admin by
  // deliberately failing 5 logins. Skip lockout enforcement in that case
  // rather than fail into a guaranteed DoS -- the password itself remains
  // the actual gate.
  const lockoutTrackable = ip !== "unknown";

  if (lockoutTrackable) {
    const lockoutMs = await getLockoutRemainingMs(ip);
    if (lockoutMs !== null) {
      redirect(`/admin/login?error=locked&next=${encodeURIComponent(next)}`);
    }
  }

  if (!password || !verifyPassword(password)) {
    if (lockoutTrackable) await recordFailedLoginAttempt(ip);
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  if (lockoutTrackable) await clearLoginAttempts(ip);

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  redirect(next.startsWith("/admin") ? next : "/admin/opportunities");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
