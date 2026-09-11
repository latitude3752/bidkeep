import Link from "next/link";
import KeepMark from "@/components/KeepMark";

const coverage = [
  {
    title: "SAM.gov, tracked daily",
    description:
      "Solicitations, sources-sought, and presolicitation notices — synced automatically, not a manual search you have to remember to run.",
  },
  {
    title: "Facilities NAICS, precisely",
    description:
      "Core codes for facilities support (561210), janitorial (561720), grounds/landscaping (561730), and security guards/patrol (561612), plus adjacent building-services codes. The codes name the work, so there's no noisy keyword net trying to guess relevance.",
  },
  {
    title: "Set-aside intensity, on every row",
    description:
      "SDVOSB, 8(a), HUBZone, WOSB, and small-business set-asides are shown on the public sample and in the subscriber pipeline — the same SAM.gov field, surfaced first instead of buried in a notice.",
  },
  {
    title: "Recompete and expiration watching",
    description:
      "Facilities work is multi-year base-plus-option. The recompete radar classifies option-year, period-of-performance, and follow-on language from the SAM.gov notice and lists those clocks — dates only when the notice itself includes them.",
  },
  {
    title: "SCA wage-determination awareness",
    description:
      "Service Contract Act WDs drive labor cost on janitorial, grounds, and guard contracts. When a notice includes a WD number or link, BidKeep surfaces it. Mentions without a number stay an honest empty — we do not invent DOL rates.",
  },
  {
    title: "Filter to where you work",
    description:
      "Every notice is tagged with its place-of-performance state, so a janitorial firm in Georgia is not wading through patrol work in Alaska. Built for firms bidding locally, not chasing every federal dollar nationwide.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 text-cream">
        <KeepMark className="pointer-events-none absolute -left-16 bottom-0 h-64 w-auto text-cream/10 md:h-80" />
        <div className="relative mx-auto max-w-6xl px-6 py-28 md:py-36">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
            Federal Opportunity Tracking
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Facilities contracts you can actually staff, before they expire.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-cream/80">
            BidKeep watches SAM.gov for federal solicitations in janitorial,
            grounds, security guards/patrol, and facilities support / base ops
            — with set-aside type on every row, so SDVOSB, 8(a), HUBZone, and
            WOSB shops see the work written for them.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/radar"
              className="rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
            >
              Recompete radar
            </Link>
            <Link
              href="/opportunities"
              className="rounded-full border border-cream/30 px-7 py-3 text-sm font-semibold text-cream hover:border-gold-400 hover:text-gold-400"
            >
              See what&apos;s tracked
            </Link>
            <Link
              href="/demo"
              className="rounded-full px-7 py-3 text-sm font-semibold text-cream/80 hover:text-gold-400"
            >
              Dashboard preview
            </Link>
            <Link
              href="/pricing"
              className="rounded-full px-7 py-3 text-sm font-semibold text-cream/80 hover:text-gold-400"
            >
              $100/mo pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-bold text-navy-950 md:text-3xl">
          What it covers
        </h2>
        <p className="mt-3 max-w-2xl text-ink/70">
          Built for facilities contractors the generalist contract-search tools
          do not specialize in.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {coverage.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-navy-950/10 bg-white p-7 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-navy-950">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border-2 border-gold-500 bg-white p-7 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-gold-600">
            Secondary signal
          </p>
          <h3 className="text-lg font-semibold text-navy-950">
            Grant awards that precede facilities work
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            Facilities is mostly contracts. A smaller grant feed still helps:
            public-housing capital, community facilities, and energy-efficiency
            awards often turn into janitorial, grounds, or base-ops
            solicitations later. BidKeep keeps the grants infrastructure and
            tunes it to those programs — not highway or heavy-civil construction
            lists.
          </p>
          <Link
            href="/grants"
            className="mt-4 inline-block text-sm font-semibold text-gold-600 hover:text-gold-500"
          >
            See tracked grant programs →
          </Link>
        </div>
      </section>

      <section className="bg-navy-900 text-cream">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">$100/month</h2>
          <p className="mx-auto mt-3 max-w-2xl text-cream/70">
            The full dashboard of matching SAM.gov notices, set-aside type on
            every row, and an email digest so you do not have to remember to
            check. Up to 5 seats per company.
          </p>
          <Link
            href="/start"
            className="mt-8 inline-block rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
          >
            Start for $100/mo
          </Link>
        </div>
      </section>
    </>
  );
}
