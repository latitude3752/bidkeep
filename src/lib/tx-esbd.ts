import "server-only";

/**
 * Texas Electronic State Business Daily (ESBD) — the state's own public
 * bid-advertising system (txsmartbuy.gov/esbd), run by the Comptroller's
 * Statewide Procurement Division. Sign-in is explicitly not required
 * ("Sign in is NOT required" on the page itself). Like Georgia's GPR,
 * this is a single feed covering state agencies, higher ed, and local
 * governments (cities, counties, ISDs, councils of governments) together
 * -- at roughly 100x Georgia's volume (~60k total records; ~500 with an
 * active "Posted" status at any time).
 *
 * The search endpoint (`ESBD.Service.ss`) is a NetSuite SuiteCommerce
 * service -- found the same way GPR's and Bonfire's endpoints were, by
 * inspecting the page's own outgoing request, not from any published
 * documentation. Unlike GPR, this one needs no session cookie at all: a
 * cold, cookie-less POST with a plain JSON body works (confirmed by
 * hand), and it needs no special User-Agent either -- a meaningfully
 * simpler target than either GPR or Bonfire.
 *
 * The server enforces a fixed page size of 24 regardless of any
 * `recordsPerPage` override, so a keyword-filtered query still needs a
 * short pagination loop (not a single request like GPR's).
 */

const ESBD_SEARCH_URL =
  "https://www.txsmartbuy.gov/app/extensions/CPA/CPAMain/1.0.0/services/ESBD.Service.ss?c=852252&n=2";

/** Status code for "Posted" (active/open) solicitations -- read directly
 * off the search page's Status <select> (1=Posted, 2=Awarded, 11=No
 * Award, 5=Closed, 3=Posting Cancelled). */
const STATUS_POSTED = "1";

/** Server enforces this page size regardless of any recordsPerPage sent
 * in the request body. */
const PAGE_SIZE = 24;

/** Hard cap on pages fetched per keyword -- bounds worst-case request
 * count if a keyword is unexpectedly broad (same safety role as
 * Bonfire's MAX_PAGES_PER_KEYWORD). 240 records at 24/page is well above
 * any single keyword's typical result set (88 for "construction" alone
 * on BidYard's equivalent search). */
const MAX_PAGES_PER_KEYWORD = 10;

/** ESBD is a live state procurement system, not a dedicated API -- pace
 * requests the same way the Bonfire integration does rather than firing
 * a tight loop. */
const REQUEST_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type TxEsbdLine = {
  internalid: string;
  title: string;
  solicitationId: string;
  responseDue: string | null;
  responseTime: string | null;
  agencyNumber: string | null;
  agencyName: string | null;
  status: string;
  statusName: string;
  postingDate: string | null;
  nigpCodes: string | null;
  url: string | null;
};

export type TxEsbdOpportunity = {
  noticeId: string;
  title: string;
  agencyName: string | null;
  statusName: string;
  postingDate: string | null;
  responseDue: string | null;
  responseTime: string | null;
  nigpCodes: string | null;
  /** External bidding-platform link when the agency hosts its own
   * response process elsewhere (e.g. SciQuest/Jaggaer) -- falls back to
   * the ESBD detail page when empty. */
  detailUrl: string;
};

type EsbdSearchResponse = {
  totalRecordsFound?: number;
  recordsPerPage?: number;
  page?: number;
  lines?: TxEsbdLine[];
};

export function buildTxEsbdDetailUrl(line: TxEsbdLine): string {
  if (line.url) return line.url;
  return `https://www.txsmartbuy.gov/esbd/${encodeURIComponent(line.solicitationId)}`;
}

function toTxEsbdOpportunity(line: TxEsbdLine): TxEsbdOpportunity {
  return {
    noticeId: line.solicitationId,
    title: line.title,
    agencyName: line.agencyName,
    statusName: line.statusName,
    postingDate: line.postingDate,
    responseDue: line.responseDue,
    responseTime: line.responseTime,
    nigpCodes: line.nigpCodes,
    detailUrl: buildTxEsbdDetailUrl(line),
  };
}

async function searchEsbdPage(opts: {
  page: number;
  keyword: string;
}): Promise<EsbdSearchResponse> {
  const res = await fetch(ESBD_SEARCH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ page: opts.page, status: STATUS_POSTED, keyword: opts.keyword }),
  });
  if (!res.ok) {
    throw new Error(`ESBD search HTTP ${res.status} (keyword="${opts.keyword}", page=${opts.page})`);
  }
  return (await res.json()) as EsbdSearchResponse;
}

/** Runs every configured keyword as a separate server-side-filtered
 * search (ESBD's `keyword` field does real filtering, unlike Bonfire's
 * free-text-only search or GPR's category taxonomy), paginating each
 * keyword's full result set (server-fixed 24/page) up to
 * MAX_PAGES_PER_KEYWORD, and returns the deduplicated union. A single
 * keyword or page's failure is recorded and skipped rather than
 * aborting the whole run. */
export async function fetchTxEsbdOpportunities(
  keywords: readonly string[],
): Promise<{ opportunities: TxEsbdOpportunity[]; errors: string[] }> {
  const byId = new Map<string, TxEsbdOpportunity>();
  const errors: string[] = [];

  for (const keyword of keywords) {
    let page = 1;
    let totalRecordsFound = Infinity;
    let fetched = 0;

    while (fetched < totalRecordsFound && page <= MAX_PAGES_PER_KEYWORD) {
      try {
        const body = await searchEsbdPage({ page, keyword });
        totalRecordsFound = body.totalRecordsFound ?? 0;
        const lines = body.lines ?? [];
        for (const line of lines) {
          byId.set(line.solicitationId, toTxEsbdOpportunity(line));
        }
        fetched += lines.length;
        if (lines.length === 0) break; // no more pages
      } catch (err) {
        errors.push(`esbd "${keyword}" page ${page}: ${err instanceof Error ? err.message : String(err)}`);
        break; // don't keep paging a keyword that's already failing
      }
      page++;
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return { opportunities: [...byId.values()], errors };
}
