import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const lastSuccessfulSyncRun = vi.fn();
const notifySyncErrors = vi.fn(async (_errors: string[], _source?: string) => {});

vi.mock("@netacracy/bid-core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  lastSuccessfulSyncRun: (sources?: string[]) => lastSuccessfulSyncRun(sources),
}));

vi.mock("@/lib/notify", () => ({
  notifySyncErrors: (errors: string[], source?: string) => notifySyncErrors(errors, source),
}));

function authedRequest() {
  return new NextRequest("http://localhost/api/check-sync-freshness", {
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("GET /api/check-sync-freshness", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
    lastSuccessfulSyncRun.mockReset();
    notifySyncErrors.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_SECRET;
  });

  it("rejects requests without a matching CRON_SECRET", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/check-sync-freshness", {
        headers: { authorization: "Bearer wrong" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("stays quiet when the last successful run is recent", async () => {
    lastSuccessfulSyncRun.mockResolvedValue({
      id: 1,
      source: "relay",
      upserted: 3,
      error_count: 0,
      errors: [],
      ran_at: "2026-09-06T11:00:00.000Z", // 1h ago
    });

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(body.stale).toBe(false);
    expect(notifySyncErrors).not.toHaveBeenCalled();
  });

  it("scopes the freshness check to the SAM.gov sources only", async () => {
    lastSuccessfulSyncRun.mockResolvedValue(null);

    const { GET } = await import("./route");
    await GET(authedRequest());

    expect(lastSuccessfulSyncRun).toHaveBeenCalledWith(["direct", "relay"]);
  });

  it("alerts when the last successful run is stale", async () => {
    lastSuccessfulSyncRun.mockResolvedValue({
      id: 1,
      source: "relay",
      upserted: 3,
      error_count: 0,
      errors: [],
      ran_at: "2026-09-04T00:00:00.000Z", // 60h ago
    });

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(body.stale).toBe(true);
    expect(notifySyncErrors).toHaveBeenCalledTimes(1);
    expect(notifySyncErrors.mock.calls[0][1]).toBe("sync freshness check");
  });

  it("alerts when there has never been a successful run", async () => {
    lastSuccessfulSyncRun.mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET(authedRequest());
    const body = await res.json();

    expect(body.stale).toBe(true);
    expect(body.lastSuccessAgeHours).toBeNull();
    expect(notifySyncErrors).toHaveBeenCalledTimes(1);
  });
});
