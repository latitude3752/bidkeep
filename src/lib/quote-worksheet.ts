/** Generalized from fountain-city-capital's single-tenant, NSN-parts-reseller
 * quote worksheet: instead of three fixed cost buckets (item/shipping/other)
 * tied to physical-parts reselling, this is an itemized list of line items
 * across four categories that cover both product and service contracts. The
 * subscriber fills this in themselves against the solicitation's own terms
 * -- there's no automated extraction of "quoted servicing terms" from
 * notice text (see ADR discussion: no reliable general-purpose parser for
 * service terms across facilities solicitation styles, unlike
 * FCC's narrow DIBBS-format NSN regex parser). */

export const QUOTE_LINE_CATEGORIES = ["labor", "materials", "shipping", "other"] as const;
export type QuoteLineCategory = (typeof QUOTE_LINE_CATEGORIES)[number];

export const QUOTE_LINE_CATEGORY_LABELS: Record<QuoteLineCategory, string> = {
  labor: "Labor / service hours",
  materials: "Materials / parts",
  shipping: "Shipping / freight",
  other: "Travel, training, warranty & support",
};

export type QuoteLineItem = {
  category: QuoteLineCategory;
  description: string;
  qty: number;
  unitCost: number;
};

export type QuoteWorksheetInputs = {
  lineItems: QuoteLineItem[];
  overheadPct: number;
  profitPct: number;
};

export type QuoteWorksheetResult = QuoteWorksheetInputs & {
  costBasis: number;
  overheadAmount: number;
  burdenedCost: number;
  profitAmount: number;
  totalAsk: number;
  markupAmount: number;
  markupPercent: number;
};

/** Default rates: 15% is the profit-margin benchmark DoD OIG uses when
 * reviewing whether pricing looks excessive, so it's a reasonable
 * ceiling-ish starting point rather than an arbitrary number. Overhead
 * defaults low (8%) since a lean shop without heavy services-firm
 * infrastructure carries far less indirect cost than the 15-40% typical of
 * professional services shops -- tune both to actual numbers. */
export const DEFAULT_OVERHEAD_PCT = 8;
export const DEFAULT_PROFIT_PCT = 15;

/** Starting line items for a fresh worksheet -- the "basic block" fallback
 * for solicitations that don't spell out service terms explicitly. All four
 * categories are shown up front (rather than only the ones a solicitation
 * happens to mention) so the subscriber consciously decides what applies --
 * e.g. shipping may or may not belong on a given service contract, and an
 * absent line item should be a deliberate zero, not a silent omission.
 * Labor and materials default to qty 1 since almost every quote has some of
 * both; shipping and the travel/training/warranty bucket default to qty 0
 * since they're the ones most likely to not apply. */
export function defaultLineItems(): QuoteLineItem[] {
  return [
    { category: "labor", description: "", qty: 1, unitCost: 0 },
    { category: "materials", description: "", qty: 1, unitCost: 0 },
    { category: "shipping", description: "", qty: 0, unitCost: 0 },
    { category: "other", description: "", qty: 0, unitCost: 0 },
  ];
}

/** Same cost-plus stacking as the worksheet this was generalized from:
 * overhead applied to direct line-item cost, profit applied to the fully
 * burdened cost (cost + overhead), not to raw cost. */
export function computeQuoteWorksheet(inputs: QuoteWorksheetInputs): QuoteWorksheetResult {
  const costBasis = inputs.lineItems.reduce((sum, li) => sum + li.qty * li.unitCost, 0);
  const overheadAmount = costBasis * (inputs.overheadPct / 100);
  const burdenedCost = costBasis + overheadAmount;
  const profitAmount = burdenedCost * (inputs.profitPct / 100);
  const totalAsk = burdenedCost + profitAmount;
  const markupAmount = totalAsk - costBasis;
  const markupPercent = costBasis > 0 ? (markupAmount / costBasis) * 100 : 0;

  return {
    ...inputs,
    costBasis,
    overheadAmount,
    burdenedCost,
    profitAmount,
    totalAsk,
    markupAmount,
    markupPercent,
  };
}
