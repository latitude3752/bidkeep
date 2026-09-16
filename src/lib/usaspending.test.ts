import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  searchAwardPageByProgramNumber,
  searchAwardsByProgramNumber,
  searchAwardsByProgramNumbers,
  USASPENDING_MAX_ATTEMPTS,
  usaspendingBackoffMs,
} from "./usaspending";

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

describe("USAspending grant award search", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts program_numbers and grant award_type_codes, and maps a real-shaped result row", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        results: [
          {
            generated_internal_id: "ASST_NON_EMW-2026-CU-05011_070",
            "Award ID": "EMW-2026-CU-05011",
            "Recipient Name": "NEW JERSEY OFFICE OF HOMELAND SECURITY AND PREPAREDNESS",
            "Awarding Agency": "Department of Homeland Security",
            "Award Amount": 21764005.0,
            "Start Date": "2025-07-04",
            Description: "COUNTER-UNMANNED AIRCRAFT SYSTEMS GRANT PROGRAM",
            "Recipient Location": {
              state_code: "NJ",
              state_name: "New Jersey",
              city_name: "ROBBINSVILLE",
              county_name: "MERCER",
            },
          },
        ],
        page_metadata: { page: 1, hasNext: false },
      })
    );

    const awards = await searchAwardsByProgramNumber("97.161");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.usaspending.gov/api/v2/search/spending_by_award/");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.filters.program_numbers).toEqual(["97.161"]);
    expect(body.filters.award_type_codes).toEqual(["02", "03", "04", "05"]);

    expect(awards).toEqual([
      {
        awardId: "ASST_NON_EMW-2026-CU-05011_070",
        awardNumber: "EMW-2026-CU-05011",
        recipientName: "NEW JERSEY OFFICE OF HOMELAND SECURITY AND PREPAREDNESS",
        awardingAgency: "Department of Homeland Security",
        amount: 21764005.0,
        startDate: "2025-07-04",
        description: "COUNTER-UNMANNED AIRCRAFT SYSTEMS GRANT PROGRAM",
        state: "New Jersey",
        county: "MERCER",
        city: "ROBBINSVILLE",
      },
    ]);
  });

  it("pages while page_metadata.hasNext is true", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ generated_internal_id: "a", "Recipient Name": "Agency A" }],
          page_metadata: { page: 1, hasNext: true },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ generated_internal_id: "b", "Recipient Name": "Agency B" }],
          page_metadata: { page: 2, hasNext: false },
        })
      );

    const awards = await searchAwardsByProgramNumber("97.161");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(awards.map((a) => a.awardId)).toEqual(["a", "b"]);
    const secondBody = JSON.parse(
      String((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body)
    );
    expect(secondBody.page).toBe(2);
  });

  it("skips rows missing an id or recipient name", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        results: [
          { generated_internal_id: "has-id-no-name" },
          { "Recipient Name": "Has name, no id" },
          { generated_internal_id: "c", "Recipient Name": "Complete" },
        ],
        page_metadata: { page: 1, hasNext: false },
      })
    );

    const awards = await searchAwardsByProgramNumber("97.161");
    expect(awards.map((a) => a.awardId)).toEqual(["c"]);
  });

  it("throws on a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    } as Response);

    await expect(searchAwardsByProgramNumber("97.161")).rejects.toThrow(
      "USAspending API error 500"
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a 503 with exponential backoff then succeeds", async () => {
    const sleep = vi.fn(async () => {});
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "unavailable",
      } as Response)
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ generated_internal_id: "a", "Recipient Name": "Agency A" }],
          page_metadata: { page: 1, hasNext: false },
        })
      );

    const page = await searchAwardPageByProgramNumber("10.766", 1, { sleep });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(usaspendingBackoffMs(0));
    expect(page.awards.map((a) => a.awardId)).toEqual(["a"]);
  });

  it("retries a 502 then a 504 before succeeding", async () => {
    const sleep = vi.fn(async () => {});
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => "bad gateway",
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        text: async () => "gateway timeout",
      } as Response)
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ generated_internal_id: "b", "Recipient Name": "Agency B" }],
          page_metadata: { page: 1, hasNext: false },
        })
      );

    const page = await searchAwardPageByProgramNumber("14.218", 1, { sleep });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([
      usaspendingBackoffMs(0),
      usaspendingBackoffMs(1),
    ]);
    expect(page.awards.map((a) => a.awardId)).toEqual(["b"]);
  });

  it("retries an empty JSON body then succeeds", async () => {
    const sleep = vi.fn(async () => {});
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      } as Response)
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ generated_internal_id: "c", "Recipient Name": "Agency C" }],
          page_metadata: { page: 1, hasNext: false },
        })
      );

    const page = await searchAwardPageByProgramNumber("14.228", 1, { sleep });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(page.awards.map((a) => a.awardId)).toEqual(["c"]);
  });

  it("retries a fetch TypeError then succeeds", async () => {
    const sleep = vi.fn(async () => {});
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ generated_internal_id: "d", "Recipient Name": "Agency D" }],
          page_metadata: { page: 1, hasNext: false },
        })
      );

    const page = await searchAwardPageByProgramNumber("81.041", 1, { sleep });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(page.awards.map((a) => a.awardId)).toEqual(["d"]);
  });

  it("gives up after retries on a persistent 504", async () => {
    const sleep = vi.fn(async () => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 504,
      text: async () => "gateway timeout",
    } as Response);

    await expect(searchAwardPageByProgramNumber("14.872", 1, { sleep })).rejects.toThrow(
      "USAspending API error 504: gateway timeout"
    );
    expect(fetch).toHaveBeenCalledTimes(USASPENDING_MAX_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(USASPENDING_MAX_ATTEMPTS - 1);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([
      usaspendingBackoffMs(0),
      usaspendingBackoffMs(1),
      usaspendingBackoffMs(2),
    ]);
  });

  it("does not retry a non-transient fetch Error", async () => {
    const sleep = vi.fn(async () => {});
    vi.mocked(fetch).mockRejectedValue(new Error("USAspending 503"));

    await expect(searchAwardPageByProgramNumber("81.128", 1, { sleep })).rejects.toThrow(
      "USAspending 503"
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("searchAwardPageByProgramNumber returns a single page and hasNext", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        results: [{ generated_internal_id: "a", "Recipient Name": "Agency A" }],
        page_metadata: { page: 2, hasNext: true },
      })
    );

    const page = await searchAwardPageByProgramNumber("97.161", 2);
    expect(page.awards.map((a) => a.awardId)).toEqual(["a"]);
    expect(page.hasNext).toBe(true);
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect(body.page).toBe(2);
  });

  it("searchAwardsByProgramNumbers fetches every ALN and flattens the results", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      const aln = body.filters.program_numbers[0];
      return jsonResponse({
        results: [{ generated_internal_id: `award-${aln}`, "Recipient Name": `Agency ${aln}` }],
        page_metadata: { page: 1, hasNext: false },
      });
    });

    const awards = await searchAwardsByProgramNumbers(["97.161", "20.765"]);
    expect(awards.map((a) => a.awardId).sort()).toEqual(["award-20.765", "award-97.161"]);
  });
});
