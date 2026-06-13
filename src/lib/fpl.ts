// Federal Poverty Level (FPL) — public data published every year by the U.S.
// Department of Health & Human Services (HHS).
// Source: https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines
//
// These are the 2026 HHS Poverty Guidelines for the 48 contiguous states + DC,
// published in the Federal Register on Jan 15, 2026 (verified against
// aspe.hhs.gov). Medi-Cal / Medicaid (MAGI) uses the CURRENT-year guidelines, so
// 2026 figures govern Medi-Cal eligibility as of 2026.
//
// Nuance: the ACA marketplace uses the PRIOR year's guidelines for a coverage
// year (so 2026 Covered California subsidies technically reference the 2025
// table). We use this single 2026 table for both; the only effect is a ~2%
// shift at the very top (400% FPL) marketplace boundary — Medi-Cal, the
// higher-stakes pathway, is exact. (A future refinement could carry both tables.)
//
// To update next year: replace EFFECTIVE_YEAR, BASE, and PER_ADDITIONAL_PERSON
// with the new official numbers. Everything downstream recomputes automatically.

export const EFFECTIVE_YEAR = 2026;
export const FPL_SOURCE =
  'HHS 2026 Poverty Guidelines (48 contiguous states + DC), aspe.hhs.gov';

// 2026 guidelines: 1-person household = $15,960, +$5,680 per additional person.
const BASE_ONE_PERSON = 15960;
const PER_ADDITIONAL_PERSON = 5680;

/** Annual Federal Poverty Level for a given household size. */
export function fplForHousehold(householdSize: number): number {
  const raw = Number.isFinite(householdSize) ? householdSize : 1;
  // Clamp to a sane range so a huge/garbage household size can't produce a
  // non-finite FPL (which would serialize to null over the API).
  const size = Math.min(50, Math.max(1, Math.floor(raw)));
  return BASE_ONE_PERSON + (size - 1) * PER_ADDITIONAL_PERSON;
}

/** Income as a percentage of the FPL for that household size (rounded). */
export function fplPercent(annualIncome: number, householdSize: number): number {
  const fpl = fplForHousehold(householdSize);
  const income = Number.isFinite(annualIncome) ? Math.max(0, annualIncome) : 0;
  if (fpl <= 0) return 0;
  return Math.round((income / fpl) * 100);
}
