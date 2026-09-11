import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PriceResearchResult } from "@/lib/contract-awards";
import StatusSelect from "../StatusSelect";
import ResearchButton from "./ResearchButton";
import ScaleButton from "./ScaleButton";
import { ensureOpportunityScale, extractSubmissionMethod } from "@netacracy/bid-core";
import { radarPersistFields, RADAR_KIND_LABELS, isRadarKind, type RadarKind } from "@/lib/radar";
import { getCurrentSeat } from "@/lib/current-seat";
import { getCompanyProfile } from "@/lib/company-profiles";
import { getQuoteWorksheet } from "@/lib/quote-worksheets-store";
import QuoteWorksheetForm from "./QuoteWorksheetForm";
import Proposal from "./Proposal";

type Row = {
  id: string;
  title: string;
  agency: string | null;
  naics_code: string | null;
  psc_code: string | null;
  set_aside_type: string | null;
  response_deadline: string | null;
  notice_url: string | null;
  notice_type: string | null;
  acquisition_type: string | null;
  status: string;
  price_research: PriceResearchResult | null;
  price_research_at: string | null;
  requirements_text: string | null;
  requirements_fetched_at: string | null;
  program_type: "bpa" | "idiq" | null;
  estimated_ceiling: number | null;
  raw_data: { solicitationNumber?: string | null } | null;
  radar_kind: RadarKind | null;
  radar_event_date: string | null;
  radar_evidence: string | null;
  radar_source: string | null;
  radar_option_years: number | null;
  sca_mentioned: boolean;
  sca_wd_number: string | null;
  sca_wd_url: string | null;
  radar_classified_at: string | null;
};

export async function getOpportunity(id: string): Promise<Row | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("opportunities")
    .select(
      "id, title, agency, naics_code, psc_code, set_aside_type, response_deadline, notice_url, notice_type, acquisition_type, status, price_research, price_research_at, requirements_text, requirements_fetched_at, program_type, estimated_ceiling, raw_data, radar_kind, radar_event_date, radar_evidence, radar_source, radar_option_years, sca_mentioned, sca_wd_number, sca_wd_url, radar_classified_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Row;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export async function OpportunityDetail({
  params,
  basePath,
}: {
  params: Promise<{ id: string }>;
  basePath: "/admin/opportunities" | "/app/opportunities";
}) {
  const { id } = await params;
  let op = await getOpportunity(id);
  if (!op) notFound();

  try {
    const ensured = await ensureOpportunityScale(id);
    op = {
      ...op,
      requirements_text: ensured.text ?? op.requirements_text,
      requirements_fetched_at: ensured.fetchedAt ?? op.requirements_fetched_at,
      program_type: ensured.scale.programType,
      estimated_ceiling: ensured.scale.estimatedCeiling,
    };
  } catch {
    // Page still renders; user can hit "Refresh scale classification".
  }

  const radarFields = radarPersistFields({
    title: op.title,
    noticeType: op.notice_type,
    rawData: op.raw_data,
    requirementsText: op.requirements_text,
  });
  if (!op.radar_classified_at || (op.requirements_text && op.radar_source !== "requirements_text")) {
    try {
      await getSupabaseAdmin().from("opportunities").update(radarFields).eq("id", id);
      op = { ...op, ...radarFields };
    } catch {
      op = { ...op, ...radarFields };
    }
  }

  const research = op.price_research;
  const submission = extractSubmissionMethod(op.requirements_text);

  const isSubscriberView = basePath === "/app/opportunities";
  const seat = isSubscriberView ? await getCurrentSeat() : null;
  const profile = seat?.company ? await getCompanyProfile(seat.company) : null;
  const savedQuote = seat?.company ? await getQuoteWorksheet(op.id, seat.company) : null;

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <Link href={basePath} className="text-sm text-ink/50 hover:text-ink">
        ← Back to pipeline
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-950">{op.title}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {op.agency ?? "—"} · {op.notice_type ?? "—"}
          </p>
        </div>
        <StatusSelect id={op.id} status={op.status} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-navy-950/10 bg-white p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/40">NAICS</dt>
          <dd className="font-mono">{op.naics_code ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/40">PSC</dt>
          <dd className="font-mono">{op.psc_code ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/40">Acquisition</dt>
          <dd>{op.acquisition_type ?? "unknown"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/40">Deadline</dt>
          <dd>{op.response_deadline ? new Date(op.response_deadline).toLocaleDateString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/40">Scale</dt>
          <dd>
            {op.program_type || op.estimated_ceiling !== null ? (
              <>
                {op.program_type?.toUpperCase()}
                {op.program_type && op.estimated_ceiling !== null ? " · " : ""}
                {op.estimated_ceiling !== null ? `ceiling ${formatMoney(op.estimated_ceiling)}` : ""}
              </>
            ) : (
              <span title="No ceiling disclosed in the notice text — ordinary one-off RFQ, most likely">
                Single-buy
              </span>
            )}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-xs uppercase tracking-wide text-ink/40">Set-Aside</dt>
          <dd>{op.set_aside_type ?? "Full and open"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/40">Radar</dt>
          <dd>
            {isRadarKind(op.radar_kind) ? (
              <>
                {RADAR_KIND_LABELS[op.radar_kind]}
                {op.radar_option_years != null ? ` · ${op.radar_option_years} option years` : ""}
                {op.radar_event_date
                  ? ` · ${new Date(`${op.radar_event_date}T00:00:00.000Z`).toLocaleDateString()}`
                  : ""}
              </>
            ) : (
              <span title="No recompete, option, or period-of-performance language in the notice">
                No signal in notice
              </span>
            )}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-xs uppercase tracking-wide text-ink/40">SCA / wage determination</dt>
          <dd>
            {op.sca_wd_number ? (
              op.sca_wd_url ? (
                <a
                  href={op.sca_wd_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
                >
                  WD {op.sca_wd_number}
                </a>
              ) : (
                `WD ${op.sca_wd_number}`
              )
            ) : op.sca_mentioned ? (
              "Notice mentions a wage determination — no WD number in the SAM text"
            ) : (
              "Not in this notice"
            )}
          </dd>
        </div>
      </dl>
      {op.radar_evidence && (
        <p className="mt-3 text-xs text-ink/55">{op.radar_evidence}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
        {op.notice_url && (
          <a
            href={op.notice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
          >
            View full solicitation on SAM.gov ↗
          </a>
        )}
        {submission?.method === "email" ? (
          <a
            href={`mailto:${submission.email}`}
            className="inline-block text-sm underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
            title="This notice's own text asks for the response by email, not through PIEE"
          >
            Email your quote to {submission.email} ↗
          </a>
        ) : (
          <a
            href="https://piee.eb.mil"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
          >
            Submit via PIEE ↗
          </a>
        )}
      </div>

      <div className="mt-10 rounded-xl border border-navy-950/10 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy-950">Notice text &amp; scale</h2>
            <p className="mt-1 text-sm text-ink/60">
              Pulls the full solicitation description and classifies it as a plain RFQ vs. a
              BPA/IDIQ with a stated ceiling. Refresh if the notice was just amended.
            </p>
          </div>
          <ScaleButton id={op.id} />
        </div>

        {op.requirements_fetched_at && (
          <p className="mt-3 text-xs text-ink/40">
            Last fetched {new Date(op.requirements_fetched_at).toLocaleString()}
          </p>
        )}

        {op.requirements_text && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-navy-900/70 hover:text-navy-950">
              Full notice text
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-navy-950/[0.03] p-4 text-xs text-ink/80">
              {op.requirements_text}
            </pre>
          </details>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy-950">Price research</h2>
            <p className="mt-1 text-sm text-ink/60">
              Past federal award amounts for comparable NAICS/keyword matches, via SAM.gov&apos;s
              Contract Awards data. Ballpark award totals, not unit pricing.
            </p>
          </div>
          <ResearchButton id={op.id} hasResearch={!!research} />
        </div>

        {op.price_research_at && (
          <p className="mt-3 text-xs text-ink/40">
            Last researched {new Date(op.price_research_at).toLocaleString()} · searched for “
            {research?.query.keyword}” in NAICS {research?.query.naicsCode ?? "—"}
          </p>
        )}

        {research && research.stats && (
          <div className="mt-5 grid grid-cols-3 gap-4 rounded-lg bg-navy-950/[0.03] p-4 text-center">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink/40">Low</div>
              <div className="text-lg font-bold text-navy-950">{formatMoney(research.stats.min)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink/40">Avg</div>
              <div className="text-lg font-bold text-navy-950">{formatMoney(research.stats.avg)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink/40">High</div>
              <div className="text-lg font-bold text-navy-950">{formatMoney(research.stats.max)}</div>
            </div>
          </div>
        )}

        {research && research.comps.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-950/10 text-ink/50">
                  <th className="py-2 pr-3 font-medium">Awardee</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Signed</th>
                  <th className="py-2 font-medium">Office</th>
                </tr>
              </thead>
              <tbody>
                {research.comps.map((c, i) => (
                  <tr key={i} className="border-b border-navy-950/5 last:border-0">
                    <td className="py-2 pr-3">
                      {c.awardeeName ?? "—"}
                      {c.isSdvosb && (
                        <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 text-xs font-semibold text-gold-700">
                          SDVOSB
                        </span>
                      )}
                      {!c.isSdvosb && c.isSmallBusiness && (
                        <span className="ml-2 rounded-full bg-navy-950/10 px-2 py-0.5 text-xs font-semibold text-navy-900">
                          SB
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-ink/70">{c.awardType ?? "—"}</td>
                    <td className="py-2 pr-3">{c.dollars ? formatMoney(c.dollars) : "—"}</td>
                    <td className="py-2 pr-3 text-ink/70">
                      {c.dateSigned ? new Date(c.dateSigned).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 text-ink/70">{c.contractingOffice ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {research && research.comps.length === 0 && (
          <p className="mt-4 text-sm text-ink/50">No comparable past awards found for this search.</p>
        )}
      </div>

      {isSubscriberView && seat && (
        <>
          <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-6 print:hidden">
            <h2 className="text-lg font-bold text-navy-950">Quote worksheet</h2>
            <p className="mt-1 text-sm text-ink/60">
              Your own cost-plus pricing worksheet for this opportunity — not shared with other
              subscribers.
            </p>
            <div className="mt-4">
              <QuoteWorksheetForm
                opportunityId={op.id}
                saved={savedQuote?.result ?? null}
                savedNotes={savedQuote?.notes ?? null}
              />
            </div>
          </div>

          <Proposal
            op={{
              title: op.title,
              agency: op.agency,
              naics_code: op.naics_code,
              psc_code: op.psc_code,
              set_aside_type: op.set_aside_type,
              response_deadline: op.response_deadline,
              notice_type: op.notice_type,
              raw_data: op.raw_data,
            }}
            quote={savedQuote?.result ?? null}
            quoteNotes={savedQuote?.notes ?? null}
            profile={profile}
          />
        </>
      )}
    </section>
  );
}
