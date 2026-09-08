import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SampleOpportunityList from "@/components/SampleOpportunityList";
import { getPublicNaicsCodes } from "@netacracy/bid-core";
import { FACILITIES_NAICS_SEED } from "@/lib/facilities-naics";
import {
  getOpportunityStats,
  getSampleOpportunities,
} from "@/lib/public-samples";

export const metadata = {
  title: "Opportunities | BidKeep",
  alternates: { canonical: "/opportunities" },
};
// Tracked NAICS codes (and the live sample below) change constantly; render
// per-request rather than baking a stale list into the build output.
export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const [naicsCodes, stats, sample] = await Promise.all([
    getPublicNaicsCodes().catch(() => FACILITIES_NAICS_SEED),
    getOpportunityStats(),
    getSampleOpportunities(),
  ]);
  const displayedNaics = naicsCodes.length > 0 ? naicsCodes : FACILITIES_NAICS_SEED;
  const hasExamples = sample.some((op) => op.isExample);
  const allExamples = sample.length > 0 && sample.every((op) => op.isExample);

  return (
    <>
      <PageHeader
        eyebrow="Coverage"
        title="What's being tracked"
        description="Every notice below is pulled from SAM.gov automatically — matched by facilities and building-services NAICS code, tagged with where the work actually is, and classified for program scale (BPA/IDIQ vs. a plain RFQ)."
      />

      <section className="mx-auto max-w-6xl px-6 pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold-600">
          {stats.activeCount.toLocaleString()} active opportunities tracked · updated daily
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-8">
        <h2 className="text-xl font-bold text-navy-950">
          {allExamples
            ? "Recent opportunity examples"
            : "A sample of what's live right now"}
        </h2>
        {sample.length > 0 && !allExamples && (
          <p className="mt-2 text-sm text-ink/60">
            Showing {sample.length.toLocaleString()}
            {stats.activeCount > 0
              ? ` of ${stats.activeCount.toLocaleString()} notices with upcoming deadlines`
              : " notices with upcoming deadlines"}
            . Titles link to SAM.gov.
          </p>
        )}
        {hasExamples && (
          <p className="mt-2 text-sm text-gold-700">
            {allExamples
              ? "No notices currently have upcoming deadlines. These are recent pipeline rows or labeled examples (not currently open)."
              : "Rows marked Open have a future response deadline. Rows marked Recent opportunity example are historical or scaffold samples."}
          </p>
        )}
        <div className="mt-5">
          {sample.length > 0 ? (
            <SampleOpportunityList rows={sample} />
          ) : (
            <p className="text-sm text-ink/60">
              No sample notices available yet. Check back after the next
              SAM.gov sync, or start a seat to see the full pipeline.
            </p>
          )}
        </div>
        {sample.length > 0 && (
          <p className="mt-3 text-xs text-ink/50">
            Live titles link to the SAM.gov notice. Program ceiling and capture
            status live in the subscriber dashboard.
          </p>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-navy-950">
              Matched by service, not by chance
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/70">
              Facilities NAICS codes name the service directly — janitorial,
              landscaping, guard, facilities support — so every match below is
              exactly what it says it is. Adjacent codes (pest, waste, temp
              labor) are tracked because they show up on the same building-
              services solicitations.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink/70">
              Every notice also carries its place-of-performance state, so
              the full pipeline dashboard can filter down to sites you can
              actually staff — not just work you&apos;re licensed to bid on
              nationwide.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy-950">
              Tracked NAICS codes
            </h2>
            <div className="mt-5 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
              {displayedNaics.map(({ code, label }, i) => (
                <div
                  key={code}
                  className={`flex items-center gap-4 p-4 text-sm ${
                    i !== displayedNaics.length - 1 ? "border-b border-navy-950/10" : ""
                  }`}
                >
                  <span className="font-mono font-semibold text-gold-600">
                    {code}
                  </span>
                  <span className="text-ink/70">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-navy-900 text-cream">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold">Actively monitoring SAM.gov</h2>
          <p className="mx-auto mt-3 max-w-2xl text-cream/70">
            New matching notices sync in automatically. The full list —
            deadlines, set-aside type, program ceiling — lives in the
            subscriber dashboard.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/start"
              className="inline-block rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
            >
              Start for $100/mo
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-cream/80 transition-colors hover:text-gold-400"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
