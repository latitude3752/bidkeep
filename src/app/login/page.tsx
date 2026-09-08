import Link from "next/link";
import { login } from "@/app/login/actions";
import { OPERATOR } from "@/lib/operator";

export const metadata = { title: `Sign in | ${OPERATOR.productName}` };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-bold text-navy-950">Sign in</h1>
      <p className="mt-2 text-sm text-ink/60">
        Private opportunity-tracking dashboard. After you pay, we email a
        one-time password to the checkout address the same business day.
      </p>
      <form action={login} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-navy-950">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            className="mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium text-navy-950">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </div>
        {params.error === "locked" && (
          <p className="text-sm text-red-600">
            Too many failed attempts. Try again in a few minutes.
          </p>
        )}
        {params.error === "expired" && (
          <p className="text-sm text-red-600">Your subscription has ended.</p>
        )}
        {params.error === "1" && (
          <p className="text-sm text-red-600">Incorrect email or password.</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-cream hover:bg-navy-900"
        >
          Sign in
        </button>
      </form>
      <p className="mt-4 text-sm text-ink/60">
        <Link
          href="/login/reset"
          className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
        >
          Forgot password?
        </Link>
      </p>
      <p className="mt-4 text-sm text-ink/50">
        No account yet?{" "}
        <Link
          href="/start"
          className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
        >
          Subscribe for ${OPERATOR.monthlyPriceUsd}/mo
        </Link>
        {" · "}
        <Link
          href="/demo"
          className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
        >
          Preview the dashboard
        </Link>
      </p>
    </section>
  );
}
