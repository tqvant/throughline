import { describe, expect, it } from 'vitest';
import { runFindHelp } from '../src/lib/findHelp';
import { mockHelpFinder } from '../src/lib/mockHelpFinder';
import type { FindHelpInput } from '../src/lib/types';

const input: FindHelpInput = {
  location: 'Oakland',
  need: 'I have no insurance until next month and need to see a doctor and refill a prescription',
};

describe('the emergency-gap find-help loop converges', () => {
  it('catches a thin first list and repairs it into a passing one', async () => {
    const res = await runFindHelp(input, mockHelpFinder);

    expect(res.iterations.length).toBeGreaterThanOrEqual(2);

    const first = res.iterations[0].grade;
    expect(first.pass).toBe(false);
    // First pass is too narrow and partly unsourced.
    expect(first.criteria.find((c) => c.id === 'coverage')?.passed).toBe(false);
    expect(first.criteria.find((c) => c.id === 'real_sourced')?.passed).toBe(false);

    expect(res.passed).toBe(true);
    expect(res.final.grade.overall).toBeGreaterThan(first.overall);
    expect(res.final.grade.criteria.every((c) => c.passed)).toBe(true);
  });

  it('the final list spans multiple kinds and every resource is sourced', async () => {
    const res = await runFindHelp(input, mockHelpFinder);
    const kinds = new Set(res.final.resources.map((r) => r.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    expect(res.final.resources.every((r) => !!r.sourceUrl)).toBe(true);
  });
});
