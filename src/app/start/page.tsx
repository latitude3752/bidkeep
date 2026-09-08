import { startPilotHref } from "@/lib/start-pilot";
import { submitContactRequest } from "@/app/start/actions";
import CommercialLinks from "@/components/CommercialLinks";

export const metadata = {
  title: "Start for $100/mo | BidKeep",
  alternates: { canonical: "/start" },
};

const GOLD_CTA =
  "inline-block rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400";

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-2 text-sm outline-none focus:border-gold-500";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const href = startPilotHref(process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL);
  const params = await searchParams;
  // No pre-payment capacity gate anymore: any number of companies can sign
  // up, so there's no global "full" state to check ahead of time. A single
  // company hitting its own per-company seat cap is a post-payment,
  // per-account edge case handled by the same founder-alert fallback as any
  // other provisioning failure (see /api/stripe-webhook), not something the
  // public checkout button needs to gate.

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">
        $100/month
      </p>
      <h1 className="text-3xl font-bold text-navy-950 md:text-4xl">
        Facilities opportunity tracking, $100/month
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink/75">
        The SAM.gov opportunity dashboard and an email digest of matching
        notices, plus grant-award leads from USAspending.gov and Grants.gov.
        Up to 5 seats per company. Cancel anytime. Access the same business
        day after payment.
      </p>
      <div className="mt-10">
        {href ? (
          <a href={href} className={GOLD_CTA}>
            Start for $100/mo
          </a>
        ) : params.sent === "1" ? (
          <p className="max-w-md rounded-lg border border-navy-950/15 bg-white px-5 py-4 text-ink/80">
            Thanks — we&apos;ll be in touch shortly to get your team set up.
          </p>
        ) : (
          <form action={submitContactRequest} className="max-w-md space-y-4">
            <p className="text-ink/70">
              Pricing isn&apos;t self-serve yet — tell us about your team and
              we&apos;ll get you set up.
            </p>
            {params.error === "invalid" && (
              <p className="text-sm text-red-600">
                Please fill in your name, a valid email, and a short message.
              </p>
            )}
            {params.error === "send-failed" && (
              <p className="text-sm text-red-600">
                Something went wrong sending that — try again in a moment.
              </p>
            )}
            {/* Honeypot: hidden from real visitors, only a bot fills it in. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              aria-hidden="true"
            />
            <div>
              <label htmlFor="name" className="text-sm font-medium text-navy-950">
                Name
              </label>
              <input id="name" name="name" type="text" required className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-medium text-navy-950">
                Email
              </label>
              <input id="email" name="email" type="email" required className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="company" className="text-sm font-medium text-navy-950">
                Company
              </label>
              <input id="company" name="company" type="text" className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="message" className="text-sm font-medium text-navy-950">
                Tell us about your team
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={4}
                className={INPUT_CLASS}
              />
            </div>
            <button type="submit" className={GOLD_CTA}>
              Request access
            </button>
          </form>
        )}
      </div>
      <CommercialLinks />
    </section>
  );
}
