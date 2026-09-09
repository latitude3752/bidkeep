import { describe, expect, it } from "vitest";
import { loginOutcome } from "./subscriber-login";

const seat = {
  id: "11111111-1111-4111-8111-111111111111",
  password_hash: "salt:hash",
  active_until: "2099-01-01T00:00:00.000Z",
};

const now = Date.parse("2026-08-30T00:00:00.000Z");

describe("loginOutcome", () => {
  it("returns locked when the IP is locked out", () => {
    expect(loginOutcome({ locked: true, seat, passwordOk: true, now })).toEqual({
      ok: false,
      error: "locked",
    });
  });

  it("returns invalid when the seat is missing or the password is wrong", () => {
    expect(loginOutcome({ locked: false, seat: null, passwordOk: false, now })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(loginOutcome({ locked: false, seat, passwordOk: false, now })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(
      loginOutcome({
        locked: false,
        seat: { ...seat, active_until: "2020-01-01T00:00:00.000Z" },
        passwordOk: false,
        now,
      })
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("returns expired when the password is correct but active_until is past", () => {
    expect(
      loginOutcome({
        locked: false,
        seat: { ...seat, active_until: "2020-01-01T00:00:00.000Z" },
        passwordOk: true,
        now,
      })
    ).toEqual({ ok: false, error: "expired" });
    expect(
      loginOutcome({
        locked: false,
        seat: { ...seat, active_until: "2026-08-30T00:00:00.000Z" },
        passwordOk: true,
        now,
      })
    ).toEqual({ ok: false, error: "expired" });
  });

  it("returns the seat id on success", () => {
    expect(loginOutcome({ locked: false, seat, passwordOk: true, now })).toEqual({
      ok: true,
      seatId: seat.id,
    });
  });
});
