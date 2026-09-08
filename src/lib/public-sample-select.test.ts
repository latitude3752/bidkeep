import { describe, expect, it } from "vitest";
import { agencyDepartment, interleaveByKey, pickDiverseRows } from "./public-sample-select";

describe("agencyDepartment", () => {
  it("returns the first dotted SAM segment", () => {
    expect(agencyDepartment("DEPT OF DEFENSE.DEPT OF THE ARMY.US ARMY ACC")).toBe(
      "DEPT OF DEFENSE"
    );
  });

  it("returns empty for blank input", () => {
    expect(agencyDepartment(null)).toBe("");
    expect(agencyDepartment("  ")).toBe("");
  });
});

describe("pickDiverseRows", () => {
  it("prefers new agency and NAICS keys before filling", () => {
    const rows = [
      { agency: "GSA.PBS", naics: "561720" },
      { agency: "GSA.PBS", naics: "561720" },
      { agency: "DEPT OF VETERANS AFFAIRS.NCA", naics: "561730" },
      { agency: "DEPT OF THE ARMY.ACC", naics: "561612" },
      { agency: "NASA.KSC", naics: "561210" },
    ];
    const picked = pickDiverseRows(rows, 4, [
      (row) => agencyDepartment(row.agency),
      (row) => row.naics,
    ]);
    expect(picked).toHaveLength(4);
    expect(picked.map((r) => r.naics).sort()).toEqual([
      "561210",
      "561612",
      "561720",
      "561730",
    ]);
  });
});

describe("interleaveByKey", () => {
  it("round-robins so one key cannot fill the teaser", () => {
    const rows = [
      { program: "10.766", title: "A" },
      { program: "10.766", title: "B" },
      { program: "14.872", title: "C" },
      { program: "14.872", title: "D" },
    ];
    expect(interleaveByKey(rows, (row) => row.program, 4).map((r) => r.title)).toEqual([
      "A",
      "C",
      "B",
      "D",
    ]);
  });
});
