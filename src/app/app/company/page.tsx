import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSeat } from "@/lib/current-seat";
import { getCompanyProfile } from "@/lib/company-profiles";
import { SET_ASIDE_CERTIFICATIONS, SET_ASIDE_CERTIFICATION_LABELS } from "@/lib/opportunities";
import { saveCompanyProfile } from "./actions";

export const metadata = { title: "Company Profile | BidKeep" };

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-2 text-sm outline-none focus:border-gold-500";

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const seat = await getCurrentSeat();
  if (!seat?.company) redirect("/login");

  const profile = await getCompanyProfile(seat.company);
  const params = await searchParams;

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/app/opportunities" className="text-sm text-ink/50 hover:text-ink">
        ← Back to pipeline
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-navy-950">Company profile</h1>
      <p className="mt-2 text-sm text-ink/60">
        Used to fill in the quote worksheet and proposal on each opportunity — your own company
        info, UEI/CAGE, and certifications, instead of typing them in every time.
      </p>

      {params.saved === "1" && (
        <p className="mt-4 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
          Saved.
        </p>
      )}

      <form action={saveCompanyProfile} className="mt-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-navy-950">Company</label>
          <input
            type="text"
            value={seat.company}
            disabled
            className={`${INPUT_CLASS} bg-navy-950/[0.03] text-ink/60`}
          />
          <p className="mt-1 text-xs text-ink/40">
            Matches your account — contact us if this needs to change.
          </p>
        </div>

        <div>
          <label htmlFor="address" className="text-sm font-medium text-navy-950">
            Address
          </label>
          <input
            id="address"
            name="address"
            type="text"
            defaultValue={profile?.address ?? ""}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="uei" className="text-sm font-medium text-navy-950">
              UEI
            </label>
            <input
              id="uei"
              name="uei"
              type="text"
              defaultValue={profile?.uei ?? ""}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="cage" className="text-sm font-medium text-navy-950">
              CAGE code
            </label>
            <input
              id="cage"
              name="cage"
              type="text"
              defaultValue={profile?.cage ?? ""}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-navy-950">Certifications</legend>
          <p className="mt-1 text-xs text-ink/50">
            Used to flag whether you&apos;re eligible for a given opportunity&apos;s set-aside —
            check what you actually hold, we don&apos;t verify these.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SET_ASIDE_CERTIFICATIONS.map((cert) => (
              <label key={cert} className="flex items-center gap-2 text-sm text-ink/80">
                <input
                  type="checkbox"
                  name="certifications"
                  value={cert}
                  defaultChecked={profile?.certifications.includes(cert) ?? false}
                  className="h-4 w-4 rounded border-navy-950/30"
                />
                {SET_ASIDE_CERTIFICATION_LABELS[cert]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <h2 className="text-sm font-medium text-navy-950">Proposal contact</h2>
          <div className="mt-2 space-y-3">
            <input
              name="contactName"
              type="text"
              placeholder="Name"
              defaultValue={profile?.contactName ?? ""}
              className={INPUT_CLASS}
            />
            <input
              name="contactEmail"
              type="email"
              placeholder="Email"
              defaultValue={profile?.contactEmail ?? ""}
              className={INPUT_CLASS}
            />
            <input
              name="contactPhone"
              type="tel"
              placeholder="Phone"
              defaultValue={profile?.contactPhone ?? ""}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <button
          type="submit"
          className="inline-block rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-950 transition-colors hover:bg-gold-400"
        >
          Save
        </button>
      </form>
    </section>
  );
}
