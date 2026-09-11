import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_DEADLINE_HORIZON_DAYS,
  NOISE_NOTICE_TYPES,
  deadlineHorizonEnd,
  isWithinDeadlineHorizon,
  statePlaceOfPerformanceBucket,
} from "@/lib/opportunities";
import { pipelineHref } from "@/lib/pipeline-href";
import {
  KEEP_SEGMENTS,
  naicsInKeepSegment,
  parseKeepSegment,
  type KeepSegmentId,
} from "@/lib/default-criteria";
import { getCurrentSeat } from "@/lib/current-seat";
import {
  getAllNaicsCodes,
  distanceFromZipMiles,
  listRelevanceVotes,
  formatDeadlineWithZone,
} from "@netacracy/bid-core";
import { explainNaicsMatch } from "@/lib/match-explanation";
import RelevanceButtons from "@/components/RelevanceButtons";
import SavedGeo from "@/components/SavedGeo";
import { logout as founderLogout } from "@/app/admin/actions";
import { logout as subscriberLogout } from "@/app/login/actions";
import StatusSelect from "@/app/admin/opportunities/StatusSelect";

type Row = {
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
};

type SetAsideFilter = "all" | "small-business" | "8a" | "sdvosb" | "wosb" | "hubzone" | "none";

type Filters = {
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
  /** 5-digit ZIP the contractor is bidding from, "" = no distance filter. */
  myZip: string;
  /** Only meaningful when myZip is set. Null = myZip not set. */
  radiusMiles: number | null;
};

const RADIUS_OPTIONS = [25, 50, 100] as const;
const DEFAULT_RADIUS_MILES = 50;

/** The notice types worth filtering to explicitly -- excludes Award
 * Notice/Justification (already handled by the noise toggle) and rarer
 * types not seen in this pipeline's data. */
const NOTICE_TYPE_OPTIONS = [
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
function departmentOf(agency: string | null): string {
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
function classifySetAside(setAsideType: string | null): SetAsideFilter | "other" {
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
const SET_ASIDE_BADGE_LABEL: Partial<Record<SetAsideFilter | "other", string>> = {
  "8a": "8(a)",
  sdvosb: "SDVOSB",
  wosb: "WOSB",
  hubzone: "HUBZone",
  "small-business": "Small Business",
};

const INACTIVE_STATUSES = ["expired", "lost"];
/** Statuses that mean "we haven't submitted yet" -- once their deadline
 * passes, the notice is genuinely closed even if the once-daily sync sweep
 * (sync-opportunities' `status: "expired"` update) hasn't run since. 'bid'
 * is deliberately excluded: it's expected to pass its own deadline while
 * awaiting award, which isn't the same as having missed the window. */
const PRE_SUBMISSION_STATUSES = ["new", "reviewing"];
const PAGE_SIZE = 50;

/** Sortable columns, all backed by a real DB column, keyed by the URL-safe
 * name used in `?sort=`. Kept as an allowlist rather than passing the query
 * param straight to `.order()`. */
const DB_SORT_COLUMNS = {
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
type SortKey = keyof typeof DB_SORT_COLUMNS;
type SortDir = "asc" | "desc";

function formatMoney0(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function scaleLabel(row: Row): string | null {
  if (!row.program_type && row.estimated_ceiling === null) return null;
  const kind = row.program_type ? row.program_type.toUpperCase() : null;
  const ceiling = row.estimated_ceiling !== null ? `ceiling ${formatMoney0(row.estimated_ceiling)}` : null;
  return [kind, ceiling].filter(Boolean).join(" · ");
}

function parseHorizon(sp: Record<string, string | undefined>): number | null {
  if (sp.horizon === "all") return null;
  const n = Number(sp.horizon);
  if (n === 30 || n === 7) return n;
  return DEFAULT_DEADLINE_HORIZON_DAYS;
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

function parseFilters(sp: Record<string, string | undefined>): Filters {
  // Facilities-services demand (janitorial, grounds, security, maintenance)
  // is overwhelmingly a "service" acquisition type, not "material" -- the
  // default used to be "material", which silently hid the vast majority of
  // relevant listings behind an extra click (2 shown vs. 172 once switched
  // to Service in a live audit).
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

function parsePage(sp: Record<string, string | undefined>): number {
  const page = Number(sp.page);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseSort(sp: Record<string, string | undefined>): { sortBy: SortKey; sortDir: SortDir } {
  const raw = sp.sort;
  const sortBy: SortKey = raw && raw in DB_SORT_COLUMNS ? (raw as SortKey) : "deadline";
  const sortDir = sp.dir === "desc" ? "desc" : "asc";
  return { sortBy, sortDir };
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function deadlineSpan(rows: Row[]): string | null {
  const dates = rows
    .map((r) => r.response_deadline)
    .filter((d): d is string => Boolean(d))
    .sort();
  if (dates.length === 0) return null;
  const first = formatDeadline(dates[0]);
  const last = formatDeadline(dates[dates.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

/** Fetches every row matching the DB-level filters. Supabase caps a single
 * select at 1000 rows, so we page with `.range()` — otherwise deadline-asc
 * only ever shows the soonest ~3 days and the +90-day window looks empty. */
async function getOpportunities(
  filters: Filters,
  sortBy: SortKey,
  sortDir: SortDir
): Promise<{
  rows: Row[];
  totalOpen: number;
  departmentOptions: { name: string; count: number }[];
  stateOptions: { name: string; count: number }[];
}> {
  const admin = getSupabaseAdmin();
  const BATCH = 1000;
  const rows: Row[] = [];

  for (let from = 0; from < 20_000; from += BATCH) {
    let query = admin
      .from("opportunities")
      .select(
        "id, title, agency, naics_code, set_aside_type, response_deadline, notice_url, notice_type, psc_code, acquisition_type, status, program_type, estimated_ceiling, place_of_performance_state, place_of_performance_zip"
      );

    if (!filters.noise) {
      query = query.not("notice_type", "in", `(${NOISE_NOTICE_TYPES.map((t) => `"${t}"`).join(",")})`);
    }
    if (filters.type !== "all") {
      query = query.eq("acquisition_type", filters.type);
    }
    if (filters.activeOnly) {
      const nowIso = new Date().toISOString();
      query = query
        .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`)
        .or(
          `status.not.in.(${PRE_SUBMISSION_STATUSES.join(",")}),response_deadline.gte.${nowIso},response_deadline.is.null`
        );
    }
    if (filters.program === "big") {
      query = query.not("program_type", "is", null);
    } else if (filters.program === "single") {
      query = query.is("program_type", null);
    }
    if (filters.noticeType !== "all") {
      query = query.eq("notice_type", filters.noticeType);
    }
    if (filters.q) {
      query = query.ilike("title", `%${filters.q}%`);
    }
    const { data, error } = await query
      .order(DB_SORT_COLUMNS[sortBy], {
        ascending: sortDir === "asc",
        nullsFirst: false,
      })
      .range(from, from + BATCH - 1);

    if (error) {
      console.error("Failed to load opportunities:", error.message);
      return { rows: [], totalOpen: 0, departmentOptions: [], stateOptions: [] };
    }

    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
  }

  const bySetAside =
    filters.setAside === "all"
      ? rows
      : rows.filter((r) => classifySetAside(r.set_aside_type) === filters.setAside);

  // Computed from the set that's filterable-by-department (i.e. before the
  // department filter itself), so the chip list reflects what's actually
  // available under the other active filters rather than the whole table.
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

  const byDepartment =
    filters.department === "all"
      ? bySetAside
      : bySetAside.filter((r) => departmentOf(r.agency) === filters.department);

  // Same "computed before this filter's own effect" pattern as
  // departmentOptions above -- reflects what's available under every other
  // active filter, so the state chip list doesn't collapse to one option
  // the moment a state is already selected.
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
    filters.state === "all"
      ? byDepartment
      : byDepartment.filter((r) => statePlaceOfPerformanceBucket(r.place_of_performance_state) === filters.state);

  const bySegment = byState.filter((r) =>
    naicsInKeepSegment(r.naics_code, filters.segment)
  );

  const now = new Date();
  const inHorizon =
    filters.horizonDays === null
      ? bySegment
      : bySegment.filter((r) => isWithinDeadlineHorizon(r.response_deadline, now, filters.horizonDays ?? DEFAULT_DEADLINE_HORIZON_DAYS));
  const totalOpen = inHorizon.filter((r) => !NOISE_NOTICE_TYPES.includes(r.notice_type ?? "")).length;

  return { rows: inHorizon, totalOpen, departmentOptions, stateOptions };
}

function SortableHeader({
  href,
  active,
  dir,
  children,
}: {
  href: string;
  active: boolean;
  dir: SortDir;
  children: React.ReactNode;
}) {
  return (
    <th className="p-3 font-medium">
      <Link href={href} className="inline-flex items-center gap-1 hover:text-ink">
        {children}
        <span className={`text-[10px] ${active ? "text-navy-900" : "text-ink/20"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </Link>
    </th>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
        active
          ? "bg-navy-950 text-cream"
          : "border border-navy-950/20 text-navy-950/70 hover:border-navy-950/40"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function OpportunityPipeline({
  viewer,
  basePath,
  searchParams,
}: {
  viewer: "founder" | "subscriber";
  basePath: "/admin/opportunities" | "/app/opportunities";
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const page = parsePage(sp);
  const { sortBy, sortDir } = parseSort(sp);
  const loaded = await getOpportunities(filters, sortBy, sortDir);
  const seat = await getCurrentSeat();
  const actorKey = seat?.id ?? (viewer === "founder" ? "founder" : "");
  let votes = new Map<string, boolean>();
  try {
    votes = await listRelevanceVotes(
      actorKey,
      loaded.rows.map((r) => r.id)
    );
  } catch (err) {
    console.error("relevance votes unavailable:", err);
  }
  let allRows = filters.hideJunk
    ? loaded.rows.filter((r) => votes.get(r.id) !== false)
    : loaded.rows;
  if (filters.myZip && filters.radiusMiles !== null) {
    const radius = filters.radiusMiles;
    allRows = allRows.filter((r) => {
      const miles = distanceFromZipMiles(filters.myZip, r.place_of_performance_zip);
      return miles !== null && miles <= radius;
    });
  }
  const { totalOpen, departmentOptions, stateOptions } = loaded;
  const pageCount = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = allRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  let trackedNaicsCodes = new Set<string>();
  try {
    trackedNaicsCodes = new Set((await getAllNaicsCodes()).map((c) => c.code));
  } catch (err) {
    console.error("tracked NAICS codes unavailable:", err);
  }
  const horizonEnd =
    filters.horizonDays === null
      ? null
      : deadlineHorizonEnd(new Date(), filters.horizonDays);
  const horizonLabel = horizonEnd
    ? horizonEnd.toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const spanLabel = deadlineSpan(allRows);
  const logout = viewer === "founder" ? founderLogout : subscriberLogout;
  const grantsHref = viewer === "founder" ? "/admin/grants" : "/app/grants";

  const qs = (
    overrides: Partial<
      Record<
        | "type"
        | "noise"
        | "activeOnly"
        | "program"
        | "setAside"
        | "noticeType"
        | "department"
        | "state"
        | "q"
        | "horizon"
        | "page"
        | "sort"
        | "dir"
        | "segment"
        | "junk"
        | "myZip"
        | "radius",
        string
      >
    >
  ) =>
    pipelineHref(basePath, {
      type: filters.type,
      noise: filters.noise ? "1" : "0",
      activeOnly: filters.activeOnly ? "1" : "0",
      program: filters.program,
      setAside: filters.setAside,
      noticeType: filters.noticeType,
      department: filters.department,
      state: filters.state,
      q: filters.q,
      horizon: filters.horizonDays === null ? "all" : String(filters.horizonDays),
      page: "1",
      sort: sortBy,
      dir: sortDir,
      segment: filters.segment,
      junk: filters.hideJunk ? "0" : "1",
      myZip: filters.myZip,
      radius: filters.radiusMiles === null ? String(DEFAULT_RADIUS_MILES) : String(filters.radiusMiles),
      ...overrides,
    });

  const sortHref = (key: SortKey) =>
    qs({ sort: key, dir: sortBy === key && sortDir === "asc" ? "desc" : "asc" });

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <SavedGeo currentState={filters.state} />
      <SavedGeo currentState={filters.myZip} storageKey="bidkeep-my-zip" paramName="myZip" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Facilities opportunities pipeline</h1>
          <p className="mt-1 text-sm text-ink/60">
            {horizonLabel ? `Due through ${horizonLabel}` : "All response dates"}
            {spanLabel ? ` · In this list ${spanLabel}` : ""}
            {" · "}
            {allRows.length === 0
              ? "0"
              : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, allRows.length)}`}{" "}
            of {allRows.length} matching filters ({totalOpen} open/actionable notices tracked)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://piee.eb.mil"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-ink/50 underline hover:text-ink"
          >
            PIEE ↗
          </a>
          {viewer === "founder" && (
            <>
              <Link
                href="/admin/naics-codes"
                className="text-sm font-medium text-ink/50 underline hover:text-ink"
              >
                NAICS codes
              </Link>
              <Link
                href="/admin/subscribers"
                className="text-sm font-medium text-ink/50 underline hover:text-ink"
              >
                Subscribers
              </Link>
            </>
          )}
          {viewer === "subscriber" && (
            <Link
              href="/app/company"
              className="text-sm font-medium text-ink/50 underline hover:text-ink"
            >
              Company profile
            </Link>
          )}
          <Link
            href={viewer === "founder" ? "/admin/radar" : "/app/radar"}
            className="text-sm font-medium text-ink/50 underline hover:text-ink"
          >
            Radar
          </Link>
          <Link
            href={grantsHref}
            className="text-sm font-medium text-ink/50 underline hover:text-ink"
          >
            Grants
          </Link>
          {viewer === "subscriber" && (
            <Link
              href="/app/local-bids"
              className="text-sm font-medium text-ink/50 underline hover:text-ink"
            >
              State & local (beta)
            </Link>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium text-ink/50 underline hover:text-ink"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      <form action={basePath} method="GET" className="mt-6 flex items-center gap-2">
        <input type="hidden" name="type" value={filters.type} />
        <input type="hidden" name="noise" value={filters.noise ? "1" : "0"} />
        <input type="hidden" name="activeOnly" value={filters.activeOnly ? "1" : "0"} />
        <input type="hidden" name="program" value={filters.program} />
        <input type="hidden" name="setAside" value={filters.setAside} />
        <input type="hidden" name="noticeType" value={filters.noticeType} />
        <input type="hidden" name="department" value={filters.department} />
        <input type="hidden" name="state" value={filters.state} />
        <input type="hidden" name="horizon" value={filters.horizonDays === null ? "all" : String(filters.horizonDays)} />
        <input type="hidden" name="sort" value={sortBy} />
        <input type="hidden" name="dir" value={sortDir} />
        <input type="hidden" name="segment" value={filters.segment} />
        <input type="hidden" name="junk" value={filters.hideJunk ? "0" : "1"} />
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search titles…"
          className="w-64 rounded-lg border border-navy-950/20 px-3 py-1.5 text-sm outline-none focus:border-gold-500"
        />
        <button
          type="submit"
          className="rounded-lg border border-navy-950/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy-950/70 hover:border-navy-950/40"
        >
          Search
        </button>
        {filters.q && (
          <Link href={qs({ q: "" })} className="text-xs font-medium text-ink/50 underline hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      <form action={basePath} method="GET" className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="type" value={filters.type} />
        <input type="hidden" name="noise" value={filters.noise ? "1" : "0"} />
        <input type="hidden" name="activeOnly" value={filters.activeOnly ? "1" : "0"} />
        <input type="hidden" name="program" value={filters.program} />
        <input type="hidden" name="setAside" value={filters.setAside} />
        <input type="hidden" name="noticeType" value={filters.noticeType} />
        <input type="hidden" name="department" value={filters.department} />
        <input type="hidden" name="state" value={filters.state} />
        <input type="hidden" name="q" value={filters.q} />
        <input type="hidden" name="horizon" value={filters.horizonDays === null ? "all" : String(filters.horizonDays)} />
        <input type="hidden" name="sort" value={sortBy} />
        <input type="hidden" name="dir" value={sortDir} />
        <input type="hidden" name="segment" value={filters.segment} />
        <input type="hidden" name="junk" value={filters.hideJunk ? "0" : "1"} />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
          Distance from
        </span>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          name="myZip"
          defaultValue={filters.myZip}
          placeholder="Your ZIP"
          className="w-28 rounded-lg border border-navy-950/20 px-3 py-1.5 text-sm outline-none focus:border-gold-500"
        />
        <select
          name="radius"
          defaultValue={filters.radiusMiles ?? DEFAULT_RADIUS_MILES}
          className="rounded-lg border border-navy-950/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-gold-500"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              within {r} mi
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-navy-950/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy-950/70 hover:border-navy-950/40"
        >
          Apply
        </button>
        {filters.myZip && (
          <Link href={qs({ myZip: "" })} className="text-xs font-medium text-ink/50 underline hover:text-ink">
            Clear
          </Link>
        )}
        {filters.myZip && (
          <span className="text-xs text-ink/40">
            Distance is estimated from ZIP centroids, not routing -- treat it as approximate.
          </span>
        )}
      </form>

      <div className="mt-6 flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Acquisition
          </span>
          <FilterLink href={qs({ type: "material" })} active={filters.type === "material"}>
            Material
          </FilterLink>
          <FilterLink href={qs({ type: "service" })} active={filters.type === "service"}>
            Service
          </FilterLink>
          <FilterLink href={qs({ type: "all" })} active={filters.type === "all"}>
            All
          </FilterLink>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            NAICS
          </span>
          {(Object.values(KEEP_SEGMENTS) as { id: KeepSegmentId; label: string }[]).map((seg) => (
            <FilterLink
              key={seg.id}
              href={qs({ segment: seg.id })}
              active={filters.segment === seg.id}
            >
              {seg.label}
            </FilterLink>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Notice Type
          </span>
          <FilterLink href={qs({ noticeType: "all" })} active={filters.noticeType === "all"}>
            All
          </FilterLink>
          {NOTICE_TYPE_OPTIONS.map((nt) => (
            <FilterLink key={nt} href={qs({ noticeType: nt })} active={filters.noticeType === nt}>
              {nt}
            </FilterLink>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Noise
          </span>
          <FilterLink href={qs({ noise: "0" })} active={!filters.noise}>
            Hide awarded/justifications
          </FilterLink>
          <FilterLink href={qs({ noise: "1" })} active={filters.noise}>
            Show all
          </FilterLink>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Relevance
          </span>
          <FilterLink href={qs({ junk: "0" })} active={filters.hideJunk}>
            Hide junk I marked
          </FilterLink>
          <FilterLink href={qs({ junk: "1" })} active={!filters.hideJunk}>
            Show junk
          </FilterLink>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Status
          </span>
          <FilterLink href={qs({ activeOnly: "1" })} active={filters.activeOnly}>
            Active pipeline
          </FilterLink>
          <FilterLink href={qs({ activeOnly: "0" })} active={!filters.activeOnly}>
            Include expired/lost
          </FilterLink>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Deadline
          </span>
          <FilterLink
            href={qs({ horizon: "30", sort: "deadline", dir: "asc" })}
            active={filters.horizonDays === 30}
          >
            30 days
          </FilterLink>
          <FilterLink
            href={qs({
              horizon: String(DEFAULT_DEADLINE_HORIZON_DAYS),
              sort: "deadline",
              dir: "asc",
            })}
            active={filters.horizonDays === DEFAULT_DEADLINE_HORIZON_DAYS}
          >
            90 days
          </FilterLink>
          <FilterLink href={qs({ horizon: "all", sort: "deadline", dir: "asc" })} active={filters.horizonDays === null}>
            All dates
          </FilterLink>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Scale</span>
          <FilterLink href={qs({ program: "all" })} active={filters.program === "all"}>
            All
          </FilterLink>
          <FilterLink href={qs({ program: "big" })} active={filters.program === "big"}>
            BPA / IDIQ
          </FilterLink>
          <FilterLink href={qs({ program: "single" })} active={filters.program === "single"}>
            Single-buy
          </FilterLink>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Set-Aside
          </span>
          <FilterLink href={qs({ setAside: "all" })} active={filters.setAside === "all"}>
            All
          </FilterLink>
          <FilterLink
            href={qs({ setAside: "small-business" })}
            active={filters.setAside === "small-business"}
          >
            Small Business
          </FilterLink>
          <FilterLink href={qs({ setAside: "8a" })} active={filters.setAside === "8a"}>
            8(a)
          </FilterLink>
          <FilterLink href={qs({ setAside: "sdvosb" })} active={filters.setAside === "sdvosb"}>
            SDVOSB
          </FilterLink>
          <FilterLink href={qs({ setAside: "wosb" })} active={filters.setAside === "wosb"}>
            WOSB
          </FilterLink>
          <FilterLink href={qs({ setAside: "hubzone" })} active={filters.setAside === "hubzone"}>
            HUBZone
          </FilterLink>
          <FilterLink href={qs({ setAside: "none" })} active={filters.setAside === "none"}>
            Full and Open
          </FilterLink>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Department
          </span>
          <FilterLink href={qs({ department: "all" })} active={filters.department === "all"}>
            All
          </FilterLink>
          {departmentOptions.map((d) => (
            <FilterLink key={d.name} href={qs({ department: d.name })} active={filters.department === d.name}>
              {d.name} ({d.count})
            </FilterLink>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            State
          </span>
          <FilterLink href={qs({ state: "all" })} active={filters.state === "all"}>
            All
          </FilterLink>
          {stateOptions.map((s) => (
            <FilterLink key={s.name} href={qs({ state: s.name })} active={filters.state === s.name}>
              {s.name} ({s.count})
            </FilterLink>
          ))}
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-navy-950/10">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-950/10 bg-navy-950/[0.03] text-ink/50">
              <SortableHeader href={sortHref("title")} active={sortBy === "title"} dir={sortDir}>
                Title
              </SortableHeader>
              <SortableHeader href={sortHref("agency")} active={sortBy === "agency"} dir={sortDir}>
                Agency
              </SortableHeader>
              <SortableHeader href={sortHref("naics")} active={sortBy === "naics"} dir={sortDir}>
                NAICS / PSC
              </SortableHeader>
              <SortableHeader href={sortHref("setAside")} active={sortBy === "setAside"} dir={sortDir}>
                Set-Aside
              </SortableHeader>
              <SortableHeader href={sortHref("state")} active={sortBy === "state"} dir={sortDir}>
                State
              </SortableHeader>
              <SortableHeader href={sortHref("type")} active={sortBy === "type"} dir={sortDir}>
                Type
              </SortableHeader>
              <SortableHeader href={sortHref("ceiling")} active={sortBy === "ceiling"} dir={sortDir}>
                Ceiling
              </SortableHeader>
              <SortableHeader href={sortHref("deadline")} active={sortBy === "deadline"} dir={sortDir}>
                Deadline
              </SortableHeader>
              <SortableHeader href={sortHref("status")} active={sortBy === "status"} dir={sortDir}>
                Status
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((op) => (
              <tr key={op.id} className="border-b border-navy-950/10 last:border-0">
                <td className="max-w-xs p-3">
                  {op.notice_url ? (
                    <a
                      href={op.notice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
                    >
                      {op.title}
                    </a>
                  ) : (
                    op.title
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink/40">
                    <span>{op.notice_type ?? "—"}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-ink/55">
                    {explainNaicsMatch(op.naics_code, trackedNaicsCodes).label}
                  </p>
                  <RelevanceButtons
                    opportunityId={op.id}
                    vote={votes.has(op.id) ? votes.get(op.id)! : null}
                  />
                  <Link
                    href={`${basePath}/${op.id}`}
                    className="mt-1.5 inline-block rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-navy-950 transition-colors hover:bg-gold-400"
                  >
                    Research →
                  </Link>
                </td>
                <td className="p-3 text-ink/70">{op.agency ?? "—"}</td>
                <td className="p-3 font-mono text-xs text-ink/70">
                  {op.naics_code ?? "—"} / {op.psc_code ?? "—"}
                  {op.naics_code && !trackedNaicsCodes.has(op.naics_code) && (
                    <span
                      title="NAICS code on this notice doesn't match a currently-tracked code — it may have been retired since this row was synced"
                      className="ml-1.5 rounded-full bg-gold-500/20 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase text-gold-700"
                    >
                      Untracked NAICS
                    </span>
                  )}
                </td>
                <td className="p-3 text-ink/70">
                  {(() => {
                    const category = classifySetAside(op.set_aside_type);
                    const text = op.set_aside_type ?? "Full and open";
                    if (category === "none") {
                      return text;
                    }
                    return (
                      <span
                        title={text}
                        className="rounded-full bg-gold-500/20 px-2 py-0.5 text-xs font-semibold text-gold-700"
                      >
                        {SET_ASIDE_BADGE_LABEL[category] ?? text}
                      </span>
                    );
                  })()}
                </td>
                <td className="p-3 text-ink/70">
                  {op.place_of_performance_state ?? "—"}
                  {filters.myZip &&
                    (() => {
                      const miles = distanceFromZipMiles(filters.myZip, op.place_of_performance_zip);
                      return miles !== null ? (
                        <span className="ml-1 text-xs text-ink/40">({Math.round(miles)} mi)</span>
                      ) : null;
                    })()}
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      op.acquisition_type === "material"
                        ? "bg-gold-500/20 text-gold-700"
                        : op.acquisition_type === "service"
                          ? "bg-navy-950/10 text-navy-900"
                          : "bg-ink/10 text-ink/50"
                    }`}
                  >
                    {op.acquisition_type ?? "unknown"}
                  </span>
                </td>
                <td className="p-3 text-xs text-ink/70">
                  {(() => {
                    const label = scaleLabel(op);
                    if (!label) return <span className="text-ink/30">—</span>;
                    return (
                      <span
                        title={label}
                        className="rounded-full bg-navy-950/10 px-2 py-0.5 font-semibold text-navy-900"
                      >
                        {label}
                      </span>
                    );
                  })()}
                </td>
                <td className="p-3 text-ink/70">
                  {op.response_deadline ? formatDeadlineWithZone(op.response_deadline) : "—"}
                </td>
                <td className="p-3">
                  <StatusSelect id={op.id} status={op.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-sm text-ink/50">No opportunities match these filters.</p>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {currentPage > 1 ? (
            <Link
              href={qs({ page: String(currentPage - 1) })}
              className="font-medium text-navy-900 underline hover:text-navy-950"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink/50">
            Page {currentPage} of {pageCount}
          </span>
          {currentPage < pageCount ? (
            <Link
              href={qs({ page: String(currentPage + 1) })}
              className="font-medium text-navy-900 underline hover:text-navy-950"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  );
}
