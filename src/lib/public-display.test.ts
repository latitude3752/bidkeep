import { describe, expect, it } from "vitest";
import {
  formatDeadline,
  formatMoney0,
  normalizeAgency,
  samNoticeHref,
  setAsideLabel,
  usaSpendingAwardHref,
} from "./public-display";

describe("normalizeAgency", () => {
  it("collapses SAM dotted hierarchy to department + last office", () => {
    expect(
      normalizeAgency("DEPT OF DEFENSE.DEPT OF THE ARMY.US ARMY ACC.ACC-RSA")
    ).toBe("DEPT OF DEFENSE · ACC-RSA");
  });

  it("passes through short names", () => {
    expect(normalizeAgency("DEPT OF VETERANS AFFAIRS")).toBe(
      "DEPT OF VETERANS AFFAIRS"
    );
    expect(normalizeAgency("DEPT OF DEFENSE.DEPT OF THE NAVY")).toBe(
      "DEPT OF DEFENSE · DEPT OF THE NAVY"
    );
  });

  it("handles empty", () => {
    expect(normalizeAgency(null)).toBe("—");
    expect(normalizeAgency("")).toBe("—");
  });
});

describe("samNoticeHref", () => {
  it("prefers the stored SAM uiLink", () => {
    expect(samNoticeHref("https://sam.gov/opp/abc/view", "abc")).toBe(
      "https://sam.gov/opp/abc/view"
    );
  });

  it("falls back to a SAM notice URL from the ID", () => {
    expect(samNoticeHref(null, "NOTICE-1")).toBe(
      "https://sam.gov/opp/NOTICE-1/view"
    );
  });
});

describe("usaSpendingAwardHref", () => {
  it("builds a public award URL", () => {
    expect(usaSpendingAwardHref("CONT_IDV_123")).toBe(
      "https://www.usaspending.gov/award/CONT_IDV_123"
    );
  });
});

describe("setAsideLabel", () => {
  it("normalizes empty and full-and-open", () => {
    expect(setAsideLabel(null)).toBe("Full and open");
    expect(setAsideLabel("No Set Aside Used")).toBe("Full and open");
  });
});

describe("formatters", () => {
  it("formats money without cents", () => {
    expect(formatMoney0(250000000)).toBe("$250,000,000");
  });

  it("formats a deadline", () => {
    expect(formatDeadline("2026-09-04T00:00:00.000Z")).toMatch(/Sep/);
  });
});
