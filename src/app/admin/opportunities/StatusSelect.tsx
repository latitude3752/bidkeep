"use client";

import { useTransition } from "react";
import { updateOpportunityStatus } from "./actions";
import { OPPORTUNITY_STATUSES } from "@/lib/opportunities";

export default function StatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => {
          updateOpportunityStatus(id, next);
        });
      }}
      className="rounded-full border border-navy-950/20 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-navy-950 disabled:opacity-50"
    >
      {OPPORTUNITY_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
