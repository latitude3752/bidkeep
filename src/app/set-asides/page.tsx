import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { OPERATOR } from "@/lib/operator";
import { getRadarStats, getSampleScaRows } from "@/lib/public-radar";
import { samNoticeHref } from "@/lib/public-display";

export const metadata = {
  title: `Set-asides & SCA | ${OPERATOR.productName}`,
  description:
    "SDVOSB, 8(a), HUBZone, WOSB, and small-business set-aside types explained for federal facilities contracts, plus Service Contract Act wage-determination awareness.",
  alternates: { canonical: "/set-asides" },
};

const SET_ASIDES = [
  {
    name: "SDVOSB",
    body: "Service-Disabled Veteran-Owned Small Business. Common on VA and DoD facilities, custodial, and guard contracts.",
  },
  {
    name: "8(a)",
    body: "SBA 8(a) Business Development set-aside or sole-source. Frequent on multi-year base-ops and janitorial vehicles.",
  },
  {
    name: "HUBZone",
    body: "Historically Underutilized Business Zone. Often paired with installation-support and grounds work near qualifying census tracts.",
  },
  {
    name: "WOSB / EDWOSB",
    body: "Women-Owned (and Economically Disadvantaged Women-Owned) Small Business set-asides where SBA has authorized the NAICS.",
  },
  {
    name: "Small business / SDB",
    body: "Total small-business set-aside or small-disadvantaged-business preference. The default small-business filter on many GSA and installation RFPs.",
  },
];

export const dynamic = "force-dynamic";

export default async function SetAsidesPage() {
  const [scaRows, stats] = await Promise.all([getSampleScaRows(), getRadarStats()]);

  return (
    <>
      <PageHeader
        eyebrow="Trust page"
        title="Set-asides and the Service Contract Act"
        description="Facilities contracts are set-aside-heavy and SCA-covered. BidKeep surfaces the set-aside type SAM.gov already publishes. We do not invent wage-determination numbers — WD links appear when the notice includes them."
      />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-xl font-bold text-navy-950">
          Set-aside types you will see on sample rows
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/70">
          These labels come from SAM.gov&apos;s set-aside field. BidKeep shows
          them on the public opportunities list and in the subscriber pipeline
          so a shop can scan SDVOSB / 8(a) / HUBZone / WOSB work without opening
          every notice.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {SET_ASIDES.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border border-navy-950/10 bg-white p-6"
            >
              <h3 className="text-base font-semibold text-navy-950">
                {item.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-xl font-bold text-navy-950">
            Service Contract Act (SCA) wage determinations
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink/70">
            Most janitorial, grounds, and guard contracts are covered by the
            McNamara-O&apos;Hara Service Contract Act. The contracting office
            attaches a Department of Labor wage determination (WD) that sets
            prevailing wages and fringe by locality and occupation. Pricing
            without the correct WD is how otherwise-qualified shops lose money
            on a base-plus-option vehicle.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink/70">
            BidKeep does not fabricate WD numbers or scrape DOL on its own.
            Sync reads the notice title, description, and attachment links.
            A WD number or SAM.gov wage-determination URL is stored when it
            is actually there. “Wage determination has been updated” without
            a number stays an honest mention — not a guessed WD-2015-XXXX.
            Use{" "}
            <a
              href="https://sam.gov/wage-determination"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gold-700 underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            >
              SAM.gov wage determinations
            </a>{" "}
            and the solicitation attachments when the notice is silent.
          </p>
          {stats.scaMentionCount > 0 ? (
            <p className="mt-4 text-sm text-ink/70">
              {stats.scaMentionCount.toLocaleString()} open notices mention SCA
              or a wage determination
              {stats.scaWdCount > 0
                ? ` · ${stats.scaWdCount.toLocaleString()} include a WD number`
                : " · none of those include a WD number yet"}
              .
            </p>
          ) : (
            <p className="mt-4 text-sm text-ink/60">
              No open BidKeep notices currently include SCA or WD language in
              the stored title or description. That empty state is intentional.
            </p>
          )}
          {scaRows.length > 0 && (
            <ul className="mt-6 space-y-3">
              {scaRows.map((row) => {
                const href = samNoticeHref(row.noticeUrl, row.noticeId);
                return (
                  <li
                    key={row.noticeId ?? row.title}
                    className="rounded-xl border border-navy-950/10 bg-cream px-4 py-3 text-sm"
                  >
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gold-700 underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
                      >
                        {row.title}
                      </a>
                    ) : (
                      <span className="font-medium text-navy-950">{row.title}</span>
                    )}
                    <p className="mt-1 text-xs text-ink/60">
                      {row.wdNumber
                        ? `WD ${row.wdNumber}`
                        : "Mentions a wage determination — number not in the notice text"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink/70">
            Recompetes of multi-year facilities vehicles are the other clock
            that matters. The{" "}
            <Link
              href="/radar"
              className="font-medium text-gold-700 underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            >
              recompete radar
            </Link>{" "}
            lists option-year, period-end, and follow-on language from the
            same notices — dates only when SAM.gov included them.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/radar"
              className="inline-block rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
            >
              Recompete radar
            </Link>
            <Link
              href="/opportunities"
              className="inline-block rounded-full border border-navy-950/20 px-7 py-3 text-sm font-semibold text-navy-950 hover:border-gold-500"
            >
              See live set-asides
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
