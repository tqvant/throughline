# Demo scripts

Two scripts: the **60-second submission video** and the **3-minute stage demo**.
Both center the moment the judges asked for: *Claude catching and fixing its own
failure.*

---

## 60-second submission video

> Record the live app (use the demo story, which is pre-filled). Keep talking
> while the loop runs — the score climb is the hero shot.

**[0:00–0:12] The problem, from life.**
"When I lost my job, I lost my family's health insurance. COBRA was quoted at
$3,400 a month. I spent weeks lost in county websites. The help exists — I just
couldn't find it in time. This is Throughline."

**[0:12–0:22] One input.**
"I describe my situation: family of three in California, made $145k last year,
almost nothing coming in now." *(Click **Find my coverage**.)*

**[0:22–0:42] The hero shot — Claude grades and repairs itself.**
"Opus 4.8 drafts a plan — then grades its own work against our rubric and a
deterministic eligibility engine. Watch: the first draft scores **70 and fails
three checks** — it missed that Medi-Cal looks at *current* income, not last
year's salary, so my family qualifies for free coverage *today*. It catches its
own mistake, repairs it, and re-grades to **100. Passed.**"

**[0:42–0:55] The payoff.**
"Out comes a verified plan: apply for Medi-Cal today, here's where, here's what
to bring, here's the 60-day deadline — and free clinics covering me in the
meantime. Weeks of navigation, in under a minute."

**[0:55–1:00] Close.**
"Throughline. The safety net, made findable — with a machine-checked guarantee."

---

## 3-minute stage demo

**Slide:** the single provided intro slide (team name + members).

**1. The story (30s).** Tell it straight: job loss, lost coverage, the $3,400
COBRA quote, weeks lost navigating. "The programs exist. Findability is the
problem — and a wrong answer costs you a deadline."

**2. The build, in one breath (20s).** "Throughline is a self-verifying loop: a
deterministic eligibility engine on public Poverty Level data is the ground
truth; Opus 4.8 generates the plan, grades it against a committed `rubric.yaml`,
and repairs itself until it passes."

**3. Live demo (90s).** Run the demo story.
- Narrate the **70 → fails 3 checks → 100 → passes** arc. Point at the red
  ✗ criteria and the amber `→ fix:` lines. *"This is the model catching its own
  mistake and telling itself exactly how to fix it."*
- Scroll the final plan: Medi-Cal today, the 60-day deadline, free clinics now.

**4. How we directed Claude + how it verifies itself (40s).** Show the repo:
- `BRIEF.md` — the brief and definition of done.
- `rubric.yaml` — the bar, in plain text. *"Swap this file, rerun, new domain."*
- Terminal: `npm run eval` → "every persona produces a rubric-passing plan, or
  it exits non-zero. Done is verified by the model, no human in the loop."
- Mention: *"We caught a real bug live during the build — the rubric loader was
  path-fragile; the running app surfaced it, we hardened it, eval went green."*

**Q&A readies:**
- *Hallucinated benefits?* "The grader checks every claim against deterministic
  ground truth; fabricated programs fail `eligibility_accuracy`, which is
  critical."
- *Medical advice risk?* "`safety_navigation_only` is a critical criterion; the
  plan is eligibility navigation only."
- *Generalize?* "The loop is domain-agnostic. New rules + new `rubric.yaml` +
  new personas = a new self-verifying navigator. Same engine."
- *Offline?* "Full loop runs deterministically with no key — the demo can't be
  killed by the Wi-Fi."
