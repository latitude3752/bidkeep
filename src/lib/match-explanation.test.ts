import { describe, expect, it } from "vitest";
import { explainNaicsMatch } from "./match-explanation";

describe("explainNaicsMatch", () => {
  const tracked = ["561720", "561730"];

  it("names the tracked NAICS code", () => {
    const exp = explainNaicsMatch("561720", tracked);
    expect(exp.viaTrackedNaics).toBe(true);
    expect(exp.label).toBe("NAICS 561720");
  });

  it("flags a NAICS code that isn't currently tracked", () => {
    const exp = explainNaicsMatch("332710", tracked);
    expect(exp.viaTrackedNaics).toBe(false);
    expect(exp.label).toContain("332710");
    expect(exp.label).toContain("untracked");
  });

  it("handles a missing NAICS code", () => {
    const exp = explainNaicsMatch(null, tracked);
    expect(exp.viaTrackedNaics).toBe(false);
    expect(exp.label).toBe("No NAICS code on this notice");
  });
});
