import { afterEach, describe, expect, it } from "vitest";
import {
  SUBSCRIBER_COOKIE,
  createSubscriberSessionToken,
  parseSubscriberSessionToken,
} from "./subscriber-session";
import { createSessionToken } from "./admin-auth";

describe("subscriber-session", () => {
  afterEach(() => {
    delete process.env.SUBSCRIBER_SESSION_SECRET;
    delete process.env.ADMIN_PASSWORD;
  });

  it("round-trips a seat id", () => {
    process.env.SUBSCRIBER_SESSION_SECRET = "sub-secret";
    const seatId = "11111111-1111-4111-8111-111111111111";
    const token = createSubscriberSessionToken(seatId, 1_000_000);
    const parsed = parseSubscriberSessionToken(token, 1_000_000);
    expect(parsed?.seatId).toBe(seatId);
    expect(SUBSCRIBER_COOKIE).toBe("bidkeep_subscriber_session");
  });

  it("rejects an expired token", () => {
    process.env.SUBSCRIBER_SESSION_SECRET = "sub-secret";
    const token = createSubscriberSessionToken("11111111-1111-4111-8111-111111111111", 1_000_000);
    expect(parseSubscriberSessionToken(token, 99_000_000_000)).toBeNull();
  });

  it("rejects a founder admin token", () => {
    process.env.SUBSCRIBER_SESSION_SECRET = "sub-secret";
    process.env.ADMIN_PASSWORD = "founder-pass";
    const founder = createSessionToken();
    expect(parseSubscriberSessionToken(founder)).toBeNull();
  });

  it("rejects missing or garbage tokens", () => {
    process.env.SUBSCRIBER_SESSION_SECRET = "sub-secret";
    expect(parseSubscriberSessionToken(undefined)).toBeNull();
    expect(parseSubscriberSessionToken("not.a.token")).toBeNull();
  });
});
