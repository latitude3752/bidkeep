import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Returns ms remaining if `ip` is currently locked out, otherwise null. */
export async function getLockoutRemainingMs(ip: string): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("admin_login_attempts")
    .select("locked_until")
    .eq("ip", ip)
    .maybeSingle();

  if (!data?.locked_until) return null;
  const remaining = new Date(data.locked_until).getTime() - Date.now();
  return remaining > 0 ? remaining : null;
}

/** Records a failed login attempt, locking the IP out once it exceeds
 * MAX_ATTEMPTS within the sliding window. */
export async function recordFailedLoginAttempt(ip: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("admin_login_attempts")
    .select("attempt_count, first_attempt_at")
    .eq("ip", ip)
    .maybeSingle();

  const now = Date.now();
  const windowExpired =
    !existing || now - new Date(existing.first_attempt_at).getTime() > ATTEMPT_WINDOW_MS;

  const attemptCount = windowExpired ? 1 : existing.attempt_count + 1;
  const firstAttemptAt = windowExpired ? new Date(now).toISOString() : existing.first_attempt_at;
  const lockedUntil =
    attemptCount >= MAX_ATTEMPTS ? new Date(now + LOCKOUT_MS).toISOString() : null;

  await supabase.from("admin_login_attempts").upsert({
    ip,
    attempt_count: attemptCount,
    first_attempt_at: firstAttemptAt,
    locked_until: lockedUntil,
  });
}

/** Clears an IP's attempt history on successful login. */
export async function clearLoginAttempts(ip: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("admin_login_attempts").delete().eq("ip", ip);
}
