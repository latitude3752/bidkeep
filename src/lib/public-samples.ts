import { getSupabasePublic } from "@/lib/supabase/public";
import { FALLBACK_SAMPLE_GRANTS, FALLBACK_SAMPLE_OPPORTUNITIES } from "@/lib/fallback-samples";
import {
  agencyDepartment,
  interleaveByKey,
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

export const PUBLIC_OPP_SAMPLE_DEFAULT = 8;

/** Fetch a wider live pool than the teaser shows so diversity picking
 * can avoid eight janitorial rows that happen to share a deadline. */
const OPP_POOL = 48;

const OPP_SELECT =
  "title, agency, naics_code, response_deadline, notice_id, notice_url, set_aside_type, created_at, place_of_performance_state";

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
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

/** True when the notice still has a future (or today) response deadline.
 * Date-only strings are compared on the UTC calendar day so a same-day
 * deadline is not marked expired just because the clock is past 00:00Z. */
export function hasLiveSampleDeadline(
  deadline: string | null | undefined,
  now = new Date()
): boolean {
  if (!deadline) return false;
  const trimmed = String(deadline).trim();
  if (!trimmed) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed >= now.toISOString().slice(0, 10);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= now.getTime();
}

function selectOpportunitySample(
  rows: SampleOpportunity[],
  limit: number
): SampleOpportunity[] {
  return pickDiverseRows(rows, limit, [
    (row) => agencyDepartment(row.agency),
    (row) => row.naicsCode ?? "",
  ]);
}

function classifyByDeadline(
  rows: Record<string, unknown>[],
  now: Date
): SampleOpportunity[] {
  return rows.map((row) =>
    mapOpportunity(row, {
      isExample: !hasLiveSampleDeadline(row.response_deadline as string | null, now),
    })
  );
}

/** Live public teaser (future deadline). Falls back to recent open-status
 * rows (marked isExample) when no future-deadline matches exist. The
 * returned set is a diverse slice of that pool (agency + NAICS), not
 * strictly the next N deadlines. Scaffold/dev without Supabase uses
 * labeled example rows so public pages still render. */
export async function getSampleOpportunities(
  limit = PUBLIC_OPP_SAMPLE_DEFAULT
): Promise<SampleOpportunity[]> {
  if (!supabaseConfigured()) {
    return selectOpportunitySample(FALLBACK_SAMPLE_OPPORTUNITIES, limit);
  }

  const supabase = getSupabasePublic();
  const now = new Date();
  const { data, error } = await supabase
    .from("opportunities_public")
    .select(OPP_SELECT)
    .in("status", ["new", "reviewing", "bid"])
    .not("response_deadline", "is", null)
    .gte("response_deadline", now.toISOString())
    .order("response_deadline", { ascending: true })
    .limit(OPP_POOL);

  if (error) {
    console.error("Failed to load live opportunity sample:", error.message);
  }

  if ((data ?? []).length > 0) {
    return selectOpportunitySample(
      (data ?? []).map((row) => mapOpportunity(row as Record<string, unknown>)),
      limit
    );
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("opportunities_public")
    .select(OPP_SELECT)
    .in("status", ["new", "reviewing", "bid"])
    .order("created_at", { ascending: false })
    .limit(OPP_POOL);

  if (fallbackError) {
    console.error("Failed to load fallback opportunity sample:", fallbackError.message);
  }

  const fallbackRows = (fallback ?? []) as Record<string, unknown>[];
  if (fallbackRows.length === 0) {
    return selectOpportunitySample(FALLBACK_SAMPLE_OPPORTUNITIES, limit);
  }

  return selectOpportunitySample(classifyByDeadline(fallbackRows, now), limit);
}

/** Count only rows that match live sample criteria (future deadline)
 * so the public active count never claims opportunities while the live
 * sample is empty. */
export async function getOpportunityStats(): Promise<OpportunityStats> {
  if (!supabaseConfigured()) {
    return { activeCount: 0 };
  }

  const supabase = getSupabasePublic();
  const { count, error } = await supabase
    .from("opportunities_public")
    .select("title", { count: "exact", head: true })
    .in("status", ["new", "reviewing", "bid"])
    .not("response_deadline", "is", null)
    .gte("response_deadline", new Date().toISOString());

  if (error) {
    console.error("Failed to load opportunity stats:", error.message);
  }

  return { activeCount: count ?? 0 };
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

export async function getSampleGrantAwards(limit = 12): Promise<SampleGrantAward[]> {
  if (!supabaseConfigured()) {
    return interleaveByKey(
      FALLBACK_SAMPLE_GRANTS,
      (row) => row.programNumber ?? "",
      limit
    );
  }

  const supabase = getSupabasePublic();
  const { data, error } = await supabase
    .from("grant_awards")
    .select(GRANT_SELECT)
    .gt("amount", 0)
    .order("start_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load grant award sample:", error.message);
  }

  const rows = (data ?? []).map((row) => ({
    recipientName: row.recipient_name as string,
    awardingAgency: row.awarding_agency as string | null,
    state: row.state as string | null,
    amount: row.amount as number | null,
    programNumber: row.program_number as string | null,
    awardId: row.award_id as string | null,
    awardNumber: row.award_number as string | null,
    startDate: row.start_date as string | null,
  }));

  if (rows.length === 0) {
    return interleaveByKey(
      FALLBACK_SAMPLE_GRANTS,
      (row) => row.programNumber ?? "",
      limit
    );
  }

  return interleaveByKey(rows, (row) => row.programNumber ?? "", limit);
}

export async function getGrantStats(): Promise<GrantStats> {
  if (!supabaseConfigured()) {
    return { awardCount: 0, totalAmount: 0 };
  }

  const supabase = getSupabasePublic();
  const { data, error } = await supabase
    .from("grant_awards")
    .select("amount")
    .gt("amount", 0);
  if (error) {
    console.error("Failed to load grant stats:", error.message);
  }
  const rows = data ?? [];
  const totalAmount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  return { awardCount: rows.length, totalAmount };
}
