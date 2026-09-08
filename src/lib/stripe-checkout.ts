import type Stripe from "stripe";

export type CheckoutDetails = {
  email: string | null;
  name: string | null;
  company: string | null;
};

/** Fallback when Stripe doesn't expand the subscription period: a little
 * past one calendar month so a slow invoice.paid doesn't strand a seat. */
export const MONTHLY_GRACE_MS = 35 * 24 * 60 * 60 * 1000;

/** Pulls the fields self-serve provisioning needs out of a completed
 * Checkout Session. Email is always present for a completed session
 * (Stripe requires it for the receipt). Name requires "Collect customer
 * names" to be turned on for the Payment Link -- without it, name is
 * always null, which is a Stripe Dashboard setting, not a code bug.
 * Company comes from a custom field with key "company", which the Payment
 * Link needs configured the same way -- there's no default field for it. */
export function extractCheckoutDetails(session: Stripe.Checkout.Session): CheckoutDetails {
  const email = session.customer_details?.email ?? null;
  const name = session.customer_details?.name ?? null;
  const companyField = session.custom_fields?.find((f) => f.key === "company");
  const company = companyField?.text?.value ?? null;
  return { email, name, company };
}

function priceIdOf(price: string | { id: string } | null | undefined): string | null {
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

/** Price IDs on a Checkout Session. Empty unless line_items were expanded. */
export function priceIdsFromCheckout(session: Stripe.Checkout.Session): string[] {
  const ids: string[] = [];
  for (const item of session.line_items?.data ?? []) {
    const id = priceIdOf(item.price);
    if (id) ids.push(id);
  }
  return ids;
}

/** Price IDs on an Invoice. Reads both the current `pricing.price_details`
 * shape and a legacy `price` field so a Dashboard API-version bump doesn't
 * silently stop matching. */
export function priceIdsFromInvoice(invoice: Stripe.Invoice): string[] {
  const ids: string[] = [];
  for (const line of invoice.lines?.data ?? []) {
    const details = (
      line as {
        pricing?: { price_details?: { price?: string } };
        price?: string | { id: string } | null;
      }
    ).pricing?.price_details?.price;
    if (details) ids.push(details);
    const legacy = priceIdOf(
      (line as { price?: string | { id: string } | null }).price
    );
    if (legacy) ids.push(legacy);
  }
  return [...new Set(ids)];
}

/** When STRIPE_PRICE_ID is unset, accept anything (Hawk before the shared
 * account grew other products). Once set, ignore events for the other apps. */
export function matchesExpectedPrice(
  priceIds: string[],
  expectedPriceId: string | undefined
): boolean {
  const expected = expectedPriceId?.trim();
  if (!expected) return true;
  return priceIds.includes(expected);
}

export function unixToDate(seconds: number | null | undefined): Date | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

export function periodEndFromSubscription(
  subscription: Stripe.Subscription | string | null | undefined
): Date | null {
  if (!subscription || typeof subscription === "string") return null;
  const item = subscription.items?.data?.[0];
  return unixToDate(item?.current_period_end);
}

export function subscriptionFromInvoice(
  invoice: Stripe.Invoice
): Stripe.Subscription | string | null {
  return invoice.parent?.subscription_details?.subscription ?? null;
}
