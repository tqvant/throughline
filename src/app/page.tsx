'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGES, t } from '@/lib/i18n';
import type {
  CriterionResult,
  FindHelpResult,
  HelpIteration,
  HelpResource,
  Iteration,
  NavigatorResult,
  Plan,
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
  const [admin, setAdmin] = useState(false);
  const [lang, setLang] = useState('en');
  // Instant-demo mode forces the deterministic loop (no live Opus/web latency) —
  // ideal for recording a snappy video of the self-correcting score climb.
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has('admin')) setAdmin(true);
    if (p.has('demo')) setDemo(true);
  }, []);

  return (
    <div className="wrap">
      <div className="hero">
        <div className="brandline">
          <div className="logo-mark">T</div>
          <div className="logo">
            Throughline<span className="dot">.</span>
          </div>
          <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t(lang, 'lang')}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <h1>{t(lang, 'heroTitle')}</h1>
        <p className="lede">{t(lang, 'lede')}</p>
        <div className="trust">
          <span>✓ {t(lang, 'trustFree')}</span>
          <span>✓ {t(lang, 'trustData')}</span>
          <span>✓ {t(lang, 'trustStored')}</span>
        </div>
        <p className="disc-note">{t(lang, 'discNote')}</p>
        {admin && (
          <div className="admin-note">
            <b>Dev view on.</b> Opus 4.8 does the work, then grades its own output against a rubric and a
            deterministic engine and repairs itself until it passes. Verification internals, telemetry, and the
            architecture are shown below. Normal users don&apos;t see any of this.
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${mode === 'plan' ? 'active' : ''}`} onClick={() => setMode('plan')}>
          {t(lang, 'tabPlan')}
        </button>
        <button className={`tab ${mode === 'now' ? 'active' : ''}`} onClick={() => setMode('now')}>
          {t(lang, 'tabNow')}
        </button>
      </div>

      {mode === 'plan' ? (
        <PlanCoverage admin={admin} lang={lang} demo={demo} />
      ) : (
        <FindCareNow admin={admin} lang={lang} demo={demo} />
      )}

      <div className="footer">
        <span>Built at Claude Build Day · benefits navigation, not medical advice.</span>
        <button className={`demo-toggle ${demo ? 'on' : ''}`} onClick={() => setDemo((d) => !d)}>
          {demo ? '⚡ Instant demo: ON' : 'Instant demo: off'}
        </button>
      </div>
    </div>
  );
}

/* =========================== Shared ============================ */

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={`copy-btn ${done ? 'done' : ''}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard may be blocked; ignore */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? '✓ Copied' : label}
    </button>
  );
}

/* Concierge action plan — agent prepares each step; user reviews & approves. */

const APPLY_URLS: Record<string, { url: string; label: string }> = {
  medi_cal_adults: { url: 'https://benefitscal.com', label: 'Open BenefitsCal' },
  medi_cal_kids: { url: 'https://benefitscal.com', label: 'Open BenefitsCal' },
  medi_cal_pregnancy: { url: 'https://benefitscal.com', label: 'Open BenefitsCal' },
  covered_ca: { url: 'https://www.coveredca.com', label: 'Open Covered California' },
  edd_unemployment: { url: 'https://edd.ca.gov', label: 'Open EDD' },
  fqhc_sliding_scale: { url: 'https://findahealthcenter.hrsa.gov', label: 'Find a health center' },
  rx_assistance: { url: 'https://www.needymeds.org', label: 'Open NeedyMeds' },
};

interface ConciergeAction {
  id: string;
  kind: 'apply' | 'message' | 'call';
  title: string;
  detail: string;
  payload: string;
  href?: string;
  hrefLabel?: string;
}

function buildActions(plan: Plan): ConciergeAction[] {
  const acts: ConciergeAction[] = [];
  plan.programs.forEach((p) => {
    const link = p.programId ? APPLY_URLS[p.programId] : undefined;
    acts.push({
      id: `apply-${p.programId ?? p.name}`,
      kind: 'apply',
      title: `Apply: ${p.name}`,
      detail: p.howToApply,
      payload: p.applicationDraft ?? '',
      href: link?.url,
      hrefLabel: link?.label,
    });
  });
  if (plan.appointmentRequest) {
    const a = plan.appointmentRequest;
    // Only build a real mailto when we actually have an email recipient;
    // otherwise it's a copy-the-message action (no broken empty-recipient mailto).
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.to.trim());
    acts.push({
      id: 'appt',
      kind: 'message',
      title: `Send: ${a.subject}`,
      detail: `To: ${a.to}`,
      payload: a.body,
      href: isEmail ? `mailto:${encodeURIComponent(a.to.trim())}?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(a.body)}` : undefined,
      hrefLabel: isEmail ? 'Open email' : undefined,
    });
  }
  plan.scripts.forEach((s, i) =>
    acts.push({ id: `call-${i}`, kind: 'call', title: s.whenToUse, detail: 'Call and say:', payload: s.sayThis }),
  );
  return acts;
}

const KIND_ICON: Record<ConciergeAction['kind'], string> = { apply: '📝', message: '✉️', call: '📞' };

function ActionPlan({ plan }: { plan: Plan }) {
  const actions = useMemo(() => buildActions(plan), [plan]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setDone((d) => {
      const n = new Set(d);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pct = actions.length ? Math.round((done.size / actions.length) * 100) : 0;

  return (
    <>
      <div className="section-title">Your action plan — we prepared each step</div>
      <div className="ap-progress">
        <div className="ap-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="ap-foot">
        {done.size} of {actions.length} done · review each, then submit or call yourself
      </div>
      {actions.map((a) => (
        <div className={`act ${done.has(a.id) ? 'act-done' : ''}`} key={a.id}>
          <input type="checkbox" className="act-check" checked={done.has(a.id)} onChange={() => toggle(a.id)} />
          <div className="act-body">
            <div className="act-title">
              {KIND_ICON[a.kind]} {a.title}
            </div>
            <div className="act-detail">{a.detail}</div>
            {a.payload && <pre className="act-pre">{a.payload}</pre>}
            <div className="act-btns">
              {a.href && (
                <a className="copy-btn primary" href={a.href} target="_blank" rel="noreferrer" onClick={() => toggle(a.id)}>
                  {a.hrefLabel} ↗
                </a>
              )}
              {a.payload && <CopyButton text={a.payload} label={a.kind === 'call' ? 'Copy script' : 'Copy'} />}
              {!done.has(a.id) && (
                <button className="copy-btn" onClick={() => toggle(a.id)}>
                  Mark done
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
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

function UnderTheHood({ telemetry, passes, mode }: { telemetry?: Telemetry; passes: number; mode: 'plan' | 'now' }) {
  const offline = !telemetry || telemetry.apiCalls === 0;
  const tokens = telemetry ? telemetry.inputTokens + telemetry.outputTokens : 0;
  return (
    <div className="hood">
      <div className="hood-title">Under the hood</div>
      <ul>
        <li>
          <span className="hood-tag">workflow</span> structured <code>generate → grade → repair</code> · {passes}{' '}
          pass{passes > 1 ? 'es' : ''} (deterministic loop in <code>loop.ts</code>)
        </li>
        <li>
          <span className="hood-tag">API</span>{' '}
          {offline ? 'offline demo — 0 live API calls' : `${telemetry!.model} · ${telemetry!.apiCalls} calls · ${tokens.toLocaleString()} tokens`}
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

function VerifiedBanner({ passed, checks }: { passed: boolean; checks: number }) {
  return (
    <div className="summary" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
      <span style={{ fontSize: 18 }}>{passed ? '✓' : '⚠'}</span>
      {passed ? `Double-checked — passed all ${checks} quality checks.` : 'Best effort — some checks did not pass.'}
    </div>
  );
}

/** Animated reveal shared by both modes. Returns helpers for the verify panel. */
function useReveal<T extends { grade: { overall: number; pass: boolean; criteria: CriterionResult[] } }>() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<T[]>([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const busy = useRef(false);
  const runId = useRef(0);

  const canStart = () => !busy.current;
  const reset = () => {
    busy.current = true;
    runId.current += 1;
    setRunning(true);
    setError('');
    setRevealed([]);
    setScore(0);
    setDone(false);
  };
  const stop = () => {
    busy.current = false;
    setRunning(false);
  };

  async function play(iters: T[], labelFor: (k: number, prev?: T) => string) {
    const myRun = runId.current;
    for (let k = 0; k < iters.length; k++) {
      if (runId.current !== myRun) return; // superseded by a newer run
      setStatus(labelFor(k, iters[k - 1]));
      await delay(k === 0 ? 1100 : 1500);
      if (runId.current !== myRun) return;
      setRevealed((p) => [...p, iters[k]]);
      setScore(iters[k].grade.overall);
      await delay(900);
    }
    if (runId.current !== myRun) return;
    setStatus('');
    setDone(true);
  }

  return { running, canStart, stop, status, setStatus, error, setError, revealed, score, done, reset, play };
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

function PlanCoverage({ admin, lang, demo }: { admin: boolean; lang: string; demo: boolean }) {
  const [form, setForm] = useState<FormState>(DEMO_STORY);
  const [result, setResult] = useState<PlanApiResult | null>(null);
  const r = useReveal<Iteration>();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function run() {
    if (!r.canStart()) return; // guard against double-click / overlapping runs
    r.reset();
    setResult(null);
    r.setStatus('Opus 4.8 is building your plan…');
    try {
      const res = await fetch('/api/navigate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ situation: { ...form, language: lang }, mock: demo }),
      });
      const data = (await res.json()) as PlanApiResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data);
      await r.play(data.iterations, (k, prev) =>
        k === 0
          ? 'Double-checking the plan against our quality checks…'
          : `Fixing ${prev!.grade.criteria.filter((c) => !c.passed).length} issue(s), then re-checking…`,
      );
    } catch (e) {
      r.setError(e instanceof Error ? e.message : 'Something went wrong.');
      r.setStatus('');
    } finally {
      r.stop();
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t(lang, 'situation')}</h2>
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
        <label>{t(lang, 'else')}</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        <button className="btn" onClick={run} disabled={r.running}>
          {r.running ? '…' : t(lang, 'btnPlan')}
        </button>
        <button className="btn secondary" onClick={() => setForm(BLANK)} disabled={r.running}>
          {t(lang, 'clear')}
        </button>
      </div>

      <div className="card">
        <div className="verify-head">
          <h2>{admin ? 'Self-verifying loop' : 'Your plan'}</h2>
          {admin && result && (
            <span className={`provider-pill ${result.usedMock ? 'mock' : ''}`}>
              {result.usedMock ? 'offline demo (deterministic)' : result.provider}
            </span>
          )}
        </div>

        {!result && !r.running && !r.error && (
          <div className="empty">
            Tell us what happened, and we&apos;ll find the coverage you qualify for —
            <br />
            and draft the paperwork so you don&apos;t have to.
          </div>
        )}

        {(r.running || r.revealed.length > 0) && (
          <>
            <div className="meter">
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${r.score}%`, background: meterColor(r.score, 90) }} />
              </div>
              <div className="meter-foot">
                <span>{admin ? 'Rubric score' : 'Plan confidence'}</span>
                <span className="score-num">{r.score} / 100</span>
              </div>
            </div>
            {admin &&
              r.revealed.map((iter) => (
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
            {r.status && (
              <div className="status-line">
                <span className="spinner" /> {r.status}
              </div>
            )}
          </>
        )}

        {r.error && <div className="error">{r.error}</div>}
        {r.done && result && (
          <PlanView result={result} admin={admin} />
        )}
      </div>
    </div>
  );
}

function PlanView({ result, admin }: { result: PlanApiResult; admin: boolean }) {
  const plan: Plan = result.final.plan;
  const g = result.ground;
  return (
    <div className="plan">
      {!admin && <VerifiedBanner passed={result.passed} checks={result.final.grade.criteria.length} />}
      <div className="summary" style={{ marginTop: 10 }}>{plan.summary}</div>

      {plan.urgentActions.length > 0 && <div className="section-title">Do this first</div>}
      {plan.urgentActions.map((a, i) => (
        <div className="urgent" key={i}>
          <div className="t">{a.title}</div>
          <div>{a.why}</div>
          {a.deadline && <div className="d">⏱ {a.deadline}</div>}
        </div>
      ))}

      <ActionPlan plan={plan} />

      <div className="section-title">Program details</div>
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

      {admin && (
        <div className="facts">
          <b>Ground truth used to verify this plan</b> ({g.fpl.source}): household of {result.situation.householdSize},
          FPL ${g.fpl.fplForHousehold.toLocaleString()}. Last year ≈ {g.fpl.annualFplPercent}% of FPL; current income ≈{' '}
          {g.fpl.currentMonthlyFplPercent}% of FPL. {g.flags.length > 0 && <>Flags: {g.flags.join(', ')}.</>}
        </div>
      )}
      <div className="disclaimer">{plan.disclaimer}</div>
      {admin && <UnderTheHood telemetry={result.telemetry} passes={result.iterations.length} mode="plan" />}
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

function FindCareNow({ admin, lang, demo }: { admin: boolean; lang: string; demo: boolean }) {
  const [form, setForm] = useState<HelpForm>(HELP_DEMO);
  const [result, setResult] = useState<HelpApiResult | null>(null);
  const r = useReveal<HelpIteration>();
  const set = <K extends keyof HelpForm>(k: K, v: HelpForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function run() {
    if (!r.canStart()) return; // guard against double-click / overlapping runs
    r.reset();
    setResult(null);
    r.setStatus('Opus 4.8 is searching the web for care near you…');
    try {
      const res = await fetch('/api/find-help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: { ...form, language: lang }, mock: demo }),
      });
      const data = (await res.json()) as HelpApiResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data);
      await r.play(data.iterations, (k) =>
        k === 0 ? 'Checking results — local, free, real, and sourced?' : 'Searching again to fill the gaps…',
      );
    } catch (e) {
      r.setError(e instanceof Error ? e.message : 'Something went wrong.');
      r.setStatus('');
    } finally {
      r.stop();
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>{t(lang, 'gap')}</h2>
        <p className="hint">
          Insurance ends, the new plan hasn&apos;t started, and Medi-Cal can take weeks. This finds real, local,
          free or low-cost care for right now.
        </p>
        <label>{t(lang, 'where')}</label>
        <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City, ZIP, or City, ST" />
        <label>{t(lang, 'need')}</label>
        <textarea value={form.need} onChange={(e) => set('need', e.target.value)} style={{ minHeight: 92 }} />
        <label>{t(lang, 'else')}</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        <button className="btn" onClick={run} disabled={r.running}>
          {r.running ? '…' : t(lang, 'btnNow')}
        </button>
      </div>

      <div className="card">
        <div className="verify-head">
          <h2>{admin ? 'Self-verifying web search' : 'Care near you'}</h2>
          {admin && result && (
            <span className={`provider-pill ${result.usedMock ? 'mock' : ''}`}>
              {result.usedMock ? 'offline demo (deterministic)' : result.provider}
            </span>
          )}
        </div>

        {!result && !r.running && !r.error && (
          <div className="empty">
            Tell us where you are and what you need.
            <br />
            We&apos;ll find real, local, free care — and double-check every result.
          </div>
        )}

        {(r.running || r.revealed.length > 0) && (
          <>
            <div className="meter">
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${r.score}%`, background: meterColor(r.score, 85) }} />
              </div>
              <div className="meter-foot">
                <span>{admin ? 'Rubric score' : 'Result confidence'}</span>
                <span className="score-num">{r.score} / 100</span>
              </div>
            </div>
            {admin &&
              r.revealed.map((iter) => (
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
            {r.status && (
              <div className="status-line">
                <span className="spinner" /> {r.status}
              </div>
            )}
          </>
        )}

        {r.error && <div className="error">{r.error}</div>}
        {r.done && result && (
          <div className="plan">
            {!admin && <VerifiedBanner passed={result.passed} checks={result.final.grade.criteria.length} />}
            <div className="section-title">
              {result.final.resources.length} options near you — call or apply, then check off
            </div>
            <ResourceActionList resources={result.final.resources} />
            <div className="disclaimer">
              Throughline finds places that may be able to help. It is not medical advice and does not diagnose or
              treat any condition. Call ahead to confirm hours, cost, and eligibility.
            </div>
            {admin && <UnderTheHood telemetry={result.telemetry} passes={result.iterations.length} mode="now" />}
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceActionList({ resources }: { resources: HelpResource[] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setDone((d) => {
      const n = new Set(d);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const pct = resources.length ? Math.round((done.size / resources.length) * 100) : 0;
  return (
    <>
      <div className="ap-progress">
        <div className="ap-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="ap-foot">{done.size} of {resources.length} contacted</div>
      {resources.map((res, i) => (
        <ResourceCard key={i} r={res} done={done.has(i)} onToggle={() => toggle(i)} />
      ))}
    </>
  );
}

/** Only allow safe link schemes for model-supplied URLs (no javascript: etc.). */
function safeHttpUrl(u?: string): string | undefined {
  if (!u) return undefined;
  return /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined;
}

function ResourceCard({ r, done, onToggle }: { r: HelpResource; done: boolean; onToggle: () => void }) {
  const costClass = r.cost === 'free' ? 'cost-free' : r.cost === 'unknown' ? 'cost-unknown' : 'cost-low';
  const costLabel = r.cost === 'free' ? 'free' : r.cost === 'sliding_scale' ? 'sliding scale' : r.cost === 'low_cost' ? 'low cost' : 'cost varies';
  const applyLabel = r.kind === 'clinical_trial' ? 'See if you qualify ↗' : 'Open / apply ↗';
  const tel = (r.phone ?? '').replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, ''); // digits + single leading +
  const telOk = /\d/.test(tel);
  const url = safeHttpUrl(r.sourceUrl); // only http(s) — never javascript: etc.
  return (
    <div className={`res ${done ? 'act-done' : ''}`}>
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
      </div>
      <div className="act-btns" style={{ marginTop: 10 }}>
        {telOk && (
          <a className="copy-btn primary" href={`tel:${tel}`} onClick={onToggle}>
            📞 Call {r.phone}
          </a>
        )}
        {url && (
          <a className="copy-btn" href={url} target="_blank" rel="noreferrer" onClick={onToggle}>
            {applyLabel}
          </a>
        )}
        <button className="copy-btn" onClick={onToggle}>
          {done ? 'Undo' : 'Mark done'}
        </button>
      </div>
    </div>
  );
}
