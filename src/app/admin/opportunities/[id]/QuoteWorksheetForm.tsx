"use client";

import { useMemo, useState, useTransition } from "react";
import { saveQuoteWorksheetAction } from "./quote-actions";
import {
  computeQuoteWorksheet,
  defaultLineItems,
  DEFAULT_OVERHEAD_PCT,
  DEFAULT_PROFIT_PCT,
  QUOTE_LINE_CATEGORIES,
  QUOTE_LINE_CATEGORY_LABELS,
  type QuoteLineItem,
  type QuoteWorksheetResult,
} from "@/lib/quote-worksheet";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export default function QuoteWorksheetForm({
  opportunityId,
  saved,
  savedNotes,
}: {
  opportunityId: string;
  saved: QuoteWorksheetResult | null;
  savedNotes: string | null;
}) {
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(saved?.lineItems ?? defaultLineItems());
  const [overheadPct, setOverheadPct] = useState(saved?.overheadPct ?? DEFAULT_OVERHEAD_PCT);
  const [profitPct, setProfitPct] = useState(saved?.profitPct ?? DEFAULT_PROFIT_PCT);
  const [notes, setNotes] = useState(savedNotes ?? "");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ savedAt: string } | { error: string } | null>(null);

  const live = useMemo(
    () => computeQuoteWorksheet({ lineItems, overheadPct, profitPct }),
    [lineItems, overheadPct, profitPct]
  );

  function updateLine(index: number, patch: Partial<QuoteLineItem>) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }

  function addLine() {
    setLineItems((prev) => [...prev, { category: "other", description: "", qty: 1, unitCost: 0 }]);
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className="text-sm text-ink/60">
        Read the solicitation and fill in what actually applies — leave a category at $0 if it
        doesn&apos;t (a service contract may or may not include shipping, for example). This is a
        drafting aid for your own pricing decision, not a submission-ready quote.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-950/10 text-ink/50">
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 pr-3 font-medium">Qty</th>
              <th className="py-2 pr-3 font-medium">Unit cost</th>
              <th className="py-2 pr-3 font-medium">Extended</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} className="border-b border-navy-950/5 last:border-0">
                <td className="py-2 pr-3">
                  <select
                    value={li.category}
                    onChange={(e) => updateLine(i, { category: e.target.value as QuoteLineItem["category"] })}
                    className="rounded border border-navy-950/20 px-2 py-1 text-xs outline-none focus:border-gold-500"
                  >
                    {QUOTE_LINE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {QUOTE_LINE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={li.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    placeholder="What this line covers"
                    className="w-full rounded border border-navy-950/20 px-2 py-1 text-xs outline-none focus:border-gold-500"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={li.qty}
                    onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                    className="w-20 rounded border border-navy-950/20 px-2 py-1 text-xs outline-none focus:border-gold-500"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={li.unitCost}
                    onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })}
                    className="w-24 rounded border border-navy-950/20 px-2 py-1 text-xs outline-none focus:border-gold-500"
                  />
                </td>
                <td className="py-2 pr-3 font-mono">{formatMoney(li.qty * li.unitCost)}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-xs text-ink/40 hover:text-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addLine}
        className="mt-2 text-xs font-medium text-navy-900 underline hover:text-navy-950"
      >
        + Add line item
      </button>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:w-64">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink/40">Overhead %</span>
          <input
            type="number"
            min={0}
            step="0.1"
            value={overheadPct}
            onChange={(e) => setOverheadPct(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-1.5 text-sm outline-none focus:border-gold-500"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink/40">Profit %</span>
          <input
            type="number"
            min={0}
            step="0.1"
            value={profitPct}
            onChange={(e) => setProfitPct(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-1.5 text-sm outline-none focus:border-gold-500"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wide text-ink/40">Notes (not shown on the proposal)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-navy-950/20 px-3 py-2 text-sm outline-none focus:border-gold-500"
        />
      </label>

      <div className="mt-5 rounded-lg bg-navy-950/[0.03] p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink/60">Cost basis (all line items)</span>
          <span className="font-mono">{formatMoney(live.costBasis)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink/60">+ Overhead ({overheadPct}%)</span>
          <span className="font-mono">{formatMoney(live.overheadAmount)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-navy-950/10 pb-2">
          <span className="text-ink/60">Burdened cost</span>
          <span className="font-mono">{formatMoney(live.burdenedCost)}</span>
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-ink/60">+ Profit ({profitPct}%)</span>
          <span className="font-mono">{formatMoney(live.profitAmount)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-base font-bold text-navy-950">
          <span>Total ask</span>
          <span className="font-mono">{formatMoney(live.totalAsk)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveQuoteWorksheetAction(opportunityId, {
                lineItems,
                overheadPct,
                profitPct,
                notes,
              });
              setStatus(result.ok ? { savedAt: new Date().toLocaleString() } : { error: result.error ?? "Failed to save." });
            })
          }
          className="rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-cream hover:bg-navy-900 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save worksheet"}
        </button>
        {status && "savedAt" in status && <span className="text-xs text-ink/40">Saved {status.savedAt}</span>}
        {status && "error" in status && <span className="text-xs text-red-600">{status.error}</span>}
      </div>
    </div>
  );
}
