import { describe, expect, it } from "vitest";
import { generatePassword, hashPassword, verifyPassword } from "./subscriber-password";

describe("subscriber-password", () => {
  it("verifies a hash of the same password", () => {
    const stored = hashPassword("correct-horse");
    expect(verifyPassword("correct-horse", stored)).toBe(true);
  });

  it("rejects the wrong password", () => {
    const stored = hashPassword("correct-horse");
    expect(verifyPassword("wrong-battery", stored)).toBe(false);
  });

  it("does not store the plaintext", () => {
    const stored = hashPassword("correct-horse");
    expect(stored.includes("correct-horse")).toBe(false);
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it("rejects a malformed stored hash", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "nosalt")).toBe(false);
  });

  it("generatePassword is at least 20 characters and not the founder secret", () => {
    const p = generatePassword();
    expect(p.length).toBeGreaterThanOrEqual(20);
    expect(p).not.toBe(process.env.ADMIN_PASSWORD);
  });
});
