import { describe, expect, it } from "vitest";
import { computeQuoteWorksheet, defaultLineItems, type QuoteLineItem } from "./quote-worksheet";

function items(overrides: Partial<QuoteLineItem>[]): QuoteLineItem[] {
  return overrides.map((o) => ({ category: "labor", description: "", qty: 0, unitCost: 0, ...o }));
}

describe("computeQuoteWorksheet", () => {
  it("stacks overhead on cost, then profit on the burdened cost", () => {
    const result = computeQuoteWorksheet({
      lineItems: items([
        { category: "labor", qty: 1, unitCost: 1000 },
        { category: "shipping", qty: 1, unitCost: 100 },
      ]),
      overheadPct: 10,
      profitPct: 20,
    });

    expect(result.costBasis).toBe(1100);
    expect(result.overheadAmount).toBe(110);
    expect(result.burdenedCost).toBe(1210);
    expect(result.profitAmount).toBe(242);
    expect(result.totalAsk).toBe(1452);
    expect(result.markupAmount).toBe(352);
  });

  it("does not apply profit to raw cost directly", () => {
    // If profit were applied to costBasis instead of burdenedCost, totalAsk
    // would be 1000 * 1.10 * 1.10 rounding differently than cost-on-cost
    // stacking -- this pins the intended order of operations.
    const withOverhead = computeQuoteWorksheet({
      lineItems: items([{ category: "labor", qty: 1, unitCost: 1000 }]),
      overheadPct: 10,
      profitPct: 10,
    });
    const wrongIfProfitOnRawCost = 1000 + 1000 * 0.1;
    expect(withOverhead.totalAsk).not.toBe(wrongIfProfitOnRawCost);
    expect(withOverhead.totalAsk).toBe(1210);
  });

  it("sums quantity times unit cost across every line item", () => {
    const result = computeQuoteWorksheet({
      lineItems: items([
        { category: "labor", qty: 10, unitCost: 75 },
        { category: "materials", qty: 3, unitCost: 200 },
        { category: "other", qty: 1, unitCost: 250 },
      ]),
      overheadPct: 0,
      profitPct: 0,
    });
    // 10*75 + 3*200 + 1*250 = 750 + 600 + 250
    expect(result.costBasis).toBe(1600);
    expect(result.totalAsk).toBe(1600);
  });

  it("returns zero markup percent when cost basis is zero", () => {
    const result = computeQuoteWorksheet({
      lineItems: items([{ category: "labor", qty: 0, unitCost: 0 }]),
      overheadPct: 10,
      profitPct: 15,
    });
    expect(result.markupPercent).toBe(0);
  });
});

describe("defaultLineItems", () => {
  it("covers all four categories with labor/materials seeded and shipping/other left at zero qty", () => {
    const defaults = defaultLineItems();
    expect(defaults.map((li) => li.category)).toEqual(["labor", "materials", "shipping", "other"]);
    expect(defaults.find((li) => li.category === "labor")?.qty).toBe(1);
    expect(defaults.find((li) => li.category === "materials")?.qty).toBe(1);
    expect(defaults.find((li) => li.category === "shipping")?.qty).toBe(0);
    expect(defaults.find((li) => li.category === "other")?.qty).toBe(0);
  });
});
