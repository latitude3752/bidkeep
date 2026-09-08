import Link from "next/link";
import KeepMark from "@/components/KeepMark";

const coverage = [
  {
    title: "SAM.gov, tracked daily",
    description:
      "Solicitations, sources-sought, and presolicitation notices — synced automatically, not a manual search you have to remember to run.",
  },
  {
    title: "Facilities trades, by NAICS",
    description:
      "Facilities support (561210), janitorial (561720), grounds and landscaping (561730), and guard services (561612), plus adjacent building-services codes — pest, waste, temp labor, and security systems — matched directly.",
  },
  {
    title: "Filter to sites you can staff",
    description:
      "Every notice is tagged with its place-of-performance state, so a janitorial contractor in Georgia isn't wading through grounds work in Oregon. Built for firms bidding locally, not chasing every federal dollar nationwide.",
  },
  {
    title: "BPA/IDIQ ceiling detection",
    description:
      "Every notice is classified as a one-off RFQ or a BPA/IDIQ with a stated ceiling, so you know which listings imply years of follow-on work before you open them.",
  },
  {
    title: "Deadline-first pipeline",
    description:
      "A working pipeline view sorted by response deadline, with status tracking (new → reviewing → bid → won/lost) so nothing quietly expires unnoticed.",
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
            Every facilities bid you can staff, before your competitors see it.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-cream/80">
            BidKeep watches SAM.gov for federal solicitations across
            facilities and building services — janitorial, grounds,
            guard, and facilities support — filtered to where you actually
            work, so you&apos;re never scrolling a generic contract search for
            the one listing near you that matters.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/opportunities"
              className="rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
            >
              See what&apos;s tracked
            </Link>
            <Link
              href="/demo"
              className="rounded-full border border-cream/30 px-7 py-3 text-sm font-semibold text-cream hover:border-gold-400 hover:text-gold-400"
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
          Built for a vertical the generalist contract-search tools don&apos;t
          specialize in.
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
            Not just contracts
          </p>
          <h3 className="text-lg font-semibold text-navy-950">
            Grant awards — know who&apos;s funded before their RFP posts
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            A housing authority, school district, or municipality that just
            received community-facilities, public-housing, or weatherization
            funding is about to put building-services work out to bid. BidKeep
            tracks award data from USAspending.gov and upcoming funding cycles
            from Grants.gov, so you can reach out while the money is still new
            — not after a competitor beat you to the solicitation.
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
            The full dashboard of matching SAM.gov notices and grant-award
            leads, plus an email digest so you do not have to remember to
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
