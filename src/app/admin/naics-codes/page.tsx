import Link from "next/link";
import { getAllNaicsCodes } from "@netacracy/bid-core";
import { addNaicsCode, deleteNaicsCode, setNaicsCodeActive } from "./actions";

export const metadata = { title: "NAICS Codes | Admin" };
export const dynamic = "force-dynamic";

export default async function NaicsCodesPage() {
  const codes = await getAllNaicsCodes();

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Registered NAICS codes</h1>
          <p className="mt-1 text-sm text-ink/60">
            Only active codes are searched by the daily SAM.gov sync and shown on the
            public opportunities page.
          </p>
        </div>
        <Link
          href="/admin/opportunities"
          className="text-sm font-medium text-ink/50 underline hover:text-ink"
        >
          ← Pipeline
        </Link>
      </div>

      <form
        action={addNaicsCode}
        className="mt-8 flex flex-wrap items-end gap-3 rounded-xl border border-navy-950/10 bg-white p-5"
      >
        <label className="text-sm font-medium text-ink/80">
          Code
          <input
            name="code"
            placeholder="561720"
            pattern="\d{6}"
            required
            className="mt-1 block w-32 rounded-lg border border-navy-950/15 px-3 py-2 font-mono text-sm outline-none focus:border-gold-500"
          />
        </label>
        <label className="flex-1 text-sm font-medium text-ink/80">
          Label
          <input
            name="label"
            placeholder="Roofing Contractors"
            required
            className="mt-1 block w-full rounded-lg border border-navy-950/15 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-navy-950 px-5 py-2 text-sm font-semibold text-cream hover:bg-navy-900"
        >
          Add
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
        {codes.map((c, i) => (
          <div
            key={c.code}
            className={`flex items-center gap-4 p-4 text-sm ${
              i !== codes.length - 1 ? "border-b border-navy-950/10" : ""
            }`}
          >
            <span className="w-20 font-mono font-semibold text-gold-600">{c.code}</span>
            <span className="flex-1 text-ink/70">{c.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                c.active ? "bg-gold-500/20 text-gold-700" : "bg-ink/10 text-ink/50"
              }`}
            >
              {c.active ? "active" : "inactive"}
            </span>
            <form action={setNaicsCodeActive.bind(null, c.code, !c.active)}>
              <button type="submit" className="text-xs font-medium text-navy-900/70 underline">
                {c.active ? "Deactivate" : "Activate"}
              </button>
            </form>
            <form action={deleteNaicsCode.bind(null, c.code)}>
              <button type="submit" className="text-xs font-medium text-red-600/80 underline">
                Delete
              </button>
            </form>
          </div>
        ))}
        {codes.length === 0 && (
          <p className="p-6 text-sm text-ink/50">No NAICS codes registered yet.</p>
        )}
      </div>
    </section>
  );
}
