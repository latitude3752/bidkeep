import { getSupabasePublic } from "@/lib/supabase/public";
import {
  RADAR_KIND_LABELS,
  type RadarKind,
  isRadarKind,
} from "@/lib/radar";
import { pickDiverseRows } from "@/lib/public-sample-select";

export type SampleRadarRow = {
  title: string;
  agency: string | null;
  naicsCode: string | null;
  noticeId: string | null;
  noticeUrl: string | null;
  setAsideType: string | null;
  noticeType: string | null;
  placeOfPerformanceState: string | null;
  responseDeadline: string | null;
  kind: RadarKind;
  eventDate: string | null;
  evidence: string | null;
  optionYears: number | null;
  scaMentioned: boolean;
  scaWdNumber: string | null;
  scaWdUrl: string | null;
  isExample?: boolean;
};

export type RadarStats = {
  signalCount: number;
  recompeteCount: number;
  optionCount: number;
  expirationCount: number;
  earlySignalCount: number;
  scaMentionCount: number;
  scaWdCount: number;
};

export const PUBLIC_RADAR_SAMPLE_DEFAULT = 8;

const RADAR_SELECT =
  "title, agency, naics_code, notice_id, notice_url, set_aside_type, notice_type, place_of_performance_state, response_deadline, radar_kind, radar_event_date, radar_evidence, radar_option_years, sca_mentioned, sca_wd_number, sca_wd_url";

const SCA_SELECT = "title, notice_id, notice_url, sca_wd_number, sca_wd_url, sca_mentioned";

/** Labeled illustrations of language BidKeep classifies — not live rows
 * and not customer proof. Used only when the persisted radar is empty. */
export const RADAR_EXAMPLE_ROWS: SampleRadarRow[] = [
  {
    title: "Example — custodial sources sought with no incumbent language",
    agency: "DEPT OF DEFENSE.DEPT OF THE AIR FORCE",
    naicsCode: "561720",
    noticeId: null,
    noticeUrl: null,
    setAsideType: "8(a) Set-Aside",
    noticeType: "Sources Sought",
    placeOfPerformanceState: "FL",
    responseDeadline: null,
    kind: "early_signal",
    eventDate: null,
    evidence:
      "Illustrated language: a facilities Sources Sought / RFI with no recompete or incumbent wording is flagged as a possible early opportunity, not a confirmed recompete. Not a live BidKeep row.",
    optionYears: null,
    scaMentioned: false,
    scaWdNumber: null,
    scaWdUrl: null,
    isExample: true,
  },
  {
    title: "Example — janitorial base year plus four option years",
    agency: "DEPT OF DEFENSE.DEPT OF THE ARMY",
    naicsCode: "561720",
    noticeId: null,
    noticeUrl: null,
    setAsideType: "Total Small Business",
    noticeType: "Combined Synopsis/Solicitation",
    placeOfPerformanceState: "TX",
    responseDeadline: null,
    kind: "option",
    eventDate: "2026-12-31",
    evidence:
      "Illustrated language: “base year with four (4) 12-month option years” and a POP end date taken from the notice. Not a live BidKeep row.",
    optionYears: 4,
    scaMentioned: true,
    scaWdNumber: null,
    scaWdUrl: null,
    isExample: true,
  },
  {
    title: "Example — grounds POP end with no option language",
    agency: "VETERANS AFFAIRS, DEPARTMENT OF",
    naicsCode: "561730",
    noticeId: null,
    noticeUrl: null,
    setAsideType: "SDVOSB",
    noticeType: "Solicitation",
    placeOfPerformanceState: "NY",
    responseDeadline: null,
    kind: "expiration",
    eventDate: "2026-04-30",
    evidence:
      "Illustrated language: “Period of Performance (POP) is from 5/1/2025 thru 4/30/2026.” Date comes from the notice, not award history. Not a live BidKeep row.",
    optionYears: null,
    scaMentioned: false,
    scaWdNumber: null,
    scaWdUrl: null,
    isExample: true,
  },
];

function mapRadarRow(row: Record<string, unknown>): SampleRadarRow | null {
  if (!isRadarKind(row.radar_kind as string | null)) return null;
  return {
    title: row.title as string,
    agency: row.agency as string | null,
    naicsCode: row.naics_code as string | null,
    noticeId: row.notice_id as string | null,
    noticeUrl: row.notice_url as string | null,
    setAsideType: row.set_aside_type as string | null,
    noticeType: row.notice_type as string | null,
    placeOfPerformanceState: row.place_of_performance_state as string | null,
    responseDeadline: row.response_deadline as string | null,
    kind: row.radar_kind as RadarKind,
    eventDate: (row.radar_event_date as string | null) ?? null,
    evidence: (row.radar_evidence as string | null) ?? null,
    optionYears: (row.radar_option_years as number | null) ?? null,
    scaMentioned: Boolean(row.sca_mentioned),
    scaWdNumber: (row.sca_wd_number as string | null) ?? null,
    scaWdUrl: (row.sca_wd_url as string | null) ?? null,
  };
}

export function radarKindLabel(kind: RadarKind): string {
  return RADAR_KIND_LABELS[kind];
}

export async function getSampleRadarRows(
  limit = PUBLIC_RADAR_SAMPLE_DEFAULT
): Promise<SampleRadarRow[]> {
  try {
    const supabase = getSupabasePublic();
    const { data } = await supabase
      .from("opportunities_public")
      .select(RADAR_SELECT)
      .not("radar_kind", "is", null)
      .in("status", ["new", "reviewing", "bid"])
      .order("radar_event_date", { ascending: true })
      .limit(Math.max(limit * 3, 24));

    const live = pickDiverseRows(
      (data ?? [])
        .map((row) => mapRadarRow(row as Record<string, unknown>))
        .filter((row): row is SampleRadarRow => row !== null),
      limit,
      [(row) => row.kind, (row) => row.naicsCode ?? ""]
    );
    if (live.length > 0) return live;
  } catch {
    // Public pages stay up when Supabase is unset.
  }
  return RADAR_EXAMPLE_ROWS.slice(0, limit);
}

export async function getRadarStats(): Promise<RadarStats> {
  const empty: RadarStats = {
    signalCount: 0,
    recompeteCount: 0,
    optionCount: 0,
    expirationCount: 0,
    earlySignalCount: 0,
    scaMentionCount: 0,
    scaWdCount: 0,
  };
  try {
    const supabase = getSupabasePublic();
    const { data } = await supabase
      .from("opportunities_public")
      .select("radar_kind, sca_mentioned, sca_wd_number")
      .in("status", ["new", "reviewing", "bid"]);
    const rows = data ?? [];
    return {
      signalCount: rows.filter((r) => r.radar_kind).length,
      recompeteCount: rows.filter((r) => r.radar_kind === "recompete").length,
      optionCount: rows.filter((r) => r.radar_kind === "option").length,
      expirationCount: rows.filter((r) => r.radar_kind === "expiration").length,
      earlySignalCount: rows.filter((r) => r.radar_kind === "early_signal").length,
      scaMentionCount: rows.filter((r) => r.sca_mentioned).length,
      scaWdCount: rows.filter((r) => r.sca_wd_number).length,
    };
  } catch {
    return empty;
  }
}

export type SampleScaRow = {
  title: string;
  noticeId: string | null;
  noticeUrl: string | null;
  wdNumber: string | null;
  wdUrl: string | null;
};

export async function getSampleScaRows(limit = 6): Promise<SampleScaRow[]> {
  try {
    const supabase = getSupabasePublic();
    const { data } = await supabase
      .from("opportunities_public")
      .select(SCA_SELECT)
      .eq("sca_mentioned", true)
      .in("status", ["new", "reviewing", "bid"])
      .order("sca_wd_number", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      title: row.title as string,
      noticeId: row.notice_id as string | null,
      noticeUrl: row.notice_url as string | null,
      wdNumber: row.sca_wd_number as string | null,
      wdUrl: row.sca_wd_url as string | null,
    }));
  } catch {
    return [];
  }
}
