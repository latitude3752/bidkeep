import "server-only";

/**
 * USAspending.gov award search -- the "who just got funded" signal.
 * Public API, no key required. `program_numbers` filters by Assistance
 * Listing (formerly CFDA) number, e.g. "14.872" for Public Housing Capital Fund.
 */
const USASPENDING_SEARCH_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

/** Grant award type codes: 02 block, 03 formula, 04 project, 05 cooperative
 * agreement. Covers every award USAspending classifies as a grant; confirmed
 * against spending_by_award_count that this set matches the full grants
 * total for a real ALN with no award_type filter at all. */
const GRANT_AWARD_TYPE_CODES = ["02", "03", "04", "05"];

const MAX_PAGES = 10;
const PAGE_SIZE = 100;

/** Gateway / overload statuses USAspending returns during the morning cron.
 * 4xx and 500 stay hard failures so founder alerts still fire immediately. */
export const USASPENDING_TRANSIENT_STATUSES = new Set([502, 503, 504]);

/** 1 initial attempt + 3 retries. Worst-case extra wait is
 * 500 + 1000 + 2000 = 3.5s per page — inside the grant-sync time budget. */
export const USASPENDING_MAX_ATTEMPTS = 4;
export const USASPENDING_INITIAL_BACKOFF_MS = 500;

export type UsaSpendingRetryOptions = {
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function usaspendingBackoffMs(attemptIndex: number): number {
  return USASPENDING_INITIAL_BACKOFF_MS * 2 ** attemptIndex;
}

/** Fetch-layer failures that look like a dropped or empty gateway response
 * rather than a real API contract error. */
function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "AbortError" ||
    err.name === "TimeoutError" ||
    err.name === "TypeError" ||
    err.name === "SyntaxError"
  );
}

export type GrantAward = {
  /** USAspending's generated_internal_id -- globally unique across every
   * award on the site, unlike the human-readable "Award ID" (e.g.
   * "EMW-2026-CU-05011"), which is only unique within one program. */
  awardId: string;
  awardNumber: string | null;
  recipientName: string;
  awardingAgency: string | null;
  amount: number | null;
  startDate: string | null;
  description: string | null;
  state: string | null;
  county: string | null;
  city: string | null;
};

type UsaSpendingRecipientLocation = {
  state_code?: string | null;
  state_name?: string | null;
  county_name?: string | null;
  city_name?: string | null;
} | null;

type UsaSpendingResultRow = {
  generated_internal_id?: string;
  internal_id?: number;
  "Award ID"?: string;
  "Recipient Name"?: string;
  "Awarding Agency"?: string;
  "Award Amount"?: number;
  "Start Date"?: string;
  Description?: string;
  "Recipient Location"?: UsaSpendingRecipientLocation;
};

type UsaSpendingSearchResponse = {
  results?: UsaSpendingResultRow[];
  page_metadata?: { page: number; hasNext: boolean };
};

function toGrantAward(row: UsaSpendingResultRow): GrantAward | null {
  const awardId = row.generated_internal_id;
  const recipientName = row["Recipient Name"];
  if (!awardId || !recipientName) return null;

  const location = row["Recipient Location"] ?? null;
  return {
    awardId,
    awardNumber: row["Award ID"] ?? null,
    recipientName,
    awardingAgency: row["Awarding Agency"] ?? null,
    amount: typeof row["Award Amount"] === "number" ? row["Award Amount"] : null,
    startDate: row["Start Date"] ?? null,
    description: row.Description ?? null,
    state: location?.state_name ?? location?.state_code ?? null,
    county: location?.county_name ?? null,
    city: location?.city_name ?? null,
  };
}

function parseAwardPage(
  data: UsaSpendingSearchResponse,
  page: number
): { awards: GrantAward[]; hasNext: boolean } {
  const rows = data.results ?? [];
  const awards: GrantAward[] = [];
  for (const row of rows) {
    const award = toGrantAward(row);
    if (award) awards.push(award);
  }

  const hasNext = Boolean(data.page_metadata?.hasNext) && rows.length > 0 && page < MAX_PAGES;
  return { awards, hasNext };
}

function isHardHttpError(err: unknown): boolean {
  return err instanceof Error && /^USAspending API error \d+:/.test(err.message);
}

/** One USAspending spending_by_award page for a program number. The cron
 * upserts page-by-page so a time-budget stop can resume mid-ALN instead of
 * re-pulling every earlier page after a 504. Retries 502/503/504 (and
 * timeout-like fetch/JSON failures) with exponential backoff so a flaky
 * ALN does not skip its awards until the next cron. */
export async function searchAwardPageByProgramNumber(
  aln: string,
  page: number,
  retry: UsaSpendingRetryOptions = {}
): Promise<{ awards: GrantAward[]; hasNext: boolean }> {
  const maxAttempts = retry.maxAttempts ?? USASPENDING_MAX_ATTEMPTS;
  const wait = retry.sleep ?? sleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(USASPENDING_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            program_numbers: [aln],
            award_type_codes: GRANT_AWARD_TYPE_CODES,
          },
          fields: [
            "Award ID",
            "Recipient Name",
            "Awarding Agency",
            "Award Amount",
            "Start Date",
            "Description",
            "Recipient Location",
          ],
          limit: PAGE_SIZE,
          page,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        const error = new Error(`USAspending API error ${res.status}: ${body}`);
        if (!USASPENDING_TRANSIENT_STATUSES.has(res.status) || attempt === maxAttempts) {
          throw error;
        }
        lastError = error;
      } else {
        const data = (await res.json()) as UsaSpendingSearchResponse;
        return parseAwardPage(data, page);
      }
    } catch (err) {
      if (isHardHttpError(err)) throw err;
      lastError = err;
      if (!isRetryableNetworkError(err) || attempt === maxAttempts) {
        throw err;
      }
    }

    await wait(usaspendingBackoffMs(attempt - 1));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Fetches every grant award USAspending has recorded under a given
 * Assistance Listing (CFDA) number -- e.g. every state DOT that has
 * received Highway Planning and Construction funding to date. */
export async function searchAwardsByProgramNumber(aln: string): Promise<GrantAward[]> {
  const collected: GrantAward[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { awards, hasNext } = await searchAwardPageByProgramNumber(aln, page);
    collected.push(...awards);
    if (!hasNext) break;
  }

  return collected;
}

/** Fetches awards across every tracked Assistance Listing number. */
export async function searchAwardsByProgramNumbers(alns: string[]): Promise<GrantAward[]> {
  const results = await Promise.all(alns.map((aln) => searchAwardsByProgramNumber(aln)));
  return results.flat();
}
