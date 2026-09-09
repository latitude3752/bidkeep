import { describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn(
  async (_opts: { to: string | string[]; subject: string; html: string }) => true
);
vi.mock("./mailer", () => ({
  sendEmail,
  escapeHtml: (s: string) => s,
}));

describe("sendWelcomeEmail", () => {
  it("sends login URL, password, terms, and kickoff line — not ADMIN_PASSWORD", async () => {
    process.env.ADMIN_PASSWORD = "founder-secret";
    const { sendWelcomeEmail } = await import("./welcome-email");
    await sendWelcomeEmail({
      to: "pat@acme.test",
      password: "one-time-pass",
      siteUrl: "https://bidkeep-seven.vercel.app",
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const html = sendEmail.mock.calls[0][0].html as string;
    expect(html).toContain("https://bidkeep-seven.vercel.app/login");
    expect(html).toContain("one-time-pass");
    expect(html).toContain("/terms");
    expect(html).toContain("30-minute kickoff");
    expect(html).not.toContain("founder-secret");
  });

  it("includes email, pipeline URL, terms URL, kickoff sentence, and the expected subject — not SUBSCRIBER_SESSION_SECRET", async () => {
    process.env.SUBSCRIBER_SESSION_SECRET = "session-secret-value";
    sendEmail.mockClear();
    sendEmail.mockResolvedValueOnce(true);
    const { sendWelcomeEmail } = await import("./welcome-email");
    const sent = await sendWelcomeEmail({
      to: "pat@acme.test",
      password: "one-time-pass",
      siteUrl: "https://bidkeep-seven.vercel.app",
    });
    expect(sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.subject).toBe("Your BidKeep login");
    expect(arg.to).toBe("pat@acme.test");
    expect(arg.html).toContain("pat@acme.test");
    expect(arg.html).toContain("https://bidkeep-seven.vercel.app/app/opportunities");
    expect(arg.html).toContain("https://bidkeep-seven.vercel.app/terms");
    expect(arg.html).toContain("Reply to this email to book the 30-minute kickoff.");
    expect(arg.html).not.toContain("session-secret-value");
    expect(arg.html).not.toContain("ADMIN_PASSWORD");
    expect(arg.html).not.toContain("SUBSCRIBER_SESSION_SECRET");
  });
});
