// Loads the canonical rubric.yaml and turns per-criterion model judgments into
// a final score + pass/fail. The aggregation is deterministic CODE — the model
// proposes per-criterion scores, but the weights, the critical flags, and the
// final verdict are computed here, so the model cannot simply declare itself
// passing.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import type { CriterionResult, Grade } from './types';

export interface RubricCriterion {
  id: string;
  name: string;
  weight: number;
  critical: boolean;
  description: string;
}

export interface Rubric {
  name: string;
  version: number;
  pass_threshold: number;
  criteria: RubricCriterion[];
}

let cached: Rubric | null = null;

/**
 * Find rubric.yaml without depending on a specific working directory: an
 * explicit override wins, then cwd, then we walk up from cwd a few levels.
 * This keeps the loader robust across `npm run dev`, the eval script, Vercel
 * serverless functions, and tests.
 */
function findRubricPath(): string {
  const tried: string[] = [];
  const consider = (p: string) => {
    tried.push(p);
    return existsSync(p) ? p : null;
  };

  if (process.env.BRIDGE_RUBRIC_PATH) {
    const hit = consider(process.env.BRIDGE_RUBRIC_PATH);
    if (hit) return hit;
  }

  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const hit = consider(join(dir, 'rubric.yaml'));
    if (hit) return hit;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `Could not find rubric.yaml. Set BRIDGE_RUBRIC_PATH or run from the project root. Tried:\n  ${tried.join('\n  ')}`,
  );
}

export function loadRubric(): Rubric {
  if (cached) return cached;
  const raw = readFileSync(findRubricPath(), 'utf8');
  const parsed = parse(raw) as Rubric;
  if (!parsed?.criteria?.length) {
    throw new Error('rubric.yaml has no criteria');
  }
  cached = parsed;
  return parsed;
}

/**
 * Re-derive weight + critical from the rubric (source of truth), regardless of
 * what the model returned, and compute the overall weighted score + verdict.
 */
export function scoreGrade(modelCriteria: CriterionResult[], rubric: Rubric): Grade {
  const byId = new Map(rubric.criteria.map((c) => [c.id, c]));

  const criteria: CriterionResult[] = rubric.criteria.map((rc) => {
    const m = modelCriteria.find((c) => c.id === rc.id);
    const score = clamp01(m?.score ?? 0);
    const passed = m?.passed ?? false;
    return {
      id: rc.id,
      name: rc.name,
      weight: rc.weight,
      critical: rc.critical,
      score,
      passed,
      reasoning: m?.reasoning ?? 'No judgment returned for this criterion.',
      // If the grader omitted this criterion, give repair guidance from the
      // rubric description rather than leaving it with no fix.
      fix: m?.fix ?? (m === undefined ? rc.description : undefined),
    };
  });

  const totalWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0) || 1;
  const weighted = criteria.reduce((sum, c) => sum + c.score * c.weight, 0);
  const overall = Math.round((weighted / totalWeight) * 100);

  const criticalFailed = criteria.some((c) => c.critical && !c.passed);
  const pass = overall >= rubric.pass_threshold && !criticalFailed;

  return { criteria, overall, pass };
}

/** The criteria that failed — fed to the repair step. */
export function failures(grade: Grade): CriterionResult[] {
  return grade.criteria.filter((c) => !c.passed);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
