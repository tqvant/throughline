import { NextResponse } from 'next/server';
import { runFindHelp } from '@/lib/findHelp';
import { mockHelpFinder } from '@/lib/mockHelpFinder';
import { getTelemetry, resetTelemetry } from '@/lib/telemetry';
import type { FindHelpInput, HelpFinder } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function normalize(raw: unknown): FindHelpInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, d = '') => (typeof v === 'string' ? v.slice(0, 300) : d);
  return {
    location: str(b.location, 'California') || 'California',
    need: str(b.need, 'urgent care while uninsured'),
    notes: typeof b.notes === 'string' ? b.notes.slice(0, 500) : undefined,
    language: typeof b.language === 'string' ? b.language : undefined,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { input?: unknown; mock?: boolean };
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
