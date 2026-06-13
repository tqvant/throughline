// Best-effort per-request telemetry so the UI can *show* the real Anthropic API
// being pulled — number of Opus 4.8 calls, server-side web_search tool uses, and
// tokens. The real providers (llm.ts, webSearch.ts) record into this; the API
// routes reset it at the start of a request and read it at the end.
//
// Module-level state is fine for the demo: a serverless invocation handles one
// request at a time. Mock/offline runs never record, so apiCalls stays 0.

import type { Telemetry } from './types';

function empty(): Telemetry {
  return { model: '', apiCalls: 0, webSearches: 0, inputTokens: 0, outputTokens: 0 };
}

let current: Telemetry = empty();

export function resetTelemetry(): void {
  current = empty();
}

export function recordCall(
  model: string,
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
  webSearches = 0,
): void {
  current.model = model;
  current.apiCalls += 1;
  current.webSearches += webSearches;
  current.inputTokens += usage?.input_tokens ?? 0;
  current.outputTokens += usage?.output_tokens ?? 0;
}

export function getTelemetry(): Telemetry {
  return { ...current };
}
