// Shared types for Throughline.

export type Reason = 'job_loss' | 'reduced_hours' | 'aging_out' | 'other';

/** Everything the user tells us about their situation. */
export interface Situation {
  state: string; // two-letter code, e.g. "CA"
  householdSize: number;
  /** Last year's / projected ANNUAL household income (used for marketplace subsidies). */
  annualIncome: number;
  /** Current TOTAL monthly household income right now, including any unemployment. */
  currentMonthlyIncome: number;
  reason: Reason;
  hasChildren: boolean;
  pregnant: boolean;
  /** ISO date the job-based coverage ended (or will end), if known. */
  lostCoverageDate?: string;
  notes?: string;
}

export type EligibilityStatus =
  | 'eligible'
  | 'likely_eligible'
  | 'maybe'
  | 'not_eligible';

export type ProgramCategory =
  | 'medicaid'
  | 'marketplace'
  | 'safety_net'
  | 'income'
  | 'prescription'
  | 'bridge';

export interface ProgramMatch {
  id: string;
  name: string;
  category: ProgramCategory;
  status: EligibilityStatus;
  reason: string;
}

export interface FplContext {
  effectiveYear: number;
  source: string;
  fplForHousehold: number;
  annualFplPercent: number;
  currentMonthlyFplPercent: number;
}

export interface EligibilityResult {
  state: string;
  fpl: FplContext;
  matches: ProgramMatch[];
  /** Program ids the plan is REQUIRED to cover (status eligible | likely_eligible). */
  recommended: string[];
  /** Machine flags that drive critical rubric checks. */
  flags: string[];
}

// ---- The plan the model produces ----

export interface PlanAction {
  title: string;
  why: string;
  deadline?: string;
}

export interface PlanProgram {
  programId?: string;
  name: string;
  whatItIs: string;
  whyYouQualify: string;
  howToApply: string;
  documentsNeeded: string[];
  estimatedValue: string;
}

export interface PlanScript {
  whenToUse: string;
  sayThis: string;
}

export interface Plan {
  summary: string;
  urgentActions: PlanAction[];
  programs: PlanProgram[];
  scripts: PlanScript[];
  disclaimer: string;
}

// ---- Grading ----

export interface CriterionResult {
  id: string;
  name: string;
  weight: number;
  critical: boolean;
  /** 0..1 */
  score: number;
  passed: boolean;
  reasoning: string;
  /** Present when !passed — tells the repair step exactly what to fix. */
  fix?: string;
}

export interface Grade {
  criteria: CriterionResult[];
  /** 0..100, computed deterministically in code from per-criterion scores. */
  overall: number;
  /** computed in code: overall >= threshold AND no critical criterion failed. */
  pass: boolean;
}

// ---- The provider contract (real Opus 4.8 or a mock) ----

export interface GenerateInput {
  situation: Situation;
}

export interface GradeInput {
  situation: Situation;
  ground: EligibilityResult;
  plan: Plan;
}

export interface RepairInput {
  situation: Situation;
  previousPlan: Plan;
  failures: CriterionResult[];
}

export interface NavigatorProvider {
  name: string;
  generate(input: GenerateInput): Promise<Plan>;
  /** Returns per-criterion results; loop.ts computes overall + pass. */
  grade(input: GradeInput): Promise<CriterionResult[]>;
  repair(input: RepairInput): Promise<Plan>;
}

export interface Iteration {
  index: number;
  label: string;
  plan: Plan;
  grade: Grade;
}

export interface NavigatorResult {
  situation: Situation;
  ground: EligibilityResult;
  iterations: Iteration[];
  final: Iteration;
  passed: boolean;
  provider: string;
}
