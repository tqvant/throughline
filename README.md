# Throughline

**Find the health coverage you qualify for between jobs — in minutes, not weeks.**

Throughline is a self-verifying benefits navigator. Opus 4.8 drafts a personalized
coverage plan, then **grades its own work** against a deterministic eligibility
engine and a committed `rubric.yaml`, and **repairs itself** until it passes.

Built at Claude Build Day. See [`BRIEF.md`](./BRIEF.md) for the problem, the
rubric, and the definition of done.

![the self-verifying loop: a draft scores 70/100 and fails three checks, then a self-repair pass scores 100/100 and passes](#)

---

## Why it's different

A wrong benefits answer is worse than no answer. So Throughline never trusts one
model pass:

```
                 ┌─────────────────────────────────────────────┐
   situation ──▶ │ Opus 4.8: GENERATE plan (reasons; no answer) │
                 └───────────────────────┬─────────────────────┘
                                         ▼
   public FPL data ─▶ deterministic   ┌────────────────────────────┐
   eligibility engine ──ground truth─▶│ Opus 4.8: GRADE vs rubric + │
                                      │ ground truth, per criterion │
                                      └───────────┬────────────────┘
                                       pass?      │  fail → defects
                                    ◀─────────────┤
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │ Opus 4.8: REPAIR the defects   │──┐
                                  └───────────────────────────────┘  │
                                              ▲                       │
                                              └───────── re-grade ────┘
```

The **model proposes** per-criterion scores; **deterministic code disposes** —
the weights, the `critical` gates, and the final pass/fail are computed in
[`src/lib/rubric.ts`](./src/lib/rubric.ts), so the model cannot declare itself
passing.

## Quickstart

```bash
# 1. install (Node 18+)
npm install

# 2. add your key (your Build Day credits live at console.anthropic.com)
cp .env.example .env.local        # then paste your ANTHROPIC_API_KEY

# 3. run it
npm run dev                       # http://localhost:3000
```

No key handy? Everything still runs in **deterministic offline mode** — the full
generate → grade → repair loop, no API calls:

```bash
npm run eval:mock                 # the whole loop, offline
```

The web app auto-falls back to offline mode when no key is present, so the live
demo survives flaky Wi-Fi.

## Verify it (this is the "done" definition)

```bash
npm test          # deterministic eligibility engine — 12 assertions
npm run eval      # every persona → a rubric-passing plan via real Opus 4.8
npm run eval:mock # same end-to-end loop, offline & deterministic
```

`npm run eval` exits non-zero if any persona's final plan fails the rubric.

## How it works

| File | Role |
|------|------|
| [`src/lib/fpl.ts`](./src/lib/fpl.ts) | Public HHS Federal Poverty Level table — the single source of truth for every dollar threshold |
| [`src/lib/programs.ts`](./src/lib/programs.ts) | Program catalog (Medi-Cal, Covered California, FQHCs, COBRA, EDD, Rx) as pure eligibility predicates |
| [`src/lib/eligibility.ts`](./src/lib/eligibility.ts) | The deterministic engine → **ground truth** + machine flags |
| [`rubric.yaml`](./rubric.yaml) | The canonical grading rubric the model grades against |
| [`src/lib/rubric.ts`](./src/lib/rubric.ts) | Loads the rubric; computes the weighted score + pass/fail in code |
| [`src/lib/llm.ts`](./src/lib/llm.ts) | The real Opus 4.8 provider: `generate`, `grade`, `repair` via tool-use |
| [`src/lib/mockProvider.ts`](./src/lib/mockProvider.ts) | Deterministic offline provider (tests + venue insurance) |
| [`src/lib/loop.ts`](./src/lib/loop.ts) | The provider-agnostic self-verifying loop |
| [`scripts/eval.ts`](./scripts/eval.ts) | The rerunnable verification harness |

## Deploy to a live URL (Vercel)

The fastest path, non-developer friendly:

1. Push this repo to GitHub (it must be public for the hackathon).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Add one Environment Variable: `ANTHROPIC_API_KEY` = your key.
4. Deploy. Vercel builds and gives you a live `https://…vercel.app` URL.

Or from the CLI: `npx vercel` then `npx vercel --prod` (set the env var in the
dashboard or with `npx vercel env add ANTHROPIC_API_KEY`).

## Data & safety

- Federal Poverty Level figures are public HHS data
  ([source](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines)).
  Update the constants in `src/lib/fpl.ts` to the current year — everything
  downstream recomputes.
- Throughline does **benefits navigation only**. It does not diagnose, treat, or give
  medical advice. Final eligibility is always determined by each program.
- No personal data is stored; the situation is sent only to the model to produce
  the plan.

## Tech

Next.js 14 (App Router) · TypeScript · Anthropic SDK (Opus 4.8) · Vitest.
