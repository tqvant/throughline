import { NextResponse } from 'next/server';
import { runNavigator } from '@/lib/loop';
import { mockProvider } from '@/lib/mockProvider';
import { getTelemetry, resetTelemetry } from '@/lib/telemetry';
import type { NavigatorProvider, Reason, Situation } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const REASONS: Reason[] = ['job_loss', 'reduced_hours', 'aging_out', 'other'];

function normalize(raw: unknown): Situation {
  const b = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const reason = REASONS.includes(b.reason as Reason) ? (b.reason as Reason) : 'job_loss';
  const money = (v: unknown) => Math.min(1e9, Math.max(0, num(v))); // cap to keep FPL math finite
  return {
    state: typeof b.state === 'string' && b.state ? b.state.toUpperCase().slice(0, 2) : 'CA',
    householdSize: Math.min(50, Math.max(1, Math.round(num(b.householdSize, 1)))),
    annualIncome: money(b.annualIncome),
    currentMonthlyIncome: money(b.currentMonthlyIncome),
    reason,
    hasChildren: Boolean(b.hasChildren),
    pregnant: Boolean(b.pregnant),
    lostCoverageDate: typeof b.lostCoverageDate === 'string' ? b.lostCoverageDate.slice(0, 40) : undefined,
    notes: typeof b.notes === 'string' ? b.notes.slice(0, 500) : undefined,
    language: typeof b.language === 'string' ? b.language.slice(0, 10) : undefined,
  };
}

export async function POST(req: Request) {
  let body: { situation?: unknown; mock?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) body = {};
  try {
    const situation = normalize(body.situation);

    const useMock = body.mock === true || !process.env.ANTHROPIC_API_KEY;
    let provider: NavigatorProvider;
    if (useMock) {
      provider = mockProvider;
    } else {
      const { anthropicProvider } = await import('@/lib/llm');
      provider = anthropicProvider;
    }

    resetTelemetry();
    const result = await runNavigator(situation, provider);
    return NextResponse.json({ ...result, telemetry: getTelemetry(), usedMock: useMock });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
