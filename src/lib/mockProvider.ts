// A deterministic, offline provider that reproduces the full
// generate -> grade -> repair -> pass arc with NO API key and NO credits.
//
// Two purposes:
//   1. Venue insurance — if the Wi-Fi or credits flake during the live demo,
//      Throughline still runs the entire self-verifying loop end to end.
//   2. Tests — the loop logic is verified without burning tokens.
//
// The first draft deliberately makes the single most realistic mistake a real
// model makes for the newly laid off: it misses the "you qualify for Medicaid
// NOW based on current monthly income" pathway and the enrollment deadline. The
// heuristic grader (a real, if simpler, check against ground truth) catches it,
// and the repair pass fixes it — so the score climbs for a genuine reason.

import { computeEligibility } from './eligibility';
import type {
  CriterionResult,
  GenerateInput,
  GradeInput,
  NavigatorProvider,
  Plan,
  PlanProgram,
  RepairInput,
  Situation,
} from './types';

const WHERE_TO_APPLY: Record<string, string> = {
  medi_cal_adults: 'Apply at BenefitsCal.com or your county human-services office. Report your CURRENT income.',
  medi_cal_kids: 'Apply at BenefitsCal.com — add each child to the household application.',
  medi_cal_pregnancy: 'Apply at BenefitsCal.com or ask any clinic to start a presumptive-eligibility application same-day.',
  covered_ca: 'Compare plans and enroll at CoveredCA.com or by phone with a free certified enroller.',
  fqhc_sliding_scale: 'Find a center at findahealthcenter.hrsa.gov and call to book a sliding-scale visit.',
  county_indigent: 'Call your county health department and ask about the medically-indigent / county care program.',
  edd_unemployment: 'File at edd.ca.gov as soon as possible — benefits date from when you file.',
  cobra: 'Your former employer / plan administrator mails an election notice; you have 60 days to decide.',
  rx_assistance: 'Search NeedyMeds.org and GoodRx for your medications; ask the FQHC about 340B pricing.',
};

const DOCS: Record<string, string[]> = {
  medi_cal_adults: ['Photo ID', 'Proof of current income (or proof of income loss / layoff letter)', 'Date prior coverage ended'],
  medi_cal_kids: ['Photo ID', "Children's birth certificates or SSNs", 'Proof of household income'],
  covered_ca: ['Photo ID', 'Projected annual income estimate', 'Date job-based coverage ended (triggers Special Enrollment)'],
};

function programEntry(id: string, name: string, why: string): PlanProgram {
  return {
    programId: id,
    name,
    whatItIs: `${name} — a program that can cover you during this gap.`,
    whyYouQualify: why,
    howToApply: WHERE_TO_APPLY[id] ?? 'Contact the program office to apply.',
    documentsNeeded: DOCS[id] ?? ['Photo ID', 'Proof of income'],
    estimatedValue: id === 'medi_cal_adults' ? '$0 monthly premium' : 'Reduces or eliminates your cost',
  };
}

function buildPlan(situation: Situation, full: boolean): Plan {
  const ground = computeEligibility(situation);
  const recommended = ground.matches.filter((m) => ground.recommended.includes(m.id));

  // First draft "forgets" the highest-value item: Medi-Cal via the income-drop
  // pathway. The repair pass puts it back.
  const included = full
    ? recommended
    : recommended.filter((m) => m.id !== 'medi_cal_adults');

  const programs = included.map((m) => programEntry(m.id, m.name, m.reason));

  const urgentActions = full
    ? [
        {
          title: 'Apply for Medi-Cal today based on your CURRENT income',
          why: 'Medi-Cal looks at your income right now, not last year. With little income this month you very likely qualify for $0 coverage immediately.',
          deadline: 'Today — coverage can be backdated, so do not wait.',
        },
        {
          title: 'Mark your 60-day enrollment deadline',
          why: 'Losing job-based coverage opens a 60-day Special Enrollment Period on Covered California and a 60-day COBRA election window. Missing them narrows your options.',
          deadline: '60 days from the date your coverage ended.',
        },
      ]
    : [
        {
          title: 'Look into Covered California',
          why: 'You can buy a subsidized marketplace plan.',
        },
      ];

  return {
    summary: full
      ? 'Losing coverage between jobs is stressful, but you have more options than it feels like right now. Based on your current income, the fastest path is almost certainly free Medi-Cal today, with community-clinic care covering you in the meantime.'
      : 'Here are some health-coverage options you can look into while you are between jobs.',
    urgentActions,
    programs,
    scripts: [
      {
        whenToUse: 'Calling the county Medi-Cal office',
        sayThis: 'Hi, I recently lost my job and my health coverage. I\'d like to apply for Medi-Cal based on my current monthly income.',
      },
    ],
    disclaimer:
      'Throughline helps you find and apply for benefits you may qualify for. It is not medical advice and does not diagnose or treat any condition. Final eligibility is determined by each program.',
  };
}

function planCovers(plan: Plan, id: string): boolean {
  return plan.programs.some((p) => p.programId === id);
}

function planText(plan: Plan): string {
  return JSON.stringify(plan).toLowerCase();
}

export const mockProvider: NavigatorProvider = {
  name: 'mock:deterministic',

  async generate(input: GenerateInput): Promise<Plan> {
    return buildPlan(input.situation, false);
  },

  async grade(input: GradeInput): Promise<CriterionResult[]> {
    const { ground, plan } = input;
    const text = planText(plan);
    const recommended = ground.matches.filter((m) => ground.recommended.includes(m.id));
    const covered = recommended.filter((m) => planCovers(plan, m.id));
    const completeness = recommended.length ? covered.length / recommended.length : 1;

    const missing = recommended.filter((m) => !planCovers(plan, m.id));

    const needsIncomeDrop = ground.flags.includes('medicaid_income_drop_pathway');
    const incomeDropOk =
      !needsIncomeDrop ||
      (planCovers(plan, 'medi_cal_adults') &&
        text.includes('current') &&
        text.includes('month'));

    const needsDeadline = ground.flags.includes('sep_60_day');
    const deadlineOk = !needsDeadline || text.includes('60') || text.includes('special enrollment');

    const actionable = plan.programs.every(
      (p) => p.howToApply.length > 0 && p.documentsNeeded.length > 0,
    );

    const result = (
      id: string,
      score: number,
      passed: boolean,
      reasoning: string,
      fix?: string,
    ): CriterionResult => ({ id, name: id, weight: 0, critical: false, score, passed, reasoning, fix });

    return [
      result(
        'completeness',
        completeness,
        completeness >= 1,
        completeness >= 1
          ? 'All recommended programs are covered.'
          : `Missing recommended programs: ${missing.map((m) => m.name).join(', ')}.`,
        missing.length
          ? `Add an action item for: ${missing.map((m) => m.name).join(', ')}.`
          : undefined,
      ),
      result('eligibility_accuracy', 1, true, 'No fabricated or ineligible programs detected.'),
      result(
        'income_drop_pathway',
        incomeDropOk ? 1 : 0,
        incomeDropOk,
        incomeDropOk
          ? 'Current-monthly-income Medicaid pathway is explained (or not applicable).'
          : 'Ground truth flags the income-drop pathway, but the plan does not explain that Medi-Cal uses current monthly income.',
        incomeDropOk
          ? undefined
          : 'Add a Medi-Cal action item explaining eligibility is based on CURRENT monthly income, not last year\'s salary.',
      ),
      result(
        'deadline_urgency',
        deadlineOk ? 1 : 0,
        deadlineOk,
        deadlineOk ? 'Deadlines addressed (or not applicable).' : 'The 60-day Special Enrollment / COBRA window is not called out.',
        deadlineOk ? undefined : 'Add an urgent action noting the 60-day Special Enrollment Period and COBRA election window.',
      ),
      result('actionability', actionable ? 1 : 0.5, actionable, actionable ? 'Each program has where-to-apply and documents.' : 'Some programs lack how-to-apply detail.'),
      result('safety_navigation_only', plan.disclaimer ? 1 : 0, !!plan.disclaimer, plan.disclaimer ? 'Navigation-only disclaimer present.' : 'No disclaimer.'),
      result('plain_empathetic', plan.summary ? 1 : 0, !!plan.summary, 'Plain, empathetic summary present.'),
    ];
  },

  async repair(input: RepairInput): Promise<Plan> {
    return buildPlan(input.situation, true);
  },
};
