import "server-only";

/**
 * Grants.gov Search2 -- the "next funding cycle just opened" signal.
 * Public API, no key required.
 */
const GRANTS_GOV_SEARCH_URL = "https://api.grants.gov/v1/api/search2";

const MAX_ROWS_PER_REQUEST = 25;

export type FundingOpportunity = {
  id: string;
  number: string;
  title: string;
  agency: string | null;
  /** ISO (YYYY-MM-DD) -- see toIsoDate. */
  openDate: string | null;
  /** ISO (YYYY-MM-DD) -- see toIsoDate. */
  closeDate: string | null;
  status: string | null;
  alnList: string[];
  opportunityUrl: string;
};

/** Grants.gov returns dates as "MM/DD/YYYY". Normalize to ISO so callers can
 * write straight into a Postgres `date` column and sort/compare correctly --
 * a raw text compare of "07/20/2026" vs "11/07/2025" would wrongly rank July
 * before November regardless of year. */
export function toIsoDate(mmddyyyy: string | null | undefined): string | null {
  if (!mmddyyyy) return null;
  const m = mmddyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

type GrantsGovOppHit = {
  id?: string;
  number?: string;
  title?: string;
  agency?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  cfdaList?: string[];
};

type GrantsGovSearchResponse = {
  errorcode?: number;
  msg?: string;
  data?: {
    hitCount?: number;
    oppHits?: GrantsGovOppHit[];
  };
};

function toFundingOpportunity(hit: GrantsGovOppHit): FundingOpportunity | null {
  if (!hit.id || !hit.number || !hit.title) return null;
  return {
    id: hit.id,
    number: hit.number,
    title: hit.title,
    agency: hit.agency ?? null,
    openDate: toIsoDate(hit.openDate),
    closeDate: toIsoDate(hit.closeDate),
    status: hit.oppStatus ?? null,
    alnList: hit.cfdaList ?? [],
    opportunityUrl: `https://www.grants.gov/search-results-detail/${hit.id}`,
  };
}

async function search2(body: Record<string, unknown>): Promise<FundingOpportunity[]> {
  const res = await fetch(GRANTS_GOV_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: MAX_ROWS_PER_REQUEST, ...body }),
  });

  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(`Grants.gov API error ${res.status}: ${responseBody}`);
  }

  const data = (await res.json()) as GrantsGovSearchResponse;
  if (data.errorcode) {
    throw new Error(`Grants.gov API error: ${data.msg ?? "unknown"}`);
  }

  const hits = data.data?.oppHits ?? [];
  const opportunities: FundingOpportunity[] = [];
  for (const hit of hits) {
    const opp = toFundingOpportunity(hit);
    if (opp) opportunities.push(opp);
  }
  return opportunities;
}

/** Fetches funding opportunities for a given Assistance Listing (CFDA)
 * number, across every status -- including already-closed/archived cycles,
 * since a program that just closed is exactly when its USAspending award
 * data starts to appear (see usaspending.ts). */
export async function searchFundingOpportunitiesByAln(
  aln: string
): Promise<FundingOpportunity[]> {
  return search2({ cfda: aln, oppStatuses: "forecasted|posted|closed|archived" });
}

