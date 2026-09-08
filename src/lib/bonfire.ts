import "server-only";
import { createHash } from "node:crypto";

/**
 * Bonfire (Euna Supplier Network) public preview search — state/local
 * procurement sourcing, since most facilities procurement (school
 * districts, municipal buildings, campus grounds, guard posts) happens
 * below the federal SAM.gov level BidHawk's engine covers.
 *
 * This hits `vendor.bonfirehub.com`'s own public, unauthenticated preview
 * API (the same endpoint the site's `/preview` browse page calls — found
 * via its network requests, not documented anywhere) rather than scraping
 * rendered HTML. No API key exists or is needed for this endpoint.
 *
 * IMPORTANT LIMITATION: the preview tier returns only title, status,
 * open/close dates, and state — no agency, description, documents, or a
 * per-listing id/link. Full detail sits behind Bonfire's own paid "Premium
 * Vendor" subscription (confirmed by hand: clicking through triggers a
 * paywall modal). This is a teaser feed, not a substitute for SAM.gov's
 * full-notice pipeline — see BonfireOpportunity.searchUrl, which links back
 * to Bonfire's own browse page (not a specific listing, since there's no id
 * to link to) rather than a real notice detail page.
 *
 * Unlike SAM.gov, there's no NAICS-equivalent code search here — only a
 * free-text `search` param — so this runs a small, fixed set of
 * facilities-service keywords as separate queries (same wide-net-keyword
 * shape as BidHawk's keyword pass, applied here because Bonfire's API
 * leaves no better option).
 */

const BONFIRE_PREVIEW_BASE =
  "https://common-production-api-global.bonfirehub.com/v1.0/projects/preview/search";

/** Facilities-service keywords run as separate free-text searches against
 * Bonfire's preview index (no NAICS-equivalent filter exists there). Kept
 * short and specific rather than broad, generic terms ("services",
 * "contract") that would mostly return noise. */
export const BONFIRE_FACILITIES_KEYWORDS = [
  "janitorial",
  "custodial",
  "landscaping",
  "grounds maintenance",
  "security guard",
  "facilities support",
  "pest control",
  "building services",
  "carpet cleaning",
  "waste collection",
] as const;

/** Pages fetched per keyword, 25 results each (site default page size) --
 * bounds total requests (10 keywords * up to 4 pages = up to 40 calls per
 * run) and keeps only the freshest results (sorted -dateOpen) if a keyword
 * has more matches than the cap covers. */
const MAX_PAGES_PER_KEYWORD = 4;
const PAGE_SIZE = 25;
const REQUEST_DELAY_MS = 200;

export type BonfirePreviewRow = {
  ProjectName: string;
  ProjectStatusID: number;
  DateOpen: string | null;
  DateClose: string | null;
  Locations: string[] | null;
};

export type BonfireOpportunity = {
  /** Deterministic key: sha256(title|state|dateOpen|dateClose) -- Bonfire's
   * preview tier exposes no id, so this is the only stable dedup key,
   * including across the same listing matching more than one keyword. */
  dedupKey: string;
  title: string;
  /** Two-letter US state code parsed from "US.XX", or null if unparseable
   * (e.g. multi-state or non-US locations). */
  state: string | null;
  statusId: number;
  dateOpen: string | null;
  dateClose: string | null;
  /** Links back to Bonfire's own browse page with this title pre-filled in
   * search -- NOT a link to the specific listing (no id exists to link to
   * at the preview tier). Full detail requires a paid Bonfire account. */
  searchUrl: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseState(locations: string[] | null | undefined): string | null {
  const first = locations?.[0];
  if (!first) return null;
  const match = /^US\.([A-Z]{2})$/.exec(first);
  return match ? match[1]! : null;
}

export function buildBonfireDedupKey(row: {
  title: string;
  state: string | null;
  dateOpen: string | null;
  dateClose: string | null;
}): string {
  const joined = `${row.title.trim().toLowerCase()}|${row.state ?? ""}|${row.dateOpen ?? ""}|${row.dateClose ?? ""}`;
  return createHash("sha256").update(joined).digest("hex").slice(0, 32);
}

export function buildBonfireSearchUrl(title: string): string {
  const qs = new URLSearchParams({ search: title });
  return `https://vendor.bonfirehub.com/preview?${qs.toString()}`;
}

function toBonfireOpportunity(row: BonfirePreviewRow): BonfireOpportunity {
  const state = parseState(row.Locations);
  const dedupKey = buildBonfireDedupKey({
    title: row.ProjectName,
    state,
    dateOpen: row.DateOpen,
    dateClose: row.DateClose,
  });
  return {
    dedupKey,
    title: row.ProjectName,
    state,
    statusId: row.ProjectStatusID,
    dateOpen: row.DateOpen,
    dateClose: row.DateClose,
    searchUrl: buildBonfireSearchUrl(row.ProjectName),
  };
}

/** One page of Bonfire's public preview search. Throws on a non-200
 * response or unparseable body -- callers decide whether to skip the
 * keyword or abort the run. */
export async function searchBonfirePreview(opts: {
  search: string;
  page: number;
  limit?: number;
}): Promise<BonfirePreviewRow[]> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? PAGE_SIZE),
    page: String(opts.page),
    sort: "-dateOpen",
    search: opts.search,
  });
  const res = await fetch(`${BONFIRE_PREVIEW_BASE}?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Bonfire preview search HTTP ${res.status} (search="${opts.search}", page=${opts.page})`);
  }
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new Error(`Bonfire preview search: unexpected response shape (search="${opts.search}")`);
  }
  return body as BonfirePreviewRow[];
}

/** Runs every configured facilities keyword against Bonfire's preview
 * search, paginating up to MAX_PAGES_PER_KEYWORD each, and returns the
 * deduplicated union. A single keyword's failure (network error, non-200)
 * is recorded and skipped rather than aborting the whole run -- same
 * per-item resilience as BidHawk's own SAM.gov keyword pass. */
export async function fetchAllBonfireOpportunities(
  keywords: readonly string[] = BONFIRE_FACILITIES_KEYWORDS,
): Promise<{ opportunities: BonfireOpportunity[]; errors: string[] }> {
  const byKey = new Map<string, BonfireOpportunity>();
  const errors: string[] = [];

  for (const keyword of keywords) {
    for (let page = 1; page <= MAX_PAGES_PER_KEYWORD; page++) {
      try {
        const rows = await searchBonfirePreview({ search: keyword, page });
        for (const row of rows) {
          const opp = toBonfireOpportunity(row);
          byKey.set(opp.dedupKey, opp);
        }
        if (rows.length < PAGE_SIZE) break; // last page for this keyword
      } catch (err) {
        errors.push(`bonfire "${keyword}" page ${page}: ${err instanceof Error ? err.message : String(err)}`);
        break; // don't keep paging a keyword that's already failing
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return { opportunities: [...byKey.values()], errors };
}
