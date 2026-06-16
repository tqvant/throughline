# Throughline — Live Artifact

**A self-verifying safety-net navigator for people who lose their health coverage when they lose their job.**

▶︎ **Live demo:** https://throughline-opal.vercel.app  ·  **Repo:** https://github.com/tqvant/throughline  ·  **Build log:** https://github.com/tqvant/throughline/blob/main/session-log.md

> _The live demo loads instantly by default (a deterministic path), so it never hangs in front of a reviewer. An optional **Live AI** toggle runs real Opus 4.8 + live web search (~1 minute)._

---

## Short version (for tight fields)

Throughline turns "I just lost my job and my health insurance" into a verified, actionable plan. It tells you what coverage you may qualify for — checked against a deterministic eligibility engine built on public 2026 Federal Poverty Level data, not a chatbot guess — finds local free/low-cost care for the gap before coverage starts, and drafts the applications, appointment messages, and call scripts into a review-and-approve checklist (you stay the signer). Built on Opus 4.8 with a self-verifying generate → grade → repair loop where **code**, not the model, computes the final pass/fail. Localized in 5 languages. Benefits navigation only — never medical advice.

---

## The problem

When you lose your job, you usually lose your health insurance the same week — and the official "bridge," COBRA, can be brutally expensive. Throughline was built by a founder who lived it: laid off, suddenly uninsured, and quoted about **$3,400/month** to keep COBRA for a California family of three. In that moment people are panicked and on the clock; the help that exists (Medi-Cal, subsidized Covered California, free clinics) is real but scattered across confusing government sites, and a wrong guess about eligibility can cost real money and real coverage.

## What it does

Throughline turns "what do I do?" into a concrete, checkable plan. Two modes, one trustworthy engine:

- **Plan my coverage** — surfaces what you may qualify for (Medi-Cal, subsidized Covered California), checked against a deterministic eligibility engine on public **2026 Federal Poverty Level** data. It catches the detail almost everyone misses: Medi-Cal looks at your *current* monthly income, not last year's salary, so the newly laid-off often qualify for $0 coverage — while staying honest that approval takes a few weeks. _(Eligibility is an estimate to act on, not a guarantee of approval.)_
- **Find care now** — an agent finds local free/low-cost resources to cover the gap *before* new coverage starts, each with a real source link.
- **Concierge** — drafts each application, the appointment message, and the call scripts into a review-and-approve checklist. **You stay the signer, always.**
- **Localized in 5 languages** (English, Spanish, Chinese, Vietnamese, Tagalog). Benefits navigation only — never medical advice.

## Try it in 30 seconds

1. Open **https://throughline-opal.vercel.app** — it loads fast (the homepage responded in ~0.1s in our check).
2. On **Plan my coverage**, the form is pre-filled with an example (California, household of 3, last year's income, this month's income). Click **Find my coverage**. In about a second you get a plain-English summary, a **confidence score** with "passed all 8 quality checks," the urgent next steps, and a Concierge checklist with ready-to-paste application drafts, an appointment message, and call scripts.
3. Switch to **Find care now**, fill **Where are you?** (e.g. *Oakland, CA*) and **What do you need?** (e.g. *clinic*), and click **Find care near me now** — you get five free/low-cost resources, each with a working source link (HRSA health centers, 211, free-clinic and medication-assistance directories, ClinicalTrials.gov).
4. Want to see the real model work? Flip the **Live AI** toggle in the footer — that runs live Opus 4.8 plus real web search (~1 minute). Off by default, so the demo stays instant.
5. Change language with the dropdown in the **top-right** (English · Español · 中文 · Tiếng Việt · Tagalog).

## Why it's credible

Throughline never lets the AI grade its own pass/fail. Every plan runs through **one self-verifying loop — generate → grade against a rubric and deterministic ground truth → repair** — and crucially, the model only *proposes* per-criterion scores while **code** computes the weighted result, the critical safety gates, and the final pass/fail. The model can't talk itself into a passing grade.

Independently verified on **2026-06-16** (live app, links, and test suite):

- **The live app works.** Every checked endpoint returned successfully and fast — the homepage (~0.1s), a full eligibility plan (summary + urgent actions, self-graded *pass*, ~1s), and the find-care results (~0.2s, five resources each with a source link).
- **The links are real.** All 12 external links resolved to HTTP 200 — including all 8 safety-net resources (HRSA, 211, Covered California, Medi-Cal, CA EDD, ClinicalTrials.gov, and more). No dead links.
- **The eligibility math is checkable, not hand-wavy.** It runs on published 2026 FPL constants in code, scored by a rubric of **8 criteria and 4 hard safety gates**.
- **It's tested.** The test suite is **16 tests / 42 assertions** (`npm test`, passing). The repo also ships an eval harness — `npm run eval` runs personas through the full generate → grade → repair loop and asserts each final plan passes the rubric (using the real model when an API key is set); `npm run eval:mock` runs the same harness fully offline.

## Built with

Anthropic **Opus 4.8** (the generate / grade / repair loop, a server-side web-search agent, and MCP tools `check_eligibility` + `find_care_resources`), **Next.js** (App Router, TypeScript), deployed on **Vercel**.

## Links

- **Live demo:** https://throughline-opal.vercel.app
- **Repo:** https://github.com/tqvant/throughline
- **Session log (how it was built, with Claude Code):** https://github.com/tqvant/throughline/blob/main/session-log.md
