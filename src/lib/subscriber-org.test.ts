import { describe, expect, it } from "vitest";
import { MAX_SEATS_PER_COMPANY, assertCanAddSeat } from "./subscriber-org";

describe("assertCanAddSeat", () => {
  it("allows the first seat", () => {
    expect(() => assertCanAddSeat([], "Acme Builders")).not.toThrow();
  });

  it("allows a second seat at the same company", () => {
    expect(() =>
      assertCanAddSeat([{ company: "Acme Builders" }], "acme builders")
    ).not.toThrow();
  });

  it("allows a different company regardless of another company's seat count", () => {
    const seats = Array.from({ length: MAX_SEATS_PER_COMPANY }, () => ({ company: "Acme Builders" }));
    expect(() => assertCanAddSeat(seats, "Other Co")).not.toThrow();
  });

  it("rejects a seat past the per-company cap", () => {
    const seats = Array.from({ length: MAX_SEATS_PER_COMPANY }, () => ({ company: "Acme Builders" }));
    expect(() => assertCanAddSeat(seats, "Acme Builders")).toThrow(/Seat cap reached/);
  });

  it("only counts seats at the same company toward the cap", () => {
    const seats = [
      ...Array.from({ length: MAX_SEATS_PER_COMPANY - 1 }, () => ({ company: "Acme Builders" })),
      { company: "Other Co" },
      { company: "Other Co" },
    ];
    expect(() => assertCanAddSeat(seats, "Acme Builders")).not.toThrow();
  });

  it("rejects a blank company", () => {
    expect(() => assertCanAddSeat([], "  ")).toThrow(/Company is required/);
  });
});
