"use client";

import { useState, useTransition } from "react";
import { refreshOpportunityScale } from "../actions";

export default function ScaleButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshOpportunityScale(id);
            setError(result.ok ? null : result.error ?? "Failed to refresh scale classification.");
          })
        }
        className="rounded-full border border-navy-950/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy-950/70 hover:border-navy-950/40 disabled:opacity-50"
      >
        {isPending ? "Checking…" : "Refresh scale classification"}
      </button>
      {error && <span className="max-w-xs text-xs text-red-600">{error}</span>}
    </div>
  );
}
