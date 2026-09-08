/** Default pipeline segment: the four core facilities NAICS. Geography is the saved POP state. */

export const KEEP_SEGMENTS = {
  core: {
    id: "core",
    label: "Core facilities (561210 / 561612 / 561720 / 561730)",
    prefixes: ["561210", "561612", "561720", "561730"],
  },
  all: {
    id: "all",
    label: "All tracked NAICS",
    prefixes: null as string[] | null,
  },
} as const;

export type KeepSegmentId = keyof typeof KEEP_SEGMENTS;

export const KEEP_DEFAULT_SEGMENT: KeepSegmentId = "core";

export function parseKeepSegment(raw: string | undefined): KeepSegmentId {
  if (raw === "all") return "all";
  if (raw === "core") return "core";
  return KEEP_DEFAULT_SEGMENT;
}

export function naicsInKeepSegment(
  naics: string | null,
  segment: KeepSegmentId
): boolean {
  const prefixes = KEEP_SEGMENTS[segment].prefixes;
  if (!prefixes) return true;
  return Boolean(naics && prefixes.some((p) => naics.startsWith(p)));
}
