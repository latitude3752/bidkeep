import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { pipelineHref } from "@/lib/pipeline-href";
import { RADAR_KINDS, RADAR_KIND_LABELS, isRadarKind, type RadarKind } from "@/lib/radar";
import { formatDeadline, normalizeAgency, setAsideLabel } from "@/lib/public-display";
import { logout as founderLogout } from "@/app/admin/actions";
import { logout as subscriberLogout } from "@/app/login/actions";

type Row = {
  id: string;
  title: string;
  agency: string | null;
  naics_code: string | null;
  set_aside_type: string | null;
  notice_type: string | null;
  notice_url: string | null;
  place_of_performance_state: string | null;
  response_deadline: string | null;
  radar_kind: RadarKind;
  radar_event_date: string | null;
  radar_evidence: string | null;
  radar_option_years: number | null;
  sca_mentioned: boolean;
  sca_wd_number: string | null;
  sca_wd_url: string | null;
};

type KindFilter = "all" | RadarKind;

function parseKind(raw: string | undefined): KindFilter {
  if (isRadarKind(raw)) return raw;
  return "all";
}

export default async function RadarBoard({
  viewer,
  basePath,
  searchParams,
}: {
  viewer: "founder" | "subscriber";
  basePath: "/admin/radar" | "/app/radar";
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const kind = parseKind(sp.kind);
  const logout = viewer === "founder" ? founderLogout : subscriberLogout;
  const pipelinePath =
    viewer === "founder" ? "/admin/opportunities" : "/app/opportunities";

  const admin = getSupabaseAdmin();
  let query = admin
    .from("opportunities")
    .select(
      "id, title, agency, naics_code, set_aside_type, notice_type, notice_url, place_of_performance_state, response_deadline, radar_kind, radar_event_date, radar_evidence, radar_option_years, sca_mentioned, sca_wd_number, sca_wd_url"
    )
    .not("radar_kind", "is", null)
    .in("status", ["new", "reviewing", "bid"]);

  if (kind !== "all") {
    query = query.eq("radar_kind", kind);
  }

  const { data } = await query
    .order("radar_event_date", { ascending: true })
    .limit(200);
  const rows = (data ?? []) as Row[];

  const qs = (overrides: Record<string, string>) =>
    pipelineHref(basePath, { kind, ...overrides });

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Recompete radar</h1>
          <p className="mt-1 text-sm text-ink/60">
            Facilities notices whose title, notice type, or description mentions a
            recompete, option exercise, or period of performance — plus early-stage
            notices with no incumbent evidence, labeled as possible opportunities
            rather than confirmed recompetes. Dates appear only when the notice
            itself includes them.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={pipelinePath}
            className="text-sm font-medium text-ink/50 underline hover:text-ink"
          >
            Pipeline
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium text-ink/50 underline hover:text-ink"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={qs({ kind: "all" })}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            kind === "all"
              ? "bg-navy-950 text-cream"
              : "border border-navy-950/15 text-navy-950 hover:border-gold-500"
          }`}
        >
          All signals
        </Link>
        {RADAR_KINDS.map((k) => (
          <Link
            key={k}
            href={qs({ kind: k })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              kind === k
                ? "bg-navy-950 text-cream"
                : "border border-navy-950/15 text-navy-950 hover:border-gold-500"
            }`}
          >
            {RADAR_KIND_LABELS[k]}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-ink/55">
        {rows.length} classified {rows.length === 1 ? "notice" : "notices"}
        {kind !== "all" ? ` · ${RADAR_KIND_LABELS[kind]}` : ""}.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink/60">
          No persisted radar signals yet. They appear after the next SAM.gov
          ingest classifies title / notice-type / requirements text. We do not
          invent option or expiration dates in the meantime.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-ink/50">
                <th className="p-4 font-medium">Title</th>
                <th className="p-4 font-medium">Signal</th>
                <th className="p-4 font-medium">Notice date</th>
                <th className="p-4 font-medium">Set-aside</th>
                <th className="p-4 font-medium">SCA</th>
                <th className="p-4 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-navy-950/5 last:border-0">
                  <td className="p-4">
                    <Link
                      href={`${pipelinePath}/${row.id}`}
                      className="font-medium text-navy-950 hover:text-gold-700"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-1 text-xs text-ink/55">
                      {normalizeAgency(row.agency)} · {row.naics_code ?? "—"} ·{" "}
                      {row.notice_type ?? "—"}
                    </p>
                    {row.radar_evidence && (
                      <p className="mt-1 text-xs text-ink/50">{row.radar_evidence}</p>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="inline-block rounded-full bg-gold-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-800">
                      {RADAR_KIND_LABELS[row.radar_kind]}
                    </span>
                    {row.radar_option_years != null && (
                      <p className="mt-1 text-xs text-ink/55">
                        {row.radar_option_years} option year
                        {row.radar_option_years === 1 ? "" : "s"}
                      </p>
                    )}
                  </td>
                  <td className="p-4 text-ink/70">
                    {row.radar_event_date
                      ? formatDeadline(`${row.radar_event_date}T00:00:00.000Z`)
                      : "not in notice"}
                    {row.response_deadline && (
                      <p className="mt-1 text-xs text-ink/45">
                        Response {formatDeadline(row.response_deadline)}
                      </p>
                    )}
                  </td>
                  <td className="p-4 text-ink/70">{setAsideLabel(row.set_aside_type)}</td>
                  <td className="p-4 text-ink/70">
                    {row.sca_wd_number ? (
                      row.sca_wd_url ? (
                        <a
                          href={row.sca_wd_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
                        >
                          WD {row.sca_wd_number}
                        </a>
                      ) : (
                        `WD ${row.sca_wd_number}`
                      )
                    ) : row.sca_mentioned ? (
                      "Mentioned — no WD number"
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-4 text-ink/70">
                    {row.place_of_performance_state ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
