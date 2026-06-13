import { describe, expect, it } from 'vitest';
import { runNavigator } from '../src/lib/loop';
import { mockProvider } from '../src/lib/mockProvider';
import type { Situation } from '../src/lib/types';

const TODAY = new Date('2026-06-13T00:00:00Z');

const demo: Situation = {
  state: 'CA',
  householdSize: 3,
  annualIncome: 145000,
  currentMonthlyIncome: 1800,
  reason: 'job_loss',
  hasChildren: true,
  pregnant: false,
  lostCoverageDate: '2026-05-22',
};

describe('the self-verifying loop converges', () => {
  it('catches a failing draft and repairs it to a passing plan', async () => {
    const res = await runNavigator(demo, mockProvider, { today: TODAY });

    // It took at least one repair pass.
    expect(res.iterations.length).toBeGreaterThanOrEqual(2);

    // The first draft failed...
    const first = res.iterations[0].grade;
    expect(first.pass).toBe(false);
    expect(first.criteria.find((c) => c.id === 'income_drop_pathway')?.passed).toBe(false);
    expect(first.criteria.find((c) => c.id === 'completeness')?.passed).toBe(false);

    // ...and the final plan passed, with a strictly higher score.
    expect(res.passed).toBe(true);
    expect(res.final.grade.overall).toBeGreaterThan(first.overall);
    expect(res.final.grade.criteria.every((c) => c.passed)).toBe(true);
  });

  it('the final plan actually covers every recommended program', async () => {
    const res = await runNavigator(demo, mockProvider, { today: TODAY });
    const covered = new Set(res.final.plan.programs.map((p) => p.programId));
    for (const id of res.ground.recommended) {
      expect(covered.has(id)).toBe(true);
    }
  });
});
