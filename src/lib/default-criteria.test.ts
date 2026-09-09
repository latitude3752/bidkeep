import { describe, expect, it } from "vitest";
import { naicsInKeepSegment, parseKeepSegment } from "./default-criteria";

describe("Keep default segment", () => {
  it("defaults to core facilities when unset", () => {
    expect(parseKeepSegment(undefined)).toBe("core");
    expect(parseKeepSegment("all")).toBe("all");
    expect(parseKeepSegment("core")).toBe("core");
  });

  it("keeps the four core facilities codes and drops adjacents in core", () => {
    expect(naicsInKeepSegment("561210", "core")).toBe(true);
    expect(naicsInKeepSegment("561720", "core")).toBe(true);
    expect(naicsInKeepSegment("561730", "core")).toBe(true);
    expect(naicsInKeepSegment("561612", "core")).toBe(true);
    expect(naicsInKeepSegment("561790", "core")).toBe(false);
    expect(naicsInKeepSegment("561740", "core")).toBe(false);
    expect(naicsInKeepSegment("561621", "core")).toBe(false);
    expect(naicsInKeepSegment("561790", "all")).toBe(true);
  });
});
