import { describe, expect, it } from "vitest";
import {
  agencyDepartment,
  interleaveByKey,
  pickDiverseRows,
} from "./public-sample-select";

describe("agencyDepartment", () => {
  it("takes the first dotted SAM segment", () => {
    expect(
      agencyDepartment("DEPT OF DEFENSE.DLA TROOP SUPPORT")
    ).toBe("DEPT OF DEFENSE");
  });

  it("passes through a bare name", () => {
    expect(agencyDepartment("VETERANS AFFAIRS, DEPARTMENT OF")).toBe(
      "VETERANS AFFAIRS, DEPARTMENT OF"
    );
  });

  it("handles empty", () => {
    expect(agencyDepartment(null)).toBe("");
    expect(agencyDepartment("")).toBe("");
  });
});

describe("pickDiverseRows", () => {
  const rows = [
    { title: "VA janitorial", agency: "VA.NCO1", naics: "561720" },
    { title: "VA custodial night", agency: "VA.NCO1", naics: "561720" },
    { title: "Army grounds", agency: "DOD.ARMY", naics: "561730" },
    { title: "VA floor care", agency: "VA.NCO1", naics: "561720" },
    { title: "GSA security", agency: "GSA.PBS", naics: "561612" },
    { title: "USAF facilities", agency: "DOD.USAF", naics: "561210" },
  ];

  it("skips near-duplicate agency+NAICS rows until the limit must be filled", () => {
    const picked = pickDiverseRows(rows, 4, [
      (r) => agencyDepartment(r.agency),
      (r) => r.naics,
    ]);
    expect(picked.map((r) => r.title)).toEqual([
      "VA janitorial",
      "Army grounds",
      "GSA security",
      "USAF facilities",
    ]);
  });

  it("fills from original order when diversity runs out", () => {
    const picked = pickDiverseRows(rows, 5, [
      (r) => agencyDepartment(r.agency),
      (r) => r.naics,
    ]);
    expect(picked).toHaveLength(5);
    expect(picked[4].title).toBe("VA custodial night");
  });

  it("returns a copy when the pool is already at or under the limit", () => {
    const pool = rows.slice(0, 2);
    const picked = pickDiverseRows(pool, 8, [
      (r) => agencyDepartment(r.agency),
    ]);
    expect(picked).toEqual(pool);
    expect(picked).not.toBe(pool);
  });

  it("returns empty for empty input or non-positive limit", () => {
    const empty: typeof rows = [];
    expect(pickDiverseRows(rows, 0, [(r) => r.naics])).toEqual([]);
    expect(pickDiverseRows(empty, 4, [(r) => r.naics])).toEqual([]);
  });
});

describe("interleaveByKey", () => {
  it("round-robins so one program cannot fill the teaser", () => {
    const awards = [
      { recipient: "Housing A", program: "14.872" },
      { recipient: "Housing B", program: "14.872" },
      { recipient: "Housing C", program: "14.872" },
      { recipient: "CDBG city", program: "14.218" },
      { recipient: "Energy office", program: "81.041" },
      { recipient: "Community facility", program: "10.766" },
    ];
    const picked = interleaveByKey(awards, (r) => r.program, 4);
    expect(picked.map((r) => r.program)).toEqual([
      "14.872",
      "14.218",
      "81.041",
      "10.766",
    ]);
  });

  it("keeps going around buckets when some run out", () => {
    const awards = [
      { recipient: "A1", program: "14.872" },
      { recipient: "A2", program: "14.872" },
      { recipient: "B1", program: "14.218" },
    ];
    const picked = interleaveByKey(awards, (r) => r.program, 3);
    expect(picked.map((r) => r.recipient)).toEqual(["A1", "B1", "A2"]);
  });
});
