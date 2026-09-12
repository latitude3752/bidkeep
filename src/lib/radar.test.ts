import { describe, expect, it } from "vitest";
import {
  classifyRadarSignal,
  extractScaWageContext,
  parseNoticeDate,
  radarPersistFields,
  structuredPeriodEnd,
} from "./radar";

describe("parseNoticeDate", () => {
  it("accepts ISO, US numeric, and written dates", () => {
    expect(parseNoticeDate("2026-12-31")).toBe("2026-12-31");
    expect(parseNoticeDate("2026-12-31T00:00:00.000Z")).toBe("2026-12-31");
    expect(parseNoticeDate("1/31/2027")).toBe("2027-01-31");
    expect(parseNoticeDate("2/1/2026")).toBe("2026-02-01");
    expect(parseNoticeDate("15 January 2026")).toBe("2026-01-15");
    expect(parseNoticeDate("January 31, 2026")).toBe("2026-01-31");
    expect(parseNoticeDate("31 December 2026")).toBe("2026-12-31");
  });

  it("rejects junk and does not invent a date", () => {
    expect(parseNoticeDate(null)).toBeNull();
    expect(parseNoticeDate("soon")).toBeNull();
    expect(parseNoticeDate("13/40/2026")).toBeNull();
  });
});

describe("structuredPeriodEnd", () => {
  it("reads a real periodOfPerformance endDate when SAM sent one", () => {
    expect(
      structuredPeriodEnd({ periodOfPerformance: { endDate: "2027-09-30" } })
    ).toBe("2027-09-30");
  });

  it("does not treat award.date or archiveDate as a contract end", () => {
    expect(
      structuredPeriodEnd({
        award: { date: "2026-01-16" },
        archiveDate: "2026-12-01",
      })
    ).toBeNull();
  });
});

describe("classifyRadarSignal", () => {
  it("classifies recompete language in the title", () => {
    const result = classifyRadarSignal({
      title: "EARTH Recompete Sources Sought",
      noticeType: "Sources Sought",
    });
    expect(result.kind).toBe("recompete");
    expect(result.source).toBe("title");
    expect(result.evidence).toMatch(/recompete/i);
    expect(result.eventDate).toBeNull();
  });

  it("classifies follow-on / incumbent wording as recompete", () => {
    expect(
      classifyRadarSignal({
        title: "Follow-on custodial services at Fort Example",
        noticeType: "Presolicitation",
      }).kind
    ).toBe("recompete");
    expect(
      classifyRadarSignal({
        requirementsText: "This replaces the incumbent contract for grounds maintenance.",
      }).kind
    ).toBe("recompete");
  });

  it("extracts base+option language from live SAM custodial wording", () => {
    const result = classifyRadarSignal({
      title: "Custodial Services OH033",
      noticeType: "Combined Synopsis/Solicitation",
      requirementsText:
        "Non-personal Custodial Services OH033. The period of performance is 15 January 2026 to 31 December 2026 (or subsequent date), which includes one (1) 11.5-month base year with four (4) 12-month option years and a six (6) month extension.",
    });
    expect(result.kind).toBe("option");
    expect(result.optionYears).toBe(4);
    expect(result.eventDate).toBe("2026-12-31");
    expect(result.source).toBe("requirements_text");
    expect(result.evidence).toMatch(/option years/i);
  });

  it("reads B+4 title shorthand and slash POP ranges", () => {
    const result = classifyRadarSignal({
      title: "Custodial Services for the 88th RD at IN075 B+4 POP 3/1.",
      requirementsText:
        "The base period of performance is 2/1/2026-1/31/2027 with four (4) option years.",
    });
    expect(result.kind).toBe("option");
    expect(result.optionYears).toBe(4);
    expect(result.eventDate).toBe("2027-01-31");
  });

  it("classifies POP-only language as expiration without inventing options", () => {
    const result = classifyRadarSignal({
      title:
        "The purpose of this requirement is for a new Janitorial Services contract at the Long Island National Cemetery (LINC). The Period of Performance (POP) is from 5/1/2025 thru 4/30/2026.",
    });
    expect(result.kind).toBe("expiration");
    expect(result.eventDate).toBe("2026-04-30");
    expect(result.optionYears).toBeNull();
  });

  it("prefers recompete over option when both appear", () => {
    const result = classifyRadarSignal({
      title: "Janitorial recompete",
      requirementsText:
        "Follow-on contract. Base year with four (4) option years. Period of performance is 1 October 2026 to 30 September 2027.",
    });
    expect(result.kind).toBe("recompete");
    expect(result.optionYears).toBe(4);
    expect(result.eventDate).toBe("2027-09-30");
  });

  it("treats a facilities Sources Sought with no incumbent language as a possible early opportunity, not a recompete", () => {
    const result = classifyRadarSignal({
      title: "Tyndall Base Custodial Services IDIQ",
      noticeType: "Sources Sought",
      requirementsText:
        "The 325th Contracting Squadron at Tyndall AFB, FL, is issuing this RFI for qualified 8(a) firms to provide custodial services.",
    });
    expect(result.kind).toBe("early_signal");
    expect(result.source).toBe("notice_type");
    expect(result.eventDate).toBeNull();
    expect(result.evidence).not.toMatch(/recompete/i);
  });

  it("does not treat negated follow-on boilerplate as recompete evidence (Sep 12 audit)", () => {
    // Real pattern from the Yokota construction-site security-monitoring
    // notice: standard sources-sought disclaimer language, not an actual
    // recompete/follow-on signal.
    const result = classifyRadarSignal({
      title: "Construction Site Security Monitoring Services",
      noticeType: "Sources Sought",
      requirementsText:
        "This is a market research announcement only. The Government is not obligated to award a follow-on contract as a result of this notice, and there is no commitment to any follow-on announcement.",
    });
    expect(result.kind).not.toBe("recompete");
  });

  it("classifies a sole-source follow-on to a named incumbent separately from an ordinary recompete (Sep 12 audit)", () => {
    // Real pattern from the USPTO example: an explicit sole-source follow-on
    // is useful incumbent intelligence, not an open competitive recompete.
    const result = classifyRadarSignal({
      title: "Notice of Intent to Sole Source",
      requirementsText:
        "The agency intends to award a sole source follow-on contract to Acme Facilities Group, the incumbent contractor, to avoid a lapse in service.",
    });
    expect(result.kind).toBe("sole_source_followon");
    expect(result.evidence).toMatch(/follow-on/i);
  });

  it("still classifies an ordinary competitive follow-on as recompete when sole-source isn't mentioned", () => {
    const result = classifyRadarSignal({
      title: "Follow-on custodial services, full and open competition",
      requirementsText: "This requirement will be competed as a follow-on to the incumbent contract.",
    });
    expect(result.kind).toBe("recompete");
  });

  it("does not treat a random Sources Sought as a radar hit", () => {
    expect(
      classifyRadarSignal({
        title: "Market research for office supplies",
        noticeType: "Sources Sought",
      }).kind
    ).toBeNull();
  });

  it("does not invent dates from award or archive fields in raw_data", () => {
    const result = classifyRadarSignal({
      title: "Custodial Services TX075",
      noticeType: "Award Notice",
      rawData: {
        award: { date: "2026-01-23", amount: "120000" },
        archiveDate: "2026-06-01",
        description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc",
      },
    });
    expect(result.eventDate).toBeNull();
  });

  it("uses inline raw_data description text but ignores description URLs", () => {
    const fromText = classifyRadarSignal({
      title: "Grounds maintenance",
      rawData: {
        description:
          "The period of performance is 1 March 2026 to 28 February 2027.",
      },
    });
    expect(fromText.kind).toBe("expiration");
    expect(fromText.source).toBe("raw_data");
    expect(fromText.eventDate).toBe("2027-02-28");

    const fromUrl = classifyRadarSignal({
      title: "Grounds maintenance",
      rawData: {
        description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc",
      },
    });
    expect(fromUrl.kind).toBeNull();
  });

  it("returns an empty classification when there is no signal", () => {
    expect(
      classifyRadarSignal({
        title: "FIRE ALARM / SECURITY PANEL REPLACEMENTS",
        noticeType: "Solicitation",
      })
    ).toEqual({
      kind: null,
      eventDate: null,
      evidence: null,
      source: null,
      optionYears: null,
    });
  });
});

describe("extractScaWageContext", () => {
  it("extracts a WD number and does not invent one", () => {
    const found = extractScaWageContext({
      requirementsText:
        "Service Contract Act applies. Wage Determination WD-2015-5637 is incorporated.",
    });
    expect(found.mentioned).toBe(true);
    expect(found.wdNumber).toBe("2015-5637");
    expect(found.wdUrl).toBe("https://sam.gov/wage-determination");

    const mentionOnly = extractScaWageContext({
      requirementsText:
        "Amendment 0001: Wage determination has been updated. See attachments.",
    });
    expect(mentionOnly.mentioned).toBe(true);
    expect(mentionOnly.wdNumber).toBeNull();
    expect(mentionOnly.wdUrl).toBeNull();
    expect(mentionOnly.evidence).toMatch(/wage determination/i);

    const silent = extractScaWageContext({
      title: "Custodial Services OH033",
      requirementsText: "Non-personal custodial services. Base plus four option years.",
    });
    expect(silent.mentioned).toBe(false);
    expect(silent.wdNumber).toBeNull();
  });

  it("keeps a SAM wage-determination link from notice text or resourceLinks", () => {
    const fromText = extractScaWageContext({
      requirementsText: "See https://sam.gov/wage-determination for the applicable WD.",
    });
    expect(fromText.mentioned).toBe(true);
    expect(fromText.wdUrl).toBe("https://sam.gov/wage-determination");

    const fromLink = extractScaWageContext({
      rawData: {
        resourceLinks: ["https://sam.gov/api/prod/opps/v3/opportunities/resources/files/wd-file"],
      },
    });
    expect(fromLink.mentioned).toBe(true);
  });
});

describe("radarPersistFields", () => {
  it("flattens classification + SCA into upsert columns", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    const fields = radarPersistFields(
      {
        title: "Janitorial recompete",
        requirementsText:
          "Follow-on. Base year with four (4) option years. Wage Determination 2015-4281 applies.",
      },
      now
    );
    expect(fields.radar_kind).toBe("recompete");
    expect(fields.radar_option_years).toBe(4);
    expect(fields.sca_mentioned).toBe(true);
    expect(fields.sca_wd_number).toBe("2015-4281");
    expect(fields.radar_classified_at).toBe("2026-09-10T12:00:00.000Z");
  });
});
