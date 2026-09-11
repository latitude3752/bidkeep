import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const resetSeatPassword = vi.fn(async (_email: string) => ({ password: "new-pass" }));
vi.mock("@/lib/subscriber-seats", () => ({
  resetSeatPassword: (email: string) => resetSeatPassword(email),
}));

const sendPasswordResetEmail = vi.fn(async (_args: unknown) => {});
vi.mock("@/lib/password-reset-email", () => ({
  sendPasswordResetEmail: (args: unknown) => sendPasswordResetEmail(args),
}));

vi.mock("@/lib/operator", () => ({ OPERATOR: { siteUrl: "https://example.com" } }));

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    resetSeatPassword.mockClear();
    sendPasswordResetEmail.mockClear();
  });

  it("sends a reset email and always redirects to the same sent page", async () => {
    const { requestPasswordReset } = await import("./actions");

    await expect(requestPasswordReset(form("subscriber@example.com"))).rejects.toThrow(
      "REDIRECT:/login/reset?sent=1"
    );

    expect(resetSeatPassword).toHaveBeenCalledWith("subscriber@example.com");
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("stops rotating the password after 3 requests for the same email within the window", async () => {
    const { requestPasswordReset } = await import("./actions");

    for (let i = 0; i < 3; i++) {
      await expect(requestPasswordReset(form("target@example.com"))).rejects.toThrow(
        "REDIRECT:/login/reset?sent=1"
      );
    }
    expect(resetSeatPassword).toHaveBeenCalledTimes(3);

    // 4th request within the window: same redirect (no enumeration signal),
    // but the password is never touched again.
    await expect(requestPasswordReset(form("target@example.com"))).rejects.toThrow(
      "REDIRECT:/login/reset?sent=1"
    );
    expect(resetSeatPassword).toHaveBeenCalledTimes(3);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(3);
  });

  it("rate-limits per email, not globally -- a different email is unaffected", async () => {
    const { requestPasswordReset } = await import("./actions");

    for (let i = 0; i < 4; i++) {
      await expect(requestPasswordReset(form("victim@example.com"))).rejects.toThrow(
        "REDIRECT:/login/reset?sent=1"
      );
    }
    expect(resetSeatPassword).toHaveBeenCalledTimes(3);

    await expect(requestPasswordReset(form("someone-else@example.com"))).rejects.toThrow(
      "REDIRECT:/login/reset?sent=1"
    );
    expect(resetSeatPassword).toHaveBeenCalledTimes(4);
  });
});
