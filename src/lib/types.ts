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
  /** Language code for the generated, user-facing content (e.g. "es"). */
  language?: string;
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
  /** Concierge: ready-to-paste answers for this program's application. */
  applicationDraft?: string;
}

export interface PlanScript {
  whenToUse: string;
  sayThis: string;
}

/** Concierge: a ready-to-send message requesting an appointment / callback. */
export interface AppointmentRequest {
  to: string;
  subject: string;
  body: string;
}

export interface Plan {
  summary: string;
  urgentActions: PlanAction[];
  programs: PlanProgram[];
  scripts: PlanScript[];
  appointmentRequest?: AppointmentRequest;
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

/** Best-effort count of the real API work a run did (0 in offline/mock mode). */
export interface Telemetry {
  model: string;
  apiCalls: number;
  webSearches: number;
  inputTokens: number;
  outputTokens: number;
}

export interface NavigatorResult {
  situation: Situation;
  ground: EligibilityResult;
  iterations: Iteration[];
  final: Iteration;
  passed: boolean;
  provider: string;
  telemetry?: Telemetry;
}

// ---- "Find care near me — now": the emergency-gap web-search agent ----
//
// For the days/weeks between when coverage ends and the next plan (or Medi-Cal)
// starts. An Opus 4.8 / Fable 5 agent searches the live web for local, free or
// low-cost, immediate-care resources, then self-verifies the list against a
// rubric before showing it.

export type ResourceKind =
  | 'free_clinic'
  | 'community_health_center'
  | 'mobile_unit'
  | 'prescription'
  | 'urgent_low_cost'
  | 'dental'
  | 'clinical_trial'
  | 'community_tip'
  | 'hotline'
  | 'other';

export type CostLevel = 'free' | 'sliding_scale' | 'low_cost' | 'unknown';

export interface HelpResource {
  name: string;
  kind: ResourceKind;
  description: string;
  whyItHelps: string;
  cost: CostLevel;
  address?: string;
  phone?: string;
  hours?: string;
  /** Where this came from — a web page or a community thread. */
  sourceUrl?: string;
  /** "web" = official/listed source; "community" = forum/social (verify before relying). */
  sourceType: 'web' | 'community';
}

export interface FindHelpInput {
  /** City, ZIP, or "City, ST". */
  location: string;
  /** What they need right now, in their words. */
  need: string;
  /** Optional extra context (e.g. "uninsured until Aug 1", "need insulin"). */
  notes?: string;
  /** Language code for the generated, user-facing content (e.g. "es"). */
  language?: string;
}

export interface HelpFinder {
  name: string;
  search(input: FindHelpInput): Promise<{ resources: HelpResource[]; notes?: string }>;
  grade(input: {
    input: FindHelpInput;
    resources: HelpResource[];
  }): Promise<CriterionResult[]>;
  repair(input: {
    input: FindHelpInput;
    previous: HelpResource[];
    failures: CriterionResult[];
  }): Promise<{ resources: HelpResource[] }>;
}

export interface HelpIteration {
  index: number;
  label: string;
  resources: HelpResource[];
  grade: Grade;
}

export interface FindHelpResult {
  input: FindHelpInput;
  iterations: HelpIteration[];
  final: HelpIteration;
  passed: boolean;
  provider: string;
  telemetry?: Telemetry;
}
