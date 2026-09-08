import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCompany } from "@/lib/subscriber-org";
import {
  computeQuoteWorksheet,
  type QuoteLineItem,
  type QuoteWorksheetResult,
} from "@/lib/quote-worksheet";

export async function getQuoteWorksheet(
  opportunityId: string,
  companyName: string
): Promise<{ result: QuoteWorksheetResult; notes: string | null } | null> {
  const key = normalizeCompany(companyName);
  if (!key) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quote_worksheets")
    .select("line_items, overhead_pct, profit_pct, notes")
    .eq("opportunity_id", opportunityId)
    .eq("company_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    result: computeQuoteWorksheet({
      lineItems: data.line_items as QuoteLineItem[],
      overheadPct: data.overhead_pct,
      profitPct: data.profit_pct,
    }),
    notes: data.notes,
  };
}

export async function saveQuoteWorksheet(
  opportunityId: string,
  companyName: string,
  input: { lineItems: QuoteLineItem[]; overheadPct: number; profitPct: number; notes: string }
): Promise<void> {
  const key = normalizeCompany(companyName);
  if (!key) throw new Error("Company is required.");
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("quote_worksheets").upsert(
    {
      opportunity_id: opportunityId,
      company_key: key,
      line_items: input.lineItems,
      overhead_pct: input.overheadPct,
      profit_pct: input.profitPct,
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "opportunity_id,company_key" }
  );
  if (error) throw new Error(error.message);
}
