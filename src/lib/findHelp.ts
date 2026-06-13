// The "find care near me — now" loop: search the live web -> grade the results
// against a rubric -> repair gaps -> until they pass. Same self-verifying spine
// as the eligibility navigator, applied to live web data. Provider-agnostic.

import { scoreGrade, type Rubric } from './rubric';
import type {
  FindHelpInput,
  FindHelpResult,
  HelpFinder,
  HelpIteration,
} from './types';

// The bar a list of emergency-gap resources must clear. Embedded in code (not
// YAML) because it is small and shared between the grader and the scorer; the
// eligibility rubric lives in rubric.yaml as the canonical editable artifact.
export const HELP_RUBRIC: Rubric = {
  name: 'Emergency-gap resource rubric',
  version: 1,
  pass_threshold: 85,
  criteria: [
    {
      id: 'locality',
      name: 'Resources are actually near the location given',
      weight: 25,
      critical: true,
      description:
        'Every resource is in or serves the requested location — not a national 800-number list or a different city.',
    },
    {
      id: 'cost_clarity',
      name: 'Each resource states what it costs',
      weight: 20,
      critical: true,
      description:
        'Free, sliding-scale, or low-cost is stated for each resource. Someone with no coverage must know they can afford it.',
    },
    {
      id: 'real_sourced',
      name: 'Resources are real and sourced, not invented',
      weight: 20,
      critical: true,
      description:
        'Each resource is backed by a web page or a community source. No fabricated clinics, addresses, or phone numbers.',
    },
    {
      id: 'actionability',
      name: 'You can act on each one today',
      weight: 15,
      critical: false,
      description: 'Each resource has a phone number, address, or URL — a concrete way to reach it now.',
    },
    {
      id: 'coverage',
      name: 'Covers more than one kind of help',
      weight: 10,
      critical: false,
      description:
        'The list spans multiple resource kinds (e.g. a clinic, a mobile/urgent option, and prescription help) rather than five of the same thing.',
    },
    {
      id: 'safety_navigation_only',
      name: 'Resource-finding only — no medical advice',
      weight: 10,
      critical: true,
      description:
        'The output points to places to get care. It does not diagnose, recommend treatments, or tell the person what is wrong with them.',
    },
  ],
};

export interface RunFindHelpOptions {
  maxIterations?: number;
}

export async function runFindHelp(
  input: FindHelpInput,
  finder: HelpFinder,
  opts: RunFindHelpOptions = {},
): Promise<FindHelpResult> {
  const maxIterations = opts.maxIterations ?? 3;
  const iterations: HelpIteration[] = [];

  let { resources } = await finder.search(input);
  let grade = scoreGrade(await finder.grade({ input, resources }), HELP_RUBRIC);
  iterations.push({ index: 0, label: 'Initial web search', resources, grade });

  let i = 1;
  while (!grade.pass && i < maxIterations) {
    const failures = grade.criteria.filter((c) => !c.passed);
    ({ resources } = await finder.repair({ input, previous: resources, failures }));
    grade = scoreGrade(await finder.grade({ input, resources }), HELP_RUBRIC);
    iterations.push({ index: i, label: `Self-repair pass ${i}`, resources, grade });
    i += 1;
  }

  const final = iterations[iterations.length - 1];
  return {
    input,
    iterations,
    final,
    passed: final.grade.pass,
    provider: finder.name,
  };
}
