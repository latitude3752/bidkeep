import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listActiveSeats = vi.fn(async () => [] as Array<{ email: string }>);
vi.mock("./subscriber-seats", () => ({ listActiveSeats }));

const sendEmail = vi.fn(
  async (_opts: { to: string | string[]; bcc?: string; subject: string; html: string }) => true
);
const isEmailConfigured = vi.fn(() => true);
vi.mock("./mailer", async () => {
  const actual = await vi.importActual<typeof import("./mailer")>("./mailer");
  return { ...actual, sendEmail, isEmailConfigured };
});

describe("resolveDigestMailing / resolveErrorMailing", () => {
  beforeEach(() => {
    listActiveSeats.mockReset();
    delete process.env.FOUNDER_DIGEST_BCC;
    delete process.env.NOTIFY_EMAIL_TO;
  });
  afterEach(() => {
    delete process.env.FOUNDER_DIGEST_BCC;
    delete process.env.NOTIFY_EMAIL_TO;
  });

  it("mails active seats and BCCs the founder", async () => {
    listActiveSeats.mockResolvedValue([
      { email: "pat@acme.test" },
      { email: "sam@acme.test" },
    ]);
    process.env.FOUNDER_DIGEST_BCC = "ben@bidkeep.example";
    const { resolveDigestMailing } = await import("./notify");
    await expect(resolveDigestMailing()).resolves.toEqual({
      to: ["pat@acme.test", "sam@acme.test"],
      bcc: "ben@bidkeep.example",
    });
  });

  it("skips the digest when no seats are active", async () => {
    listActiveSeats.mockResolvedValue([]);
    process.env.FOUNDER_DIGEST_BCC = "ben@bidkeep.example";
    const { resolveDigestMailing } = await import("./notify");
    await expect(resolveDigestMailing()).resolves.toBeNull();
  });

  it("sends sync errors to founder only, never seats", async () => {
    listActiveSeats.mockResolvedValue([{ email: "pat@acme.test" }]);
    process.env.FOUNDER_DIGEST_BCC = "ben@bidkeep.example";
    const { resolveErrorMailing } = await import("./notify");
    await expect(resolveErrorMailing()).resolves.toEqual({
      to: ["ben@bidkeep.example"],
    });
  });

  it("falls back to NOTIFY_EMAIL_TO as founder BCC", async () => {
    listActiveSeats.mockResolvedValue([{ email: "pat@acme.test" }]);
    process.env.NOTIFY_EMAIL_TO = "legacy@bidkeep.example";
    const { resolveDigestMailing } = await import("./notify");
    await expect(resolveDigestMailing()).resolves.toEqual({
      to: ["pat@acme.test"],
      bcc: "legacy@bidkeep.example",
    });
  });

  it("throws (does not silently swallow) when listActiveSeats rejects", async () => {
    listActiveSeats.mockRejectedValue(new Error("supabase down"));
    process.env.FOUNDER_DIGEST_BCC = "ben@bidkeep.example";
    const { resolveDigestMailing } = await import("./notify");
    await expect(resolveDigestMailing()).rejects.toThrow("supabase down");
  });
});

describe("notifyNewOpportunities / notifyNewGrantAwards / notifyNewFundingOpportunities", () => {
  const opportunity = {
    title: "Janitorial Services — Barracks Building 412",
    agency: "DEPT OF THE ARMY",
    noticeUrl: "https://sam.gov/opp/n1",
    responseDeadline: "2026-11-01T00:00:00.000Z",
    naicsCode: "561720",
    scaleLabel: null,
  };
  const grantAward = {
    recipientName: "STATE OF GEORGIA",
    awardingAgency: "Department of Agriculture",
    amount: 1850000,
    state: "Georgia",
    programNumber: "10.766",
  };
  const fundingOpportunity = {
    title: "Community Facilities Grant Program",
    agency: "USDA/RD",
    opportunityUrl: "https://www.grants.gov/search-results-detail/360833",
    closeDate: "2026-12-05",
    programNumber: "10.766",
  };

  beforeEach(() => {
    listActiveSeats.mockReset();
    sendEmail.mockReset().mockResolvedValue(true);
    isEmailConfigured.mockReset().mockReturnValue(true);
    delete process.env.FOUNDER_DIGEST_BCC;
    delete process.env.NOTIFY_EMAIL_TO;
  });

  it("sends an action digest of soonest notices", async () => {
    listActiveSeats.mockResolvedValue([{ email: "pat@acme.test" }]);
    const { notifyNewOpportunities } = await import("./notify");
    await notifyNewOpportunities([opportunity]);
    const arg = sendEmail.mock.calls[0][0] as { subject: string; html: string };
    expect(arg.subject).toContain("Action digest");
    expect(arg.html).toContain("https://sam.gov/opp/n1");
  });

  it("returns null and never calls sendEmail for an empty batch", async () => {
    const { notifyNewOpportunities } = await import("./notify");
    await expect(notifyNewOpportunities([])).resolves.toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns null and never calls sendEmail when there are no active seats", async () => {
    listActiveSeats.mockResolvedValue([]);
    const { notifyNewOpportunities } = await import("./notify");
    await expect(notifyNewOpportunities([opportunity])).resolves.toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the digest and returns null on success", async () => {
    listActiveSeats.mockResolvedValue([{ email: "pat@acme.test" }]);
    const { notifyNewGrantAwards } = await import("./notify");
    await expect(notifyNewGrantAwards([grantAward])).resolves.toBeNull();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0] as { to: string[]; subject: string; html: string };
    expect(arg.to).toEqual(["pat@acme.test"]);
    expect(arg.subject).toContain("1 new grant award");
    expect(arg.html).toContain("STATE OF GEORGIA");
  });

  it("sends the funding-opportunity digest with a working link and close date", async () => {
    listActiveSeats.mockResolvedValue([{ email: "pat@acme.test" }]);
    const { notifyNewFundingOpportunities } = await import("./notify");
    await expect(notifyNewFundingOpportunities([fundingOpportunity])).resolves.toBeNull();
    const arg = sendEmail.mock.calls[0][0] as { html: string };
    expect(arg.html).toContain("https://www.grants.gov/search-results-detail/360833");
    expect(arg.html).toContain("ALN 10.766");
  });

  it("returns an error string (does not throw) when the seat lookup fails", async () => {
    listActiveSeats.mockRejectedValue(new Error("supabase down"));
    const { notifyNewOpportunities } = await import("./notify");
    const result = await notifyNewOpportunities([opportunity]);
    expect(result).toMatch(/digest recipient lookup failed.*supabase down/);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns an error string when sendEmail fails and SMTP is configured", async () => {
    listActiveSeats.mockResolvedValue([{ email: "pat@acme.test" }]);
    sendEmail.mockResolvedValue(false);
    isEmailConfigured.mockReturnValue(true);
    const { notifyNewOpportunities } = await import("./notify");
    const result = await notifyNewOpportunities([opportunity]);
    expect(result).toMatch(/failed to send/);
  });

  it("returns null (not an error) when sendEmail fails only because SMTP isn't configured", async () => {
    listActiveSeats.mockResolvedValue([{ email: "pat@acme.test" }]);
    sendEmail.mockResolvedValue(false);
    isEmailConfigured.mockReturnValue(false);
    const { notifyNewOpportunities } = await import("./notify");
    await expect(notifyNewOpportunities([opportunity])).resolves.toBeNull();
  });
});
