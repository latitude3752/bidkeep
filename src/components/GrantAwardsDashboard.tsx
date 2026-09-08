import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAllGrantPrograms } from "@/lib/grant-programs";
import { pipelineHref } from "@/lib/pipeline-href";
import { logout as founderLogout } from "@/app/admin/actions";
import { logout as subscriberLogout } from "@/app/login/actions";

type Row = {
  id: string;
  recipient_name: string;
  awarding_agency: string | null;
  amount: number | null;
  start_date: string | null;
  state: string | null;
  city: string | null;
  program_number: string | null;
};

type FundingOppRow = {
  id: string;
  opportunity_id: string;
  title: string;
  agency: string | null;
  program_number: string | null;
  close_date: string | null;
};

type SortKey = "recipient" | "amount" | "start_date" | "state";
type SortDir = "asc" | "desc";

type Filters = {
  /** Free-text, matched with ilike -- state is stored as a full name
   * ("Florida"), not a two-letter code, so exact-match would be too brittle. */
  state: string;
  /** "" = all programs, else an exact Assistance Listing number. */
  program: string;
};

const DB_SORT_COLUMNS: Record<SortKey, string> = {
  recipient: "recipient_name",
  amount: "amount",
  start_date: "start_date",
  state: "state",
};

function formatMoney(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

function parseSort(sp: Record<string, string | undefined>): { sortBy: SortKey; sortDir: SortDir } {
  const raw = sp.sort;
  const sortBy: SortKey = raw && raw in DB_SORT_COLUMNS ? (raw as SortKey) : "start_date";
  const sortDir = sp.dir === "asc" ? "asc" : "desc";
  return { sortBy, sortDir };
}

function parseFilters(sp: Record<string, string | undefined>): Filters {
  return {
    state: (sp.state ?? "").trim(),
    program: (sp.program ?? "").trim(),
  };
}

async function getGrantAwards(filters: Filters, sortBy: SortKey, sortDir: SortDir): Promise<Row[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("grant_awards")
    .select("id, recipient_name, awarding_agency, amount, start_date, state, city, program_number");

  if (filters.state) query = query.ilike("state", `%${filters.state}%`);
  if (filters.program) query = query.eq("program_number", filters.program);

  const { data, error } = await query
    .order(DB_SORT_COLUMNS[sortBy], { ascending: sortDir === "asc", nullsFirst: false })
    .limit(500);

  if (error) {
    console.error("Failed to load grant awards:", error.message);
    return [];
  }
  return (data ?? []) as Row[];
}

/** Open/forecasted Grants.gov funding windows -- the "apply before this
 * closes" signal, alongside the awards table above (the "already funded"
 * signal). Capped at 20 and sorted by closest deadline first since this is
 * meant to be skimmed, not paged through. */
async function getOpenFundingOpportunities(): Promise<FundingOppRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("grant_funding_opportunities")
    .select("id, opportunity_id, title, agency, program_number, close_date")
    .in("status", ["posted", "forecasted"])
    .order("close_date", { ascending: true, nullsFirst: false })
    .limit(20);

  if (error) {
    console.error("Failed to load funding opportunities:", error.message);
    return [];
  }
  return (data ?? []) as FundingOppRow[];
}

function SortableHeader({
  href,
  active,
  dir,
  children,
}: {
  href: string;
  active: boolean;
  dir: SortDir;
  children: React.ReactNode;
}) {
  return (
    <th className="p-3 font-medium">
      <Link href={href} className="inline-flex items-center gap-1 hover:text-ink">
        {children}
        <span className={`text-[10px] ${active ? "text-navy-900" : "text-ink/20"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </Link>
    </th>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
        active
          ? "bg-navy-950 text-cream"
          : "border border-navy-950/20 text-navy-950/70 hover:border-navy-950/40"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function GrantAwardsDashboard({
  viewer,
  basePath,
  searchParams,
}: {
  viewer: "founder" | "subscriber";
  basePath: "/admin/grants" | "/app/grants";
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const { sortBy, sortDir } = parseSort(sp);
  const [rows, fundingOpportunities, programs] = await Promise.all([
    getGrantAwards(filters, sortBy, sortDir),
    getOpenFundingOpportunities(),
    getAllGrantPrograms(),
  ]);
  const totalAmount = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const logout = viewer === "founder" ? founderLogout : subscriberLogout;
  const opportunitiesHref = viewer === "founder" ? "/admin/opportunities" : "/app/opportunities";

  const qs = (overrides: Partial<Record<"state" | "program" | "sort" | "dir", string>>) =>
    pipelineHref(basePath, {
      state: filters.state,
      program: filters.program,
      sort: sortBy,
      dir: sortDir,
      ...overrides,
    });

  const sortHref = (key: SortKey) =>
    qs({ sort: key, dir: sortBy === key && sortDir === "desc" ? "asc" : "desc" });

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Grant awards — leads before the RFP</h1>
          <p className="mt-1 text-sm text-ink/60">
            {rows.length} award{rows.length === 1 ? "" : "s"} tracked · {formatMoney(totalAmount)} total
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={opportunitiesHref}
            className="text-sm font-medium text-ink/50 underline hover:text-ink"
          >
            Opportunities
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

      <div className="mt-6 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Program
          </span>
          <FilterLink href={qs({ program: "" })} active={!filters.program}>
            All
          </FilterLink>
          {programs.map((p) => (
            <FilterLink key={p.aln} href={qs({ program: p.aln })} active={filters.program === p.aln}>
              {p.aln}
            </FilterLink>
          ))}
        </div>
        <form
          action={basePath}
          method="GET"
          className="flex items-center gap-2"
        >
          <label
            htmlFor="grant-state-filter"
            className="text-xs font-semibold uppercase tracking-wide text-ink/40"
          >
            State
          </label>
          <input type="hidden" name="program" value={filters.program} />
          <input type="hidden" name="sort" value={sortBy} />
          <input type="hidden" name="dir" value={sortDir} />
          <input
            id="grant-state-filter"
            name="state"
            defaultValue={filters.state}
            placeholder="e.g. Florida"
            className="rounded-full border border-navy-950/20 px-3 py-1.5 text-xs text-navy-950 placeholder:text-ink/30"
          />
          <button
            type="submit"
            className="rounded-full border border-navy-950/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy-950/70 hover:border-navy-950/40"
          >
            Filter
          </button>
          {filters.state && (
            <Link href={qs({ state: "" })} className="text-xs font-medium text-ink/50 underline hover:text-ink">
              Clear
            </Link>
          )}
        </form>
      </div>

      {fundingOpportunities.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/40">
            Open funding opportunities — apply before these close
          </h2>
          <ul className="mt-3 space-y-2">
            {fundingOpportunities.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-navy-950/10 bg-white p-3 text-sm"
              >
                <a
                  href={`https://www.grants.gov/search-results-detail/${o.opportunity_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-navy-950 underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
                >
                  {o.title}
                </a>
                <span className="text-ink/60">
                  {" "}
                  — {o.agency ?? "Unknown agency"} · closes {formatDate(o.close_date)}
                  {o.program_number ? ` · ALN ${o.program_number}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-navy-950/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-950/10 bg-navy-950/[0.03] text-ink/50">
              <SortableHeader href={sortHref("recipient")} active={sortBy === "recipient"} dir={sortDir}>
                Recipient
              </SortableHeader>
              <SortableHeader href={sortHref("state")} active={sortBy === "state"} dir={sortDir}>
                State / City
              </SortableHeader>
              <th className="p-3 font-medium">Program (ALN)</th>
              <th className="p-3 font-medium">Awarding Agency</th>
              <SortableHeader href={sortHref("amount")} active={sortBy === "amount"} dir={sortDir}>
                Amount
              </SortableHeader>
              <SortableHeader href={sortHref("start_date")} active={sortBy === "start_date"} dir={sortDir}>
                Start Date
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-navy-950/10 last:border-0">
                <td className="p-3 font-medium text-navy-950">{r.recipient_name}</td>
                <td className="p-3 text-ink/70">
                  {r.state ?? "—"}
                  {r.city ? ` · ${r.city}` : ""}
                </td>
                <td className="p-3 font-mono text-xs text-ink/70">{r.program_number ?? "—"}</td>
                <td className="p-3 text-ink/70">{r.awarding_agency ?? "—"}</td>
                <td className="p-3 font-semibold text-navy-900">{formatMoney(r.amount)}</td>
                <td className="p-3 text-ink/70">{formatDate(r.start_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-sm text-ink/50">
            {filters.state || filters.program
              ? "No grant awards match these filters."
              : "No grant awards synced yet — run /api/sync-grants once a Supabase project and CRON_SECRET are configured."}
          </p>
        )}
      </div>
    </section>
  );
}
