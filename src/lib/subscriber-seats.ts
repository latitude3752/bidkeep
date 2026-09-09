import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertCanAddSeat, PILOT_MS } from "@/lib/subscriber-org";
import { generatePassword, hashPassword } from "@/lib/subscriber-password";

export type SubscriberSeat = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  company: string | null;
  role: "owner" | "member";
  active_until: string;
};

const SEAT_COLUMNS = "id, email, password_hash, name, company, role, active_until";

export async function listActiveSeats(): Promise<SubscriberSeat[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscriber_seats")
    .select(SEAT_COLUMNS)
    .gt("active_until", new Date().toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []) as SubscriberSeat[];
}

export async function getSeatByEmail(email: string): Promise<SubscriberSeat | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscriber_seats")
    .select(SEAT_COLUMNS)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubscriberSeat | null) ?? null;
}

export async function getSeatById(id: string): Promise<SubscriberSeat | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscriber_seats")
    .select(SEAT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubscriberSeat | null) ?? null;
}

export async function createSeat(input: {
  email: string;
  name: string;
  company: string;
  role?: "owner" | "member";
  activeUntil?: Date;
}): Promise<SubscriberSeat & { password: string }> {
  const email = input.email.trim().toLowerCase();
  const existing = await getSeatByEmail(email);
  const active = (await listActiveSeats()).filter((seat) => seat.email !== email);
  assertCanAddSeat(active, input.company);
  const password = generatePassword();
  const now = new Date().toISOString();
  const payload = {
    email,
    password_hash: hashPassword(password),
    name: input.name,
    company: input.company.trim(),
    role: input.role ?? "owner",
    active_until: (input.activeUntil ?? new Date(Date.now() + PILOT_MS)).toISOString(),
  };
  const supabase = getSupabaseAdmin();
  if (existing) {
    const { data, error } = await supabase
      .from("subscriber_seats")
      .update({ ...payload, updated_at: now })
      .eq("email", email)
      .select(SEAT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { ...(data as SubscriberSeat), password };
  }
  const { data, error } = await supabase
    .from("subscriber_seats")
    .insert(payload)
    .select(SEAT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as SubscriberSeat), password };
}

export async function revokeSeat(id: string): Promise<void> {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("subscriber_seats")
    .update({ active_until: now, updated_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Renewal path: stretch active_until without rotating the password.
 * Returns null when there is no seat for that email (founder should
 * provision by hand — the customer already paid). */
/** Rotates the password for an existing seat. Returns null when there is
 * no seat so the public form can always show the same success message. */
export async function resetSeatPassword(
  email: string
): Promise<{ password: string } | null> {
  const existing = await getSeatByEmail(email);
  if (!existing) return null;
  const password = generatePassword();
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("subscriber_seats")
    .update({ password_hash: hashPassword(password), updated_at: now })
    .eq("email", existing.email);
  if (error) throw new Error(error.message);
  return { password };
}

export async function extendSeatAccess(
  email: string,
  activeUntil: Date
): Promise<SubscriberSeat | null> {
  const existing = await getSeatByEmail(email);
  if (!existing) return null;
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscriber_seats")
    .update({ active_until: activeUntil.toISOString(), updated_at: now })
    .eq("email", existing.email)
    .select(SEAT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as SubscriberSeat;
}
