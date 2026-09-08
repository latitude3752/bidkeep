import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@netacracy/bid-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveNaicsCodes: async () => [
    { code: "561720", label: "Janitorial Services", active: true },
    { code: "561730", label: "Landscaping Services", active: true },
  ],
}));

function req(secret: string | null) {
  const headers: Record<string, string> = {};
  if (secret !== null) headers["x-relay-secret"] = secret;
  return new NextRequest("http://localhost/api/naics-codes", { headers });
}

describe("GET /api/naics-codes", () => {
  beforeEach(() => {
    process.env.SAM_RELAY_SECRET = "test-relay-secret";
  });

  afterEach(() => {
    delete process.env.SAM_RELAY_SECRET;
  });

  it("rejects requests with no or a mismatched relay secret", async () => {
    const { GET } = await import("./route");
    expect((await GET(req(null))).status).toBe(401);
    expect((await GET(req("wrong"))).status).toBe(401);
  });

  it("returns the active NAICS codes for an authorized relay request", async () => {
    const { GET } = await import("./route");
    const res = await GET(req("test-relay-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.codes).toEqual(["561720", "561730"]);
  });
});
