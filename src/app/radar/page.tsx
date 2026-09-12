import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SampleRadarList from "@/components/SampleRadarList";
import { OPERATOR } from "@/lib/operator";
import { getRadarStats, getSampleRadarRows } from "@/lib/public-radar";

export const metadata = {
  title: `Recompete radar | ${OPERATOR.productName}`,
  description:
    "Facilities contracts approaching option exercise, period end, or a recompete window — classified from SAM.gov notice language, never from invented award-history dates.",
  alternates: { canonical: "/radar" },
};
export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const [rows, stats] = await Promise.all([getSampleRadarRows(), getRadarStats()]);
  const allExamples = rows.length > 0 && rows.every((row) => row.isExample);

  return (
    <>
      <PageHeader
        eyebrow="Product wedge"
        title="Recompete radar"
        description="Facilities work is multi-year base-plus-option. BidKeep reads option, period-of-performance, and recompete language from the SAM.gov notice — title, notice type, and description text — and lists those clocks here. We do not invent incumbent expiration dates."
      />

      <section className="mx-auto max-w-6xl px-6 pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold-600">
          {stats.signalCount > 0
            ? `${stats.signalCount.toLocaleString()} classified signals · ${stats.recompeteCount} recompete · ${stats.soleSourceFollowonCount} sole-source follow-on · ${stats.optionCount} options identified · ${stats.expirationCount} period end · ${stats.earlySignalCount} possible early`
            : "Classified from notice language after each SAM.gov sync"}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-8">
        <h2 className="text-xl font-bold text-navy-950">
          {allExamples ? "What a radar row looks like" : "Upcoming option, expiration, and recompete signals"}
        </h2>
        {allExamples ? (
          <p className="mt-2 text-sm text-gold-700">
            These are labeled examples of the language BidKeep classifies. Live
            rows appear here after the next ingest writes radar columns.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink/60">
            Dates show only when the notice itself includes a period of
            performance or option window. Titles link to SAM.gov.
          </p>
        )}
        <div className="mt-5">
          <SampleRadarList rows={rows} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <h2 className="text-lg font-semibold text-navy-950">Recompete</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              Title or description explicitly says recompete, follow-on,
              successor, or incumbent contract.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-navy-950">Option exercise</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              Base-plus-option language such as “four (4) 12-month option years”
              or “B+4”. The option count is stored when the notice states it.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-navy-950">Period end</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              A period of performance range in the notice (“POP is from 5/1/2025
              thru 4/30/2026”). Award dates and notice archive dates are ignored.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-navy-950">Possible early opportunity</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              A facilities Sources Sought, Presolicitation, or Special Notice
              with no recompete or incumbent language actually in the notice —
              an early window worth watching, not a confirmed recompete.
            </p>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/set-asides"
            className="inline-block rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
          >
            Set-asides &amp; SCA
          </Link>
          <Link
            href="/start"
            className="inline-block rounded-full border border-navy-950/20 px-7 py-3 text-sm font-semibold text-navy-950 hover:border-gold-500"
          >
            Open the full radar
          </Link>
        </div>
      </section>
    </>
  );
}
