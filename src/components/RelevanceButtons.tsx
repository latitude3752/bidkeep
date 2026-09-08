"use client";

import { useTransition } from "react";
import { markOpportunityRelevance } from "@/app/app/opportunities/relevance-actions";

export default function RelevanceButtons({
  opportunityId,
  vote,
}: {
  opportunityId: string;
  vote: boolean | null;
}) {
  const [pending, start] = useTransition();

  return (
    <span className="mt-1 flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => markOpportunityRelevance(opportunityId, true))}
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          vote === true
            ? "bg-navy-950 text-cream"
            : "border border-navy-950/20 text-navy-950/70 hover:border-navy-950/40"
        }`}
      >
        Useful
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => markOpportunityRelevance(opportunityId, false))}
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          vote === false
            ? "bg-navy-950 text-cream"
            : "border border-navy-950/20 text-navy-950/70 hover:border-navy-950/40"
        }`}
      >
        Junk
      </button>
    </span>
  );
}
