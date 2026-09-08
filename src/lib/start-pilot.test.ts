import { describe, expect, it } from "vitest";
import { startPilotHref } from "./start-pilot";

describe("startPilotHref", () => {
  it("uses the Stripe payment link when set", () => {
    expect(startPilotHref("https://buy.stripe.com/test_abc")).toBe(
      "https://buy.stripe.com/test_abc"
    );
  });

  it("returns null when unset so the page can show the fallback", () => {
    expect(startPilotHref(undefined)).toBeNull();
    expect(startPilotHref("")).toBeNull();
  });
});
