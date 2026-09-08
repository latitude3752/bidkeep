"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSeat } from "@/lib/current-seat";
import { saveQuoteWorksheet as persistQuoteWorksheet } from "@/lib/quote-worksheets-store";
import type { QuoteLineItem } from "@/lib/quote-worksheet";

export async function saveQuoteWorksheetAction(
  opportunityId: string,
  input: { lineItems: QuoteLineItem[]; overheadPct: number; profitPct: number; notes: string }
): Promise<{ ok: boolean; error?: string }> {
  const seat = await getCurrentSeat();
  if (!seat?.company) return { ok: false, error: "Not signed in." };
  try {
    await persistQuoteWorksheet(opportunityId, seat.company, input);
    revalidatePath(`/app/opportunities/${opportunityId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}
