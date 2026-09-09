"use client";

import { useState, useTransition } from "react";
import { researchOpportunityPrice } from "../actions";

export default function ResearchButton({ id, hasResearch }: { id: string; hasResearch: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await researchOpportunityPrice(id);
            setError(result.ok ? null : result.error ?? "Failed to fetch price research.");
          })
        }
        className="shrink-0 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-navy-950 shadow-sm transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Researching…" : hasResearch ? "Refresh price research" : "Research comparable awards"}
      </button>
      {error && <span className="max-w-xs text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}
