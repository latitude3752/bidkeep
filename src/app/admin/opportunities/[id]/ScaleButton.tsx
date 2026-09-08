"use client";

import { useTransition } from "react";
import { refreshOpportunityScale } from "../actions";

export default function ScaleButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => refreshOpportunityScale(id))}
      className="rounded-full border border-navy-950/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy-950/70 hover:border-navy-950/40 disabled:opacity-50"
    >
      {isPending ? "Checking…" : "Refresh scale classification"}
    </button>
  );
}
