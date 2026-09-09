import { login } from "@/app/admin/actions";

export const metadata = { title: "Admin Login | BidKeep" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/admin/opportunities";

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-bold text-navy-950">Admin sign-in</h1>
      <p className="mt-2 text-sm text-ink/60">
        Private opportunity-tracking dashboard.
      </p>
      <form action={login} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="password" className="text-sm font-medium text-navy-950">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            className="mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </div>
        {params.error === "locked" && (
          <p className="text-sm text-red-600">
            Too many failed attempts. Try again in a few minutes.
          </p>
        )}
        {params.error === "1" && (
          <p className="text-sm text-red-600">Incorrect password.</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-cream hover:bg-navy-900"
        >
          Sign in
        </button>
      </form>
    </section>
  );
}
