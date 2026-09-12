import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";

const notifySyncErrors = vi.fn(async (_errors: string[], _source?: string) => {});
vi.mock("@/lib/notify", () => ({ notifySyncErrors }));

const createSeat = vi.fn();
const extendSeatAccess = vi.fn();
vi.mock("@/lib/subscriber-seats", () => ({ createSeat, extendSeatAccess }));

const sendWelcomeEmail = vi.fn();
vi.mock("@/lib/welcome-email", () => ({ sendWelcomeEmail }));

const constructEvent = vi.fn();
const sessionsRetrieve = vi.fn();
const invoicesRetrieve = vi.fn();
vi.mock("stripe", () => ({
  default: function StripeMock(this: unknown) {
    return {
      webhooks: { constructEvent },
      checkout: { sessions: { retrieve: sessionsRetrieve } },
      invoices: { retrieve: invoicesRetrieve },
    };
  },
}));

/** Fake stripe_events ledger: a real unique-violation on insert when the id
 * is already present, matching what the route's insert-based markProcessed
 * relies on for concurrent-safety. */
let ledger: Set<string>;
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "stripe_events") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({ data: ledger.has(id) ? { id } : null, error: null }),
          }),
        }),
        insert: async (row: { id: string }) => {
          if (ledger.has(row.id)) {
            return { error: { code: "23505", message: "duplicate key value" } };
          }
          ledger.add(row.id);
          return { error: null };
        },
      };
    },
  }),
}));

function fakeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_1",
    payment_status: "paid",
    customer_details: { email: "buyer@example.com", name: "Buyer" },
    custom_fields: [],
    line_items: { data: [] },
    subscription: null,
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

function checkoutEvent(id: string, sessionId = "cs_1") {
  return {
    id,
    type: "checkout.session.completed",
    data: { object: { id: sessionId } },
  } as unknown as Stripe.Event;
}

function postRequest(): NextRequest {
  return new NextRequest("http://localhost/api/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body: "{}",
  });
}

describe("POST /api/stripe-webhook", () => {
  beforeEach(() => {
    ledger = new Set();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    delete process.env.STRIPE_PRICE_ID;
    constructEvent.mockReset();
    sessionsRetrieve.mockReset();
    invoicesRetrieve.mockReset();
    createSeat.mockReset();
    extendSeatAccess.mockReset();
    sendWelcomeEmail.mockReset().mockResolvedValue(true);
    notifySyncErrors.mockClear();
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
  });

  it("retries a failed provisioning attempt on redelivery instead of dismissing it as a duplicate", async () => {
    constructEvent.mockReturnValue(checkoutEvent("evt_retry"));
    sessionsRetrieve.mockResolvedValue(fakeSession());
    createSeat.mockRejectedValueOnce(new Error("db unavailable"));

    const { POST } = await import("./route");

    const first = await POST(postRequest());
    const firstBody = await first.json();
    expect(firstBody.duplicate).toBeUndefined();
    expect(createSeat).toHaveBeenCalledTimes(1);
    expect(notifySyncErrors).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("needs manual follow-up")]),
      "Stripe checkout"
    );

    // Simulate a Stripe Dashboard "Resend" of the same event id after the
    // underlying issue is fixed.
    createSeat.mockResolvedValueOnce({
      id: "seat_1",
      email: "buyer@example.com",
      password: "generated-pw",
    });

    const second = await POST(postRequest());
    const secondBody = await second.json();
    expect(secondBody.duplicate).toBeUndefined();
    expect(createSeat).toHaveBeenCalledTimes(2);
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it("dismisses a real duplicate delivery of an already-completed event without re-provisioning", async () => {
    constructEvent.mockReturnValue(checkoutEvent("evt_done"));
    sessionsRetrieve.mockResolvedValue(fakeSession());
    createSeat.mockResolvedValue({
      id: "seat_1",
      email: "buyer@example.com",
      password: "generated-pw",
    });

    const { POST } = await import("./route");

    const first = await POST(postRequest());
    expect((await first.json()).duplicate).toBeUndefined();
    expect(createSeat).toHaveBeenCalledTimes(1);

    const second = await POST(postRequest());
    const secondBody = await second.json();
    expect(secondBody.duplicate).toBe(true);
    expect(createSeat).toHaveBeenCalledTimes(1); // not called again
  });

  it("does not retry indefinitely once a welcome-email failure is itself the reason it wasn't marked done, but does retry it", async () => {
    constructEvent.mockReturnValue(checkoutEvent("evt_email_fail"));
    sessionsRetrieve.mockResolvedValue(fakeSession());
    createSeat.mockResolvedValue({
      id: "seat_1",
      email: "buyer@example.com",
      password: "generated-pw",
    });
    sendWelcomeEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const { POST } = await import("./route");

    const first = await POST(postRequest());
    expect((await first.json()).duplicate).toBeUndefined();

    const second = await POST(postRequest());
    const secondBody = await second.json();
    expect(secondBody.duplicate).toBeUndefined();
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(2);
  });

  it("marks a legitimate no-op (unpaid session) done so it isn't reprocessed forever", async () => {
    constructEvent.mockReturnValue(checkoutEvent("evt_unpaid"));
    sessionsRetrieve.mockResolvedValue(fakeSession({ payment_status: "unpaid" }));

    const { POST } = await import("./route");

    await POST(postRequest());
    expect(createSeat).not.toHaveBeenCalled();

    const second = await POST(postRequest());
    const secondBody = await second.json();
    expect(secondBody.duplicate).toBe(true);
  });
});
