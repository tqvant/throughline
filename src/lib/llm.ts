// The real Opus 4.8 provider. Three roles, all forced into structured JSON via
// tool use:
//   generate — reasons about eligibility from the rules and drafts a plan
//   grade    — strictly scores a plan against the rubric AND the ground truth
//   repair   — revises a plan to fix the specific criteria that failed
//
// The grader is given ground truth; the generator is NOT — it must reason,
// which is exactly what lets the loop catch and fix real mistakes.

import Anthropic from '@anthropic-ai/sdk';
import type {
  CriterionResult,
  GenerateInput,
  GradeInput,
  NavigatorProvider,
  Plan,
  RepairInput,
} from './types';
import { loadRubric } from './rubric';

const MODEL = process.env.BRIDGE_MODEL || 'claude-opus-4-8';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const PROGRAM_REFERENCE = `
PROGRAM RULES (California-focused; all thresholds are % of the Federal Poverty Level, FPL):
- Medi-Cal (Medicaid) for ADULTS: income at or under 138% FPL. CRITICAL: Medi-Cal uses CURRENT MONTHLY income, not last year's salary. Someone newly laid off with little or no income now usually qualifies immediately, even if last year's annual income was high.
- Medi-Cal for CHILDREN: up to 266% FPL (kids can be covered even when parents are not).
- Medi-Cal pregnancy coverage: up to 213% FPL.
- Covered California (ACA marketplace) premium subsidies: roughly 138%-400% FPL based on PROJECTED ANNUAL income; above 400% you can still enroll and may get enhanced subsidies. Losing job-based coverage opens a 60-day Special Enrollment Period.
- Community health centers (FQHCs) / free & charitable clinics: sliding-scale or free care for ANYONE, any income or immigration status. Good for care right now while applications process.
- County medically-indigent programs: backstop for people between Medi-Cal and affordable marketplace coverage.
- Unemployment Insurance (EDD): income support after a job loss; counts as income on health applications.
- COBRA: keep the old employer plan up to 18 months but pay the FULL premium (often $650+/mo/person); 60-day election window; usually the costliest option.
- Prescription assistance: manufacturer Patient Assistance Programs, 340B pharmacies, GoodRx, NeedyMeds.
Where to apply in California: BenefitsCal.com (Medi-Cal), CoveredCA.com (marketplace), county human-services office, local health center.
`.trim();

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Warm 2-3 sentence overview that acknowledges the stress.' },
    urgentActions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          deadline: { type: 'string' },
        },
        required: ['title', 'why'],
      },
    },
    programs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          programId: { type: 'string', description: 'Optional id from the rules, e.g. medi_cal_adults.' },
          name: { type: 'string' },
          whatItIs: { type: 'string' },
          whyYouQualify: { type: 'string' },
          howToApply: { type: 'string', description: 'WHERE to apply and HOW.' },
          documentsNeeded: { type: 'array', items: { type: 'string' } },
          estimatedValue: { type: 'string', description: 'e.g. "$0 premium" or "saves ~$650/mo vs COBRA".' },
        },
        required: ['name', 'whatItIs', 'whyYouQualify', 'howToApply', 'documentsNeeded', 'estimatedValue'],
      },
    },
    scripts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          whenToUse: { type: 'string' },
          sayThis: { type: 'string' },
        },
        required: ['whenToUse', 'sayThis'],
      },
    },
    disclaimer: { type: 'string' },
  },
  required: ['summary', 'urgentActions', 'programs', 'scripts', 'disclaimer'],
} as const;

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The rubric criterion id.' },
          score: { type: 'number', description: '0.0 to 1.0 — how fully this criterion is satisfied.' },
          passed: { type: 'boolean' },
          reasoning: { type: 'string' },
          fix: { type: 'string', description: 'If not passed, the exact change that would fix it.' },
        },
        required: ['id', 'score', 'passed', 'reasoning'],
      },
    },
  },
  required: ['criteria'],
} as const;

async function callTool<T>(args: {
  system: string;
  user: string;
  toolName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  maxTokens?: number;
}): Promise<T> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: args.maxTokens ?? 4096,
    system: args.system,
    messages: [{ role: 'user', content: args.user }],
    tools: [
      {
        name: args.toolName,
        description: `Return the result by calling ${args.toolName}.`,
        input_schema: args.schema,
      },
    ],
    tool_choice: { type: 'tool', name: args.toolName },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = res.content.find((b: any) => b.type === 'tool_use') as any;
  if (!block) throw new Error(`Model did not call ${args.toolName}`);
  return block.input as T;
}

function situationText(input: GenerateInput | GradeInput | RepairInput): string {
  const s = input.situation;
  return [
    `State: ${s.state}`,
    `Household size: ${s.householdSize}`,
    `Last year's / projected ANNUAL household income: $${s.annualIncome.toLocaleString()}`,
    `CURRENT total monthly household income (right now): $${s.currentMonthlyIncome.toLocaleString()}`,
    `Reason for the gap: ${s.reason}`,
    `Children in household: ${s.hasChildren ? 'yes' : 'no'}`,
    `Pregnant: ${s.pregnant ? 'yes' : 'no'}`,
    s.lostCoverageDate ? `Job-based coverage ended: ${s.lostCoverageDate}` : '',
    s.notes ? `Notes: ${s.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const anthropicProvider: NavigatorProvider = {
  name: `opus:${MODEL}`,

  async generate(input: GenerateInput): Promise<Plan> {
    const system = [
      'You are Throughline, a calm, expert benefits navigator for people who just lost their health coverage between jobs.',
      'Your job is BENEFITS NAVIGATION ONLY: figure out which programs the person likely qualifies for and how to enroll. You must NEVER diagnose, recommend treatments or medications, or give clinical/medical advice.',
      'You are NOT given the answer — reason out eligibility yourself from the rules below. Do not invent programs or thresholds. Do not tell someone to apply for a program they clearly do not qualify for.',
      'Write in plain, encouraging language. Always include the safety-net options (community health center, prescription assistance) and a short disclaimer.',
      '',
      PROGRAM_REFERENCE,
    ].join('\n');
    return callTool<Plan>({
      system,
      user: `Here is the person's situation. Produce their benefits action plan.\n\n${situationText(input)}`,
      toolName: 'submit_plan',
      schema: PLAN_SCHEMA,
    });
  },

  async grade(input: GradeInput): Promise<CriterionResult[]> {
    const rubric = loadRubric();
    const system = [
      'You are a STRICT grader for benefits plans. You are given the rubric, the ground-truth eligibility computed by a deterministic engine, and a plan to grade.',
      'Grade ONLY against the rubric and the ground truth. Be skeptical: if a required program is missing, a fact contradicts ground truth, or a critical flag is not addressed, mark that criterion failed and give the precise fix.',
      'For each criterion return a score from 0.0 to 1.0, passed true/false, your reasoning, and (when not passed) the exact fix.',
      '',
      `RUBRIC:\n${JSON.stringify(rubric.criteria, null, 2)}`,
    ].join('\n');
    const user = [
      `GROUND TRUTH (authoritative):\n${JSON.stringify(input.ground, null, 2)}`,
      '',
      `PLAN TO GRADE:\n${JSON.stringify(input.plan, null, 2)}`,
      '',
      'Grade every criterion in the rubric by its id.',
    ].join('\n');
    const out = await callTool<{ criteria: CriterionResult[] }>({
      system,
      user,
      toolName: 'submit_grade',
      schema: GRADE_SCHEMA,
      maxTokens: 3000,
    });
    return out.criteria;
  },

  async repair(input: RepairInput): Promise<Plan> {
    const system = [
      'You are Throughline, revising a benefits plan to fix specific problems a strict grader found. Keep everything that was good; fix exactly what failed.',
      'Benefits navigation only — no medical advice. Do not invent programs or thresholds.',
      '',
      PROGRAM_REFERENCE,
    ].join('\n');
    const failuresText = input.failures
      .map((f) => `- [${f.id}] ${f.reasoning}${f.fix ? `\n  FIX: ${f.fix}` : ''}`)
      .join('\n');
    const user = [
      `Person's situation:\n${situationText(input)}`,
      '',
      `Your previous plan:\n${JSON.stringify(input.previousPlan, null, 2)}`,
      '',
      `These criteria FAILED — fix every one:\n${failuresText}`,
      '',
      'Return the full corrected plan.',
    ].join('\n');
    return callTool<Plan>({
      system,
      user,
      toolName: 'submit_plan',
      schema: PLAN_SCHEMA,
    });
  },
};
