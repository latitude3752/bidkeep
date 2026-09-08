import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBonfireDedupKey,
  buildBonfireSearchUrl,
  fetchAllBonfireOpportunities,
  searchBonfirePreview,
} from "./bonfire";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildBonfireDedupKey", () => {
  it("is stable for identical inputs", () => {
    const input = { title: "Storm Sewer Extension", state: "PA", dateOpen: "2026-09-08", dateClose: "2026-10-05" };
    expect(buildBonfireDedupKey(input)).toBe(buildBonfireDedupKey({ ...input }));
  });

  it("is case-insensitive on title (Bonfire could return the same listing with different casing across searches)", () => {
    const a = buildBonfireDedupKey({ title: "Storm Sewer Extension", state: "PA", dateOpen: "d1", dateClose: "d2" });
    const b = buildBonfireDedupKey({ title: "STORM SEWER EXTENSION", state: "PA", dateOpen: "d1", dateClose: "d2" });
    expect(a).toBe(b);
  });

  it("differs when any field differs", () => {
    const base = { title: "Roof Replacement", state: "OH", dateOpen: "d1", dateClose: "d2" };
    expect(buildBonfireDedupKey(base)).not.toBe(buildBonfireDedupKey({ ...base, state: "IN" }));
    expect(buildBonfireDedupKey(base)).not.toBe(buildBonfireDedupKey({ ...base, dateClose: "d3" }));
  });
});

describe("buildBonfireSearchUrl", () => {
  it("URL-encodes the title into a Bonfire preview search link", () => {
    const url = buildBonfireSearchUrl("Storm Sewer & Drain Extension");
    expect(url).toBe(
      "https://vendor.bonfirehub.com/preview?search=Storm+Sewer+%26+Drain+Extension",
    );
  });
});

describe("searchBonfirePreview", () => {
  it("throws on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(searchBonfirePreview({ search: "janitorial", page: 1 })).rejects.toThrow(/HTTP 500/);
  });

  it("throws when the body isn't the expected array shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ not: "an array" })));
    await expect(searchBonfirePreview({ search: "janitorial", page: 1 })).rejects.toThrow(/unexpected response shape/);
  });

  it("parses a valid response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          { ProjectName: "Roof Replacement", ProjectStatusID: 2, DateOpen: "2026-09-08", DateClose: "2026-10-01", Locations: ["US.OH"] },
        ]),
      ),
    );
    const rows = await searchBonfirePreview({ search: "janitorial", page: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ProjectName).toBe("Roof Replacement");
  });
});

describe("fetchAllBonfireOpportunities", () => {
  it("dedupes a listing matched by more than one keyword", async () => {
    const shared = { ProjectName: "Municipal Concrete Repair", ProjectStatusID: 2, DateOpen: "2026-09-08", DateClose: "2026-10-01", Locations: ["US.TX"] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([shared])), // every keyword/page "finds" the same listing
    );
    const { opportunities, errors } = await fetchAllBonfireOpportunities(["janitorial", "custodial"]);
    expect(errors).toEqual([]);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]!.title).toBe("Municipal Concrete Repair");
    expect(opportunities[0]!.state).toBe("TX");
  });

  it("stops paginating a keyword once a short page comes back", async () => {
    const calls: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const page = Number(new URL(String(input)).searchParams.get("page"));
        calls.push(page);
        // Full page 1, short (final) page 2.
        if (page === 1) {
          return jsonResponse(
            Array.from({ length: 25 }, (_, i) => ({
              ProjectName: `Job ${i}`,
              ProjectStatusID: 2,
              DateOpen: "2026-09-08",
              DateClose: "2026-10-01",
              Locations: ["US.CA"],
            })),
          );
        }
        return jsonResponse([{ ProjectName: "Last Job", ProjectStatusID: 2, DateOpen: "2026-09-08", DateClose: "2026-10-01", Locations: ["US.CA"] }]);
      }),
    );
    const { opportunities, errors } = await fetchAllBonfireOpportunities(["paving"]);
    expect(errors).toEqual([]);
    expect(calls).toEqual([1, 2]); // never reaches page 3+ for this keyword
    expect(opportunities).toHaveLength(26);
  });

  it("records a failing keyword's error and continues with the rest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const search = new URL(String(input)).searchParams.get("search");
        if (search === "broken") return new Response("", { status: 500 });
        return jsonResponse([{ ProjectName: "OK Job", ProjectStatusID: 2, DateOpen: "2026-09-08", DateClose: "2026-10-01", Locations: ["US.NY"] }]);
      }),
    );
    const { opportunities, errors } = await fetchAllBonfireOpportunities(["broken", "janitorial"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/broken/);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]!.title).toBe("OK Job");
  });

  it("parses only a recognizable US.<state> location, leaving others null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          { ProjectName: "Weird Location Job", ProjectStatusID: 2, DateOpen: null, DateClose: null, Locations: ["CA.ON"] },
        ]),
      ),
    );
    const { opportunities } = await fetchAllBonfireOpportunities(["x"]);
    expect(opportunities[0]!.state).toBeNull();
  });
});
