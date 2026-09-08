import { describe, expect, it } from "vitest";
import { naicsInKeepSegment, parseKeepSegment } from "./default-criteria";

describe("Keep default segment", () => {
  it("defaults to core facilities codes when unset", () => {
    expect(parseKeepSegment(undefined)).toBe("core");
    expect(parseKeepSegment("all")).toBe("all");
    expect(parseKeepSegment("core")).toBe("core");
  });

  it("keeps core facilities NAICS and drops adjacent codes in the core segment", () => {
    expect(naicsInKeepSegment("561720", "core")).toBe(true);
    expect(naicsInKeepSegment("561210", "core")).toBe(true);
    expect(naicsInKeepSegment("561612", "core")).toBe(true);
    expect(naicsInKeepSegment("561730", "core")).toBe(true);
    expect(naicsInKeepSegment("561710", "core")).toBe(false);
    expect(naicsInKeepSegment("561710", "all")).toBe(true);
  });
});
