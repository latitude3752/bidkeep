import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SampleOpportunityList from "@/components/SampleOpportunityList";
import SampleGrantList from "@/components/SampleGrantList";
import { OPERATOR } from "@/lib/operator";
import {
  PUBLIC_OPP_SAMPLE_DEFAULT,
  getSampleGrantAwards,
  getSampleOpportunities,
} from "@/lib/public-samples";

export const metadata = {
  title: `Dashboard preview | ${OPERATOR.productName}`,
  alternates: { canonical: "/demo" },
};
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const [opps, grants] = await Promise.all([
    getSampleOpportunities(PUBLIC_OPP_SAMPLE_DEFAULT),
    getSampleGrantAwards(8),
  ]);
  const hasExamples = opps.some((op) => op.isExample);
  const allExamples = opps.length > 0 && opps.every((op) => op.isExample);

  return (
    <>
      <PageHeader
        eyebrow="Preview"
        title={`What ${OPERATOR.productName} looks like before you pay`}
        description="A read-only sample of live federal data — the same sources as the subscriber dashboard. Filters, status tracking, quote tools, and the full pipeline are behind a paid seat."
      />
      <section className="mx-auto max-w-6xl px-6 pt-12">
        <h2 className="text-xl font-bold text-navy-950">Opportunities</h2>
        <p className="mt-2 text-sm text-ink/60">
          {opps.length > 0
            ? `Public sample of ${opps.length} notices. Titles link out to SAM.gov.`
            : "Public sample. Titles link out to SAM.gov."}
        </p>
        {hasExamples && (
          <p className="mt-1 text-sm text-gold-700">
            {allExamples
              ? "No notices currently have upcoming deadlines. These are recent pipeline rows (not currently open)."
              : "Some rows are recent opportunity examples (not currently open)."}
          </p>
        )}
        <div className="mt-5">
          {opps.length > 0 ? (
            <SampleOpportunityList rows={opps} />
          ) : (
            <p className="text-sm text-ink/60">
              No sample notices available yet. Check back after the next
              SAM.gov sync.
            </p>
          )}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-xl font-bold text-navy-950">Grant awards</h2>
        <p className="mt-2 text-sm text-ink/60">
          Public sample. Recipients link out to USAspending.gov.
        </p>
        <div className="mt-5">
          {grants.length > 0 ? (
            <SampleGrantList rows={grants} />
          ) : (
            <p className="text-sm text-ink/60">No current sample rows.</p>
          )}
        </div>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/pricing"
            className="inline-block rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
          >
            See pricing
          </Link>
          <Link
            href="/start"
            className="inline-block rounded-full border border-navy-950/20 px-7 py-3 text-sm font-semibold text-navy-950 hover:border-gold-500"
          >
            Start for ${OPERATOR.monthlyPriceUsd}/mo
          </Link>
        </div>
      </section>
    </>
  );
}
