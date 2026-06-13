// Throughline — end-to-end rubric eval. This is the "done is verifiable by the
// model without a human" artifact: it runs a set of personas through the full
// generate -> grade -> repair loop and asserts every final plan PASSES the
// rubric. Exits non-zero if any persona fails.
//
//   npm run eval        # uses real Opus 4.8 if ANTHROPIC_API_KEY is set
//   npm run eval:mock   # deterministic, offline, no key/credits needed
//
// Another team can drop in new personas or a new rubric.yaml and rerun this to
// re-verify the whole system — no code changes required.

import { runNavigator } from '../src/lib/loop';
import { mockProvider } from '../src/lib/mockProvider';
import type { NavigatorProvider, Situation } from '../src/lib/types';

const useMock = process.argv.includes('--mock') || !process.env.ANTHROPIC_API_KEY;

const PERSONAS: { name: string; situation: Situation }[] = [
  {
    name: 'Laid-off CA family of 3 (the demo story)',
    situation: {
      state: 'CA', householdSize: 3, annualIncome: 145000, currentMonthlyIncome: 1800,
      reason: 'job_loss', hasChildren: true, pregnant: false, lostCoverageDate: '2026-05-22',
    },
  },
  {
    name: 'Single person, big salary, $0 income now',
    situation: {
      state: 'CA', householdSize: 1, annualIncome: 120000, currentMonthlyIncome: 0,
      reason: 'job_loss', hasChildren: false, pregnant: false, lostCoverageDate: '2026-06-01',
    },
  },
  {
    name: 'Couple in the marketplace-subsidy range',
    situation: {
      state: 'CA', householdSize: 2, annualIncome: 70000, currentMonthlyIncome: 5800,
      reason: 'reduced_hours', hasChildren: false, pregnant: false,
    },
  },
  {
    name: 'Pregnant applicant, modest income',
    situation: {
      state: 'CA', householdSize: 2, annualIncome: 40000, currentMonthlyIncome: 3000,
      reason: 'job_loss', hasChildren: false, pregnant: true, lostCoverageDate: '2026-05-30',
    },
  },
];

async function main() {
  let provider: NavigatorProvider = mockProvider;
  if (!useMock) {
    const { anthropicProvider } = await import('../src/lib/llm');
    provider = anthropicProvider;
  }

  console.log(`\nThroughline rubric eval — provider: ${provider.name}\n${'─'.repeat(64)}`);

  let failed = 0;
  for (const p of PERSONAS) {
    const res = await runNavigator(p.situation, provider);
    if (!res.passed) failed += 1;
    const first = res.iterations[0].grade.overall;
    const last = res.final.grade.overall;
    const arc = first === last ? `${last}/100` : `${first}→${last}/100`;
    console.log(
      `${res.passed ? 'PASS ✓' : 'FAIL ✗'}  ${arc.padEnd(12)} ${res.iterations.length} pass(es)  ${p.name}`,
    );
  }

  console.log('─'.repeat(64));
  if (failed === 0) {
    console.log(`All ${PERSONAS.length} personas produced rubric-passing plans. ✓\n`);
    process.exit(0);
  } else {
    console.log(`${failed}/${PERSONAS.length} personas FAILED the rubric. ✗\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
