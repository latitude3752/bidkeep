export type LoginOutcome =
  | { ok: true; seatId: string }
  | { ok: false; error: "locked" | "invalid" | "expired" };

export function loginOutcome(args: {
  locked: boolean;
  seat: { id: string; password_hash: string; active_until: string } | null;
  passwordOk: boolean;
  now?: number;
}): LoginOutcome {
  if (args.locked) return { ok: false, error: "locked" };
  if (!args.seat || !args.passwordOk) return { ok: false, error: "invalid" };
  if (new Date(args.seat.active_until).getTime() <= (args.now ?? Date.now())) {
    return { ok: false, error: "expired" };
  }
  return { ok: true, seatId: args.seat.id };
}
