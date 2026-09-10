import type { SampleRadarRow } from "@/lib/public-radar";
import { radarKindLabel } from "@/lib/public-radar";
import {
  formatDeadline,
  normalizeAgency,
  samNoticeHref,
  setAsideLabel,
} from "@/lib/public-display";

const LINK =
  "font-medium text-gold-700 underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600";

function ExampleBadge() {
  return (
    <span className="ml-2 inline-block shrink-0 rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
      Example signal
    </span>
  );
}

function KindBadge({ kind }: { kind: SampleRadarRow["kind"] }) {
  return (
    <span className="inline-block rounded-full bg-gold-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-800">
      {radarKindLabel(kind)}
    </span>
  );
}

function RadarCard({ row }: { row: SampleRadarRow }) {
  const href = row.isExample ? null : samNoticeHref(row.noticeUrl, row.noticeId);
  return (
    <article className="rounded-xl border border-navy-950/10 bg-white p-4">
      <h3 className="text-sm font-semibold leading-snug text-navy-950">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {row.title}
          </a>
        ) : (
          row.title
        )}
        {row.isExample && <ExampleBadge />}
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink/70">
        <dt className="text-ink/45">Signal</dt>
        <dd>
          <KindBadge kind={row.kind} />
        </dd>
        <dt className="text-ink/45">Agency</dt>
        <dd title={row.agency ?? undefined}>{normalizeAgency(row.agency)}</dd>
        <dt className="text-ink/45">NAICS</dt>
        <dd className="font-mono">{row.naicsCode ?? "—"}</dd>
        <dt className="text-ink/45">Set-aside</dt>
        <dd>{setAsideLabel(row.setAsideType)}</dd>
        <dt className="text-ink/45">Notice date</dt>
        <dd>{row.eventDate ? formatDeadline(`${row.eventDate}T00:00:00.000Z`) : "not in notice"}</dd>
        <dt className="text-ink/45">Options</dt>
        <dd>{row.optionYears != null ? `${row.optionYears} option year${row.optionYears === 1 ? "" : "s"}` : "—"}</dd>
      </dl>
      {row.evidence && (
        <p className="mt-3 text-xs leading-relaxed text-ink/60">{row.evidence}</p>
      )}
    </article>
  );
}

export default function SampleRadarList({ rows }: { rows: SampleRadarRow[] }) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row, i) => (
          <RadarCard key={row.noticeId ?? `${row.title}-${i}`} row={row} />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-navy-950/10 bg-white md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-ink/50">
              <th className="p-4 font-medium">Title</th>
              <th className="p-4 font-medium">Signal</th>
              <th className="p-4 font-medium">Notice date</th>
              <th className="p-4 font-medium">Agency</th>
              <th className="p-4 font-medium">NAICS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const href = row.isExample
                ? null
                : samNoticeHref(row.noticeUrl, row.noticeId);
              return (
                <tr
                  key={row.noticeId ?? `${row.title}-${i}`}
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
                        {row.title}
                      </a>
                    ) : (
                      row.title
                    )}
                    {row.isExample && <ExampleBadge />}
                    {row.evidence && (
                      <p className="mt-1 text-xs text-ink/55">{row.evidence}</p>
                    )}
                  </td>
                  <td className="p-4">
                    <KindBadge kind={row.kind} />
                    {row.optionYears != null && (
                      <p className="mt-1 text-xs text-ink/55">
                        {row.optionYears} option year{row.optionYears === 1 ? "" : "s"}
                      </p>
                    )}
                  </td>
                  <td className="p-4 text-ink/70">
                    {row.eventDate
                      ? formatDeadline(`${row.eventDate}T00:00:00.000Z`)
                      : "not in notice"}
                  </td>
                  <td className="p-4 text-ink/70" title={row.agency ?? undefined}>
                    {normalizeAgency(row.agency)}
                  </td>
                  <td className="p-4 font-mono text-ink/60">{row.naicsCode ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
