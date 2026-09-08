export type MatchExplanation = {
  viaTrackedNaics: boolean;
  label: string;
};

/** Human-readable reason this notice is in the pipeline. Unlike BidHawk,
 * this app has no title-keyword pass -- NAICS codes here name the trade
 * directly, so the NAICS code alone is the whole explanation. */
export function explainNaicsMatch(
  naics: string | null | undefined,
  trackedNaics: Iterable<string>
): MatchExplanation {
  const viaTrackedNaics = Boolean(naics && new Set(trackedNaics).has(naics));
  if (!naics) {
    return { viaTrackedNaics: false, label: "No NAICS code on this notice" };
  }
  return {
    viaTrackedNaics,
    label: viaTrackedNaics ? `NAICS ${naics}` : `NAICS ${naics} (untracked)`,
  };
}
