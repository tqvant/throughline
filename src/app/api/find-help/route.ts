import { NextResponse } from 'next/server';
import { runFindHelp } from '@/lib/findHelp';
import { mockHelpFinder } from '@/lib/mockHelpFinder';
import { getTelemetry, resetTelemetry } from '@/lib/telemetry';
import type { FindHelpInput, HelpFinder } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function normalize(raw: unknown): FindHelpInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, d = '') => {
    const s = typeof v === 'string' ? v.trim().slice(0, 300) : '';
    return s || d;
  };
  return {
    location: str(b.location, 'California'),
    need: str(b.need, 'urgent care while uninsured'),
    notes: typeof b.notes === 'string' ? b.notes.slice(0, 500) : undefined,
    language: typeof b.language === 'string' ? b.language.slice(0, 10) : undefined,
  };
}

export async function POST(req: Request) {
  let body: { input?: unknown; mock?: boolean; live?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) body = {};
  try {
    const input = normalize(body.input);

    // The real web_search agent loop exceeds the 60s serverless function limit on
    // this Vercel plan, so the DEPLOYED find-care uses the instant deterministic
    // finder by default (honestly labeled as demo data in the UI). The real
    // web-search finder works without a time cap locally, via `npm run eval`, and
    // via the MCP server — opt into it here with {"live": true}.
    const useMock = body.mock === true || body.live !== true || !process.env.ANTHROPIC_API_KEY;
    let finder: HelpFinder;
    if (useMock) {
      finder = mockHelpFinder;
    } else {
      const { webHelpFinder } = await import('@/lib/webSearch');
      finder = webHelpFinder;
    }

    resetTelemetry();
    // Mock runs the full search→grade→repair loop instantly; the real finder
    // (opt-in) does a single lean search + self-grade to bound latency.
    const maxIterations = useMock ? 3 : 1;
    const result = await runFindHelp(input, finder, { maxIterations });
    return NextResponse.json({ ...result, telemetry: getTelemetry(), usedMock: useMock });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
