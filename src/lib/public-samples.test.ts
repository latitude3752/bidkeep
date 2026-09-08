import { describe, expect, it } from "vitest";
import { FALLBACK_SAMPLE_OPPORTUNITIES } from "./fallback-samples";
import { hasLiveSampleDeadline } from "./public-samples";
import { agencyDepartment, pickDiverseRows } from "./public-sample-select";

describe("hasLiveSampleDeadline", () => {
  const now = new Date("2026-09-08T15:00:00.000Z");

  it("treats a same-day date-only deadline as live", () => {
    expect(hasLiveSampleDeadline("2026-09-08", now)).toBe(true);
  });

  it("marks a past timestamp as an example", () => {
    expect(hasLiveSampleDeadline("2026-08-01T22:00:00.000Z", now)).toBe(false);
  });

  it("marks a future timestamp as live", () => {
    expect(hasLiveSampleDeadline("2026-11-03T18:00:00.000Z", now)).toBe(true);
  });
});

describe("fallback sample diversity", () => {
  it("covers core facilities NAICS across more than one agency", () => {
    const agencies = new Set(
      FALLBACK_SAMPLE_OPPORTUNITIES.map((row) => agencyDepartment(row.agency))
    );
    const naics = new Set(FALLBACK_SAMPLE_OPPORTUNITIES.map((row) => row.naicsCode));
    expect(agencies.size).toBeGreaterThanOrEqual(5);
    expect(naics.has("561210")).toBe(true);
    expect(naics.has("561612")).toBe(true);
    expect(naics.has("561720")).toBe(true);
    expect(naics.has("561730")).toBe(true);
    expect(FALLBACK_SAMPLE_OPPORTUNITIES.every((row) => row.isExample)).toBe(true);
  });

  it("diversity pick keeps mixed agencies when the pool is larger than the teaser", () => {
    const picked = pickDiverseRows(FALLBACK_SAMPLE_OPPORTUNITIES, 4, [
      (row) => agencyDepartment(row.agency),
      (row) => row.naicsCode ?? "",
    ]);
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((row) => agencyDepartment(row.agency))).size).toBeGreaterThanOrEqual(3);
    expect(new Set(picked.map((row) => row.naicsCode)).size).toBeGreaterThanOrEqual(3);
  });
});
