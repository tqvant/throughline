// The deterministic eligibility engine. This is GROUND TRUTH — pure functions,
// no model, fully unit-tested. The Opus 4.8 grader checks every generated plan
// against the output of this engine, which is what makes "done" verifiable by
// the model without a human in the loop.

import { EFFECTIVE_YEAR, FPL_SOURCE, fplForHousehold, fplPercent } from './fpl';
import { PROGRAMS, type ProgramContext } from './programs';
import type { EligibilityResult, ProgramMatch, Situation } from './types';

const RECOMMENDABLE: ReadonlySet<string> = new Set(['eligible', 'likely_eligible']);

/** Days between an ISO date and "today" (UTC), or null if unparseable. */
function daysSince(iso: string | undefined, today: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((today.getTime() - t) / 86_400_000);
}

export interface ComputeOptions {
  /** Injectable for deterministic tests. Defaults to the current date. */
  today?: Date;
}

export function computeEligibility(
  situation: Situation,
  opts: ComputeOptions = {},
): EligibilityResult {
  const today = opts.today ?? new Date();

  const fpl = fplForHousehold(situation.householdSize);
  const annualFplPercent = fplPercent(situation.annualIncome, situation.householdSize);
  const currentAnnualized = situation.currentMonthlyIncome * 12;
  const currentMonthlyFplPercent = fplPercent(currentAnnualized, situation.householdSize);
  // Unrounded ratios drive threshold DECISIONS (avoids rounding 138.4% -> 138).
  const annualFplRatio = fpl > 0 ? Math.max(0, situation.annualIncome) / fpl : 0;
  const currentMonthlyFplRatio = fpl > 0 ? Math.max(0, currentAnnualized) / fpl : 0;

  const ctx: ProgramContext = {
    annualFplPercent,
    currentMonthlyFplPercent,
    annualFplRatio,
    currentMonthlyFplRatio,
  };

  const matches: ProgramMatch[] = PROGRAMS.map((p) => {
    const evaluation = p.evaluate(situation, ctx);
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      status: evaluation.status,
      reason: evaluation.reason,
    };
  });

  const recommended = matches
    .filter((m) => RECOMMENDABLE.has(m.status))
    .map((m) => m.id);

  const flags: string[] = [];

  // The single most important — and most missed — fact for the newly laid off:
  // they qualify for Medicaid NOW based on current monthly income, even though
  // last year's salary was well above the cutoff.
  if (currentMonthlyFplRatio <= 1.38 && annualFplRatio > 1.38) {
    flags.push('medicaid_income_drop_pathway');
  }

  // A 60-day Special Enrollment Period / COBRA election window opens when
  // job-based coverage is lost.
  const daysSinceLoss = daysSince(situation.lostCoverageDate, today);
  const recentLoss = daysSinceLoss !== null && daysSinceLoss <= 60 && daysSinceLoss >= -60;
  if (situation.reason === 'job_loss' || recentLoss) {
    flags.push('sep_60_day');
  }

  return {
    state: situation.state,
    fpl: {
      effectiveYear: EFFECTIVE_YEAR,
      source: FPL_SOURCE,
      fplForHousehold: fpl,
      annualFplPercent,
      currentMonthlyFplPercent,
    },
    matches,
    recommended,
    flags,
  };
}
