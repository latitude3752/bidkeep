import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSeat, extendSeatAccess } from "@/lib/subscriber-seats";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import { notifySyncErrors } from "@/lib/notify";
import {
  MONTHLY_GRACE_MS,
  extractCheckoutDetails,
  matchesExpectedPrice,
  periodEndFromSubscription,
  priceIdsFromCheckout,
  priceIdsFromInvoice,
  subscriptionFromInvoice,
} from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";

const SOURCE = "Stripe checkout";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com").replace(/\/$/, "");
}

function expectedPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_ID;
}

function periodOrGrace(
  subscription: Stripe.Subscription | string | null | undefined
): Date {
  return periodEndFromSubscription(subscription) ?? new Date(Date.now() + MONTHLY_GRACE_MS);
}

/** True only if this event id was previously marked done by markProcessed
 * (i.e. its handling actually completed) -- not merely attempted. Stripe
 * delivers at-least-once, and a founder can also manually "Resend" an
 * event from the Dashboard; either can redeliver an event whose first
 * attempt failed partway (seat provisioning threw, the welcome email
 * didn't send). Checking rather than claiming-then-processing means that
 * redelivery actually retries instead of being silently dismissed as a
 * duplicate (Sep 12 recheck: this was the main blocker to safely taking a
 * first outside payment -- resend was the only recovery path, and it
 * didn't work). A read failure fails open (treated as not-yet-processed):
 * risking a re-run of idempotent provisioning (see markProcessed) is safer
 * than silently dropping a real delivery. */
async function wasAlreadyProcessed(eventId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (error) {
    await notifySyncErrors(
      [`failed to check stripe_events for ${eventId}: ${error.message}`],
      SOURCE
    );
    return false;
  }
  return data !== null;
}

/** Records an event id as done -- call only after its handling has
 * actually completed, never before. createSeat/extendSeatAccess are both
 * upsert-by-email, so the rare case of two deliveries racing past
 * wasAlreadyProcessed at once (rather than one arriving well after the
 * other, which is the normal redelivery case) is still safe: at worst a
 * second welcome email with a rotated password, not a broken or
 * duplicated seat. */
async function markProcessed(eventId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("stripe_events").insert({ id: eventId });
  if (error && error.code !== "23505") {
    await notifySyncErrors(
      [`failed to record event ${eventId} in stripe_events: ${error.message}`],
      SOURCE
    );
  }
}

/** Returns true once this session needs no further attempts -- either it
 * was actually provisioned, or it's a legitimate no-op (unpaid, wrong
 * product). False means the caller should NOT call markProcessed, so a
 * redelivery of the same event tries again instead of being dismissed. */
async function provisionFromSession(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.payment_status === "unpaid") return true;
  if (!matchesExpectedPrice(priceIdsFromCheckout(session), expectedPriceId())) return true;

  const { email, name, company } = extractCheckoutDetails(session);
  if (!email) {
    await notifySyncErrors(
      [`checkout ${session.id} completed with no customer email -- can't provision a seat`],
      SOURCE
    );
    return false;
  }

  try {
    const seat = await createSeat({
      email,
      name: name ?? "",
      company: company ?? "",
      role: "owner",
      activeUntil: periodOrGrace(session.subscription),
    });
    const emailSent = await sendWelcomeEmail({
      to: seat.email,
      password: seat.password,
      siteUrl: siteUrl(),
    });
    if (!emailSent) {
      await notifySyncErrors(
        [`seat provisioned for ${seat.email} (checkout ${session.id}) but the welcome email failed to send`],
        SOURCE
      );
      return false;
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The customer already paid -- this alerts a human, but also leaves
    // the event unmarked so a Dashboard "Resend" (or Stripe's own retry)
    // can succeed on its own without needing manual provisioning too.
    await notifySyncErrors(
      [`payment from ${email} (checkout ${session.id}) succeeded but seat provisioning failed: ${message} -- needs manual follow-up`],
      SOURCE
    );
    return false;
  }
}

/** See provisionFromSession -- same true/false contract. */
async function renewFromInvoice(invoice: Stripe.Invoice): Promise<boolean> {
  if (!matchesExpectedPrice(priceIdsFromInvoice(invoice), expectedPriceId())) return true;
  const email = invoice.customer_email?.trim().toLowerCase();
  if (!email) {
    await notifySyncErrors(
      [`invoice ${invoice.id} paid with no customer email -- can't extend a seat`],
      SOURCE
    );
    return false;
  }
  const until = periodOrGrace(subscriptionFromInvoice(invoice));
  try {
    const seat = await extendSeatAccess(email, until);
    if (!seat) {
      await notifySyncErrors(
        [`invoice ${invoice.id} paid for ${email} but no seat exists -- needs manual follow-up`],
        SOURCE
      );
      return false;
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await notifySyncErrors(
      [`invoice ${invoice.id} paid for ${email} but extending the seat failed: ${message}`],
      SOURCE
    );
    return false;
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!signature || !webhookSecret || !secretKey) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  const stripe = new Stripe(secretKey);
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (await wasAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const sessionId = (event.data.object as Stripe.Checkout.Session).id;
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price", "subscription"],
    });
    if (await provisionFromSession(session)) await markProcessed(event.id);
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.paid") {
    const invoiceId = (event.data.object as Stripe.Invoice).id;
    if (invoiceId) {
      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ["lines.data", "parent.subscription_details.subscription"],
      });
      if (await renewFromInvoice(invoice)) await markProcessed(event.id);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    if (matchesExpectedPrice(priceIdsFromInvoice(invoice), expectedPriceId())) {
      await notifySyncErrors(
        [
          `invoice ${invoice.id} payment failed for ${invoice.customer_email ?? "unknown email"} -- seat still active until current period end`,
        ],
        SOURCE
      );
    }
    await markProcessed(event.id);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
