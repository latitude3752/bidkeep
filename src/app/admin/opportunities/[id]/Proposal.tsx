import Link from "next/link";
import type { QuoteWorksheetResult } from "@/lib/quote-worksheet";
import { QUOTE_LINE_CATEGORY_LABELS } from "@/lib/quote-worksheet";
import type { CompanyProfile } from "@/lib/company-profiles";
import { NOISE_NOTICE_TYPES, isEligibleSetAside, SET_ASIDE_CERTIFICATION_LABELS } from "@/lib/opportunities";
import PrintButton from "@/components/PrintButton";
import { formatDeadlineWithZone } from "@netacracy/bid-core";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

type ComplianceCheck = { label: string; ok: boolean; detail: string };

export default function Proposal({
  op,
  quote,
  quoteNotes,
  profile,
}: {
  op: {
    title: string;
    agency: string | null;
    naics_code: string | null;
    psc_code: string | null;
    set_aside_type: string | null;
    response_deadline: string | null;
    notice_type: string | null;
    raw_data: { solicitationNumber?: string | null } | null;
  };
  quote: QuoteWorksheetResult | null;
  quoteNotes: string | null;
  profile: CompanyProfile | null;
}) {
  if (!quote || quote.lineItems.every((li) => li.qty === 0)) {
    return (
      <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-6 print:hidden">
        <h2 className="text-lg font-bold text-navy-950">Proposal</h2>
        <p className="mt-2 text-sm text-ink/60">
          Fill in and save a quote worksheet above first — the proposal is built from it.
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-6 print:hidden">
        <h2 className="text-lg font-bold text-navy-950">Proposal</h2>
        <p className="mt-2 text-sm text-ink/60">
          Add your{" "}
          <Link href="/app/company" className="underline hover:text-navy-950">
            company profile
          </Link>{" "}
          first — the proposal header is built from it.
        </p>
      </div>
    );
  }

  const deadlinePassed = op.response_deadline ? new Date(op.response_deadline) < new Date() : false;
  const eligible = isEligibleSetAside(op.set_aside_type, profile.certifications);
  const isNoise = NOISE_NOTICE_TYPES.includes(op.notice_type ?? "");

  const checks: ComplianceCheck[] = [
    {
      label: "Set-aside eligibility",
      ok: eligible,
      detail: eligible
        ? `Eligible under: ${op.set_aside_type ?? "Full and open"}`
        : `Restricted to a certification not on file for your company: ${op.set_aside_type} — check your company profile is up to date`,
    },
    {
      label: "Response deadline",
      ok: !deadlinePassed,
      detail: op.response_deadline
        ? `Due ${formatDeadlineWithZone(op.response_deadline)}${deadlinePassed ? " — already past" : ""}`
        : "No deadline on file — confirm against the solicitation",
    },
    {
      label: "Notice still actionable",
      ok: !isNoise,
      detail: isNoise
        ? `Notice type is "${op.notice_type}" — likely already decided, not open for quotes`
        : `Notice type: ${op.notice_type ?? "unknown"}`,
    },
  ];

  const blockers = checks.filter((c) => !c.ok);
  const activeLineItems = quote.lineItems.filter((li) => li.qty > 0);

  return (
    <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-6 print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-lg font-bold text-navy-950">Proposal</h2>
        <PrintButton />
      </div>

      {blockers.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 print:hidden">
          <span className="font-semibold">Before submitting: </span>
          {blockers.map((b) => b.detail).join("; ")}
        </div>
      )}

      <div className="mt-6 space-y-6 print:mt-0">
        <div className="flex items-start justify-between border-b border-navy-950/10 pb-4">
          <div>
            <p className="text-lg font-bold text-navy-950">{profile.companyName}</p>
            {profile.address && <p className="text-sm text-ink/60">{profile.address}</p>}
            {profile.certifications.length > 0 && (
              <p className="text-sm text-ink/60">
                {profile.certifications.map((c) => SET_ASIDE_CERTIFICATION_LABELS[c]).join(" · ")}
              </p>
            )}
            {(profile.contactName || profile.contactEmail || profile.contactPhone) && (
              <p className="text-sm text-ink/60">
                {[profile.contactName, profile.contactEmail, profile.contactPhone].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-ink/60">
            {profile.uei && (
              <p>
                UEI <span className="font-mono">{profile.uei}</span>
              </p>
            )}
            {profile.cage && (
              <p>
                CAGE <span className="font-mono">{profile.cage}</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/40">Quote for</h3>
          <p className="mt-1 font-semibold text-navy-950">{op.title}</p>
          <p className="text-sm text-ink/70">{op.agency ?? "—"}</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/70">
            {op.raw_data?.solicitationNumber && (
              <span>
                Solicitation: <span className="font-mono">{op.raw_data.solicitationNumber}</span>
              </span>
            )}
            <span>NAICS: {op.naics_code ?? "—"}</span>
            <span>PSC: {op.psc_code ?? "—"}</span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/40">Quote</h3>
          <table className="mt-2 w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy-950/10 text-ink/50">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Unit price</th>
                <th className="py-2 font-medium">Extended price</th>
              </tr>
            </thead>
            <tbody>
              {activeLineItems.map((li, i) => (
                <tr key={i} className="border-b border-navy-950/5 last:border-0">
                  <td className="py-2 pr-3">{li.description || QUOTE_LINE_CATEGORY_LABELS[li.category]}</td>
                  <td className="py-2 pr-3">{li.qty}</td>
                  <td className="py-2 pr-3">{formatMoney(li.unitCost)}</td>
                  <td className="py-2">{formatMoney(li.qty * li.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-navy-950/[0.03] p-3 text-base font-bold text-navy-950">
            <span>Total quoted price</span>
            <span className="font-mono">{formatMoney(quote.totalAsk)}</span>
          </div>

          {quoteNotes && (
            <p className="mt-2 text-sm text-ink/60 print:hidden">
              <span className="font-medium">Internal notes: </span>
              {quoteNotes}
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/40">
            Compliance checklist
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                <span className={c.ok ? "text-green-600" : "text-red-600"}>{c.ok ? "✓" : "✗"}</span>
                <span>
                  <span className="font-medium text-navy-950">{c.label}: </span>
                  {c.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-navy-950/10 pt-4 text-xs text-ink/50">
          This worksheet and draft quote are a decision-support aid prepared for {profile.companyName}
          &apos;s own use in evaluating and preparing its response to this opportunity. BidKeep does not
          prepare, author, or submit proposals on a subscriber&apos;s behalf, and generating this
          document is not a guarantee of pricing accuracy, compliance, or award eligibility — review
          and verify everything against the actual solicitation before submitting anything.
        </p>
      </div>
    </div>
  );
}
