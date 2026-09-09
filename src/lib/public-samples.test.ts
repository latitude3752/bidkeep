import { describe, expect, it } from "vitest";
import {
  PUBLIC_OPP_SAMPLE_DEFAULT,
  PUBLIC_OPP_SAMPLE_MAX,
  clampPublicSampleLimit,
  mergeOpportunitySample,
  opportunityTitleKey,
  pickDiverseOpportunitySample,
  pickUniqueOpportunitySample,
  publicSamplePoolSize,
} from "./public-samples";

const row = (title: string, extra: { isExample?: boolean } = {}) => ({
  title,
  ...extra,
});

describe("clampPublicSampleLimit", () => {
  it("keeps values inside 1..max", () => {
    expect(clampPublicSampleLimit(8)).toBe(8);
    expect(clampPublicSampleLimit(1)).toBe(1);
    expect(clampPublicSampleLimit(PUBLIC_OPP_SAMPLE_MAX)).toBe(
      PUBLIC_OPP_SAMPLE_MAX
    );
  });

  it("rejects zero, negatives, fractions, and non-finite values", () => {
    expect(clampPublicSampleLimit(0)).toBe(1);
    expect(clampPublicSampleLimit(-3)).toBe(1);
    expect(clampPublicSampleLimit(12.9)).toBe(12);
    expect(clampPublicSampleLimit(Number.POSITIVE_INFINITY)).toBe(
      PUBLIC_OPP_SAMPLE_DEFAULT
    );
    expect(clampPublicSampleLimit(Number.NaN)).toBe(PUBLIC_OPP_SAMPLE_DEFAULT);
  });

  it("caps oversized public requests", () => {
    expect(clampPublicSampleLimit(10_000)).toBe(PUBLIC_OPP_SAMPLE_MAX);
  });
});

describe("publicSamplePoolSize", () => {
  it("fetches extra rows so title-dedup can still fill the cap", () => {
    expect(publicSamplePoolSize(8)).toBe(32);
    expect(publicSamplePoolSize(12)).toBe(48);
    expect(publicSamplePoolSize(10_000)).toBe(48);
  });
});

describe("opportunityTitleKey", () => {
  it("normalizes case and inner whitespace", () => {
    expect(opportunityTitleKey("  LC - 3504  Custodial Services  ")).toBe(
      "lc - 3504 custodial services"
    );
  });
});

describe("pickUniqueOpportunitySample", () => {
  it("drops later SAM.gov amendments of the same title", () => {
    const picked = pickUniqueOpportunitySample(
      [
        row("Z--CCSC CUSTODIAL SERVICES"),
        row("Z--CCSC CUSTODIAL SERVICES"),
        row("LC - 3504 Grounds Maintenance"),
        row("LC - 3504 Grounds Maintenance"),
        row("FRC Security Guard Services"),
      ],
      8
    );
    expect(picked.map((r) => r.title)).toEqual([
      "Z--CCSC CUSTODIAL SERVICES",
      "LC - 3504 Grounds Maintenance",
      "FRC Security Guard Services",
    ]);
  });

  it("stops at the clamped limit", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(`Notice ${i}`));
    expect(pickUniqueOpportunitySample(rows, 12)).toHaveLength(12);
    expect(pickUniqueOpportunitySample(rows, 10_000)).toHaveLength(
      PUBLIC_OPP_SAMPLE_MAX
    );
  });
});

describe("mergeOpportunitySample", () => {
  it("returns only live rows when they already fill the limit", () => {
    const live = Array.from({ length: 12 }, (_, i) => row(`Live ${i}`));
    const fallback = [row("Old notice")];
    const merged = mergeOpportunitySample(live, fallback, 12);
    expect(merged).toHaveLength(12);
    expect(merged.every((r) => !r.isExample)).toBe(true);
  });

  it("falls back entirely to labeled examples when nothing is live", () => {
    const merged = mergeOpportunitySample([], [row("Recent A"), row("Recent B")], 8);
    expect(merged).toEqual([
      { title: "Recent A", isExample: true },
      { title: "Recent B", isExample: true },
    ]);
  });

  it("fills a short live set with examples and skips title duplicates", () => {
    const merged = mergeOpportunitySample(
      [row("Live janitorial"), row("Live janitorial")],
      [row("Live janitorial"), row("Recent grounds"), row("Recent security")],
      8
    );
    expect(merged.map((r) => r.title)).toEqual([
      "Live janitorial",
      "Recent grounds",
      "Recent security",
    ]);
    expect(merged[0]?.isExample).toBeUndefined();
    expect(merged[1]?.isExample).toBe(true);
    expect(merged[2]?.isExample).toBe(true);
  });
});

describe("pickDiverseOpportunitySample", () => {
  const row = (
    title: string,
    agency: string,
    naicsCode: string
  ): { title: string; agency: string; naicsCode: string } => ({
    title,
    agency,
    naicsCode,
  });

  it("spreads agencies and NAICS instead of filling with one series", () => {
    const picked = pickDiverseOpportunitySample(
      [
        row("VA janitorial 1", "VA.NCO1", "561720"),
        row("VA janitorial 2", "VA.NCO1", "561720"),
        row("Army grounds", "DOD.ARMY", "561730"),
        row("GSA security", "GSA.PBS", "561612"),
        row("VA janitorial 3", "VA.NCO1", "561720"),
      ],
      3
    );
    expect(picked.map((r) => r.title)).toEqual([
      "VA janitorial 1",
      "Army grounds",
      "GSA security",
    ]);
  });
});
