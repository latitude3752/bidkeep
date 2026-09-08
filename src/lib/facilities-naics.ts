/** Seed NAICS for the facilities / building-services vertical.
 * Core codes are the product's named trades; adjacents commonly appear
 * on the same SAM.gov notices (pest, waste, temp labor, systems). */

export type FacilitiesNaics = { code: string; label: string; core?: boolean };

export const FACILITIES_NAICS_SEED: FacilitiesNaics[] = [
  { code: "561210", label: "Facilities Support Services", core: true },
  { code: "561612", label: "Security Guards and Patrol Services", core: true },
  { code: "561720", label: "Janitorial Services", core: true },
  { code: "561730", label: "Landscaping Services", core: true },
  { code: "561611", label: "Investigation Services" },
  { code: "561613", label: "Armored Car Services" },
  { code: "561621", label: "Security Systems Services (except Locksmiths)" },
  { code: "561710", label: "Exterminating and Pest Control Services" },
  { code: "561740", label: "Carpet and Upholstery Cleaning Services" },
  { code: "561790", label: "Other Services to Buildings and Dwellings" },
  { code: "561320", label: "Temporary Help Services" },
  { code: "561990", label: "All Other Support Services" },
  { code: "562111", label: "Solid Waste Collection" },
  { code: "562119", label: "Other Waste Collection" },
  { code: "562910", label: "Remediation Services" },
  { code: "811310", label: "Commercial and Industrial Machinery and Equipment (except Automotive and Electronic) Repair and Maintenance" },
];

export const FACILITIES_CORE_NAICS = FACILITIES_NAICS_SEED.filter((row) => row.core).map(
  (row) => row.code
);

export const FACILITIES_GRANT_PROGRAMS_SEED: { aln: string; label: string }[] = [
  { aln: "10.766", label: "Community Facilities Loans and Grants" },
  { aln: "14.218", label: "Community Development Block Grants/Entitlement Grants" },
  { aln: "14.850", label: "Public and Indian Housing" },
  { aln: "14.872", label: "Public Housing Capital Fund" },
  { aln: "81.042", label: "Weatherization Assistance for Low-Income Persons" },
  { aln: "97.036", label: "Disaster Grants — Public Assistance (Presidentially Declared Disasters)" },
];
