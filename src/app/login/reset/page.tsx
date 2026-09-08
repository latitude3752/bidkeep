import Link from "next/link";
import { OPERATOR } from "@/lib/operator";
import { requestPasswordReset } from "./actions";

export const metadata = { title: `Reset password | ${OPERATOR.productName}` };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-bold text-navy-950">Reset password</h1>
      {params.sent === "1" ? (
        <p className="mt-4 text-sm text-ink/70">
          If that email has a {OPERATOR.productName} seat, we sent a new
          password. Check your inbox, then{" "}
          <Link
            href="/login"
            className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
          >
            sign in
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink/60">
            Enter the email you used at checkout. There is no public signup —
            seats are created after payment.
          </p>
          <form action={requestPasswordReset} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-navy-950">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                className="mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-2 text-sm outline-none focus:border-gold-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-cream hover:bg-navy-900"
            >
              Email a new password
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-sm text-ink/50">
        Stuck? {OPERATOR.email}
      </p>
    </section>
  );
}
