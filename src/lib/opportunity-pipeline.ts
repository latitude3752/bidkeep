/**
 * Pure opportunity-pipeline logic: types, URL<->filter parsing, set-aside/
 * department classification, sorting, and the full filter pipeline.
 *
 * Split out of OpportunityPipeline.tsx so the exact same functions run on
 * both sides of the server/client boundary -- the server fetches the full
 * viewer-scoped row set once, and OpportunityPipelineClient re-filters/
 * sorts/paginates it in memory on every interaction instead of a page
 * round-trip. No business logic changed in the move, only where it runs.
 *
 * One filter stays server-driven on purpose: distance-from-ZIP. The
 * centroid dataset it needs (@netacracy/bid-core's distance.ts) is ~1.1MB
 * of JSON -- shipping that to every browser just to make one occasional
 * "Distance from" control instant would be a net loss for a page that
 * exists to be fast. Instead the server computes `distance_miles` once per
 * row (already true today, and only when myZip is set) and the client
 * filters against that precomputed number -- no centroid data ever reaches
 * the browser, and the ZIP/radius control keeps its original explicit
 * "Apply" submit (a real navigation) exactly as it worked before, while
 * every other filter is instant.
 */

import type { KeepSegmentId } from "@/lib/default-criteria";
import { naicsInKeepSegment, parseKeepSegment } from "@/lib/default-criteria";
import { statePlaceOfPerformanceBucket } from "@/lib/opportunities";

export type Row = {
  id: string;
  title: string;
  agency: string | null;
  naics_code: string | null;
  set_aside_type: string | null;
  response_deadline: string | null;
  notice_url: string | null;
  notice_type: string | null;
  psc_code: string | null;
  acquisition_type: "material" | "service" | "unknown" | null;
  status: string;
  program_type: "bpa" | "idiq" | null;
  estimated_ceiling: number | null;
  place_of_performance_state: string | null;
  place_of_performance_zip: string | null;
  /** Miles from the request's myZip filter, precomputed server-side once
   * per fetch (null when no myZip filter was active at fetch time). See
   * module doc -- this is what lets radius filtering run client-side
   * without shipping the ZIP centroid dataset to the browser. */
  distance_miles: number | null;
};

export type SetAsideFilter = "all" | "small-business" | "8a" | "sdvosb" | "wosb" | "hubzone" | "none";

export type Filters = {
  type: "material" | "service" | "all";
  noise: boolean;
  activeOnly: boolean;
  program: "all" | "big" | "single";
  setAside: SetAsideFilter;
  /** "all" or an exact notice_type value from NOTICE_TYPE_OPTIONS. */
  noticeType: string;
  /** "all" or an exact department name from departmentOf(). */
  department: string;
  /** "all" or an exact place_of_performance_state value. */
  state: string;
  /** Trimmed free-text title search, "" = no filter. */
  q: string;
  /** null = no upper bound. Default 90. */
  horizonDays: number | null;
  segment: KeepSegmentId;
  /** Default true: hide rows this actor marked junk. */
  hideJunk: boolean;
  /** 5-digit ZIP the contractor is bidding from, "" = no distance filter.
   * Changing this re-navigates (see module doc); it's read here only so
   * the UI can display/clear the current value. */
  myZip: string;
  /** Only meaningful when myZip is set. Null = myZip not set. */
  radiusMiles: number | null;
};

export const RADIUS_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_RADIUS_MILES = 50;
export const PAGE_SIZE = 50;

/** The notice types worth filtering to explicitly -- excludes Award
 * Notice/Justification (already handled by the noise toggle) and rarer
 * types not seen in this pipeline's data. */
export const NOTICE_TYPE_OPTIONS = [
  "Solicitation",
  "Combined Synopsis/Solicitation",
  "Presolicitation",
  "Sources Sought",
  "Special Notice",
];

/** Buying department, derived from the first segment of SAM.gov's dotted
 * agency hierarchy (e.g. "DEPT OF DEFENSE.DEPT OF THE ARMY.AMC..." ->
 * "DEPT OF DEFENSE"). Filtered dynamically (top N by frequency) rather than
 * a hardcoded button list, since which departments actually appear shifts
 * with the data and a fixed list would either miss new ones or list every
 * department that's ever shown up. */
export function departmentOf(agency: string | null): string {
  return agency?.split(".")[0]?.trim() || "Unclassified";
}

/** Raw SAM.gov set-aside codes (used when the sync had no description text
 * to fall back to) mapped straight to their category. */
const SET_ASIDE_CODE_CATEGORY: Record<string, Exclude<SetAsideFilter, "all" | "none">> = {
  SDVOSBC: "sdvosb",
  SDVOSBS: "sdvosb",
  SBA: "small-business",
  SBP: "small-business",
  "8A": "8a",
  "8AN": "8a",
  WOSB: "wosb",
  EDWOSB: "wosb",
  HZC: "hubzone",
  HZS: "hubzone",
};

/** Categorizes a row's free-text set_aside_type for the filter above. Live
 * data confirmed this needs real classification, not a single substring
 * match: SAM.gov's full descriptions for WOSB/SDVOSB/8(a) all also contain
 * the words "small business" (e.g. "SBA Certified Women-Owned Small
 * Business (WOSB) Program Set-Aside"), so a naive "small business" filter
 * would double-count them under "Small Business" too. More specific
 * categories are matched first. Unrestricted opportunities are stored as
 * text too ("No Set aside used", "Full and open"), not NULL, though NULL
 * is treated the same way defensively. */
export function classifySetAside(setAsideType: string | null): SetAsideFilter | "other" {
  if (!setAsideType) return "none";
  const text = setAsideType.trim();
  const byCode = SET_ASIDE_CODE_CATEGORY[text.toUpperCase()];
  if (byCode) return byCode;
  if (/no set.?aside|full and open/i.test(text)) return "none";
  if (/8\s*\(\s*a\s*\)/i.test(text)) return "8a";
  if (/service-disabled|sdvosb/i.test(text)) return "sdvosb";
  if (/wom[ae]n-owned|\bwosb\b|edwosb/i.test(text)) return "wosb";
  if (/hubzone/i.test(text)) return "hubzone";
  if (/small business/i.test(text)) return "small-business";
  return "other";
}

/** Short badge text for a restricted set-aside category -- "other" (a real
 * restriction SAM.gov's free text didn't classify further) falls back to
 * the raw set_aside_type string instead of a made-up label. */
export const SET_ASIDE_BADGE_LABEL: Partial<Record<SetAsideFilter | "other", string>> = {
  "8a": "8(a)",
  sdvosb: "SDVOSB",
  wosb: "WOSB",
  hubzone: "HUBZone",
  "small-business": "Small Business",
};

export const INACTIVE_STATUSES = ["expired", "lost"];
/** Statuses that mean "we haven't submitted yet" -- once their deadline
 * passes, the notice is genuinely closed even if the once-daily sync sweep
 * (sync-opportunities' `status: "expired"` update) hasn't run since. 'bid'
 * is deliberately excluded: it's expected to pass its own deadline while
 * awaiting award, which isn't the same as having missed the window. */
export const PRE_SUBMISSION_STATUSES = ["new", "reviewing"];

/** Sortable columns, all backed by a real Row field, keyed by the URL-safe
 * name used in `?sort=`. Kept as an allowlist rather than passing the query
 * param straight through. */
export const SORT_COLUMNS = {
  title: "title",
  agency: "agency",
  naics: "naics_code",
  setAside: "set_aside_type",
  type: "acquisition_type",
  deadline: "response_deadline",
  status: "status",
  ceiling: "estimated_ceiling",
  state: "place_of_performance_state",
} as const;
export type SortKey = keyof typeof SORT_COLUMNS;
export type SortDir = "asc" | "desc";

export function formatMoney0(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function scaleLabel(row: Row): string | null {
  if (!row.program_type && row.estimated_ceiling === null) return null;
  const kind = row.program_type ? row.program_type.toUpperCase() : null;
  const ceiling = row.estimated_ceiling !== null ? `ceiling ${formatMoney0(row.estimated_ceiling)}` : null;
  return [kind, ceiling].filter(Boolean).join(" · ");
}

export const DEFAULT_HORIZON_DAYS_UI = 90;

function parseHorizon(sp: Record<string, string | undefined>): number | null {
  if (sp.horizon === "all") return null;
  const n = Number(sp.horizon);
  if (n === 30 || n === 7) return n;
  return DEFAULT_HORIZON_DAYS_UI;
}

const SET_ASIDE_FILTER_VALUES: SetAsideFilter[] = [
  "all",
  "small-business",
  "8a",
  "sdvosb",
  "wosb",
  "hubzone",
  "none",
];

export function parseFilters(sp: Record<string, string | undefined>): Filters {
  const type = sp.type === "material" || sp.type === "all" ? sp.type : "service";
  const program = sp.program === "big" || sp.program === "single" ? sp.program : "all";
  const setAside = SET_ASIDE_FILTER_VALUES.includes(sp.setAside as SetAsideFilter)
    ? (sp.setAside as SetAsideFilter)
    : "all";
  const noticeType = sp.noticeType && NOTICE_TYPE_OPTIONS.includes(sp.noticeType) ? sp.noticeType : "all";
  const department = sp.department?.trim().slice(0, 200) || "all";
  // Not a 2-letter USPS-code slice: filter values also include the
  // "Unlisted"/"International" bucket names from statePlaceOfPerformanceBucket.
  const state = sp.state?.trim().slice(0, 20) || "all";
  const q = sp.q?.trim().slice(0, 200) || "";
  return {
    type,
    noise: sp.noise === "1",
    activeOnly: sp.activeOnly !== "0",
    program,
    setAside,
    noticeType,
    department,
    state,
    q,
    horizonDays: parseHorizon(sp),
    segment: parseKeepSegment(sp.segment),
    hideJunk: sp.junk !== "1",
    myZip: /^\d{5}$/.test(sp.myZip ?? "") ? sp.myZip! : "",
    radiusMiles: /^\d{5}$/.test(sp.myZip ?? "")
      ? RADIUS_OPTIONS.includes(Number(sp.radius) as (typeof RADIUS_OPTIONS)[number])
        ? Number(sp.radius)
        : DEFAULT_RADIUS_MILES
      : null,
  };
}

export function parsePage(sp: Record<string, string | undefined>): number {
  const page = Number(sp.page);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function parseSort(sp: Record<string, string | undefined>): { sortBy: SortKey; sortDir: SortDir } {
  const raw = sp.sort;
  const sortBy: SortKey = raw && raw in SORT_COLUMNS ? (raw as SortKey) : "deadline";
  const sortDir = sp.dir === "desc" ? "desc" : "asc";
  return { sortBy, sortDir };
}

export function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Local copy of @netacracy/bid-core's formatDeadlineWithZone. Not
 * imported from bid-core here because that package's only public entry
 * point is its barrel (src/index.ts), which also re-exports server-only
 * modules (Supabase admin client, SAM.gov client, etc.) -- pulling even
 * one pure helper from it into this client-safe module would drag those
 * into the browser bundle and fail the build. */
export function formatDeadlineWithZone(iso: string | null | undefined): string {
  if (!iso) return "no deadline listed";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "no deadline listed";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/New_York",
  });
}

export function deadlineSpan(rows: Row[]): string | null {
  const dates = rows
    .map((r) => r.response_deadline)
    .filter((d): d is string => Boolean(d))
    .sort();
  if (dates.length === 0) return null;
  const first = formatDeadline(dates[0]);
  const last = formatDeadline(dates[dates.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

function isWithinDeadlineHorizon(deadline: string | null, now: Date, days: number | null): boolean {
  if (days === null) return true;
  if (!deadline) return true;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return true;
  const end = new Date(now.getTime());
  end.setUTCDate(end.getUTCDate() + days);
  return t <= end.getTime();
}

const NOISE_TYPES_SET = new Set(["Award Notice", "Justification"]);

/** Same nulls-last ordering Supabase's `.order(col, { nullsFirst: false })`
 * produced server-side, now run client-side after the fetch-once move.
 * Numeric columns compare numerically; everything else (including ISO date
 * strings, which sort correctly lexicographically) compares as text. */
function compareRows(a: Row, b: Row, key: SortKey, dir: SortDir): number {
  const col = SORT_COLUMNS[key];
  const av = a[col as keyof Row] as string | number | null;
  const bv = b[col as keyof Row] as string | number | null;
  const aNull = av === null || av === undefined || av === "";
  const bNull = bv === null || bv === undefined || bv === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
  return dir === "asc" ? cmp : -cmp;
}

export type PipelineView = {
  /** Fully filtered + sorted rows (not yet paginated). */
  rows: Row[];
  totalOpen: number;
  departmentOptions: { name: string; count: number }[];
  stateOptions: { name: string; count: number }[];
};

/**
 * The full filter pipeline, run once in memory against the already-fetched
 * row set. Mirrors the exact filter order the old server-side query used
 * (noise/type/activeOnly/program/noticeType/search, then set-aside, then
 * department, then state, then segment, then horizon, then the myZip
 * radius filter) including its "computed before this filter's own effect"
 * quirk for the department/state chip counts, and totalOpen always
 * counting non-noise rows regardless of the current noise toggle.
 */
export function runPipeline(
  allFetchedRows: Row[],
  votes: Map<string, boolean>,
  filters: Filters,
  sortBy: SortKey,
  sortDir: SortDir
): PipelineView {
  const now = new Date();
  const nowIso = now.toISOString();

  const preSetAside = allFetchedRows.filter((r) => {
    if (!filters.noise && NOISE_TYPES_SET.has(r.notice_type ?? "")) return false;
    if (filters.type !== "all" && r.acquisition_type !== filters.type) return false;
    if (filters.activeOnly) {
      if (INACTIVE_STATUSES.includes(r.status)) return false;
      const preSubmission = PRE_SUBMISSION_STATUSES.includes(r.status);
      const deadlinePassed = r.response_deadline !== null && r.response_deadline < nowIso;
      if (preSubmission && deadlinePassed) return false;
    }
    if (filters.program === "big" && r.program_type === null) return false;
    if (filters.program === "single" && r.program_type !== null) return false;
    if (filters.noticeType !== "all" && r.notice_type !== filters.noticeType) return false;
    if (filters.q && !r.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
    return true;
  });

  const bySetAside =
    filters.setAside === "all" ? preSetAside : preSetAside.filter((r) => classifySetAside(r.set_aside_type) === filters.setAside);

  const departmentCounts = new Map<string, number>();
  for (const r of bySetAside) {
    const dept = departmentOf(r.agency);
    departmentCounts.set(dept, (departmentCounts.get(dept) ?? 0) + 1);
  }
  const departmentOptions = [...departmentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  if (filters.department !== "all" && !departmentOptions.some((d) => d.name === filters.department)) {
    departmentOptions.push({ name: filters.department, count: departmentCounts.get(filters.department) ?? 0 });
  }

  const byDepartment = filters.department === "all" ? bySetAside : bySetAside.filter((r) => departmentOf(r.agency) === filters.department);

  const stateCounts = new Map<string, number>();
  for (const r of byDepartment) {
    const state = statePlaceOfPerformanceBucket(r.place_of_performance_state);
    stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
  }
  const stateOptions = [...stateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));
  if (filters.state !== "all" && !stateOptions.some((s) => s.name === filters.state)) {
    stateOptions.push({ name: filters.state, count: stateCounts.get(filters.state) ?? 0 });
  }

  const byState =
    filters.state === "all" ? byDepartment : byDepartment.filter((r) => statePlaceOfPerformanceBucket(r.place_of_performance_state) === filters.state);

  const bySegment = byState.filter((r) => naicsInKeepSegment(r.naics_code, filters.segment));

  const inHorizon = bySegment.filter((r) => isWithinDeadlineHorizon(r.response_deadline, now, filters.horizonDays));
  // totalOpen intentionally reflects everything up through the horizon
  // filter only -- not hideJunk, not the myZip radius filter -- matching
  // the original getOpportunities()'s totalOpen, which was computed before
  // both of those (they were applied afterward, in the caller).
  const totalOpen = inHorizon.filter((r) => !NOISE_TYPES_SET.has(r.notice_type ?? "")).length;

  const withJunkFilter = filters.hideJunk ? inHorizon.filter((r) => votes.get(r.id) !== false) : inHorizon;
  const allRows =
    filters.myZip && filters.radiusMiles !== null
      ? withJunkFilter.filter((r) => r.distance_miles !== null && r.distance_miles <= filters.radiusMiles!)
      : withJunkFilter;

  const sorted = [...allRows].sort((a, b) => compareRows(a, b, sortBy, sortDir));

  return { rows: sorted, totalOpen, departmentOptions, stateOptions };
}
