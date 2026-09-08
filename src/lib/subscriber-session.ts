import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SUBSCRIBER_COOKIE = "bidkeep_subscriber_session";
export const SUBSCRIBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.SUBSCRIBER_SESSION_SECRET;
  if (!value) throw new Error("SUBSCRIBER_SESSION_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSubscriberSessionToken(seatId: string, now = Date.now()): string {
  const expires = now + SUBSCRIBER_TTL_MS;
  const payload = `${seatId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSubscriberSessionToken(
  token: string | undefined,
  now = Date.now()
): { seatId: string; expires: number } | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const signature = token.slice(lastDot + 1);
  const payload = token.slice(0, lastDot);
  const sep = payload.indexOf(".");
  if (sep <= 0) return null;
  const seatId = payload.slice(0, sep);
  const expires = Number(payload.slice(sep + 1));
  if (!seatId || !Number.isFinite(expires)) return null;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (now >= expires) return null;
  return { seatId, expires };
}
