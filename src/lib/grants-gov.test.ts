import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchFundingOpportunitiesByAln, toIsoDate } from "./grants-gov";

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

describe("toIsoDate", () => {
  it("converts MM/DD/YYYY to ISO", () => {
    expect(toIsoDate("07/20/2026")).toBe("2026-07-20");
  });

  it("returns null for null, undefined, or unrecognized formats", () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("2026-07-20")).toBeNull();
  });
});

describe("Grants.gov funding opportunity search", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("searches by ALN across every status, including closed/archived", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        errorcode: 0,
        msg: "Webservice Succeeds",
        data: {
          hitCount: 1,
          oppHits: [
            {
              id: "360833",
              number: "FHWA-STP-FY26-161",
              title: "Surface Transportation Block Grant Program",
              agencyCode: "DOT-FHWA",
              agency: "Department of Transportation - Federal Highway Administration",
              openDate: "11/07/2025",
              closeDate: "12/05/2025",
              oppStatus: "archived",
              docType: "synopsis",
              cfdaList: ["20.205"],
            },
          ],
        },
      })
    );

    const opps = await searchFundingOpportunitiesByAln("20.205");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.grants.gov/v1/api/search2");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.cfda).toBe("20.205");
    expect(body.oppStatuses).toBe("forecasted|posted|closed|archived");

    expect(opps).toEqual([
      {
        id: "360833",
        number: "FHWA-STP-FY26-161",
        title: "Surface Transportation Block Grant Program",
        agency: "Department of Transportation - Federal Highway Administration",
        openDate: "2025-11-07",
        closeDate: "2025-12-05",
        status: "archived",
        alnList: ["20.205"],
        opportunityUrl: "https://www.grants.gov/search-results-detail/360833",
      },
    ]);
  });

  it("drops hits missing an id, number, or title", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        errorcode: 0,
        data: {
          oppHits: [
            { number: "n1", title: "No id" },
            { id: "2", title: "No number" },
            { id: "3", number: "n3", title: "Complete", cfdaList: ["20.205"] },
          ],
        },
      })
    );

    const opps = await searchFundingOpportunitiesByAln("20.205");
    expect(opps.map((o) => o.id)).toEqual(["3"]);
  });

  it("throws when the API returns a non-zero errorcode", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ errorcode: 1, msg: "Invalid search criteria" })
    );

    await expect(searchFundingOpportunitiesByAln("bad")).rejects.toThrow(
      "Invalid search criteria"
    );
  });

  it("throws on a non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    } as Response);

    await expect(searchFundingOpportunitiesByAln("20.205")).rejects.toThrow(
      "Grants.gov API error 503"
    );
  });
});
