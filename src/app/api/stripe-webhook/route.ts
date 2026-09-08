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

/** True if this event was already processed (or the ledger write itself
 * failed for a reason worth alerting on). Stripe delivers at-least-once, so
 * a completed checkout can arrive as a webhook more than once; recording
 * the event id first and treating a unique-violation as "already handled"
 * is what makes provisioning idempotent without needing to reason about it
 * anywhere else in this route. */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("stripe_events").insert({ id: eventId });
  if (!error) return false;
  if (error.code === "23505") return true; // unique violation -- seen before
  await notifySyncErrors(
    [`failed to record event ${eventId} in stripe_events: ${error.message}`],
    SOURCE
  );
  return true; // don't process on an unrecorded ledger write -- safer to skip than double-provision
}

async function provisionFromSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status === "unpaid") return;
  if (!matchesExpectedPrice(priceIdsFromCheckout(session), expectedPriceId())) return;

  const { email, name, company } = extractCheckoutDetails(session);
  if (!email) {
    await notifySyncErrors(
      [`checkout ${session.id} completed with no customer email -- can't provision a seat`],
      SOURCE
    );
    return;
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
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The customer already paid -- this is a "go fix it by hand" alert, not
    // something to retry automatically (refunding or re-provisioning isn't
    // done from here).
    await notifySyncErrors(
      [`payment from ${email} (checkout ${session.id}) succeeded but seat provisioning failed: ${message} -- needs manual follow-up`],
      SOURCE
    );
  }
}

async function renewFromInvoice(invoice: Stripe.Invoice): Promise<void> {
  if (!matchesExpectedPrice(priceIdsFromInvoice(invoice), expectedPriceId())) return;
  const email = invoice.customer_email?.trim().toLowerCase();
  if (!email) {
    await notifySyncErrors(
      [`invoice ${invoice.id} paid with no customer email -- can't extend a seat`],
      SOURCE
    );
    return;
  }
  const until = periodOrGrace(subscriptionFromInvoice(invoice));
  try {
    const seat = await extendSeatAccess(email, until);
    if (!seat) {
      await notifySyncErrors(
        [`invoice ${invoice.id} paid for ${email} but no seat exists -- needs manual follow-up`],
        SOURCE
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await notifySyncErrors(
      [`invoice ${invoice.id} paid for ${email} but extending the seat failed: ${message}`],
      SOURCE
    );
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

  if (await alreadyProcessed(event.id)) {
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
    await provisionFromSession(session);
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.paid") {
    const invoiceId = (event.data.object as Stripe.Invoice).id;
    if (invoiceId) {
      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ["lines.data", "parent.subscription_details.subscription"],
      });
      await renewFromInvoice(invoice);
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
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
