import Link from "next/link";
import { startPilotHref } from "@/lib/start-pilot";
import { OPERATOR } from "@/lib/operator";

export const metadata = {
  title: `Pricing | ${OPERATOR.productName}`,
  description:
    "BidKeep is $100/month for up to 5 seats — full access to daily SAM.gov contract and grant tracking for federal facilities and building services.",
  alternates: { canonical: "/pricing" },
};

const GOLD_CTA =
  "inline-block rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400";

export default function PricingPage() {
  const href = startPilotHref(process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL);
  const checkout = href ?? "/start";

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">
        Pricing
      </p>
      <h1 className="text-3xl font-bold text-navy-950 md:text-4xl">
        ${OPERATOR.monthlyPriceUsd}/month
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink/75">
        {OPERATOR.productName} is a monthly subscription for {OPERATOR.vertical}
        {" "}— SAM.gov contract tracking plus a smaller grant feed. One company,
        up to {OPERATOR.seatsPerCompany} seats. Sold by {OPERATOR.legalName}.
      </p>

      <div className="mt-10 rounded-2xl border border-navy-950/10 bg-white p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold-600">
          What you get
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink/75">
          <li>SAM.gov opportunity dashboard matched to this vertical, updated daily.</li>
          <li>Recompete radar: option / period-end / follow-on signals from notice language.</li>
          <li>Set-aside type (SDVOSB / 8(a) / HUBZone / WOSB / SB) on every row.</li>
          <li>Grant-award leads from USAspending.gov and Grants.gov (secondary signal).</li>
          <li>Email digest of matching notices.</li>
          <li>Up to {OPERATOR.seatsPerCompany} logins per company.</li>
          <li>
            Quote worksheet and proposal tools in the subscriber dashboard — drafts
            for your own capture work, not a bid-writing service.
          </li>
        </ul>
      </div>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-ink/75">
        <div>
          <h2 className="text-base font-semibold text-navy-950">Billing &amp; renewal</h2>
          <p className="mt-2">
            Charged monthly in USD through Stripe. The subscription renews
            automatically each month until you cancel. Card details never touch
            our servers.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-navy-950">Cancel</h2>
          <p className="mt-2">
            Cancel anytime by emailing{" "}
            <a
              href={`mailto:${OPERATOR.email}`}
              className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            >
              {OPERATOR.email}
            </a>
            . Access continues through the end of the paid month. There is no
            annual lock-in.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-navy-950">Refunds</h2>
          <p className="mt-2">
            If you have not used the dashboard and ask within 7 days of the first
            charge, email {OPERATOR.email} and we will refund that first month.
            Later months are not refunded after the period has started; cancel
            before renewal instead.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-navy-950">After you pay</h2>
          <p className="mt-2">
            Stripe emails a receipt. We email a {OPERATOR.productName} login and
            a one-time password to the checkout email the same business day.
            Sign in at{" "}
            <Link
              href="/login"
              className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            >
              /login
            </Link>
            . Forgot the password? Use{" "}
            <Link
              href="/login/reset"
              className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            >
              password reset
            </Link>
            .
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-navy-950">Support</h2>
          <p className="mt-2">
            {OPERATOR.email}
            <br />
            {OPERATOR.phone}
            <br />
            {OPERATOR.legalName}
            <br />
            {OPERATOR.addressLine}
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <a href={checkout} className={GOLD_CTA}>
          Start for ${OPERATOR.monthlyPriceUsd}/mo
        </a>
        <Link
          href="/demo"
          className="text-sm font-medium text-navy-950/70 hover:text-gold-600"
        >
          See a dashboard preview
        </Link>
      </div>
    </section>
  );
}
