// The self-verifying loop: generate -> grade -> (repair -> grade)* until the
// plan passes the rubric or we hit the iteration cap. Provider-agnostic: it
// works identically with the real Opus 4.8 provider or the deterministic mock.

import { computeEligibility } from './eligibility';
import { failures, loadRubric, scoreGrade } from './rubric';
import type {
  Iteration,
  NavigatorProvider,
  NavigatorResult,
  Situation,
} from './types';

export interface RunOptions {
  maxIterations?: number;
  today?: Date;
}

export async function runNavigator(
  situation: Situation,
  provider: NavigatorProvider,
  opts: RunOptions = {},
): Promise<NavigatorResult> {
  const maxIterations = opts.maxIterations ?? 3;
  const ground = computeEligibility(situation, { today: opts.today });
  const rubric = loadRubric();
  const iterations: Iteration[] = [];

  let plan = await provider.generate({ situation });
  let grade = scoreGrade(await provider.grade({ situation, ground, plan }), rubric);
  iterations.push({ index: 0, label: 'Initial plan', plan, grade });

  let i = 1;
  while (!grade.pass && i < maxIterations) {
    const failed = failures(grade);
    // Nothing actionable to repair (e.g. low overall score but every criterion
    // marked passed) — don't burn an iteration on a no-op repair.
    if (failed.length === 0) break;
    plan = await provider.repair({ situation, previousPlan: plan, failures: failed });
    grade = scoreGrade(await provider.grade({ situation, ground, plan }), rubric);
    iterations.push({ index: i, label: `Self-repair pass ${i}`, plan, grade });
    i += 1;
  }

  const final = iterations[iterations.length - 1];
  return {
    situation,
    ground,
    iterations,
    final,
    passed: final.grade.pass,
    provider: provider.name,
  };
}
