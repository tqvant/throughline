# Keeping Throughline free — sustainability model

Throughline is free for the people who use it. Here's how it stays running, and
how it's engineered to cost very little per person helped.

## 1. Be cheap by design (token efficiency)

The expensive part of most AI apps is calling the model for everything.
Throughline doesn't.

- **Deterministic core = $0.** Eligibility is computed by a pure rules engine on
  public Federal Poverty Level data (`src/lib/eligibility.ts`) — no model call.
  The model is only used for the *narrative*, the grading, and the live search.
- **Stop early.** The self-verifying loop caps at 3 iterations and exits the
  moment a plan passes — most pass in 1–2.
- **Cheaper tiers for sub-tasks.** Generation/grading default to `claude-opus-4-8`;
  high-volume or low-stakes steps can drop to Sonnet/Haiku via one env var
  (`BRIDGE_MODEL`) with no code change.
- **Prompt caching.** The system prompt + rubric are stable prefixes — cache them
  so repeat sessions pay ~0.1× on the shared portion.
- **Offline mode.** Deterministic mock providers mean demos, tests, and
  development burn zero tokens (`npm run eval:mock`).
- **Web search only where it earns its cost** — the live-search agent runs only
  in "Find care now," with `max_uses` caps on the tool.

Net effect: a typical session is a handful of model calls, and the highest-value
output (eligibility) is free.

## 2. Where the money comes from

- **Anthropic / cloud social-good credits.** Apply to Anthropic's and cloud
  providers' nonprofit / social-impact credit programs — Throughline is a clean
  fit (public benefit, public data, no medical advice).
- **Foundation grants.** Health-access and digital-equity funders (e.g.
  California Health Care Foundation, Robert Wood Johnson, local community
  foundations). *Meta-play:* the same web-search + draft agent can find relevant
  grants and pre-draft applications for the org — funding the platform with the
  platform. (Roadmap; reuses `webSearch.ts`.)
- **Civic partnerships.** County health departments, workforce/EDD offices, and
  211 lines already serve this exact population and have budgets — license or
  co-fund a localized instance.
- **B2B2C, end-user always free.** White-label to outplacement firms, unions,
  and COBRA/benefits administrators who hand it to people they're laying off.
  They pay; the laid-off person never does.
- **Sponsor-a-navigation.** Individual/corporate donors fund N sessions; cost is
  low (see §1), so a modest gift covers many people.

## 3. Roadmap — autonomous execution (consented, human-approved)

Today the agent **prepares everything** (fills applications, drafts the
appointment message, writes call scripts) and the user reviews and submits/calls
with one tap — see the "Your action plan" checklist. The user stays the legal
actor.

The path to doing more *for* people, safely:

1. **Authorized Representative flow.** Let the user formally designate Throughline
   (or a partner navigator) as their AR via the proper form — the legitimate,
   legal way to submit benefits applications on someone's behalf.
2. **API-based submission** where programs expose it (some marketplaces / county
   systems), gated behind explicit per-action approval.
3. **Assisted calling, not robo-calling.** Click-to-call connects the user to the
   office with the script on screen; optionally an AI warm-up navigates the phone
   tree to a human, then hands off. (No autonomous calls — TCPA, two-party
   consent in CA, and clinics' patient-verification rules.)

The guardrail is constant: **anything irreversible or outward-facing stops at a
human approval gate** unless the user has formally authorized representation.
