import { describe, expect, it } from 'vitest';
import { computeEligibility } from '../src/lib/eligibility';
import { fplForHousehold, fplPercent } from '../src/lib/fpl';
import type { Situation } from '../src/lib/types';

const TODAY = new Date('2026-06-13T00:00:00Z');

function sit(over: Partial<Situation> = {}): Situation {
  return {
    state: 'CA',
    householdSize: 3,
    annualIncome: 0,
    currentMonthlyIncome: 0,
    reason: 'job_loss',
    hasChildren: false,
    pregnant: false,
    ...over,
  };
}

function statusOf(res: ReturnType<typeof computeEligibility>, id: string) {
  return res.matches.find((m) => m.id === id)?.status;
}

describe('Federal Poverty Level table (public HHS data)', () => {
  it('matches the published 2025 guidelines', () => {
    expect(fplForHousehold(1)).toBe(15650);
    expect(fplForHousehold(2)).toBe(21150);
    expect(fplForHousehold(3)).toBe(26650);
    expect(fplForHousehold(4)).toBe(32150);
  });

  it('computes income as a percent of FPL', () => {
    expect(fplPercent(26650, 3)).toBe(100);
    expect(fplPercent(13325, 3)).toBe(50);
  });
});

describe('the demo persona — laid-off CA family of 3', () => {
  const res = computeEligibility(
    sit({
      annualIncome: 145000,
      currentMonthlyIncome: 1800,
      hasChildren: true,
      lostCoverageDate: '2026-05-22',
    }),
    { today: TODAY },
  );

  it('flags the current-monthly-income Medicaid pathway', () => {
    // Last year ~544% of FPL, but current income ~81% → qualifies NOW.
    expect(res.fpl.annualFplPercent).toBeGreaterThan(400);
    expect(res.fpl.currentMonthlyFplPercent).toBeLessThanOrEqual(138);
    expect(res.flags).toContain('medicaid_income_drop_pathway');
  });

  it('flags the 60-day enrollment window after a job loss', () => {
    expect(res.flags).toContain('sep_60_day');
  });

  it('recommends Medi-Cal for adults and children, plus the safety net', () => {
    expect(statusOf(res, 'medi_cal_adults')).toBe('eligible');
    expect(statusOf(res, 'medi_cal_kids')).toBe('eligible');
    expect(res.recommended).toEqual(
      expect.arrayContaining(['medi_cal_adults', 'medi_cal_kids', 'fqhc_sliding_scale', 'rx_assistance']),
    );
  });

  it('does NOT push marketplace subsidies when free Medi-Cal applies', () => {
    expect(statusOf(res, 'covered_ca')).toBe('maybe');
    expect(res.recommended).not.toContain('covered_ca');
  });
});

describe('income above the Medicaid cutoff', () => {
  const res = computeEligibility(
    sit({ householdSize: 2, annualIncome: 70000, currentMonthlyIncome: 5800, hasChildren: false }),
    { today: TODAY },
  );

  it('routes to subsidized marketplace, not Medicaid', () => {
    expect(statusOf(res, 'medi_cal_adults')).toBe('not_eligible');
    expect(statusOf(res, 'covered_ca')).toBe('eligible');
    expect(res.recommended).toContain('covered_ca');
  });

  it('does not raise the income-drop flag when current income is still high', () => {
    expect(res.flags).not.toContain('medicaid_income_drop_pathway');
  });
});

describe('flag edge cases', () => {
  it('no SEP flag for a non-job-loss change with old coverage end date', () => {
    const res = computeEligibility(
      sit({ reason: 'other', annualIncome: 90000, currentMonthlyIncome: 7000, lostCoverageDate: '2025-01-01' }),
      { today: TODAY },
    );
    expect(res.flags).not.toContain('sep_60_day');
  });

  it('pregnancy coverage when applicable', () => {
    const res = computeEligibility(
      sit({ pregnant: true, annualIncome: 40000, currentMonthlyIncome: 3000 }),
      { today: TODAY },
    );
    expect(statusOf(res, 'medi_cal_pregnancy')).toBe('eligible');
  });
});
