import type { SampleGrantAward } from "@/lib/public-samples";
import {
  formatMoney0,
  formatPostedDate,
  usaSpendingAwardHref,
} from "@/lib/public-display";

const LINK =
  "font-medium text-gold-700 underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600";

function GrantCard({ award }: { award: SampleGrantAward }) {
  const href = usaSpendingAwardHref(award.awardId);
  return (
    <article className="rounded-xl border border-navy-950/10 bg-white p-4">
      <h3 className="text-sm font-semibold leading-snug text-navy-950">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {award.recipientName}
          </a>
        ) : (
          award.recipientName
        )}
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink/70">
        <dt className="text-ink/45">Amount</dt>
        <dd className="font-semibold text-navy-950">
          {award.amount !== null ? formatMoney0(award.amount) : "—"}
        </dd>
        <dt className="text-ink/45">State</dt>
        <dd>{award.state ?? "—"}</dd>
        <dt className="text-ink/45">Program</dt>
        <dd className="font-mono">{award.programNumber ?? "—"}</dd>
        <dt className="text-ink/45">Award ID</dt>
        <dd className="font-mono">{award.awardNumber ?? award.awardId ?? "—"}</dd>
        <dt className="text-ink/45">Award date</dt>
        <dd>{formatPostedDate(award.startDate)}</dd>
        <dt className="text-ink/45">Agency</dt>
        <dd>{award.awardingAgency ?? "—"}</dd>
      </dl>
    </article>
  );
}

export default function SampleGrantList({ rows }: { rows: SampleGrantAward[] }) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((award, i) => (
          <GrantCard key={award.awardId ?? `${award.recipientName}-${i}`} award={award} />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-navy-950/10 bg-white md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-ink/50">
              <th className="p-4 font-medium">Recipient</th>
              <th className="p-4 font-medium">State</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Program</th>
              <th className="p-4 font-medium">Award ID</th>
              <th className="p-4 font-medium">Award date</th>
              <th className="p-4 font-medium">Agency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => {
              const href = usaSpendingAwardHref(a.awardId);
              return (
                <tr
                  key={a.awardId ?? `${a.recipientName}-${i}`}
                  className={i !== rows.length - 1 ? "border-b border-navy-950/10" : ""}
                >
                  <td className="p-4 text-navy-950">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK}
                      >
                        {a.recipientName}
                      </a>
                    ) : (
                      a.recipientName
                    )}
                  </td>
                  <td className="p-4 text-ink/70">{a.state ?? "—"}</td>
                  <td className="p-4 font-semibold text-navy-950">
                    {a.amount !== null ? formatMoney0(a.amount) : "—"}
                  </td>
                  <td className="p-4 font-mono text-ink/60">{a.programNumber ?? "—"}</td>
                  <td className="p-4 font-mono text-xs text-ink/60">
                    {a.awardNumber ?? a.awardId ?? "—"}
                  </td>
                  <td className="p-4 text-ink/70">{formatPostedDate(a.startDate)}</td>
                  <td className="p-4 text-ink/70">{a.awardingAgency ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
