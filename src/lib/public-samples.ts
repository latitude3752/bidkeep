import { getSupabasePublic } from "@/lib/supabase/public";
import {
  agencyDepartment,
  pickDiverseRows,
} from "@/lib/public-sample-select";

export type SampleOpportunity = {
  title: string;
  agency: string | null;
  naicsCode: string | null;
  responseDeadline: string | null;
  noticeId: string | null;
  noticeUrl: string | null;
  setAsideType: string | null;
  postedAt: string | null;
  placeOfPerformanceState?: string | null;
  /** True when this row is a recent open-status fallback (not currently live by deadline). */
  isExample?: boolean;
};

export type OpportunityStats = { activeCount: number };

/** Default public teaser size — enough trades to be useful, short enough to scan. */
export const PUBLIC_OPP_SAMPLE_DEFAULT = 12;
/** Hard cap so a public page cannot dump the full pipeline. */
export const PUBLIC_OPP_SAMPLE_MAX = 24;
/** Extra rows fetched so title-dedup and live+example fill can still reach the cap. */
export const PUBLIC_OPP_SAMPLE_POOL = 48;

const OPP_SELECT =
  "title, agency, naics_code, response_deadline, notice_id, notice_url, set_aside_type, created_at, place_of_performance_state";

export function clampPublicSampleLimit(limit: number): number {
  if (!Number.isFinite(limit)) return PUBLIC_OPP_SAMPLE_DEFAULT;
  return Math.min(PUBLIC_OPP_SAMPLE_MAX, Math.max(1, Math.trunc(limit)));
}

export function publicSamplePoolSize(limit: number): number {
  const cap = clampPublicSampleLimit(limit);
  return Math.min(PUBLIC_OPP_SAMPLE_POOL, Math.max(cap * 4, 24));
}

export function opportunityTitleKey(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Collapse SAM.gov amendments/reposts of the same job so the teaser shows distinct work. */
export function pickUniqueOpportunitySample<T extends { title: string }>(
  rows: T[],
  limit: number
): T[] {
  const cap = clampPublicSampleLimit(limit);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = opportunityTitleKey(row.title);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(row);
    if (out.length >= cap) break;
  }
  return out;
}

/** Prefer distinct agencies and NAICS after title-dedup so one VA janitorial
 * series cannot fill the whole public teaser. */
export function pickDiverseOpportunitySample<
  T extends { title: string; agency?: string | null; naicsCode?: string | null },
>(rows: T[], limit: number): T[] {
  const unique = pickUniqueOpportunitySample(rows, publicSamplePoolSize(limit));
  return pickDiverseRows(unique, clampPublicSampleLimit(limit), [
    (row) => agencyDepartment(row.agency),
    (row) => row.naicsCode ?? "",
  ]);
}

/**
 * Prefer live (future-deadline) rows. If that set is short, fill remaining
 * slots with recent open-status history marked isExample so the public page
 * stays useful when few notices are currently open.
 */
export function mergeOpportunitySample<T extends { title: string; isExample?: boolean }>(
  liveRows: T[],
  fallbackRows: T[],
  limit: number
): T[] {
  const cap = clampPublicSampleLimit(limit);
  const live = pickUniqueOpportunitySample(liveRows, cap);
  if (live.length >= cap) return live;

  const seen = new Set(
    live.map((row) => opportunityTitleKey(row.title)).filter(Boolean)
  );
  const extras: T[] = [];
  for (const row of fallbackRows) {
    const key = opportunityTitleKey(row.title);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    extras.push({ ...row, isExample: true });
    if (live.length + extras.length >= cap) break;
  }
  return [...live, ...extras];
}

function mapOpportunity(
  row: Record<string, unknown>,
  opts?: { isExample?: boolean }
): SampleOpportunity {
  return {
    title: row.title as string,
    agency: row.agency as string | null,
    naicsCode: row.naics_code as string | null,
    responseDeadline: row.response_deadline as string | null,
    noticeId: row.notice_id as string | null,
    noticeUrl: row.notice_url as string | null,
    setAsideType: row.set_aside_type as string | null,
    postedAt: row.created_at as string | null,
    placeOfPerformanceState: row.place_of_performance_state as string | null,
    ...(opts?.isExample ? { isExample: true } : {}),
  };
}

function openStatusQuery(supabase: ReturnType<typeof getSupabasePublic>) {
  return supabase
    .from("opportunities_public")
    .select(OPP_SELECT)
    .in("status", ["new", "reviewing", "bid"]);
}

/** Live public teaser (future deadline). Fills remaining slots from recent
 * open-status rows (marked isExample) when the live set is empty or short. */
export async function getSampleOpportunities(
  limit = PUBLIC_OPP_SAMPLE_DEFAULT
): Promise<SampleOpportunity[]> {
  try {
    const cap = clampPublicSampleLimit(limit);
    const pool = publicSamplePoolSize(cap);
    const supabase = getSupabasePublic();

    const { data } = await openStatusQuery(supabase)
      .not("response_deadline", "is", null)
      .gte("response_deadline", new Date().toISOString())
      .order("response_deadline", { ascending: true })
      .limit(pool);

    const live = pickDiverseOpportunitySample(
      (data ?? []).map((row) => mapOpportunity(row as Record<string, unknown>)),
      cap
    );
    if (live.length >= cap) return live;

    const { data: fallback } = await openStatusQuery(supabase)
      .order("created_at", { ascending: false })
      .limit(pool);

    return mergeOpportunitySample(
      live,
      (fallback ?? []).map((row) =>
        mapOpportunity(row as Record<string, unknown>)
      ),
      cap
    );
  } catch {
    return [];
  }
}

/** Count only rows that match live sample criteria (future deadline)
 * so the public active count never claims opportunities while the live
 * sample is empty. */
export async function getOpportunityStats(): Promise<OpportunityStats> {
  try {
    const supabase = getSupabasePublic();
    const { count } = await supabase
      .from("opportunities_public")
      .select("title", { count: "exact", head: true })
      .in("status", ["new", "reviewing", "bid"])
      .not("response_deadline", "is", null)
      .gte("response_deadline", new Date().toISOString());

    return { activeCount: count ?? 0 };
  } catch {
    return { activeCount: 0 };
  }
}

export type SampleGrantAward = {
  recipientName: string;
  awardingAgency: string | null;
  state: string | null;
  amount: number | null;
  programNumber: string | null;
  awardId: string | null;
  awardNumber: string | null;
  startDate: string | null;
};

export type GrantStats = { awardCount: number; totalAmount: number };

const GRANT_SELECT =
  "recipient_name, awarding_agency, state, amount, program_number, award_id, award_number, start_date";

export const PUBLIC_GRANT_SAMPLE_DEFAULT = 12;

export async function getSampleGrantAwards(
  limit = PUBLIC_GRANT_SAMPLE_DEFAULT
): Promise<SampleGrantAward[]> {
  try {
    const cap = clampPublicSampleLimit(limit);
    const supabase = getSupabasePublic();
    const { data } = await supabase
      .from("grant_awards")
      .select(GRANT_SELECT)
      .gt("amount", 0)
      .order("start_date", { ascending: false })
      .limit(cap);

    return (data ?? []).map((row) => ({
      recipientName: row.recipient_name as string,
      awardingAgency: row.awarding_agency as string | null,
      state: row.state as string | null,
      amount: row.amount as number | null,
      programNumber: row.program_number as string | null,
      awardId: row.award_id as string | null,
      awardNumber: row.award_number as string | null,
      startDate: row.start_date as string | null,
    }));
  } catch {
    return [];
  }
}

export async function getGrantStats(): Promise<GrantStats> {
  try {
    const supabase = getSupabasePublic();
    const { data } = await supabase
      .from("grant_awards")
      .select("amount")
      .gt("amount", 0);
    const rows = data ?? [];
    const totalAmount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return { awardCount: rows.length, totalAmount };
  } catch {
    return { awardCount: 0, totalAmount: 0 };
  }
}
