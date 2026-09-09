import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { PILOT_MS } from "@/lib/subscriber-org";
import { listActiveSeats } from "@/lib/subscriber-seats";
import { provisionSeat, revokeSeatAction } from "./actions";

export const metadata = { title: "Subscribers | Admin" };
export const dynamic = "force-dynamic";

function defaultActiveUntilValue(): string {
  const d = new Date(Date.now() + PILOT_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatUntil(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const seats = await listActiveSeats();
  const defaultUntil = defaultActiveUntilValue();

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Pilot subscribers</h1>
          <p className="mt-1 text-sm text-ink/60">
            Up to five seats per company, any number of companies. Provision
            after Stripe emails you.
          </p>
        </div>
        <Link
          href="/admin/opportunities"
          className="text-sm font-medium text-ink/50 underline hover:text-ink"
        >
          ← Pipeline
        </Link>
      </div>

      {params.error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {params.error}
        </p>
      )}

      {params.created === "1" && params.password && (
        <div className="mt-6 rounded-xl border border-gold-500/40 bg-gold-500/15 p-4 text-sm text-navy-950">
          <p className="font-semibold">Copy this password now. It will not be shown again.</p>
          {params.email && (
            <p className="mt-2 text-ink/70">
              Email: <span className="font-mono">{params.email}</span>
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-ink/70">
            Password: <span className="font-mono">{params.password}</span>
            <CopyButton value={params.password} />
          </p>
          {params.emailSent === "0" && (
            <p className="mt-2 text-ink/70">Welcome email was not sent (SMTP unset).</p>
          )}
        </div>
      )}

      <form
        action={provisionSeat}
        className="mt-8 grid gap-3 rounded-xl border border-navy-950/10 bg-white p-5 sm:grid-cols-2"
      >
        <label className="text-sm font-medium text-ink/80">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            className="mt-1 block w-full rounded-lg border border-navy-950/15 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </label>
        <label className="text-sm font-medium text-ink/80">
          Name
          <input
            name="name"
            required
            className="mt-1 block w-full rounded-lg border border-navy-950/15 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </label>
        <label className="text-sm font-medium text-ink/80">
          Company
          <input
            name="company"
            required
            className="mt-1 block w-full rounded-lg border border-navy-950/15 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </label>
        <label className="text-sm font-medium text-ink/80">
          Role
          <select
            name="role"
            defaultValue="owner"
            className="mt-1 block w-full rounded-lg border border-navy-950/15 px-3 py-2 text-sm outline-none focus:border-gold-500"
          >
            <option value="owner">owner</option>
            <option value="member">member</option>
          </select>
        </label>
        <label className="text-sm font-medium text-ink/80 sm:col-span-2">
          Active until
          <input
            name="active_until"
            type="datetime-local"
            defaultValue={defaultUntil}
            required
            className="mt-1 block w-full max-w-xs rounded-lg border border-navy-950/15 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-navy-950 px-5 py-2 text-sm font-semibold text-cream hover:bg-navy-900"
          >
            Provision seat
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
        {seats.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">No active seats.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-navy-950/10 bg-navy-950/[0.03] text-ink/50">
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Company</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Active until</th>
                <th className="p-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {seats.map((seat) => (
                <tr key={seat.id} className="border-b border-navy-950/10 last:border-0">
                  <td className="p-4 font-mono text-xs text-ink/80">{seat.email}</td>
                  <td className="p-4 text-ink/70">{seat.company ?? "—"}</td>
                  <td className="p-4 text-ink/70">{seat.role}</td>
                  <td className="p-4 text-ink/70">{formatUntil(seat.active_until)}</td>
                  <td className="p-4 text-right">
                    <form action={revokeSeatAction}>
                      <input type="hidden" name="id" value={seat.id} />
                      <button type="submit" className="text-xs font-medium text-red-600/80 underline">
                        Revoke
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
