// Federal Poverty Level (FPL) — public data published every year by the U.S.
// Department of Health & Human Services (HHS).
// Source: https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines
//
// These are the 2025 HHS Poverty Guidelines for the 48 contiguous states + DC.
// They are the most recently verified official figures and — importantly — the
// marketplace (ACA) uses the PRIOR year's guidelines to determine subsidy
// eligibility for a coverage year, so 2025 figures are exactly what governs
// 2026 Covered California / marketplace determinations.
//
// To update: replace EFFECTIVE_YEAR, BASE, and PER_ADDITIONAL_PERSON with the
// new official numbers. Everything downstream recomputes automatically. This is
// the single source of truth for all dollar thresholds in the app.

export const EFFECTIVE_YEAR = 2025;
export const FPL_SOURCE =
  'HHS 2025 Poverty Guidelines (48 contiguous states + DC), aspe.hhs.gov';

// 2025 guidelines: 1-person household = $15,650, +$5,500 per additional person.
const BASE_ONE_PERSON = 15650;
const PER_ADDITIONAL_PERSON = 5500;

/** Annual Federal Poverty Level for a given household size. */
export function fplForHousehold(householdSize: number): number {
  const size = Math.max(1, Math.floor(householdSize));
  return BASE_ONE_PERSON + (size - 1) * PER_ADDITIONAL_PERSON;
}

/** Income as a percentage of the FPL for that household size (rounded). */
export function fplPercent(annualIncome: number, householdSize: number): number {
  const fpl = fplForHousehold(householdSize);
  if (fpl <= 0) return 0;
  return Math.round((Math.max(0, annualIncome) / fpl) * 100);
}
