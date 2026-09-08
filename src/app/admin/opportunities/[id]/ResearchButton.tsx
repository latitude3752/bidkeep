"use client";

import { useTransition } from "react";
import { researchOpportunityPrice } from "../actions";

export default function ResearchButton({ id, hasResearch }: { id: string; hasResearch: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => researchOpportunityPrice(id))}
      className="shrink-0 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-navy-950 shadow-sm transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "Researching…" : hasResearch ? "Refresh price research" : "Research comparable awards"}
    </button>
  );
}
