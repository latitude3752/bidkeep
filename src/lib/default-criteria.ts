/** Core facilities NAICS plus a full-list filter. Geography is the saved POP state. */

export const KEEP_SEGMENTS = {
  core: {
    id: "core",
    label: "Core facilities",
    codes: ["561210", "561720", "561730", "561612"] as readonly string[],
  },
  all: {
    id: "all",
    label: "All tracked NAICS",
    codes: null as string[] | null,
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
  const codes = KEEP_SEGMENTS[segment].codes;
  if (!codes) return true;
  return Boolean(naics && codes.includes(naics));
}
