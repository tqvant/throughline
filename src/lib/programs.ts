// The program catalog. Each program is a pure function of the situation +
// FPL context, returning an eligibility status and a plain-language reason.
//
// Thresholds are encoded from public program rules (California-focused, with
// federal programs that exist nationwide). Updating a threshold here is a
// one-line change and re-flows through the engine, tests, and rubric.

import type {
  EligibilityStatus,
  ProgramCategory,
  Situation,
} from './types';

export interface ProgramContext {
  /** Rounded, for display in reasons. */
  annualFplPercent: number;
  currentMonthlyFplPercent: number;
  /** Unrounded ratio (income / FPL), for threshold DECISIONS — avoids rounding
   *  138.4% down to 138 and over-granting at the cutoff. */
  annualFplRatio: number;
  currentMonthlyFplRatio: number;
}

export interface ProgramEvaluation {
  status: EligibilityStatus;
  reason: string;
}

export interface Program {
  id: string;
  name: string;
  category: ProgramCategory;
  evaluate: (s: Situation, ctx: ProgramContext) => ProgramEvaluation;
}

// California Medi-Cal / ACA thresholds, as % of FPL.
const MEDICAID_ADULT = 138; // MAGI adults
const MEDICAID_KIDS = 266; // Medi-Cal for children
const MEDICAID_PREGNANCY = 213;
const MARKETPLACE_SUBSIDY_CEILING = 400;

export const PROGRAMS: Program[] = [
  {
    id: 'medi_cal_adults',
    name: 'Medi-Cal (Medicaid) — adults',
    category: 'medicaid',
    evaluate: (_s, ctx) => {
      // Medi-Cal (MAGI) is determined by CURRENT income only — never last
      // year's salary. (Do NOT fall back to annual income here.)
      if (ctx.currentMonthlyFplRatio <= MEDICAID_ADULT / 100) {
        return {
          status: 'eligible',
          reason: `Your CURRENT monthly income is about ${ctx.currentMonthlyFplPercent}% of the Federal Poverty Level, at or under the 138% cutoff. Medi-Cal looks at income right now — not last year's salary — so you very likely qualify for $0 coverage. Apply now: approval can take a few weeks, but coverage can be backdated up to ~3 months (2026) if you were eligible then, and community clinics can see you in the meantime.`,
        };
      }
      return {
        status: 'not_eligible',
        reason: `Your current income is above the 138% adult Medi-Cal cutoff — Medi-Cal uses current income, so subsidized marketplace coverage is the better path for you.`,
      };
    },
  },
  {
    id: 'medi_cal_kids',
    name: 'Medi-Cal for children',
    category: 'medicaid',
    evaluate: (s, ctx) => {
      if (!s.hasChildren) {
        return { status: 'not_eligible', reason: 'No children in the household.' };
      }
      if (ctx.currentMonthlyFplRatio <= MEDICAID_KIDS / 100) {
        return {
          status: 'eligible',
          reason: `Children qualify for Medi-Cal up to 266% of the Federal Poverty Level — a much higher cutoff than for adults — and your income (~${ctx.currentMonthlyFplPercent}% of FPL) is under it. Kids can be covered even if the parents are not.`,
        };
      }
      return {
        status: 'maybe',
        reason: 'Income is above the 266% children cutoff; check the C-CHIP / county options for kids.',
      };
    },
  },
  {
    id: 'medi_cal_pregnancy',
    name: 'Medi-Cal — pregnancy coverage',
    category: 'medicaid',
    evaluate: (s, ctx) => {
      if (!s.pregnant) {
        return { status: 'not_eligible', reason: 'Not applicable.' };
      }
      if (ctx.currentMonthlyFplRatio <= MEDICAID_PREGNANCY / 100) {
        return {
          status: 'eligible',
          reason: `Pregnancy-related Medi-Cal covers income up to 213% of the Federal Poverty Level (~${ctx.currentMonthlyFplPercent}% here).`,
        };
      }
      return {
        status: 'maybe',
        reason: 'Income is above 213% FPL; the Medi-Cal Access Program may still help.',
      };
    },
  },
  {
    id: 'covered_ca',
    name: 'Covered California (ACA marketplace) with subsidies',
    category: 'marketplace',
    evaluate: (_s, ctx) => {
      if (ctx.currentMonthlyFplRatio <= MEDICAID_ADULT / 100) {
        return {
          status: 'maybe',
          reason: 'With your current income at/under 138% FPL, marketplace subsidies generally do not apply because free Medi-Cal covers you. Keep this as a fallback only if you decline Medi-Cal.',
        };
      }
      if (ctx.annualFplRatio <= MARKETPLACE_SUBSIDY_CEILING / 100) {
        return {
          status: 'eligible',
          reason: `Projected annual income (~${ctx.annualFplPercent}% of FPL) is in the 138–400% range for premium subsidies. Losing job-based coverage opens a Special Enrollment Period to sign up now.`,
        };
      }
      return {
        status: 'likely_eligible',
        reason: `Income is above 400% of FPL. You can still enroll at full price; whether any premium subsidy applies above 400% depends on the rules in effect for your coverage year, so it's worth pricing out at CoveredCA.com.`,
      };
    },
  },
  {
    id: 'fqhc_sliding_scale',
    name: 'Community health center / free clinic (sliding scale)',
    category: 'safety_net',
    evaluate: () => ({
      status: 'eligible',
      reason: 'Federally Qualified Health Centers and free & charitable clinics provide primary, dental, and behavioral care on a sliding fee scale — often $0–$40 a visit — regardless of income or immigration status. This covers you for care TODAY while applications process.',
    }),
  },
  {
    id: 'county_indigent',
    name: 'County health program (medically indigent)',
    category: 'safety_net',
    evaluate: (_s, ctx) => {
      if (ctx.currentMonthlyFplRatio > MEDICAID_ADULT / 100) {
        return {
          status: 'likely_eligible',
          reason: 'If you fall between Medi-Cal and affordable marketplace coverage, county medically-indigent programs can help. Eligibility is set locally.',
        };
      }
      return {
        status: 'maybe',
        reason: 'County program is a backstop; Medi-Cal is the stronger primary option for you.',
      };
    },
  },
  {
    id: 'edd_unemployment',
    name: 'Unemployment Insurance (income support)',
    category: 'income',
    evaluate: (s) => {
      if (s.reason === 'job_loss' || s.reason === 'reduced_hours') {
        return {
          status: 'eligible',
          reason: 'Losing a job or hours through no fault of your own qualifies you for Unemployment Insurance income support while you bridge the gap. Note: UI counts as income on Medi-Cal/marketplace applications.',
        };
      }
      return { status: 'maybe', reason: 'Unemployment Insurance may apply depending on the circumstances of the job change.' };
    },
  },
  {
    id: 'cobra',
    name: 'COBRA continuation (keep your old plan)',
    category: 'bridge',
    evaluate: () => ({
      status: 'maybe',
      reason: 'COBRA lets you keep your former employer plan for up to 18 months, but you pay the FULL premium (often $650+/month per person) — usually the most expensive option. You have 60 days to elect, and you can choose Medi-Cal or subsidized Covered California instead. Compare costs before electing.',
    }),
  },
  {
    id: 'rx_assistance',
    name: 'Prescription assistance',
    category: 'prescription',
    evaluate: () => ({
      status: 'likely_eligible',
      reason: 'Manufacturer Patient Assistance Programs, 340B clinic pharmacies, and discount tools (GoodRx, NeedyMeds) can keep prescriptions affordable during the gap, even before new coverage starts.',
    }),
  },
];
