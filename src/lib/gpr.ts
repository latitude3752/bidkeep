import "server-only";

/**
 * Georgia Procurement Registry (GPR) — the state's own, legally-mandated
 * public bid-advertising system (O.C.G.A. requires any Georgia state *or
 * local* government solicitation over $100k to post here). Unlike
 * Bonfire's preview tier, GPR is genuinely free and unauthenticated: full
 * agency name, buyer contact, description, and a real per-notice detail
 * link, covering every Georgia county, city, school board, and state
 * agency in one feed -- not just whichever agencies happen to license a
 * commercial e-procurement platform.
 *
 * The search endpoint (`/gpr/eventSearch`) is a jQuery DataTables
 * server-side-processing endpoint -- found the same way Bonfire's preview
 * API was, by inspecting the page's own outgoing request, not from any
 * published documentation. It requires a session cookie (a GET of the
 * search page issues one; no login or credentials involved) and a
 * DataTables-shaped POST body. GA's own category taxonomy has no exact
 * "Facilities" bucket -- the closest is `Services_SpecialProjects`, which
 * is broader than facilities work (also covers legal, IT, and consulting
 * services), so results are further narrowed client-side by the same
 * facilities-trade keyword list Bonfire already uses against the title.
 *
 * This is a genuinely public transparency system (no ToS restricting
 * automated access was found on the site), separate legal posture from
 * Bonfire's commercial preview tier.
 */

const GPR_BASE = "https://ssl.doas.state.ga.us/gpr";

/** GPR's server redirects any request whose User-Agent doesn't look like a
 * real browser to an "/unsupported?browser=" page instead of erroring --
 * confirmed by hand, a generic "BidKeepBot/1.0"-style UA silently gets
 * HTML back instead of JSON. A real Chrome UA string is required, not
 * optional, for both the session GET and the search POST. */
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** GA's own procurement category taxonomy (the `catType` filter's real
 * option values, read directly off the search page's <select>). No exact
 * "Facilities" bucket exists -- Services_SpecialProjects is the closest,
 * narrowed further by BONFIRE_FACILITIES_KEYWORDS-style title matching. */
export const GPR_CATEGORY_SERVICES = "Services_SpecialProjects";

/** Facilities-trade keywords used to narrow GPR's broader
 * Services_SpecialProjects category down to facilities-relevant listings
 * -- same list already proven against Bonfire's free-text search. */
export const GPR_FACILITIES_KEYWORDS = [
  "janitorial",
  "custodial",
  "landscaping",
  "grounds maintenance",
  "security guard",
  "facilities",
  "building services",
  "carpet cleaning",
  "pest control",
  "hvac",
  "maintenance",
] as const;

const PAGE_SIZE = 500;

export type GprEventRow = {
  eSourceId: string;
  esourceNumber: string;
  esourceNumberKey: string;
  sourceId: string;
  title: string;
  agencyCode: string | null;
  agencyName: string | null;
  closingDate: string | null;
  postingDate: string | null;
  status: string | null;
  governmentType: string | null;
  financialYear: string | null;
  bidProcessType: string | null;
  soleSource: boolean | null;
  electronicBid: boolean | null;
};

export type GprOpportunity = {
  noticeId: string;
  title: string;
  agencyName: string | null;
  governmentType: string | null;
  status: string | null;
  postingDate: string | null;
  closingDate: string | null;
  bidProcessType: string | null;
  soleSource: boolean;
  electronicBid: boolean;
  detailUrl: string;
};

type GprSearchResponse = {
  draw?: number;
  recordsTotal?: number;
  recordsFiltered?: number;
  data?: GprEventRow[] | null;
  message?: string;
};

/** GET the search page to obtain a session cookie -- GPR's eventSearch
 * endpoint 500s/errors without one, and this is the only auth it needs
 * (no login, no API key). */
async function establishSession(): Promise<string> {
  const res = await fetch(`${GPR_BASE}/`, {
    headers: { "user-agent": BROWSER_USER_AGENT },
  });
  const setCookie = res.headers.get("set-cookie");
  const match = setCookie ? /JSESSIONID=([^;]+)/.exec(setCookie) : null;
  if (!match) throw new Error("GPR: no session cookie in response");
  return `JSESSIONID=${match[1]}`;
}

/** One column entry in the DataTables server-side-processing POST body.
 * `data` is the literal string "function" for the four columns GPR's own
 * page defines with a JS render function (icon, id-link, posting/closing
 * date, ending-in, status-icon) rather than a plain field name -- that's
 * what the real page's own request sends, confirmed by intercepting it. */
function dtColumn(data: string): Record<string, string> {
  return {
    data,
    name: "",
    searchable: "true",
    orderable: "true",
    "search[value]": "",
    "search[regex]": "false",
  };
}

function buildSearchBody(opts: { catType: string; start: number; length: number }): string {
  const columns = [
    dtColumn("function"),
    dtColumn("function"),
    dtColumn("title"),
    dtColumn("agencyName"),
    dtColumn("function"),
    dtColumn("function"),
    dtColumn("function"),
    dtColumn("status"),
  ];

  const params = new URLSearchParams();
  params.set("draw", "1");
  columns.forEach((col, i) => {
    for (const [key, value] of Object.entries(col)) {
      params.set(`columns[${i}][${key}]`, value);
    }
  });
  params.set("order[0][column]", "5"); // End Date column -- soonest deadline first
  params.set("order[0][dir]", "asc");
  params.set("start", String(opts.start));
  params.set("length", String(opts.length));
  params.set("search[value]", "");
  params.set("search[regex]", "false");
  params.set("responseType", "ALL");
  params.set("eventStatus", "OPEN");
  params.set("eventIdTitle", "");
  params.set("govType", "ALL");
  params.set("govEntity", "");
  params.set("catType", opts.catType);
  params.set("eventProcessType", "ALL");
  params.set("dateRangeType", "");
  params.set("rangeStartDate", "");
  params.set("rangeEndDate", "");
  params.set("isReset", "false");
  params.set("persisted", "");
  params.set("refreshSearchData", "false");
  return params.toString();
}

export function buildGprDetailUrl(esourceNumberKey: string, sourceId: string): string {
  const qs = new URLSearchParams({ eSourceNumber: esourceNumberKey, sourceSystemType: sourceId });
  return `${GPR_BASE}/eventDetails?${qs.toString()}`;
}

function toGprOpportunity(row: GprEventRow): GprOpportunity {
  return {
    noticeId: row.esourceNumber,
    title: row.title,
    agencyName: row.agencyName,
    governmentType: row.governmentType,
    status: row.status,
    postingDate: row.postingDate,
    closingDate: row.closingDate,
    bidProcessType: row.bidProcessType,
    soleSource: Boolean(row.soleSource),
    electronicBid: Boolean(row.electronicBid),
    detailUrl: buildGprDetailUrl(row.esourceNumberKey, row.sourceId),
  };
}

function titleMentionsFacilitiesKeyword(title: string, keywords: readonly string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

/** Fetches every OPEN GPR listing in Services_SpecialProjects, then
 * narrows to facilities-relevant titles client-side (single request --
 * `length` is set well above the category's typical volume, so this is
 * not a paginated crawl like Bonfire's per-keyword loop). */
export async function fetchGprOpportunities(
  catType: string = GPR_CATEGORY_SERVICES,
  keywords: readonly string[] = GPR_FACILITIES_KEYWORDS,
): Promise<{ opportunities: GprOpportunity[]; errors: string[] }> {
  const errors: string[] = [];
  try {
    const cookie = await establishSession();
    const res = await fetch(`${GPR_BASE}/eventSearch`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        referer: `${GPR_BASE}/`,
        cookie,
        "user-agent": BROWSER_USER_AGENT,
      },
      body: buildSearchBody({ catType, start: 0, length: PAGE_SIZE }),
    });
    if (!res.ok) {
      throw new Error(`GPR eventSearch HTTP ${res.status}`);
    }
    const body = (await res.json()) as GprSearchResponse;
    if (!Array.isArray(body.data)) {
      throw new Error(`GPR eventSearch: ${body.message ?? "unexpected response shape"}`);
    }
    const relevant = body.data.filter((row) => titleMentionsFacilitiesKeyword(row.title, keywords));
    return { opportunities: relevant.map(toGprOpportunity), errors };
  } catch (err) {
    errors.push(`gpr catType=${catType}: ${err instanceof Error ? err.message : String(err)}`);
    return { opportunities: [], errors };
  }
}
