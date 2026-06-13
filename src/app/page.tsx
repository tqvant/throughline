'use client';

import { useState } from 'react';
import type { CriterionResult, Iteration, NavigatorResult } from '@/lib/types';

type ApiResult = NavigatorResult & { usedMock: boolean };

interface FormState {
  state: string;
  householdSize: number;
  annualIncome: number;
  currentMonthlyIncome: number;
  reason: string;
  hasChildren: boolean;
  pregnant: boolean;
  lostCoverageDate: string;
  notes: string;
}

const DEMO_STORY: FormState = {
  state: 'CA',
  householdSize: 3,
  annualIncome: 145000,
  currentMonthlyIncome: 1800,
  reason: 'job_loss',
  hasChildren: true,
  pregnant: false,
  lostCoverageDate: '2026-05-22',
  notes:
    'Family of 3 in California. COBRA was quoted at ~$3,400/month. Managing a chronic condition and need to keep seeing a doctor during the gap.',
};

const BLANK: FormState = {
  state: 'CA',
  householdSize: 1,
  annualIncome: 0,
  currentMonthlyIncome: 0,
  reason: 'job_loss',
  hasChildren: false,
  pregnant: false,
  lostCoverageDate: '',
  notes: '',
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function meterColor(score: number): string {
  if (score >= 90) return '#1f7a3d';
  if (score >= 60) return '#b4690e';
  return '#b3261e';
}

export default function Page() {
  const [form, setForm] = useState<FormState>(DEMO_STORY);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<ApiResult | null>(null);
  const [revealed, setRevealed] = useState<Iteration[]>([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function run() {
    setRunning(true);
    setError('');
    setResult(null);
    setRevealed([]);
    setScore(0);
    setDone(false);
    setStatus('Opus 4.8 is drafting your benefits plan…');

    try {
      const res = await fetch('/api/navigate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ situation: form }),
      });
      const data = (await res.json()) as ApiResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);

      setResult(data);
      await reveal(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('');
    } finally {
      setRunning(false);
    }
  }

  async function reveal(data: ApiResult) {
    for (let k = 0; k < data.iterations.length; k++) {
      const iter = data.iterations[k];
      setStatus(
        k === 0
          ? 'Grading the draft against rubric.yaml (7 checks)…'
          : `Self-repairing ${data.iterations[k - 1].grade.criteria.filter((c) => !c.passed).length} failed checks, then re-grading…`,
      );
      await delay(k === 0 ? 1100 : 1500);
      setRevealed((prev) => [...prev, iter]);
      setScore(iter.grade.overall);
      await delay(900);
    }
    setStatus('');
    setDone(true);
  }

  const final = result?.final;

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="logo">
          Throughline<span className="dot">.</span>
        </div>
        <div className="tagline">Find the coverage you qualify for between jobs — in minutes, not weeks.</div>
      </header>
      <p className="subnote">
        Opus 4.8 drafts a plan, then <b>grades its own work</b> against <code>rubric.yaml</code> and a
        deterministic eligibility engine, and <b>repairs itself</b> until it passes. Built on public Federal
        Poverty Level data. Benefits navigation only — not medical advice.
      </p>

      <div className="grid">
        {/* ---------------- Form ---------------- */}
        <div className="card">
          <h2>Your situation</h2>
          <p className="hint">Nothing is stored. This drives a real eligibility calculation.</p>

          <div className="row">
            <div>
              <label>State</label>
              <input type="text" value={form.state} maxLength={2} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div>
              <label>Household size</label>
              <input
                type="number"
                min={1}
                value={form.householdSize}
                onChange={(e) => set('householdSize', Number(e.target.value))}
              />
            </div>
          </div>

          <label>Last year&apos;s annual income ($)</label>
          <input
            type="number"
            min={0}
            value={form.annualIncome}
            onChange={(e) => set('annualIncome', Number(e.target.value))}
          />

          <label>Current income THIS month ($) — including any unemployment</label>
          <input
            type="number"
            min={0}
            value={form.currentMonthlyIncome}
            onChange={(e) => set('currentMonthlyIncome', Number(e.target.value))}
          />

          <label>What changed?</label>
          <select value={form.reason} onChange={(e) => set('reason', e.target.value)}>
            <option value="job_loss">Lost my job</option>
            <option value="reduced_hours">Hours cut</option>
            <option value="aging_out">Aged off a plan</option>
            <option value="other">Other</option>
          </select>

          <label>Date job-based coverage ended</label>
          <input type="date" value={form.lostCoverageDate} onChange={(e) => set('lostCoverageDate', e.target.value)} />

          <div className="checks">
            <label>
              <input type="checkbox" checked={form.hasChildren} onChange={(e) => set('hasChildren', e.target.checked)} />
              Children at home
            </label>
            <label>
              <input type="checkbox" checked={form.pregnant} onChange={(e) => set('pregnant', e.target.checked)} />
              Pregnant
            </label>
          </div>

          <label>Anything else? (optional)</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />

          <button className="btn" onClick={run} disabled={running}>
            {running ? 'Working…' : 'Find my coverage'}
          </button>
          <button className="btn secondary" onClick={() => setForm(DEMO_STORY)} disabled={running}>
            Use the demo story
          </button>
          <button className="btn secondary" onClick={() => setForm(BLANK)} disabled={running}>
            Clear
          </button>
        </div>

        {/* ---------------- Verification + Plan ---------------- */}
        <div className="card">
          <div className="verify-head">
            <h2>Self-verifying loop</h2>
            {result && (
              <span className={`provider-pill ${result.usedMock ? 'mock' : ''}`}>
                {result.usedMock ? 'offline demo (deterministic)' : result.provider}
              </span>
            )}
          </div>

          {!result && !running && !error && (
            <div className="empty">
              Fill in a situation and press <b>Find my coverage</b>.<br />
              Watch the score climb as Opus 4.8 catches and fixes its own mistakes.
            </div>
          )}

          {(running || revealed.length > 0) && (
            <>
              <div className="meter">
                <div className="meter-track">
                  <div
                    className="meter-fill"
                    style={{ width: `${score}%`, background: meterColor(score) }}
                  />
                </div>
                <div className="meter-foot">
                  <span>Rubric score</span>
                  <span className="score-num">{score} / 100 &middot; pass ≥ 90</span>
                </div>
              </div>

              {revealed.map((iter) => (
                <IterationCard key={iter.index} iter={iter} />
              ))}

              {status && (
                <div className="status-line">
                  <span className="spinner" /> {status}
                </div>
              )}
            </>
          )}

          {error && <div className="error">{error}</div>}

          {done && final && (
            <PlanView result={result!} />
          )}
        </div>
      </div>
    </div>
  );
}

function IterationCard({ iter }: { iter: Iteration }) {
  const pass = iter.grade.pass;
  return (
    <div className={`iter ${pass ? 'pass' : 'fail'}`}>
      <div className="iter-head">
        <span>
          {iter.label} &middot; {iter.grade.overall}/100
        </span>
        <span className={`badge ${pass ? 'pass' : 'fail'}`}>{pass ? 'PASSED' : 'NEEDS REPAIR'}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {iter.grade.criteria.map((c) => (
          <CriterionRow key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

function CriterionRow({ c }: { c: CriterionResult }) {
  return (
    <div className="crit">
      <span className={`mark ${c.passed ? 'ok' : 'no'}`}>{c.passed ? '✓' : '✕'}</span>
      <span>
        <span className="cname">{c.name}</span>
        {c.critical && <span className="crit-tag">critical</span>}
        <div className="creason">{c.reasoning}</div>
        {!c.passed && c.fix && <div className="cfix">→ fix: {c.fix}</div>}
      </span>
    </div>
  );
}

function PlanView({ result }: { result: ApiResult }) {
  const plan = result.final.plan;
  const g = result.ground;
  return (
    <div className="plan">
      <h2>Your plan {result.passed ? '✓ verified' : ''}</h2>
      <div className="summary">{plan.summary}</div>

      {plan.urgentActions.length > 0 && <div className="section-title">Do this first</div>}
      {plan.urgentActions.map((a, i) => (
        <div className="urgent" key={i}>
          <div className="t">{a.title}</div>
          <div>{a.why}</div>
          {a.deadline && <div className="d">⏱ {a.deadline}</div>}
        </div>
      ))}

      <div className="section-title">Programs to apply for</div>
      {plan.programs.map((p, i) => (
        <div className="prog" key={i}>
          <span className="pval">{p.estimatedValue}</span>
          <div className="pname">{p.name}</div>
          <div className="ptext">{p.whatItIs}</div>
          <div className="plabel">Why you qualify</div>
          <div className="ptext">{p.whyYouQualify}</div>
          <div className="plabel">How to apply</div>
          <div className="ptext">{p.howToApply}</div>
          {p.documentsNeeded.length > 0 && (
            <>
              <div className="plabel">Bring</div>
              <ul>
                {p.documentsNeeded.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}

      {plan.scripts.length > 0 && <div className="section-title">What to say</div>}
      {plan.scripts.map((s, i) => (
        <div className="script" key={i}>
          <div className="when">{s.whenToUse}</div>
          <div className="say">&ldquo;{s.sayThis}&rdquo;</div>
        </div>
      ))}

      <div className="facts">
        <b>Ground truth used to verify this plan</b> ({g.fpl.source}): household of {result.situation.householdSize},
        FPL ${g.fpl.fplForHousehold.toLocaleString()}. Last year ≈ {g.fpl.annualFplPercent}% of FPL; current income ≈{' '}
        {g.fpl.currentMonthlyFplPercent}% of FPL.{' '}
        {g.flags.length > 0 && <>Flags: {g.flags.join(', ')}.</>}
      </div>
      <div className="disclaimer">{plan.disclaimer}</div>
    </div>
  );
}
