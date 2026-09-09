import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

export const metadata = {
  title: `Privacy | ${OPERATOR.productName}`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">
        Privacy
      </p>
      <h1 className="text-3xl font-bold text-navy-950 md:text-4xl">
        Privacy policy
      </h1>
      <p className="mt-3 text-sm text-ink/50">Effective {OPERATOR.effectiveDate}</p>
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-ink/75">
        <p>
          {OPERATOR.productName} is operated by {OPERATOR.legalName},{" "}
          {OPERATOR.addressLine}. Core data — contract solicitations and grant
          awards — comes from public federal sources (SAM.gov, USAspending.gov,
          Grants.gov) and isn&apos;t personal information. This policy covers
          what we collect about you as a visitor or subscriber.
        </p>
        <div>
          <h2 className="text-base font-semibold text-navy-950">
            What we collect
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Support email</strong>: if you write to {OPERATOR.email},
              we keep what you send long enough to answer you.
            </li>
            <li>
              <strong>Checkout</strong>: if you subscribe, Stripe collects
              payment and billing details. We never see or store your card
              number. We receive your email (and name/company if Stripe
              provides them) so we can provision a login.
            </li>
            <li>
              <strong>Subscriber accounts</strong>: name, email, and company
              for each seat, plus a hashed password (we never store your
              password in plain text). Used only to sign you in and to send
              the notice digest you&apos;re subscribed to.
            </li>
            <li>
              <strong>Session cookies</strong>: a signed, HttpOnly cookie that
              keeps you signed in to the admin or subscriber dashboard.
            </li>
            <li>
              <strong>Contact form fallback</strong>: if self-serve checkout is
              temporarily unavailable, the /start page may show a contact form.
              That submission is emailed to us and is not stored in a database.
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-navy-950">
            What we don&apos;t do
          </h2>
          <p className="mt-2">
            We don&apos;t run analytics or advertising trackers on this site,
            don&apos;t sell or share your information with third parties for
            marketing, and don&apos;t use your data for anything beyond
            running the product and responding to you.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-navy-950">
            Third parties we use
          </h2>
          <p className="mt-2">
            Supabase (database hosting), an SMTP provider (login and digest
            email), Vercel (hosting), and Stripe (payment). Each processes
            only what&apos;s necessary to provide their part of the service.
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-navy-950">
            Your data, your control
          </h2>
          <p className="mt-2">
            Email{" "}
            <a
              href={`mailto:${OPERATOR.email}`}
              className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            >
              {OPERATOR.email}
            </a>{" "}
            to have your subscriber account and any stored data deleted, or
            to ask what we hold about you. See also{" "}
            <Link
              href="/pricing"
              className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            >
              pricing
            </Link>
            .
          </p>
        </div>
        <p>
          {OPERATOR.legalName}
          <br />
          {OPERATOR.addressLine}
          <br />
          {OPERATOR.phone}
          <br />
          {OPERATOR.email}
        </p>
      </div>
    </section>
  );
}
