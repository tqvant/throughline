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

function baseResources(loc: string): HelpResource[] {
  return [
    {
      name: `${loc} Free Clinic`,
      kind: 'free_clinic',
      description: 'Volunteer-staffed clinic offering primary care at no cost.',
      whyItHelps: 'Covers you for an urgent primary-care visit while you have no insurance.',
      cost: 'free',
      address: `Downtown ${loc}`,
      phone: '(555) 010-2000',
      hours: 'Walk-in Tue/Thu 9am–1pm',
      sourceUrl: 'https://www.freeclinics.com',
      sourceType: 'web',
    },
    {
      name: `${loc} Community Health Center (FQHC)`,
      kind: 'community_health_center',
      description: 'Federally Qualified Health Center with sliding-scale fees.',
      whyItHelps: 'Charges based on income — often $0–$40 — regardless of insurance or immigration status.',
      cost: 'sliding_scale',
      address: `${loc}, CA`,
      phone: '(555) 010-3000',
      // First-pass omission: no sourceUrl yet → fails "real_sourced".
      sourceType: 'web',
    },
  ];
}

function repairedResources(loc: string): HelpResource[] {
  const base = baseResources(loc);
  base[1].sourceUrl = 'https://findahealthcenter.hrsa.gov';
  return [
    ...base,
    {
      name: `${loc} County Mobile Health Van`,
      kind: 'mobile_unit',
      description: 'Pop-up mobile clinic that rotates through neighborhoods weekly.',
      whyItHelps: 'Brings free basic care and screenings to you while applications process.',
      cost: 'free',
      hours: 'Schedule posted weekly',
      phone: '(555) 010-4000',
      sourceUrl: 'https://www.example-county.gov/mobile-health',
      sourceType: 'web',
    },
    {
      name: 'Prescription assistance (NeedyMeds · GoodRx · 340B)',
      kind: 'prescription',
      description: 'Discount and patient-assistance programs for medications.',
      whyItHelps: 'Keeps prescriptions affordable during the gap, even before new coverage starts.',
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
    {
      name: `r/${loc.replace(/\s+/g, '')} — community mutual-aid thread`,
      kind: 'community_tip',
      description: 'Locals share which clinics and pop-ups actually help right now.',
      whyItHelps: 'Crowd-sourced, up-to-date leads on free care — verify before relying on any single tip.',
      cost: 'unknown',
      sourceUrl: 'https://www.reddit.com',
      sourceType: 'community',
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
