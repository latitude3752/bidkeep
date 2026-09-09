/**
 * Shared opportunity classification, used by both the SAM.gov sync job
 * (src/app/api/sync-opportunities/route.ts) and the admin dashboard.
 */

/** Product Service Code -> material vs. service. Numeric-leading PSCs are
 * supplies/equipment; letter-leading PSCs are services (FAR/PSC convention). */
export function classifyAcquisitionType(
  pscCode: string | null | undefined
): "material" | "service" | "unknown" {
  const code = (pscCode ?? "").trim();
  if (!code) return "unknown";
  const first = code[0];
  if (first >= "0" && first <= "9") return "material";
  if (/[A-Za-z]/.test(first)) return "service";
  return "unknown";
}

/** Notice types worth actively tracking — excludes already-decided or
 * informational-only notices (awards already went to someone else,
 * sole-source justifications) that aren't things to bid on. */
export const ACTIONABLE_NOTICE_TYPES = [
  "Solicitation",
  "Combined Synopsis/Solicitation",
  "Sources Sought",
  "Presolicitation",
  "Special Notice",
];

export const NOISE_NOTICE_TYPES = ["Award Notice", "Justification"];

export const OPPORTUNITY_STATUSES = [
  "new",
  "reviewing",
  "bid",
  "won",
  "lost",
  "expired",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/** Pipeline default: solicitations whose response deadline is on or before
 * today + this many days. */
export const DEFAULT_DEADLINE_HORIZON_DAYS = 90;

export function deadlineHorizonEnd(
  now = new Date(),
  days = DEFAULT_DEADLINE_HORIZON_DAYS
): Date {
  const end = new Date(now.getTime());
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

/** True if the notice is due on or before now+horizonDays. Missing/unparseable
 * deadlines are kept (Sources Sought often have none). */
export function isWithinDeadlineHorizon(
  deadline: string | null | undefined,
  now = new Date(),
  days = DEFAULT_DEADLINE_HORIZON_DAYS
): boolean {
  if (!deadline) return true;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return true;
  return t <= deadlineHorizonEnd(now, days).getTime();
}

/** USPS state/territory codes SAM.gov's place-of-performance data can carry
 * for domestic work. Some facilities-NAICS notices are for U.S.
 * facilities abroad (embassy compounds, overseas GSA posts) and carry a
 * foreign ISO-3166-2 subdivision code instead (e.g. "FR-92", "KR-11") --
 * those aren't useful in a filter meant for domestic "local work" search,
 * so they're bucketed separately rather than listed as their own state. */
export const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC", "PR", "GU", "VI", "AS", "MP",
]);

export const UNLISTED_STATE_BUCKET = "Unlisted";
export const INTERNATIONAL_STATE_BUCKET = "International";

/** Groups a raw place_of_performance_state value into a filter bucket: a
 * real USPS code passes through unchanged, null/empty becomes "Unlisted",
 * and anything else (a foreign subdivision code, or a raw-data anomaly
 * like a literal "N/A") becomes "International" rather than polluting the
 * state filter with one-off junk options. */
export function statePlaceOfPerformanceBucket(state: string | null | undefined): string {
  if (!state) return UNLISTED_STATE_BUCKET;
  return US_STATE_CODES.has(state) ? state : INTERNATIONAL_STATE_BUCKET;
}

export const SET_ASIDE_CERTIFICATIONS = [
  "small_business",
  "8a",
  "wosb",
  "edwosb",
  "hubzone",
  "sdvosb",
] as const;
export type SetAsideCertification = (typeof SET_ASIDE_CERTIFICATIONS)[number];

export const SET_ASIDE_CERTIFICATION_LABELS: Record<SetAsideCertification, string> = {
  small_business: "Small Business",
  "8a": "8(a)",
  wosb: "Woman-Owned Small Business (WOSB)",
  edwosb: "Economically Disadvantaged WOSB (EDWOSB)",
  hubzone: "HUBZone",
  sdvosb: "Service-Disabled Veteran-Owned Small Business (SDVOSB)",
};

/** Which certification each set-aside type's text restricts eligibility to.
 * Per-subscriber: pass in whatever certifications the subscriber's own
 * company profile lists. */
const SET_ASIDE_RESTRICTION_MATCHERS: Record<SetAsideCertification, RegExp> = {
  small_business: /small business/i,
  "8a": /8\(a\)/i,
  wosb: /woman-owned|wosb/i,
  edwosb: /economically disadvantaged women|edwosb/i,
  hubzone: /hubzone/i,
  sdvosb: /service[- ]disabled veteran|sdvosb/i,
};

/** Whether a company holding `certifications` can compete for a notice
 * carrying `setAsideType` -- decision-support only, not a compliance
 * guarantee. Unrestricted ("full and open") or unrecognized set-aside text
 * defaults to eligible; the subscriber should always confirm against the
 * actual solicitation before relying on this. */
export function isEligibleSetAside(
  setAsideType: string | null | undefined,
  certifications: readonly string[]
): boolean {
  if (!setAsideType) return true;
  const restrictions = SET_ASIDE_CERTIFICATIONS.filter((cert) =>
    SET_ASIDE_RESTRICTION_MATCHERS[cert].test(setAsideType)
  );
  if (restrictions.length === 0) return true;
  return restrictions.some((cert) => certifications.includes(cert));
}

