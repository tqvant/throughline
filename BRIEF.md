# Throughline — Build Day Brief

> The brief I gave Claude, the rubric it grades against, and what "done" means.
> This is the orchestration spec: another team could point Claude at a new
> domain with a new `rubric.yaml` and rerun the exact same loop.

## The problem

When you lose your job, you lose your health coverage at the worst possible
time. The safety net that exists for exactly this moment — Medicaid/Medi-Cal,
subsidized marketplace plans, community health centers, prescription
assistance — is real and generous, but it is scattered across a dozen agencies,
written in eligibility jargon, and gated behind deadlines most people never
hear about. So families default to the one option that's easy to find and the
worst deal on the table: COBRA at $3,000–$4,000/month for a family of three.

The single most expensive misconception: **"I made too much last year to
qualify for free coverage."** Medicaid/Medi-Cal eligibility is based on your
**current monthly income**, not last year's salary. A laid-off worker with
little income this month usually qualifies for $0 coverage *immediately* — and
almost no one tells them.

## Who it's for

Anyone in a coverage gap — laid off, hours cut, aging off a parent's plan —
who has days, not weeks, to figure out what they qualify for. Built from the
founder's own experience navigating this gap for a family of three in
California.

## What it does

Throughline turns a short description of your situation into a **verified,
personalized benefits action plan**: which programs you qualify for right now,
why, where to apply, what to bring, what to say on the phone, and which
deadlines are ticking.

## Why this is hard to do safely (and why the architecture matters)

A wrong benefits answer is worse than none — it sends a stressed family down a
dead-end application or has them miss a 60-day window. So Throughline never trusts a
single model pass. It runs a **self-verifying loop**:

1. A **deterministic eligibility engine** (`src/lib/eligibility.ts`) computes
   ground-truth eligibility from public Federal Poverty Level data. Pure
   functions, fully unit-tested.
2. **Opus 4.8 generates** a plan from the raw situation — it has to *reason*
   about eligibility, like a real navigator. It is **not** handed the answer.
3. **Opus 4.8 grades** that plan against `rubric.yaml` **and** the ground
   truth, criterion by criterion, flagging any missed program, wrong number,
   or unaddressed deadline.
4. If it fails, Opus 4.8 **repairs** the specific defects and the loop
   **re-grades** — until the plan passes or hits the iteration cap.

The model proposes; deterministic code disposes. The final weighted score and
pass/fail are computed in `src/lib/rubric.ts`, not asserted by the model.

## The rubric (what "good" means)

The canonical rubric lives in [`rubric.yaml`](./rubric.yaml). A plan passes only
if its weighted score ≥ 90 **and** zero `critical` criteria fail. Criteria:

| id | critical | what it checks |
|----|----------|----------------|
| `completeness` | ✓ | covers every program the engine recommends |
| `eligibility_accuracy` | ✓ | numbers/thresholds match ground truth; nothing fabricated |
| `income_drop_pathway` | ✓ | surfaces the current-monthly-income Medicaid pathway |
| `deadline_urgency` |   | flags the 60-day SEP / COBRA windows |
| `actionability` |   | where to apply + documents to bring |
| `safety_navigation_only` | ✓ | benefits navigation only — no medical advice |
| `plain_empathetic` |   | plain language, acknowledges the stress |

## Definition of done (verifiable by the model, no human needed)

- `npm test` — the deterministic engine is correct (12 assertions).
- `npm run eval` — every persona produces a **rubric-passing** plan through the
  real Opus 4.8 loop; exits non-zero otherwise.
- `npm run eval:mock` — the same end-to-end loop, deterministic and offline.
- A responding deployed URL serving the live app.

## How another team reruns this tomorrow on a new problem

1. Replace the program catalog (`src/lib/programs.ts`) and the public-data
   table (`src/lib/fpl.ts`) with the new domain's rules.
2. Rewrite `rubric.yaml` for the new definition of "good."
3. Add personas to `scripts/eval.ts`.
4. Run `npm run eval`. Green means done. The loop engine, the grader, and the
   verification harness do not change.

## Explicitly NOT this

Not a medical-advice bot, not a chatbot, not a dashboard, not a RAG demo. It
diagnoses nothing and treats nothing. It is eligibility navigation with a
machine-checked guarantee.
