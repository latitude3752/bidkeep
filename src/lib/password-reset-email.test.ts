import { describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn(
  async (_opts: { to: string | string[]; subject: string; html: string }) => true
);
vi.mock("./mailer", () => ({
  sendEmail,
  escapeHtml: (s: string) => s,
}));

describe("sendPasswordResetEmail", () => {
  it("sends the new password and login URL, not secrets", async () => {
    process.env.ADMIN_PASSWORD = "founder-secret";
    const { sendPasswordResetEmail } = await import("./password-reset-email");
    await sendPasswordResetEmail({
      to: "pat@acme.test",
      password: "new-pass",
      siteUrl: "https://trybidhawk.com",
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.subject).toContain("password reset");
    expect(arg.html).toContain("https://trybidhawk.com/login");
    expect(arg.html).toContain("new-pass");
    expect(arg.html).not.toContain("founder-secret");
  });
});
