import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

export const metadata = {
  title: `Terms | ${OPERATOR.productName}`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">
        Terms
      </p>
      <h1 className="text-3xl font-bold text-navy-950 md:text-4xl">
        Terms of use
      </h1>
      <p className="mt-3 text-sm text-ink/50">Effective {OPERATOR.effectiveDate}</p>
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-ink/75">
        <p>
          {OPERATOR.productName} is a software service of {OPERATOR.legalName},
          operated by {OPERATOR.contactName}, {OPERATOR.addressLine}. Contact{" "}
          {OPERATOR.email} or {OPERATOR.phone}.
        </p>
        <p>
          {OPERATOR.productName} tracks publicly available federal data from
          SAM.gov, USAspending.gov, and Grants.gov. Listings, awards, and
          program details originate with those sources. We do not control when
          they post, change, or withdraw a notice.
        </p>
        <p>
          {OPERATOR.productName} is not a bid-writing or proposal service. We
          do not register you in SAM, prepare a bid, or represent you to a
          contracting office.
        </p>
        <p>
          The quote worksheet and proposal tools in the subscriber dashboard
          are for your own developmental work on your company&apos;s contract
          response — you enter your own company information, certifications,
          and pricing, and what they generate is a decision-support draft, not
          a finished or submission-ready proposal. We are not preparing,
          authoring, reviewing, or submitting a proposal on your behalf, and
          using these tools does not make {OPERATOR.productName} your proposal
          writer, consultant, or capture manager. You are solely responsible
          for verifying accuracy, compliance, and completeness against the
          actual solicitation before submitting anything to a contracting
          office.
        </p>
        <p>
          There is no win guarantee. Matching a notice, seeing a grant award,
          or receiving a digest does not mean you will be awarded a contract
          or a grant.
        </p>
        <p>
          The customer does their own capture. Status tracking, research
          tools, and the digest are decision support — they do not replace
          your capture process, compliance review, or bid/no-bid call.
        </p>
        <div>
          <h2 className="text-base font-semibold text-navy-950">
            Subscription, cancel, refund
          </h2>
          <p className="mt-2">
            Access is a monthly USD subscription billed by Stripe. It renews
            until you cancel. Email {OPERATOR.email} to cancel; access runs
            through the paid month. First-month unused refunds and later-month
            policy are on the{" "}
            <Link
              href="/pricing"
              className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            >
              pricing page
            </Link>
            .
          </p>
        </div>
        <p>
          Governing law: State of Georgia, USA, without regard to conflict of
          law rules.
        </p>
      </div>
    </section>
  );
}
