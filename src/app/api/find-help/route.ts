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
  let body: { input?: unknown; mock?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) body = {};
  try {
    const input = normalize(body.input);

    const useMock = body.mock === true || !process.env.ANTHROPIC_API_KEY;
    let finder: HelpFinder;
    if (useMock) {
      finder = mockHelpFinder;
    } else {
      const { webHelpFinder } = await import('@/lib/webSearch');
      finder = webHelpFinder;
    }

    resetTelemetry();
    const result = await runFindHelp(input, finder);
    return NextResponse.json({ ...result, telemetry: getTelemetry(), usedMock: useMock });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
