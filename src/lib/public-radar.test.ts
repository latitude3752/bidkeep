import { describe, expect, it } from "vitest";
import { RADAR_EXAMPLE_ROWS, radarKindLabel } from "./public-radar";

describe("radar examples", () => {
  it("labels every fallback row as an example and covers the illustrated kinds", () => {
    expect(RADAR_EXAMPLE_ROWS.every((row) => row.isExample)).toBe(true);
    expect(RADAR_EXAMPLE_ROWS.every((row) => row.noticeId === null)).toBe(true);
    expect(new Set(RADAR_EXAMPLE_ROWS.map((row) => row.kind))).toEqual(
      new Set(["early_signal", "option", "expiration"])
    );
  });
});

describe("radarKindLabel", () => {
  it("uses the subscriber-facing labels", () => {
    expect(radarKindLabel("recompete")).toBe("Recompete");
    expect(radarKindLabel("sole_source_followon")).toBe("Sole-source follow-on");
    // "Options identified", not "Option exercise" -- matching a base+option
    // structure isn't evidence an exercise decision was actually made or
    // announced (Sep 12 audit).
    expect(radarKindLabel("option")).toBe("Options identified");
    expect(radarKindLabel("expiration")).toBe("Period end");
    expect(radarKindLabel("early_signal")).toBe("Possible early opportunity");
  });
});
