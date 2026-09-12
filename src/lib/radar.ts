/**
 * Recompete / option / expiration radar plus SCA wage-context extraction.
 *
 * Grounded in what SAM.gov actually ships on BidKeep rows:
 * - Search payload (`raw_data`) has title, notice type, resourceLinks,
 *   and sometimes a description URL (not body text). It does not carry
 *   structured period-of-performance or wage-determination fields.
 * - Full notice language lands in `requirements_text` after the existing
 *   description fetch. That's where "base + 4 option years" and WD numbers
 *   usually hide.
 *
 * Never invent award-history dates or DOL WD numbers. A missing date or
 * WD is an honest empty — not a guess from archiveDate or award.date.
 */

export const RADAR_KINDS = [
  "recompete",
  "sole_source_followon",
  "option",
  "expiration",
  "early_signal",
] as const;
export type RadarKind = (typeof RADAR_KINDS)[number];

export const RADAR_SOURCES = [
  "title",
  "notice_type",
  "raw_data",
  "requirements_text",
] as const;
export type RadarSource = (typeof RADAR_SOURCES)[number];

export type RadarClassification = {
  kind: RadarKind | null;
  eventDate: string | null;
  evidence: string | null;
  source: RadarSource | null;
  optionYears: number | null;
};

export type ScaWageContext = {
  mentioned: boolean;
  wdNumber: string | null;
  wdUrl: string | null;
  evidence: string | null;
};

export type RadarNoticeInput = {
  title?: string | null;
  noticeType?: string | null;
  requirementsText?: string | null;
  rawData?: unknown;
};

export type RadarPersistFields = {
  radar_kind: RadarKind | null;
  radar_event_date: string | null;
  radar_evidence: string | null;
  radar_source: RadarSource | null;
  radar_option_years: number | null;
  sca_mentioned: boolean;
  sca_wd_number: string | null;
  sca_wd_url: string | null;
  radar_classified_at: string;
};

const RECOMPETE_RE =
  /\b(?:re-?compete|follow[- ]on(?:\s+contract)?|successor\s+contract|incumbent\s+contract|replacement\s+contract)\b/i;

/** Boilerplate that negates a nearby RECOMPETE_RE match rather than
 * confirming one -- e.g. "no commitment to any follow-on announcement" is
 * standard sources-sought disclaimer language, not evidence a recompete is
 * coming (Sep 12 audit's Yokota example: a construction-site
 * security-monitoring notice matched purely on this boilerplate). */
const RECOMPETE_NEGATION_RE =
  /\bno\s+(?:commitment|guarantee|assurance|obligation)\b|\bdoes\s+not\s+(?:guarantee|commit|obligate)\b|\bis\s+not\s+(?:obligated|guaranteed|committed)\b|\bnot\s+obligated\b|\bno\s+assurance\b|\bnot\s+a\s+commitment\b|\bmay\s+or\s+may\s+not\b/i;

/** A recompete/follow-on match co-occurring with this is a sole-source
 * follow-on to a named incumbent -- useful incumbent intelligence, but not
 * an ordinary competitive recompete another small business could win (Sep
 * 12 audit's USPTO example). Classified separately (see
 * findRecompeteEvidence) instead of under the plain "recompete" kind. */
const SOLE_SOURCE_RE = /\bsole[- ]source\b/i;

/** How far around a RECOMPETE_RE match to look for negation or sole-source
 * language -- wide enough to catch the same sentence/clause, narrow enough
 * not to pick up an unrelated disclaimer elsewhere in a long notice. */
const RECOMPETE_CONTEXT_WINDOW = 100;

const OPTION_RE =
  /\b(?:option\s+years?|option\s+period|option\s+to\s+extend|exercise(?:s|d)?\s+(?:the\s+)?option|base(?:\s+year|\s+period)?(?:\s+\+\s*|\s+plus\s+|\s+with\s+)\d+|b\s*\+\s*\d+)\b/i;

const OPTION_YEARS_RE =
  /(?:with\s+)?(?:four|4|five|5|three|3|two|2|one|1|\d+)\s*(?:\((\d+)\)\s*)?(?:one[- ]year\s+|12[- ]month\s+)?option\s+years?/i;

const POP_RANGE_RE =
  /(?:period\s+of\s+performance|p\.?o\.?p\.?|performance\s+period|base\s+period(?:\s+of\s+performance)?)\s*(?:\([^)]{0,24}\))?\s*(?:is|of|:)?\s*(?:from\s+)?([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\s*(?:to|through|thru|[-–—])\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i;

const EXPIRES_RE =
  /\b(?:contract\s+expir(?:es|ation)|period\s+(?:of\s+performance\s+)?ends?|p\.?o\.?p\.?\s+ends?)\b/i;

const EARLY_NOTICE_TYPES = new Set([
  "Sources Sought",
  "Presolicitation",
  "Special Notice",
]);

const WD_NUMBER_RE = /\bWD[-\s]?(\d{4}-\d{4})\b/i;
const WD_PHRASE_RE =
  /wage\s+determination(?:\s+(?:no\.?|number|#))?\s*[:#]?\s*(?:WD[-\s]?)?(\d{4}-\d{4})/i;
const SCA_MENTION_RE =
  /\b(?:service\s+contract\s+act|\bSCA\b|wage\s+determination|FAR\s+52\.222-41)\b/i;
const WD_URL_RE =
  /https?:\/\/(?:www\.|beta\.)?sam\.gov\/(?:wage-determination|search\/\?index=wd)[^\s)"']*/i;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

export const RADAR_KIND_LABELS: Record<RadarKind, string> = {
  recompete: "Recompete",
  sole_source_followon: "Sole-source follow-on",
  // "Option exercise" overstated ordinary contract structure: matching a
  // FAR option-extension clause or "N option years" is evidence a base+option
  // structure exists, not that an exercise decision has actually been made or
  // announced (Sep 12 audit's USCG/B1990 examples were both plain structural
  // boilerplate, not exercise announcements). "Options identified" is the
  // accurate default until the classifier can tell the two apart.
  option: "Options identified",
  expiration: "Period end",
  early_signal: "Possible early opportunity",
};

export function isRadarKind(value: string | null | undefined): value is RadarKind {
  return RADAR_KINDS.includes(value as RadarKind);
}

/** Strip HTML / collapse whitespace so excerpts stay readable. */
export function normalizeNoticeText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 80);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

function firstMatchExcerpt(text: string, re: RegExp): string | null {
  const match = re.exec(text);
  if (!match) return null;
  return excerptAround(text, match.index, match[0].length);
}

export function parseNoticeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    let year = Number(us[3]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) {
      return null;
    }
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const written = value.match(
    /^(?:([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}))$/
  );
  if (written) {
    const monthName = (written[1] ?? written[5] ?? "").toLowerCase();
    const day = Number(written[2] ?? written[4]);
    const year = Number(written[3] ?? written[6]);
    const month = MONTHS[monthName];
    if (!month || day < 1 || day > 31 || year < 1990 || year > 2100) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Structured POP end only when SAM (or a later source) actually sent one.
 * Award date and notice archiveDate are not contract expiration. */
export function structuredPeriodEnd(rawData: unknown): string | null {
  const obj = asRecord(rawData);
  if (!obj) return null;
  const pop = asRecord(obj.periodOfPerformance) ?? asRecord(obj.period_of_performance);
  if (!pop) return null;
  const end = stringField(
    pop.endDate,
    pop.end_date,
    pop.periodEnd,
    pop.period_end,
    pop.to,
    asRecord(pop.end)?.date
  );
  return parseNoticeDate(end);
}

function rawDescriptionText(rawData: unknown): string | null {
  const obj = asRecord(rawData);
  if (!obj) return null;
  const description = obj.description;
  if (typeof description !== "string" || !description.trim() || isHttpUrl(description)) {
    return null;
  }
  return normalizeNoticeText(description);
}

function rawResourceLinks(rawData: unknown): string[] {
  const obj = asRecord(rawData);
  if (!obj) return [];
  const links = obj.resourceLinks;
  if (!Array.isArray(links)) return [];
  return links.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseOptionYears(text: string): number | null {
  const plus = text.match(/\b(?:base(?:\s+year|\s+period)?\s*(?:\+|plus)\s*|b\s*\+\s*)(\d+)\b/i);
  if (plus) {
    const n = Number(plus[1]);
    return n > 0 && n <= 10 ? n : null;
  }

  const match = OPTION_YEARS_RE.exec(text);
  if (!match) return null;
  if (match[1]) {
    const n = Number(match[1]);
    return n > 0 && n <= 10 ? n : null;
  }
  const head = match[0].toLowerCase();
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (head.startsWith(word) || new RegExp(`\\b${word}\\b`).test(head)) return n;
  }
  const digit = head.match(/\d+/);
  if (!digit) return null;
  const n = Number(digit[0]);
  return n > 0 && n <= 10 ? n : null;
}

type Layer = { text: string; source: RadarSource };

function layersFrom(input: RadarNoticeInput): Layer[] {
  const layers: Layer[] = [];
  const title = normalizeNoticeText(input.title);
  if (title) layers.push({ text: title, source: "title" });

  const noticeType = normalizeNoticeText(input.noticeType);
  if (noticeType) layers.push({ text: noticeType, source: "notice_type" });

  const rawText = rawDescriptionText(input.rawData);
  if (rawText) layers.push({ text: rawText, source: "raw_data" });

  const requirements = normalizeNoticeText(input.requirementsText);
  if (requirements) layers.push({ text: requirements, source: "requirements_text" });

  return layers;
}

function combinedText(layers: Layer[]): string {
  return layers.map((layer) => layer.text).join("\n");
}

function findKind(
  layers: Layer[],
  re: RegExp
): { source: RadarSource; evidence: string } | null {
  for (const layer of [...layers].reverse()) {
    const evidence = firstMatchExcerpt(layer.text, re);
    if (evidence) return { source: layer.source, evidence };
  }
  return null;
}

type RecompeteEvidence = { source: RadarSource; evidence: string; soleSource: boolean };

/** Finds the first RECOMPETE_RE match that isn't itself sitting inside
 * negating boilerplate. Unlike findKind, this checks every match in a layer
 * (not just the first) before moving to the next layer, since a notice can
 * contain both a negated disclaimer paragraph and, elsewhere, real
 * actionable language. Also flags whether the match sits near sole-source
 * wording, since that changes what kind the caller should classify it as. */
function findRecompeteEvidence(layers: Layer[]): RecompeteEvidence | null {
  for (const layer of [...layers].reverse()) {
    const re = new RegExp(RECOMPETE_RE.source, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(layer.text))) {
      const windowStart = Math.max(0, match.index - RECOMPETE_CONTEXT_WINDOW);
      const windowEnd = Math.min(
        layer.text.length,
        match.index + match[0].length + RECOMPETE_CONTEXT_WINDOW
      );
      const window = layer.text.slice(windowStart, windowEnd);
      if (RECOMPETE_NEGATION_RE.test(window)) {
        if (re.lastIndex === match.index) re.lastIndex++;
        continue;
      }
      return {
        source: layer.source,
        evidence: excerptAround(layer.text, match.index, match[0].length),
        soleSource: SOLE_SOURCE_RE.test(window),
      };
    }
  }
  return null;
}

export function classifyRadarSignal(input: RadarNoticeInput): RadarClassification {
  const layers = layersFrom(input);
  const text = combinedText(layers);
  const empty: RadarClassification = {
    kind: null,
    eventDate: null,
    evidence: null,
    source: null,
    optionYears: null,
  };
  if (!text) return empty;

  const popMatch = POP_RANGE_RE.exec(text);
  const popEnd = popMatch ? parseNoticeDate(popMatch[2]) : structuredPeriodEnd(input.rawData);
  const optionYears = parseOptionYears(text);

  const recompete = findRecompeteEvidence(layers);
  if (recompete) {
    return {
      kind: recompete.soleSource ? "sole_source_followon" : "recompete",
      eventDate: popEnd,
      evidence: recompete.evidence,
      source: recompete.source,
      optionYears,
    };
  }

  const option = findKind(layers, OPTION_RE);
  if (option || optionYears) {
    const evidence =
      option?.evidence ??
      firstMatchExcerpt(text, OPTION_YEARS_RE) ??
      firstMatchExcerpt(text, OPTION_RE);
    return {
      kind: "option",
      eventDate: popEnd,
      evidence,
      source: option?.source ?? (layers.at(-1)?.source ?? "title"),
      optionYears,
    };
  }

  if (popEnd || EXPIRES_RE.test(text)) {
    const evidence =
      popMatch
        ? excerptAround(text, popMatch.index, popMatch[0].length)
        : firstMatchExcerpt(text, EXPIRES_RE);
    const source =
      findKind(layers, POP_RANGE_RE)?.source ??
      findKind(layers, EXPIRES_RE)?.source ??
      (structuredPeriodEnd(input.rawData) ? "raw_data" : layers[0]?.source ?? null);
    return {
      kind: "expiration",
      eventDate: popEnd,
      evidence,
      source,
      optionYears: null,
    };
  }

  const noticeType = normalizeNoticeText(input.noticeType);
  if (EARLY_NOTICE_TYPES.has(noticeType) && /\b(?:custodial|janitorial|grounds|landscap|guard|patrol|facilit(?:y|ies)|base[- ]ops)\b/i.test(text)) {
    // Notice type + facilities keyword only — no recompete, follow-on, or
    // incumbent language actually appears in the notice. This is a weaker
    // signal than a real RECOMPETE_RE match and must not be labeled the same.
    return {
      kind: "early_signal",
      eventDate: null,
      evidence: `${noticeType} for facilities work — no incumbent or follow-on language found in the notice itself`,
      source: "notice_type",
      optionYears: null,
    };
  }

  return empty;
}

export function extractScaWageContext(input: RadarNoticeInput): ScaWageContext {
  const layers = layersFrom(input);
  const text = combinedText(layers);
  const links = rawResourceLinks(input.rawData);

  let wdNumber: string | null = null;
  let evidence: string | null = null;
  const phrase = WD_PHRASE_RE.exec(text);
  if (phrase?.[1]) {
    wdNumber = phrase[1];
    evidence = excerptAround(text, phrase.index, phrase[0].length);
  } else {
    const bare = WD_NUMBER_RE.exec(text);
    if (bare?.[1]) {
      wdNumber = bare[1];
      evidence = excerptAround(text, bare.index, bare[0].length);
    }
  }

  let wdUrl: string | null = null;
  const urlInText = WD_URL_RE.exec(text);
  if (urlInText) wdUrl = urlInText[0];
  if (!wdUrl) {
    wdUrl =
      links.find((link) => /wage-determination|wage.determ|\/wd[-_/]/i.test(link)) ?? null;
  }
  if (wdNumber && !wdUrl) {
    wdUrl = `https://sam.gov/wage-determination`;
  }

  const mentioned =
    Boolean(wdNumber || wdUrl) ||
    SCA_MENTION_RE.test(text) ||
    links.some((link) => /wage-determination|wage.determ|\/wd[-_/]/i.test(link));

  if (mentioned && !evidence) {
    evidence = firstMatchExcerpt(text, SCA_MENTION_RE);
  }

  return {
    mentioned,
    wdNumber,
    wdUrl: wdNumber || wdUrl ? wdUrl : null,
    evidence,
  };
}

export function radarPersistFields(
  input: RadarNoticeInput,
  now = new Date()
): RadarPersistFields {
  const radar = classifyRadarSignal(input);
  const sca = extractScaWageContext(input);
  return {
    radar_kind: radar.kind,
    radar_event_date: radar.eventDate,
    radar_evidence: radar.evidence,
    radar_source: radar.source,
    radar_option_years: radar.optionYears,
    sca_mentioned: sca.mentioned,
    sca_wd_number: sca.wdNumber,
    sca_wd_url: sca.wdUrl,
    radar_classified_at: now.toISOString(),
  };
}

export function samWageDeterminationHref(wdNumber: string | null | undefined): string | null {
  const id = wdNumber?.trim();
  if (!id) return null;
  return `https://sam.gov/wage-determination`;
}
