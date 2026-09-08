import type { SampleOpportunity } from "@/lib/public-samples";
import {
  formatDeadline,
  formatPostedDate,
  normalizeAgency,
  samNoticeHref,
  setAsideLabel,
} from "@/lib/public-display";

const LINK =
  "font-medium text-gold-700 underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600";

function ExampleBadge() {
  return (
    <span className="ml-2 inline-block shrink-0 rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
      Recent opportunity example
    </span>
  );
}

function OpenBadge() {
  return (
    <span className="ml-2 inline-block shrink-0 rounded-full bg-navy-950/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-950">
      Open
    </span>
  );
}

function StatusBadge({ isExample }: { isExample?: boolean }) {
  return isExample ? <ExampleBadge /> : <OpenBadge />;
}

function OpportunityCard({ op }: { op: SampleOpportunity }) {
  const href = samNoticeHref(op.noticeUrl, op.noticeId);
  const agency = normalizeAgency(op.agency);
  return (
    <article className="rounded-xl border border-navy-950/10 bg-white p-4">
      <h3 className="text-sm font-semibold leading-snug text-navy-950">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {op.title}
          </a>
        ) : (
          op.title
        )}
        <StatusBadge isExample={op.isExample} />
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink/70">
        <dt className="text-ink/45">Agency</dt>
        <dd title={op.agency ?? undefined}>{agency}</dd>
        <dt className="text-ink/45">Notice ID</dt>
        <dd className="font-mono">{op.noticeId ?? "—"}</dd>
        <dt className="text-ink/45">Set-aside</dt>
        <dd>{setAsideLabel(op.setAsideType)}</dd>
        <dt className="text-ink/45">NAICS</dt>
        <dd className="font-mono">{op.naicsCode ?? "—"}</dd>
        {op.placeOfPerformanceState !== undefined && (
          <>
            <dt className="text-ink/45">State</dt>
            <dd>{op.placeOfPerformanceState ?? "—"}</dd>
          </>
        )}
        <dt className="text-ink/45">Deadline</dt>
        <dd>{formatDeadline(op.responseDeadline)}</dd>
        <dt className="text-ink/45">Posted</dt>
        <dd>{formatPostedDate(op.postedAt)}</dd>
      </dl>
    </article>
  );
}

export default function SampleOpportunityList({
  rows,
}: {
  rows: SampleOpportunity[];
}) {
  const showState = rows.some((r) => r.placeOfPerformanceState !== undefined);

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((op, i) => (
          <OpportunityCard key={op.noticeId ?? `${op.title}-${i}`} op={op} />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-navy-950/10 bg-white md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-ink/50">
              <th className="p-4 font-medium">Title</th>
              <th className="p-4 font-medium">Agency</th>
              <th className="p-4 font-medium">Notice ID</th>
              <th className="p-4 font-medium">Set-aside</th>
              <th className="p-4 font-medium">NAICS</th>
              {showState && <th className="p-4 font-medium">State</th>}
              <th className="p-4 font-medium">Deadline</th>
              <th className="p-4 font-medium">Posted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((op, i) => {
              const href = samNoticeHref(op.noticeUrl, op.noticeId);
              return (
                <tr
                  key={op.noticeId ?? `${op.title}-${i}`}
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
                        {op.title}
                      </a>
                    ) : (
                      op.title
                    )}
                    <StatusBadge isExample={op.isExample} />
                  </td>
                  <td className="p-4 text-ink/70" title={op.agency ?? undefined}>
                    {normalizeAgency(op.agency)}
                  </td>
                  <td className="p-4 font-mono text-xs text-ink/60">
                    {op.noticeId ?? "—"}
                  </td>
                  <td className="p-4 text-ink/70">{setAsideLabel(op.setAsideType)}</td>
                  <td className="p-4 font-mono text-ink/60">{op.naicsCode ?? "—"}</td>
                  {showState && (
                    <td className="p-4 text-ink/70">
                      {op.placeOfPerformanceState ?? "—"}
                    </td>
                  )}
                  <td className="p-4 text-ink/70">{formatDeadline(op.responseDeadline)}</td>
                  <td className="p-4 text-ink/70">{formatPostedDate(op.postedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
