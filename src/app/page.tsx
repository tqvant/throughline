'use client';

import { useState } from 'react';
import type {
  CriterionResult,
  FindHelpResult,
  HelpIteration,
  HelpResource,
  Iteration,
  NavigatorResult,
  Telemetry,
} from '@/lib/types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function meterColor(score: number, pass: number): string {
  if (score >= pass) return '#1f7a3d';
  if (score >= pass * 0.6) return '#b4690e';
  return '#b3261e';
}

export default function Page() {
  const [mode, setMode] = useState<'plan' | 'now'>('plan');
  return (
    <div className="wrap">
      <header className="masthead">
        <div className="logo">
          Throughline<span className="dot">.</span>
        </div>
        <div className="tagline">The verified path through your coverage gap.</div>
      </header>
      <p className="subnote">
        Opus 4.8 does the work, then <b>grades its own output</b> against a rubric and repairs itself until it
        passes. Built on public data + the live web. Benefits navigation and resource-finding only — not medical
        advice.
      </p>

      <div className="tabs">
        <button className={`tab ${mode === 'plan' ? 'active' : ''}`} onClick={() => setMode('plan')}>
          Plan my coverage <span className="tab-sub">· what I qualify for</span>
        </button>
        <button className={`tab ${mode === 'now' ? 'active' : ''}`} onClick={() => setMode('now')}>
          Find care now <span className="tab-sub">· the gap before it kicks in</span>
        </button>
      </div>

      {mode === 'plan' ? <PlanCoverage /> : <FindCareNow />}
    </div>
  );
}

/* =========================== Shared ============================ */

function UnderTheHood({
  telemetry,
  passes,
  mode,
}: {
  telemetry?: Telemetry;
  passes: number;
  mode: 'plan' | 'now';
}) {
  const offline = !telemetry || telemetry.apiCalls === 0;
  const tokens = telemetry ? telemetry.inputTokens + telemetry.outputTokens : 0;
  return (
    <div className="hood">
      <div className="hood-title">Under the hood</div>
      <ul>
        <li>
          <span className="hood-tag">workflow</span> structured <code>generate → grade → repair</code> ·{' '}
          {passes} pass{passes > 1 ? 'es' : ''} (deterministic loop in <code>loop.ts</code>)
        </li>
        <li>
          <span className="hood-tag">API</span>{' '}
          {offline
            ? 'offline demo — 0 live API calls'
            : `${telemetry!.model} · ${telemetry!.apiCalls} calls · ${tokens.toLocaleString()} tokens`}
        </li>
        {mode === 'now' && (
          <li>
            <span className="hood-tag">agent</span> Opus 4.8 + server-side <code>web_search</code>
            {offline ? '' : ` · ${telemetry!.webSearches} searches`}
          </li>
        )}
        <li>
          <span className="hood-tag">MCP</span> same engine exposed as MCP tools — <code>npm run mcp</code>
        </li>
      </ul>
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

/* ====================== Plan my coverage ======================= */

type PlanApiResult = NavigatorResult & { usedMock: boolean };

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

function PlanCoverage() {
  const [form, setForm] = useState<FormState>(DEMO_STORY);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PlanApiResult | null>(null);
  const [revealed, setRevealed] = useState<Iteration[]>([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

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
      const data = (await res.json()) as PlanApiResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid">
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
            <input type="number" min={1} value={form.householdSize} onChange={(e) => set('householdSize', Number(e.target.value))} />
          </div>
        </div>
        <label>Last year&apos;s annual income ($)</label>
        <input type="number" min={0} value={form.annualIncome} onChange={(e) => set('annualIncome', Number(e.target.value))} />
        <label>Current income THIS month ($) — including any unemployment</label>
        <input type="number" min={0} value={form.currentMonthlyIncome} onChange={(e) => set('currentMonthlyIncome', Number(e.target.value))} />
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
            <input type="checkbox" checked={form.hasChildren} onChange={(e) => set('hasChildren', e.target.checked)} /> Children at home
          </label>
          <label>
            <input type="checkbox" checked={form.pregnant} onChange={(e) => set('pregnant', e.target.checked)} /> Pregnant
          </label>
        </div>
        <label>Anything else? (optional)</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        <button className="btn" onClick={run} disabled={running}>
          {running ? 'Working…' : 'Find my coverage'}
        </button>
        <button className="btn secondary" onClick={() => setForm(BLANK)} disabled={running}>
          Clear
        </button>
      </div>

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
                <div className="meter-fill" style={{ width: `${score}%`, background: meterColor(score, 90) }} />
              </div>
              <div className="meter-foot">
                <span>Rubric score</span>
                <span className="score-num">{score} / 100 · pass ≥ 90</span>
              </div>
            </div>
            {revealed.map((iter) => (
              <div className={`iter ${iter.grade.pass ? 'pass' : 'fail'}`} key={iter.index}>
                <div className="iter-head">
                  <span>{iter.label} · {iter.grade.overall}/100</span>
                  <span className={`badge ${iter.grade.pass ? 'pass' : 'fail'}`}>{iter.grade.pass ? 'PASSED' : 'NEEDS REPAIR'}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  {iter.grade.criteria.map((c) => (
                    <CriterionRow key={c.id} c={c} />
                  ))}
                </div>
              </div>
            ))}
            {status && (
              <div className="status-line">
                <span className="spinner" /> {status}
              </div>
            )}
          </>
        )}
        {error && <div className="error">{error}</div>}
        {done && result && <PlanView result={result} />}
      </div>
    </div>
  );
}

function PlanView({ result }: { result: PlanApiResult }) {
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
        {g.fpl.currentMonthlyFplPercent}% of FPL. {g.flags.length > 0 && <>Flags: {g.flags.join(', ')}.</>}
      </div>
      <div className="disclaimer">{plan.disclaimer}</div>
      <UnderTheHood telemetry={result.telemetry} passes={result.iterations.length} mode="plan" />
    </div>
  );
}

/* ======================= Find care now ========================= */

type HelpApiResult = FindHelpResult & { usedMock: boolean };

interface HelpForm {
  location: string;
  need: string;
  notes: string;
}

const HELP_DEMO: HelpForm = {
  location: 'Oakland, CA',
  need: 'My insurance ended and the new plan starts next month. I have a chronic condition, need to refill a prescription, and might need urgent care in the gap.',
  notes: 'Uninsured for ~5 weeks. Medi-Cal application is still processing.',
};

const KIND_LABELS: Record<string, string> = {
  free_clinic: 'free clinic',
  community_health_center: 'health center',
  mobile_unit: 'mobile unit',
  prescription: 'prescriptions',
  urgent_low_cost: 'low-cost urgent',
  dental: 'dental',
  clinical_trial: 'clinical trial',
  community_tip: 'community tip',
  hotline: 'hotline',
  other: 'resource',
};

function FindCareNow() {
  const [form, setForm] = useState<HelpForm>(HELP_DEMO);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<HelpApiResult | null>(null);
  const [revealed, setRevealed] = useState<HelpIteration[]>([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const set = <K extends keyof HelpForm>(k: K, v: HelpForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function run() {
    setRunning(true);
    setError('');
    setResult(null);
    setRevealed([]);
    setScore(0);
    setDone(false);
    setStatus('Opus 4.8 is searching the web for care near you…');
    try {
      const res = await fetch('/api/find-help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: form }),
      });
      const data = (await res.json()) as HelpApiResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data);
      for (let k = 0; k < data.iterations.length; k++) {
        const iter = data.iterations[k];
        setStatus(
          k === 0
            ? 'Grading the results — are they local, free, real, and sourced?'
            : 'Searching again to fix the gaps, then re-grading…',
        );
        await delay(k === 0 ? 1100 : 1500);
        setRevealed((prev) => [...prev, iter]);
        setScore(iter.grade.overall);
        await delay(900);
      }
      setStatus('');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStatus('');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>The gap before coverage kicks in</h2>
        <p className="hint">
          Insurance ends, the new plan hasn&apos;t started, and Medi-Cal can take weeks. This finds real, local,
          free or low-cost care for right now.
        </p>
        <label>Where are you?</label>
        <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City, ZIP, or City, ST" />
        <label>What do you need?</label>
        <textarea value={form.need} onChange={(e) => set('need', e.target.value)} style={{ minHeight: 90 }} />
        <label>Anything else? (optional)</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        <button className="btn" onClick={run} disabled={running}>
          {running ? 'Searching…' : 'Find care near me now'}
        </button>
      </div>

      <div className="card">
        <div className="verify-head">
          <h2>Self-verifying web search</h2>
          {result && (
            <span className={`provider-pill ${result.usedMock ? 'mock' : ''}`}>
              {result.usedMock ? 'offline demo (deterministic)' : result.provider}
            </span>
          )}
        </div>
        {!result && !running && !error && (
          <div className="empty">
            Tell us where you are and what you need.<br />
            Opus 4.8 searches the live web, then verifies every result is local, free, and real.
          </div>
        )}
        {(running || revealed.length > 0) && (
          <>
            <div className="meter">
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${score}%`, background: meterColor(score, 85) }} />
              </div>
              <div className="meter-foot">
                <span>Rubric score</span>
                <span className="score-num">{score} / 100 · pass ≥ 85</span>
              </div>
            </div>
            {revealed.map((iter) => (
              <div className={`iter ${iter.grade.pass ? 'pass' : 'fail'}`} key={iter.index}>
                <div className="iter-head">
                  <span>{iter.label} · {iter.grade.overall}/100</span>
                  <span className={`badge ${iter.grade.pass ? 'pass' : 'fail'}`}>{iter.grade.pass ? 'PASSED' : 'NEEDS REPAIR'}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  {iter.grade.criteria.map((c) => (
                    <CriterionRow key={c.id} c={c} />
                  ))}
                </div>
              </div>
            ))}
            {status && (
              <div className="status-line">
                <span className="spinner" /> {status}
              </div>
            )}
          </>
        )}
        {error && <div className="error">{error}</div>}
        {done && result && (
          <div className="plan">
            <h2>Care near you {result.passed ? '✓ verified' : ''}</h2>
            <div className="section-title">{result.final.resources.length} options found</div>
            {result.final.resources.map((r, i) => (
              <ResourceCard key={i} r={r} />
            ))}
            <div className="disclaimer">
              Throughline finds places that may be able to help. It is not medical advice and does not diagnose or
              treat any condition. Call ahead to confirm hours, cost, and eligibility.
            </div>
            <UnderTheHood telemetry={result.telemetry} passes={result.iterations.length} mode="now" />
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceCard({ r }: { r: HelpResource }) {
  const costClass = r.cost === 'free' ? 'cost-free' : r.cost === 'unknown' ? 'cost-unknown' : 'cost-low';
  const costLabel = r.cost === 'free' ? 'free' : r.cost === 'sliding_scale' ? 'sliding scale' : r.cost === 'low_cost' ? 'low cost' : 'cost varies';
  return (
    <div className="res">
      <div className="rhead">
        <div className="rname">
          {r.name}
          {r.sourceType === 'community' && <span className="community-flag">community tip · verify</span>}
        </div>
        <div className="badges">
          <span className="kind-badge">{KIND_LABELS[r.kind] ?? r.kind}</span>
          <span className={`cost-badge ${costClass}`}>{costLabel}</span>
        </div>
      </div>
      <div className="rwhy">{r.whyItHelps}</div>
      <div className="rmeta">
        {r.address && <>📍 {r.address} </>}
        {r.phone && <>· 📞 {r.phone} </>}
        {r.hours && <>· 🕑 {r.hours} </>}
        {r.sourceUrl && (
          <>
            ·{' '}
            <a href={r.sourceUrl} target="_blank" rel="noreferrer">
              source
            </a>
          </>
        )}
      </div>
    </div>
  );
}
