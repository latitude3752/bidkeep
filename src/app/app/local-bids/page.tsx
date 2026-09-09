import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";

export const metadata = { title: "State & Local Bids | BidKeep" };
export const dynamic = "force-dynamic";

type Row = {
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

async function getOpenBonfireOpportunities(): Promise<Row[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("bonfire_opportunities")
    .select("id, title, state, date_open, date_close, search_url")
    .gte("date_close", new Date().toISOString())
    .order("date_close", { ascending: true })
    .limit(200);
  return (data ?? []) as Row[];
}

export default async function LocalBidsPage() {
  const rows = await getOpenBonfireOpportunities();

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">
            State & local bids (beta)
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {rows.length} open listing{rows.length === 1 ? "" : "s"} — sourced from Bonfire
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

      <div className="mt-4 rounded-lg border border-navy-950/10 bg-navy-950/[0.03] p-4 text-sm text-ink/70">
        <strong className="text-navy-950">Beta, title/state/dates only.</strong>{" "}
        This feed comes from Bonfire, a separate third-party procurement
        platform many state and local agencies use — not from SAM.gov. Their
        public preview only exposes the title, state, and open/close dates;
        agency name, description, and bid documents require Bonfire&apos;s
        own (paid) Premium Vendor account. Use the search link on each row
        to look it up there.
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
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
            {rows.map((row) => (
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-ink/50">
                  No open listings synced yet — check back after the next sync.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
