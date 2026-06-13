// Deterministic, offline emergency-gap finder. Reproduces the search -> grade
// -> repair arc with no API key: the first pass returns a thin, partly-unsourced
// list (fails "coverage" and "real_sourced"); the repair pass fills in a mobile
// unit and prescription help with sources, and it passes.

import type {
  CriterionResult,
  FindHelpInput,
  HelpFinder,
  HelpResource,
} from './types';

// REAL national safety-net entry points (work for any location, with live
// links) — used offline / when no key is set, so results are always real and
// clickable, never placeholder data.
function baseResources(loc: string): HelpResource[] {
  return [
    {
      name: `Federally funded health center near ${loc}`,
      kind: 'community_health_center',
      description: 'HRSA-funded community health centers provide primary, dental, and behavioral care on a sliding scale. Use the official locator to find one near you.',
      whyItHelps: 'Charges based on income — often $0–$40 — regardless of insurance or immigration status.',
      cost: 'sliding_scale',
      sourceUrl: 'https://findahealthcenter.hrsa.gov',
      sourceType: 'web',
    },
    {
      name: '211 — free local health & social-service referrals',
      kind: 'hotline',
      description: 'Call 211 or search 211.org for free referrals to local clinics, prescription help, and care during a coverage gap.',
      whyItHelps: 'A real person helps you find local resources fast — free, around the clock.',
      cost: 'free',
      phone: '211',
      // First-pass omission: no sourceUrl yet → fails "real_sourced", triggering a repair.
      sourceType: 'web',
    },
  ];
}

function repairedResources(loc: string): HelpResource[] {
  const base = baseResources(loc);
  base[1].sourceUrl = 'https://www.211.org';
  return [
    ...base,
    {
      name: 'Free & charitable clinics finder (NAFC)',
      kind: 'free_clinic',
      description: 'Find free and charitable clinics in your area through the National Association of Free & Charitable Clinics.',
      whyItHelps: 'Free or very low-cost care for the uninsured while you wait for coverage.',
      cost: 'free',
      sourceUrl: 'https://www.nafcclinics.org/find-clinic',
      sourceType: 'web',
    },
    {
      name: 'Prescription assistance — NeedyMeds & GoodRx',
      kind: 'prescription',
      description: 'Patient-assistance programs and discount tools that lower medication costs during the gap.',
      whyItHelps: 'Keeps prescriptions affordable even before new coverage starts.',
      cost: 'low_cost',
      sourceUrl: 'https://www.needymeds.org',
      sourceType: 'web',
    },
    {
      name: 'Clinical trials near you (ClinicalTrials.gov)',
      kind: 'clinical_trial',
      description: 'Research studies that provide free study-related care and medications to eligible participants.',
      whyItHelps:
        'If you qualify, a trial can cover study-related visits, tests, and medication at no cost during the gap. Search by your condition and location, then ask the study team exactly what is covered.',
      cost: 'free',
      sourceUrl: 'https://clinicaltrials.gov',
      sourceType: 'web',
    },
  ];
}

function distinctKinds(resources: HelpResource[]): number {
  return new Set(resources.map((r) => r.kind)).size;
}

export const mockHelpFinder: HelpFinder = {
  name: 'mock:web',

  async search(input: FindHelpInput) {
    return { resources: baseResources(input.location) };
  },

  async grade({ resources }) {
    const allSourced = resources.every((r) => !!r.sourceUrl);
    const allCosted = resources.every((r) => r.cost !== 'unknown' || r.sourceType === 'community');
    const allActionable = resources.every((r) => !!(r.phone || r.address || r.sourceUrl));
    const kinds = distinctKinds(resources);

    const r = (
      id: string,
      score: number,
      passed: boolean,
      reasoning: string,
      fix?: string,
    ): CriterionResult => ({ id, name: id, weight: 0, critical: false, score, passed, reasoning, fix });

    return [
      r('locality', 1, true, 'Resources are scoped to the requested location.'),
      r(
        'cost_clarity',
        allCosted ? 1 : 0.5,
        allCosted,
        allCosted ? 'Every resource states a cost.' : 'A resource is missing a cost level.',
      ),
      r(
        'real_sourced',
        allSourced ? 1 : resources.filter((x) => x.sourceUrl).length / Math.max(1, resources.length),
        allSourced,
        allSourced ? 'Every resource has a source link.' : 'One or more resources have no source link.',
        allSourced ? undefined : 'Add a source URL for every resource.',
      ),
      r('actionability', allActionable ? 1 : 0.5, allActionable, allActionable ? 'Each resource has a way to reach it.' : 'Some resources lack contact info.'),
      r(
        'coverage',
        Math.min(1, kinds / 3),
        kinds >= 3,
        kinds >= 3 ? `Spans ${kinds} kinds of help.` : `Only ${kinds} kind(s) of resource — too narrow.`,
        kinds >= 3 ? undefined : 'Add other kinds: a mobile/urgent option and prescription help.',
      ),
      r('safety_navigation_only', 1, true, 'Resource-finding only; no medical advice.'),
    ];
  },

  async repair({ input }) {
    return { resources: repairedResources(input.location) };
  },
};
