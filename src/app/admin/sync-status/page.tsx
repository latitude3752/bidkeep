import Link from "next/link";
import {
  listRecentSyncRuns,
  sourceHealthSummary,
  type SourceHealthGroup,
} from "@netacracy/bid-core";

export const metadata = { title: "Sync Status | Admin" };
export const dynamic = "force-dynamic";

/** Same threshold the daily freshness-check cron alerts on -- gives a full
 * cron cycle (24h) plus buffer before flagging a run as stale. */
const STALE_HOURS = 30;

/** Every real-world data source this app syncs, grouped by how the health
 * dashboard should present them -- SAM.gov bundles "direct" and "relay"
 * into one card since only one of them is ever populated per app. */
const SOURCE_GROUPS: { label: string; sources: SourceHealthGroup["sources"] }[] = [
  { label: "SAM.gov", sources: ["direct", "relay"] },
  { label: "Georgia (GPR)", sources: ["gpr"] },
  { label: "Texas (ESBD)", sources: ["tx-esbd"] },
  { label: "Bonfire", sources: ["bonfire"] },
  { label: "Grants", sources: ["grants"] },
];

function formatAge(ranAt: string, now: number): string {
  const hours = (now - new Date(ranAt).getTime()) / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function SyncStatusPage() {
  // react-hooks/purity flags Date.now() as an impure render call, but that
  // rule targets client re-renders -- this is an async Server Component
  // (force-dynamic) that's meant to read the current time fresh per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const runs = await listRecentSyncRuns(20);
  const health = await sourceHealthSummary(SOURCE_GROUPS);
  // Scoped to the SAM.gov group specifically -- a healthy GA/TX/Bonfire run
  // must never mask this banner's "check BidHawk's relay" guidance.
  const latest = health[0].lastRun;
  const latestAgeHours = latest
    ? (now - new Date(latest.ran_at).getTime()) / 3_600_000
    : Infinity;
  const stale = latestAgeHours > STALE_HOURS;

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">SAM.gov sync status</h1>
          <p className="mt-1 text-sm text-ink/60">
            BidHawk now pulls SAM.gov once daily for the whole Bid product family and relays
            this app&apos;s share to /api/ingest-opportunities. This is the last 20 runs recorded
            here -- &quot;relay&quot; is data received from BidHawk; &quot;direct&quot; is this app&apos;s own
            sync-opportunities route, kept as a manual fallback but no longer scheduled.
          </p>
        </div>
        <Link
          href="/admin/opportunities"
          className="text-sm font-medium text-ink/50 underline hover:text-ink"
        >
          ← Pipeline
        </Link>
      </div>

      {stale && (
        <div className="mt-6 rounded-xl border border-red-600/30 bg-red-50 p-4 text-sm font-medium text-red-800">
          {latest
            ? `No sync run in ${Math.round(latestAgeHours)}h (last one was ${formatAge(latest.ran_at, now)}). Check BidHawk's relay is reaching this app.`
            : "No sync run has ever been recorded. Check BidHawk's relay is reaching this app."}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/40">
          Source health
        </h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {health.map((group) => {
            const lastRunFailed = Boolean(group.lastRun && group.lastRun.error_count > 0);
            const lastRunAgeHours = group.lastRun
              ? (now - new Date(group.lastRun.ran_at).getTime()) / 3_600_000
              : Infinity;
            const noRecentRun = lastRunAgeHours > STALE_HOURS;
            return (
              <div
                key={group.label}
                className={`rounded-xl border p-4 ${
                  lastRunFailed || noRecentRun
                    ? "border-red-600/30 bg-red-50"
                    : "border-navy-950/10 bg-white"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-navy-950">{group.label}</span>
                  {group.lastRun ? (
                    <span
                      className="text-xs text-ink/50"
                      title={group.lastRun.ran_at}
                    >
                      last attempt {formatAge(group.lastRun.ran_at, now)}
                    </span>
                  ) : (
                    <span className="text-xs text-ink/50">never run</span>
                  )}
                </div>
                {group.lastRun && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink/60">
                    <span>
                      fetched{" "}
                      <span className="font-mono text-ink/80">{group.lastRun.fetched ?? "—"}</span>
                    </span>
                    <span>
                      upserted{" "}
                      <span className="font-mono text-ink/80">{group.lastRun.upserted}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        lastRunFailed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}
                      title={group.lastRun.errors.join("\n")}
                    >
                      {group.lastRun.error_count} error{group.lastRun.error_count === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                <p className="mt-2 text-xs text-ink/50">
                  {group.lastSuccess
                    ? `last success ${formatAge(group.lastSuccess.ran_at, now)}`
                    : "no successful run recorded yet"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
        <h2 className="border-b border-navy-950/10 p-3 text-xs font-semibold uppercase tracking-wide text-ink/40">
          Last 20 runs, all sources
        </h2>
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-navy-950/10 p-3 text-xs font-semibold uppercase tracking-wide text-ink/40">
          <span>Ran</span>
          <span>Source</span>
          <span>Fetched</span>
          <span>Upserted</span>
          <span>Errors</span>
        </div>
        {runs.map((run) => (
          <div
            key={run.id}
            className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-navy-950/10 p-3 text-sm last:border-0"
          >
            <span title={run.ran_at}>{formatAge(run.ran_at, now)}</span>
            <span className="justify-self-start rounded-full bg-navy-950/10 px-2 py-0.5 text-xs font-semibold text-navy-900">
              {run.source}
            </span>
            <span className="justify-self-end font-mono text-ink/70">{run.fetched ?? "—"}</span>
            <span className="justify-self-end font-mono text-ink/70">{run.upserted}</span>
            <span
              className={`justify-self-end rounded-full px-2 py-0.5 text-xs font-semibold ${
                run.error_count > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}
              title={run.errors.join("\n")}
            >
              {run.error_count}
            </span>
          </div>
        ))}
        {runs.length === 0 && (
          <p className="p-6 text-sm text-ink/50">No sync runs recorded yet.</p>
        )}
      </div>
    </section>
  );
}
