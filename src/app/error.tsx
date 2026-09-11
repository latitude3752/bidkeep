"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-navy-950">Something went wrong</h1>
      <p className="mt-3 text-sm text-ink/60">
        We hit an unexpected error loading this page. Try again, or head back home.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-navy-950 px-5 py-2 text-sm font-semibold text-cream hover:bg-navy-900"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-navy-950/15 px-5 py-2 text-sm font-semibold text-navy-950 hover:bg-navy-950/5"
        >
          Go home
        </Link>
      </div>
    </section>
  );
}
