import { describe, expect, it } from "vitest";
import { validateContactRequest } from "./contact-request";

function input(overrides: Partial<Parameters<typeof validateContactRequest>[0]> = {}) {
  return {
    name: "Pat Reyes",
    email: "pat@example.com",
    company: "Reyes Facilities",
    message: "We do federal janitorial and grounds work and want in on the pilot.",
    ...overrides,
  };
}

describe("validateContactRequest", () => {
  it("returns no errors for valid input", () => {
    expect(validateContactRequest(input())).toEqual({});
  });

  it("requires a name", () => {
    expect(validateContactRequest(input({ name: "  " }))).toHaveProperty("name");
  });

  it("requires an email", () => {
    expect(validateContactRequest(input({ email: "" }))).toHaveProperty("email");
  });

  it("rejects a malformed email", () => {
    expect(validateContactRequest(input({ email: "not-an-email" }))).toHaveProperty("email");
  });

  it("requires a message", () => {
    expect(validateContactRequest(input({ message: "" }))).toHaveProperty("message");
  });

  it("does not require a company", () => {
    expect(validateContactRequest(input({ company: "" }))).toEqual({});
  });
});
