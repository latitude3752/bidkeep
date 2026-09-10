import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";

export const metadata = { title: "State & Local Bids | BidKeep" };
export const dynamic = "force-dynamic";

type GprRow = {
  id: string;
  title: string;
  agency_name: string | null;
  government_type: string | null;
  posting_date: string | null;
  closing_date: string | null;
  bid_process_type: string | null;
  detail_url: string;
};

type TxRow = {
  id: string;
  title: string;
  agency_name: string | null;
  status_name: string | null;
  response_due: string | null;
  response_time: string | null;
  detail_url: string;
};

type BonfireRow = {
  id: string;
  title: string;
  state: string | null;
  date_open: string | null;
  date_close: string | null;
  search_url: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatGovType(type: string | null): string {
  switch (type) {
    case "county":
      return "County";
    case "city":
      return "City";
    case "K-12":
      return "School board";
    case "state":
      return "State";
    case "other":
      return "Other";
    default:
      return type ?? "—";
  }
}

async function getOpenGprOpportunities(): Promise<GprRow[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("gpr_opportunities")
    .select("id, title, agency_name, government_type, posting_date, closing_date, bid_process_type, detail_url")
    .eq("status", "Open")
    .order("closing_date", { ascending: true })
    .limit(200);
  return (data ?? []) as GprRow[];
}

async function getOpenTxEsbdOpportunities(): Promise<TxRow[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("tx_esbd_opportunities")
    .select("id, title, agency_name, status_name, response_due, response_time, detail_url")
    .order("response_due", { ascending: true })
    .limit(200);
  return (data ?? []) as TxRow[];
}

async function getOpenBonfireOpportunities(): Promise<BonfireRow[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("bonfire_opportunities")
    .select("id, title, state, date_open, date_close, search_url")
    .gte("date_close", new Date().toISOString())
    .order("date_close", { ascending: true })
    .limit(200);
  return (data ?? []) as BonfireRow[];
}

export default async function LocalBidsPage() {
  const [gprRows, txRows, bonfireRows] = await Promise.all([
    getOpenGprOpportunities(),
    getOpenTxEsbdOpportunities(),
    getOpenBonfireOpportunities(),
  ]);

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">State & local bids</h1>
          <p className="mt-1 text-sm text-ink/60">
            Georgia and Texas state, county, city, and school-board facilities
            solicitations — plus a broader, thinner net across other states.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/app/opportunities"
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

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-navy-950">
          Georgia — {gprRows.length} open listing{gprRows.length === 1 ? "" : "s"}
        </h2>
        <div className="mt-2 rounded-lg border border-navy-950/10 bg-navy-950/[0.03] p-4 text-sm text-ink/70">
          Sourced directly from the Georgia Procurement Registry — the state&apos;s own
          public bid-advertising system, which by law covers every Georgia state
          agency, county, city, and school board. Full detail (agency, buyer contact,
          documents) lives on each listing&apos;s GPR page.
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-950/10 text-left text-xs uppercase tracking-wide text-ink/40">
                <th className="p-3">Title</th>
                <th className="p-3">Agency</th>
                <th className="p-3">Government</th>
                <th className="p-3">Closes</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {gprRows.map((row) => (
                <tr key={row.id} className="border-b border-navy-950/10 last:border-0">
                  <td className="p-3 font-medium text-navy-950">{row.title}</td>
                  <td className="p-3 text-ink/70">{row.agency_name ?? "—"}</td>
                  <td className="p-3 text-ink/70">{formatGovType(row.government_type)}</td>
                  <td className="p-3 text-ink/70">{formatDate(row.closing_date)}</td>
                  <td className="p-3 text-right">
                    <a
                      href={row.detail_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gold-600 underline hover:text-gold-500"
                    >
                      View on GPR ↗
                    </a>
                  </td>
                </tr>
              ))}
              {gprRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-ink/50">
                    No open listings synced yet — check back after the next sync.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-navy-950">
          Texas — {txRows.length} open listing{txRows.length === 1 ? "" : "s"}
        </h2>
        <div className="mt-2 rounded-lg border border-navy-950/10 bg-navy-950/[0.03] p-4 text-sm text-ink/70">
          Sourced directly from the Texas Electronic State Business Daily (ESBD) —
          the state&apos;s own public bid-advertising system, no sign-in required,
          covering state agencies, higher ed, and local governments (cities, counties,
          school districts). Filtered to facilities-trade keywords.
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-950/10 text-left text-xs uppercase tracking-wide text-ink/40">
                <th className="p-3">Title</th>
                <th className="p-3">Agency</th>
                <th className="p-3">Status</th>
                <th className="p-3">Due</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {txRows.map((row) => (
                <tr key={row.id} className="border-b border-navy-950/10 last:border-0">
                  <td className="p-3 font-medium text-navy-950">{row.title}</td>
                  <td className="p-3 text-ink/70">{row.agency_name ?? "—"}</td>
                  <td className="p-3 text-ink/70">{row.status_name ?? "—"}</td>
                  <td className="p-3 text-ink/70">
                    {row.response_due ?? "—"}
                    {row.response_time ? ` @ ${row.response_time}` : ""}
                  </td>
                  <td className="p-3 text-right">
                    <a
                      href={row.detail_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gold-600 underline hover:text-gold-500"
                    >
                      View on ESBD ↗
                    </a>
                  </td>
                </tr>
              ))}
              {txRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-ink/50">
                    No open listings synced yet — check back after the next sync.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-navy-950">
          Other states (beta) — {bonfireRows.length} open listing{bonfireRows.length === 1 ? "" : "s"}
        </h2>
        <div className="mt-2 rounded-lg border border-navy-950/10 bg-navy-950/[0.03] p-4 text-sm text-ink/70">
          <strong className="text-navy-950">Beta, title/state/dates only.</strong>{" "}
          This feed comes from Bonfire, a separate third-party procurement platform
          many state and local agencies outside Georgia use — not from SAM.gov. Their
          public preview only exposes the title, state, and open/close dates; agency
          name, description, and bid documents require Bonfire&apos;s own (paid)
          Premium Vendor account. Use the search link on each row to look it up there.
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-950/10 text-left text-xs uppercase tracking-wide text-ink/40">
                <th className="p-3">Title</th>
                <th className="p-3">State</th>
                <th className="p-3">Opens</th>
                <th className="p-3">Closes</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {bonfireRows.map((row) => (
                <tr key={row.id} className="border-b border-navy-950/10 last:border-0">
                  <td className="p-3 font-medium text-navy-950">{row.title}</td>
                  <td className="p-3 text-ink/70">{row.state ?? "—"}</td>
                  <td className="p-3 text-ink/70">{formatDate(row.date_open)}</td>
                  <td className="p-3 text-ink/70">{formatDate(row.date_close)}</td>
                  <td className="p-3 text-right">
                    <a
                      href={row.search_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gold-600 underline hover:text-gold-500"
                    >
                      Search on Bonfire ↗
                    </a>
                  </td>
                </tr>
              ))}
              {bonfireRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-ink/50">
                    No open listings synced yet — check back after the next sync.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
