import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SampleGrantList from "@/components/SampleGrantList";
import { FACILITIES_GRANT_PROGRAMS_SEED } from "@/lib/facilities-naics";
import { getPublicGrantPrograms } from "@/lib/grant-programs";
import { getGrantStats, getSampleGrantAwards } from "@/lib/public-samples";
import { formatMoney0 } from "@/lib/public-display";

export const metadata = {
  title: "Grant Awards | BidKeep",
  alternates: { canonical: "/grants" },
};
// Tracked programs (and the live award list below) change constantly; render
// per-request rather than baking a stale list into the build output.
export const dynamic = "force-dynamic";

export default async function GrantsPage() {
  const [programs, stats, awards] = await Promise.all([
    getPublicGrantPrograms().catch(() =>
      FACILITIES_GRANT_PROGRAMS_SEED.map((row) => ({ ...row, active: true }))
    ),
    getGrantStats(),
    getSampleGrantAwards(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Leading indicator"
        title="Know who just got funded — before their RFP posts"
        description="A housing authority, school district, or municipality that just received community-facilities, public-housing, or weatherization funding is about to put building-services work out to bid. BidKeep tracks award data from USAspending.gov and upcoming funding cycles from Grants.gov, so you can reach out while the money is still new."
      />

      <section className="mx-auto max-w-6xl px-6 pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold-600">
          {stats.awardCount.toLocaleString()} awards tracked ·{" "}
          {formatMoney0(stats.totalAmount)} in funding · updated daily
        </p>
      </section>

      {awards.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pt-8">
          <h2 className="text-xl font-bold text-navy-950">
            Real awards, publicly verifiable on USAspending.gov
          </h2>
          <div className="mt-5">
            <SampleGrantList rows={awards} />
          </div>
          <p className="mt-3 text-xs text-ink/50">
            Recipients link to the USAspending.gov award record.
          </p>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-navy-950">
              Tracked grant programs (Assistance Listing #)
            </h2>
            <div className="mt-5 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
              {programs.map(({ aln, label }, i) => (
                <div
                  key={aln}
                  className={`flex items-center gap-4 p-4 text-sm ${
                    i !== programs.length - 1 ? "border-b border-navy-950/10" : ""
                  }`}
                >
                  <span className="font-mono font-semibold text-gold-600">
                    {aln}
                  </span>
                  <span className="text-ink/70">{label}</span>
                </div>
              ))}
              {programs.length === 0 && (
                <p className="p-4 text-sm text-ink/50">
                  No grant programs configured yet — add some in the admin dashboard.
                </p>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy-950">
              See who&apos;s funded, state by state
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/70">
              Every award above lists the recipient&apos;s state, so it&apos;s
              easy to spot a housing authority or municipality near you that
              just picked up community-facilities, public-housing, or
              weatherization funding — a signal that janitorial, grounds, or
              facilities-support work is about to go out to bid, not just a
              national list to scroll through.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink/70">
              Assistance Listing numbers are curated by hand rather than
              guessed at from keywords — facilities grant programs are a
              known, stable list.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-navy-900 text-cream">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold">Two signals, not one</h2>
          <p className="mx-auto mt-3 max-w-2xl text-cream/70">
            Contracts (SAM.gov) tell you who&apos;s buying right now. Grant
            awards tell you who&apos;s about to have budget to buy. Newly-funded
            agencies and new solicitations both sync in automatically — the
            full recipient list, award amounts, and funding-cycle dates live
            in the subscriber dashboard.
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
