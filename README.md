# Throughline

**Find the health coverage you qualify for between jobs — in minutes, not weeks.**

Throughline is a self-verifying safety-net navigator. Opus 4.8 does the work,
then **grades its own output** against a rubric and **repairs itself** until it
passes. Two modes, same spine:

- **Plan my coverage** — what you qualify for (Medi-Cal, subsidized marketplace,
  the income-drop pathway). Verified against a deterministic eligibility engine
  built on public Federal Poverty Level data + `rubric.yaml`. A **Concierge**
  drafts each application, the appointment message, and call scripts into a
  review-&-approve checklist — you tap to submit/call, you stay the signer.
- **Find care now** — the deadly gap *before* coverage kicks in: an agent
  searches the **live web** (server-side `web_search`) for local, free/low-cost,
  immediate-care resources — free clinics, mobile units, prescription help, and
  **clinical trials that provide free study-related care** — and verifies every
  result is local, real, sourced, and free before showing it.

Built at Claude Build Day. See [`BRIEF.md`](./BRIEF.md) for the problem, the
rubrics, and the definition of done.

**Languages:** the generated guidance (plans, resources, call scripts,
application drafts) is produced in the user's language; the UI ships localized in
English, Spanish, Chinese, Vietnamese, and Tagalog (California's top threshold
languages). See [`src/lib/i18n.ts`](./src/lib/i18n.ts).

**Sustainability:** free for users; engineered to cost little per person (the
eligibility core is deterministic = $0). See [FUNDING.md](./FUNDING.md).

**Model:** defaults to `claude-opus-4-8`; set `BRIDGE_MODEL=claude-fable-5` to
run on Fable 5 (both support the `web_search_20260209` server tool). The rest of
the API surface is identical.

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

**The live deployment runs real Opus 4.8 + live web search** (the API key is
configured). Plan mode generates and self-grades a real plan; "Find care now"
searches the live web for real local clinics with working call/apply links.

No key? The app falls back to a **deterministic offline mode** that runs the full
generate → grade → repair loop with no API calls — handy for tests, development,
and a Wi-Fi-proof backup:

```bash
npm run eval:mock                 # the whole loop, offline
```

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

## Use it from another agent (MCP)

The same engine is exposed as Model Context Protocol tools — `check_eligibility`
(deterministic, no key) and `find_care_resources` — so Claude Desktop, Claude
Code, or any agent can call Throughline directly. See
[`mcp/server.ts`](./mcp/server.ts) and [WORKFLOW.md](./WORKFLOW.md).

```bash
npm run mcp                                   # run the server (stdio)
claude mcp add throughline -- npx tsx mcp/server.ts   # add to Claude Code
```

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
