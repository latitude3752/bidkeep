import { describe, expect, it } from "vitest";
import {
  classifyAcquisitionType,
  deadlineHorizonEnd,
  isEligibleSetAside,
  isWithinDeadlineHorizon,
} from "./opportunities";

describe("classifyAcquisitionType", () => {
  it("treats numeric-leading PSC codes as material", () => {
    expect(classifyAcquisitionType("1550")).toBe("material");
    expect(classifyAcquisitionType("16")).toBe("material");
  });

  it("treats letter-leading PSC codes as service", () => {
    expect(classifyAcquisitionType("R425")).toBe("service");
    expect(classifyAcquisitionType("AJ21")).toBe("service");
  });

  it("returns unknown for missing or unrecognized codes", () => {
    expect(classifyAcquisitionType(null)).toBe("unknown");
    expect(classifyAcquisitionType(undefined)).toBe("unknown");
    expect(classifyAcquisitionType("")).toBe("unknown");
    expect(classifyAcquisitionType("  ")).toBe("unknown");
  });
});

describe("isWithinDeadlineHorizon", () => {
  const now = new Date("2026-08-25T13:00:00.000Z");

  it("keeps deadlines through today + 90 days", () => {
    expect(isWithinDeadlineHorizon("2026-08-25T16:00:00.000Z", now)).toBe(true);
    expect(isWithinDeadlineHorizon("2026-11-23T13:00:00.000Z", now)).toBe(true);
    expect(isWithinDeadlineHorizon("2026-11-24T13:00:00.000Z", now)).toBe(false);
    expect(isWithinDeadlineHorizon("2031-08-03T22:00:00.000Z", now)).toBe(false);
  });

  it("keeps notices with no deadline", () => {
    expect(isWithinDeadlineHorizon(null, now)).toBe(true);
    expect(isWithinDeadlineHorizon(undefined, now)).toBe(true);
  });

  it("ends the default 90-day window on the UTC calendar date", () => {
    expect(deadlineHorizonEnd(now).toISOString()).toBe("2026-11-23T13:00:00.000Z");
  });
});

describe("isEligibleSetAside", () => {
  it("treats unrestricted or missing set-aside text as eligible for anyone", () => {
    expect(isEligibleSetAside(null, [])).toBe(true);
    expect(isEligibleSetAside("Full and Open", [])).toBe(true);
  });

  it("requires the matching certification for a restricted set-aside", () => {
    expect(isEligibleSetAside("Total Small Business Set-Aside", [])).toBe(false);
    expect(isEligibleSetAside("Total Small Business Set-Aside", ["small_business"])).toBe(true);
  });

  it("does not let an unrelated certification satisfy a different restriction", () => {
    expect(isEligibleSetAside("HUBZone Set-Aside", ["sdvosb"])).toBe(false);
    expect(isEligibleSetAside("HUBZone Set-Aside", ["hubzone"])).toBe(true);
  });

  it("defaults to eligible for set-aside text that matches no known certification", () => {
    expect(isEligibleSetAside("Some unrecognized restriction", [])).toBe(true);
  });
});
