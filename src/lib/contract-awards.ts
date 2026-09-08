import "server-only";

const CONTRACT_AWARDS_URL = "https://api.sam.gov/contract-awards/v1/search";

export type ComparableAward = {
  piid: string | null;
  awardeeName: string | null;
  awardType: string | null;
  dollars: number | null;
  dateSigned: string | null;
  contractingOffice: string | null;
  isSmallBusiness: boolean;
  isSdvosb: boolean;
};

export type PriceResearchResult = {
  query: { naicsCode: string | null; keyword: string | null };
  comps: ComparableAward[];
  stats: { count: number; min: number; max: number; avg: number } | null;
  researchedAt: string;
};

/** DLA titles are "PSC--ITEM NAME" (e.g. "53--GASKET"); other agencies just
 * use a plain descriptive title. Extract the most useful search keyword. */
export function extractSearchKeyword(title: string): string {
  const afterDashes = title.split("--")[1] ?? title;
  return afterDashes.split(",")[0].trim().slice(0, 60);
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type RawContractAward = {
  contractId?: { piid?: string };
  coreData?: {
    awardOrIDVType?: { name?: string };
    federalOrganization?: {
      contractingInformation?: { contractingOffice?: { name?: string } };
    };
  };
  awardDetails?: {
    dollars?: {
      actionObligation?: unknown;
      baseAndAllOptionsValue?: unknown;
      totalEstimatedOrderValue?: unknown;
    };
    totalContractDollars?: { totalActionObligation?: unknown };
    awardeeData?: {
      awardeeHeader?: { awardeeName?: string };
      socioEconomicData?: {
        smallBusiness?: string;
        serviceDisabledVeteranOwnedBusiness?: string;
      };
    };
    dates?: { dateSigned?: string };
  };
};

function normalizeAward(raw: unknown): ComparableAward {
  const award = raw as RawContractAward;
  const details = award?.awardDetails ?? {};
  const dollars =
    toNumber(details?.dollars?.actionObligation) ??
    toNumber(details?.totalContractDollars?.totalActionObligation) ??
    toNumber(details?.dollars?.baseAndAllOptionsValue) ??
    toNumber(details?.dollars?.totalEstimatedOrderValue);

  const socio = details?.awardeeData?.socioEconomicData;

  return {
    piid: award?.contractId?.piid ?? null,
    awardeeName: details?.awardeeData?.awardeeHeader?.awardeeName ?? null,
    awardType: award?.coreData?.awardOrIDVType?.name ?? null,
    dollars,
    dateSigned: details?.dates?.dateSigned ?? null,
    contractingOffice:
      award?.coreData?.federalOrganization?.contractingInformation?.contractingOffice?.name ?? null,
    isSmallBusiness: socio?.smallBusiness === "YES",
    isSdvosb: socio?.serviceDisabledVeteranOwnedBusiness === "YES",
  };
}

/** Searches SAM.gov's Contract Awards API for comparable past awards, using
 * NAICS + a free-text keyword derived from the opportunity title. Returns up
 * to 8 most-recent comps plus summary $ stats. Not unit-price-level detail —
 * these are award/order total dollar amounts, useful as a ballpark anchor. */
export async function searchComparableAwards(
  naicsCode: string | null,
  keyword: string | null
): Promise<PriceResearchResult> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) throw new Error("SAM_GOV_API_KEY is not set");
  if (!naicsCode && !keyword) {
    throw new Error("Need at least a NAICS code or keyword to search");
  }

  const params = new URLSearchParams({ api_key: apiKey, limit: "20" });
  if (naicsCode) params.set("naicsCode", naicsCode);
  if (keyword) params.set("q", keyword);

  const res = await fetch(`${CONTRACT_AWARDS_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Contract Awards API error ${res.status}`);
  }
  const data = await res.json();
  const raw = (data?.awardSummary ?? []) as unknown[];

  const comps = raw
    .map(normalizeAward)
    .sort((a, b) => (b.dateSigned ?? "").localeCompare(a.dateSigned ?? ""))
    .slice(0, 8);

  const values = comps.map((c) => c.dollars).filter((v): v is number => v !== null);
  const stats =
    values.length > 0
      ? {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        }
      : null;

  return {
    query: { naicsCode, keyword },
    comps,
    stats,
    researchedAt: new Date().toISOString(),
  };
}
