import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  extractCheckoutDetails,
  matchesExpectedPrice,
  periodEndFromSubscription,
  priceIdsFromCheckout,
} from "./stripe-checkout";

function session(overrides: Partial<Stripe.Checkout.Session>): Stripe.Checkout.Session {
  return {
    customer_details: null,
    custom_fields: [],
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe("extractCheckoutDetails", () => {
  it("pulls email and name from customer_details", () => {
    const result = extractCheckoutDetails(
      session({
        customer_details: {
          email: "buyer@example.com",
          name: "Acme Robotics",
        } as Stripe.Checkout.Session.CustomerDetails,
      })
    );
    expect(result).toEqual({
      email: "buyer@example.com",
      name: "Acme Robotics",
      company: null,
    });
  });

  it("pulls company from the custom field keyed 'company'", () => {
    const result = extractCheckoutDetails(
      session({
        custom_fields: [
          {
            key: "company",
            text: { value: "Acme Robotics LLC" },
          } as Stripe.Checkout.Session.CustomField,
        ],
      })
    );
    expect(result.company).toBe("Acme Robotics LLC");
  });

  it("ignores custom fields with a different key", () => {
    const result = extractCheckoutDetails(
      session({
        custom_fields: [
          { key: "engraving", text: { value: "Happy Birthday" } } as Stripe.Checkout.Session.CustomField,
        ],
      })
    );
    expect(result.company).toBeNull();
  });

  it("returns nulls when nothing was collected", () => {
    expect(extractCheckoutDetails(session({}))).toEqual({
      email: null,
      name: null,
      company: null,
    });
  });
});

describe("matchesExpectedPrice", () => {
  it("accepts any price when the expected id is unset", () => {
    expect(matchesExpectedPrice(["price_other"], undefined)).toBe(true);
    expect(matchesExpectedPrice(["price_other"], "  ")).toBe(true);
  });

  it("accepts a session that includes this app's price", () => {
    expect(matchesExpectedPrice(["price_hawk", "price_other"], "price_hawk")).toBe(true);
  });

  it("rejects a session that is only another app's price", () => {
    expect(matchesExpectedPrice(["price_yard"], "price_hawk")).toBe(false);
    expect(matchesExpectedPrice([], "price_hawk")).toBe(false);
  });
});

describe("priceIdsFromCheckout", () => {
  it("reads expanded Price objects and string ids", () => {
    const result = priceIdsFromCheckout(
      session({
        line_items: {
          data: [
            { price: { id: "price_obj" } },
            { price: "price_str" },
            { price: null },
          ],
        },
      } as unknown as Partial<Stripe.Checkout.Session>)
    );
    expect(result).toEqual(["price_obj", "price_str"]);
  });
});

describe("periodEndFromSubscription", () => {
  it("reads current_period_end from the first subscription item", () => {
    const end = periodEndFromSubscription({
      items: { data: [{ current_period_end: 1_700_000_000 }] },
    } as Stripe.Subscription);
    expect(end?.toISOString()).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it("returns null for an unexpanded subscription id", () => {
    expect(periodEndFromSubscription("sub_123")).toBeNull();
  });
});
