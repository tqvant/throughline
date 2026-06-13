# How Throughline orchestrates Claude

This is the orchestration spec for judging: how the work is structured, how
Claude verifies its own output, and how another team reruns it. Everything here
is a file in this repo.

## The shape: a self-verifying loop (run twice)

Both features are the same deterministic pipeline. The model proposes; **code
decides**.

```
            ┌──────────────────────────────────────────────────────────┐
 input ───▶ │ 1. GENERATE  (Opus 4.8)  — reason, draft output           │
            └───────────────────────────┬──────────────────────────────┘
 public data / live web ──ground truth──▶│
                                         ▼
            ┌──────────────────────────────────────────────────────────┐
            │ 2. GRADE  (Opus 4.8)  — score each rubric criterion 0–1   │
            └───────────────────────────┬──────────────────────────────┘
       scoreGrade() computes weighted %  │  + critical gates  (code, not model)
                          pass? ◀─────────┤
                            │ no → defects ▼
            ┌──────────────────────────────────────────────────────────┐
            │ 3. REPAIR  (Opus 4.8)  — fix exactly the failed criteria  │──┐
            └──────────────────────────────────────────────────────────┘  │
                                  ▲──────────── re-grade ───────────────────┘
```

| Step | Coverage planner | Emergency finder |
|---|---|---|
| Generate | `llm.ts → generate` reasons about eligibility | `webSearch.ts → search` runs an **agent**: Opus 4.8 + server-side `web_search` |
| Ground truth | `eligibility.ts` (pure, unit-tested, public FPL data) | the live web + citations |
| Grade against | [`rubric.yaml`](./rubric.yaml) (7 criteria) | `HELP_RUBRIC` in `findHelp.ts` (6 criteria) |
| Aggregate | `rubric.ts → scoreGrade` — weights + `critical` gates in code | same |
| Loop | `loop.ts → runNavigator` | `findHelp.ts → runFindHelp` |

The model returns only per-criterion scores. The **weights, the `critical`
flags, and the final pass/fail are computed in `rubric.ts`** — so the model
cannot declare itself passing. A critical criterion failing fails the run even
at a 100% weighted score.

## What we gave Claude

- **Brief:** [`BRIEF.md`](./BRIEF.md) — problem, who it's for, definition of done.
- **Rubrics:** [`rubric.yaml`](./rubric.yaml) (eligibility) and `HELP_RUBRIC` in
  [`findHelp.ts`](./src/lib/findHelp.ts) (emergency resources).
- **Tests:** [`test/`](./test) — the deterministic engine + both loops.
- **Workflow / eval harness:** [`scripts/eval.ts`](./scripts/eval.ts).

## "Done" is verifiable by the model — no human

```bash
npm test          # the deterministic engine is correct (14 assertions)
npm run eval      # every persona → a rubric-passing plan via real Opus 4.8
npm run eval:mock # the full loop, offline & deterministic
```

`npm run eval` exits non-zero if any persona's final output fails the rubric.
A responding deploy + this exit code together are the machine-checkable "done."

## Reusable tool surface (MCP)

The same engine is exposed as **Model Context Protocol** tools so any agent can
call it — see [`mcp/server.ts`](./mcp/server.ts):

- `check_eligibility` — deterministic benefits eligibility (no API key)
- `find_care_resources` — the self-verifying emergency finder

```bash
npm run mcp        # stdio transport
# Claude Code:  claude mcp add throughline -- npx tsx mcp/server.ts
```

## Rerun on a new problem tomorrow

1. Swap the rules (`programs.ts` / `fpl.ts`) and rewrite `rubric.yaml`.
2. Add personas to `scripts/eval.ts`.
3. `npm run eval` → green means done.

The loop engine, grader, verifier, and MCP surface don't change.
