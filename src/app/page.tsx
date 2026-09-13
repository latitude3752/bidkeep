import Link from "next/link";
import { ACCENT_CTA, ACCENT_CTA_GHOST, BRAND } from "@/lib/brand";

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
      <section className="relative overflow-hidden bg-hero text-hero-text">
        <div className="relative mx-auto max-w-6xl px-6 py-28 md:py-36">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            {BRAND.eyebrow}
          </p>
          <h1 className="font-display max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            {BRAND.heroTitle}
          </h1>
          <p className="mt-6 max-w-2xl font-mono text-sm tracking-wide text-accent/90">
            option year · period of performance · follow-on
          </p>
          <p className="mt-4 max-w-2xl text-lg text-hero-text/80">
            {BRAND.heroLead}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href={BRAND.primaryCta.href} className={ACCENT_CTA}>
              {BRAND.primaryCta.label}
            </Link>
            <Link href="/opportunities" className={ACCENT_CTA_GHOST}>
              See what&apos;s tracked
            </Link>
            <Link
              href="/pricing"
              className="inline-block rounded-lg px-7 py-3 text-sm font-semibold text-hero-text/80 hover:text-accent"
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

        <div className="mt-6 rounded-lg border-2 border-accent bg-white p-7 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
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
            className="mt-4 inline-block text-sm font-semibold text-link hover:text-accent"
          >
            See tracked grant programs →
          </Link>
        </div>
      </section>

      <section className="bg-hero text-hero-text">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-bold md:text-3xl">$100/month</h2>
          <p className="mx-auto mt-3 max-w-2xl text-hero-text/70">
            The full dashboard of matching SAM.gov notices, set-aside type on
            every row, and an email digest so you do not have to remember to
            check. Up to 5 seats per company.
          </p>
          <Link href="/start" className={`${ACCENT_CTA} mt-8`}>
            Start for $100/mo
          </Link>
        </div>
      </section>
    </>
  );
}
