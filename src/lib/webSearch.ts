// The real emergency-gap finder. Uses the server-side web_search /
// web_fetch tools (Opus 4.8 and Fable 5 both support web_search_20260209 with
// dynamic filtering) to find local, free/low-cost, immediate-care resources,
// then forces a structured extraction, and grades itself against HELP_RUBRIC.

import Anthropic from '@anthropic-ai/sdk';
import { HELP_RUBRIC } from './findHelp';
import { recordCall } from './telemetry';
import type {
  CriterionResult,
  FindHelpInput,
  HelpFinder,
  HelpResource,
} from './types';

const MODEL = process.env.BRIDGE_MODEL || 'claude-opus-4-8';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Server-side web tools. SDK accepts these plain literals; typed loosely here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WEB_TOOLS: any[] = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 },
];

const RESOURCES_SCHEMA = {
  type: 'object',
  properties: {
    resources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: {
            type: 'string',
            enum: [
              'free_clinic',
              'community_health_center',
              'mobile_unit',
              'prescription',
              'urgent_low_cost',
              'dental',
              'clinical_trial',
              'community_tip',
              'hotline',
              'other',
            ],
          },
          description: { type: 'string' },
          whyItHelps: { type: 'string' },
          cost: { type: 'string', enum: ['free', 'sliding_scale', 'low_cost', 'unknown'] },
          address: { type: 'string' },
          phone: { type: 'string' },
          hours: { type: 'string' },
          sourceUrl: { type: 'string' },
          sourceType: { type: 'string', enum: ['web', 'community'] },
        },
        required: ['name', 'kind', 'description', 'whyItHelps', 'cost', 'sourceType'],
      },
    },
  },
  required: ['resources'],
} as const;

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          score: { type: 'number' },
          passed: { type: 'boolean' },
          reasoning: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['id', 'score', 'passed', 'reasoning'],
      },
    },
  },
  required: ['criteria'],
} as const;

const SEARCH_SYSTEM = [
  'You are Throughline, helping someone who has NO health coverage right now find immediate, real, local places to get care during a gap between insurance plans.',
  'Search the web for FREE or low-cost, in-person resources NEAR the location given: community health centers / FQHCs, free & charitable clinics, mobile health units and pop-up clinics, sliding-scale urgent care, dental clinics, prescription-assistance options, and relevant CLINICAL TRIALS that provide free study-related care and medications to eligible participants (search ClinicalTrials.gov and academic medical centers near them). For trials, point them to the listing and tell them to ask the study team what care and medications are covered — do NOT advise whether to enroll. Community sources (Reddit, local Facebook groups, mutual-aid lists) are welcome but mark them as community tips.',
  'Prioritize resources that someone uninsured can use TODAY. Always include where to go and how to reach them. Cite your sources.',
  'You are NOT a doctor: do not diagnose, do not recommend treatments or medications, do not interpret symptoms. You only find places that provide care.',
].join('\n');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOf(content: any[]): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countWebSearches(content: any[]): number {
  return content.filter((b) => b.type === 'server_tool_use' && b.name === 'web_search').length;
}

/** Run the web-search agentic loop, returning the model's gathered notes. */
async function gatherFromWeb(prompt: string): Promise<string> {
  const c = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: 'user', content: prompt }];
  let response = await c.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SEARCH_SYSTEM,
    tools: WEB_TOOLS,
    messages,
  });
  recordCall(MODEL, response.usage, countWebSearches(response.content));
  // Server-side tools pause the turn when they hit their per-turn cap; resume.
  let guard = 0;
  while (response.stop_reason === 'pause_turn' && guard < 6) {
    messages.push({ role: 'assistant', content: response.content });
    response = await c.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SEARCH_SYSTEM,
      tools: WEB_TOOLS,
      messages,
    });
    recordCall(MODEL, response.usage, countWebSearches(response.content));
    guard += 1;
  }
  return textOf(response.content);
}

async function extractResources(notes: string, input: FindHelpInput): Promise<HelpResource[]> {
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: 3000,
    system:
      'Turn the research notes into a structured list of resources. Only include resources actually supported by the notes; do not invent any. Preserve the source URL for each.',
    messages: [
      {
        role: 'user',
        content: `Location: ${input.location}\nNeed: ${input.need}\n\nResearch notes:\n${notes}`,
      },
    ],
    tools: [
      { name: 'submit_resources', description: 'Return the structured resources.', input_schema: RESOURCES_SCHEMA },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
    tool_choice: { type: 'tool', name: 'submit_resources' },
  });
  recordCall(MODEL, res.usage);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = res.content.find((b: any) => b.type === 'tool_use') as any;
  return (block?.input?.resources ?? []) as HelpResource[];
}

function dedupe(resources: HelpResource[]): HelpResource[] {
  const seen = new Set<string>();
  const out: HelpResource[] = [];
  for (const r of resources) {
    const key = `${r.name.toLowerCase().trim()}|${(r.address ?? '').toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

export const webHelpFinder: HelpFinder = {
  name: `opus-web:${MODEL}`,

  async search(input: FindHelpInput) {
    const notes = await gatherFromWeb(
      `Find free and low-cost places to get care near "${input.location}" for someone who needs: ${input.need}.${
        input.notes ? ` Extra context: ${input.notes}.` : ''
      } Search broadly, then list the best options with addresses, phone numbers, costs, and source links.`,
    );
    return { resources: dedupe(await extractResources(notes, input)), notes };
  },

  async grade({ input, resources }) {
    const out = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: [
        'You are a strict grader for a list of emergency healthcare resources. Grade ONLY against the rubric below. Be skeptical: penalize resources that are not local, lack a stated cost, lack a source, or read like generic national hotlines when local options were requested.',
        `RUBRIC:\n${JSON.stringify(HELP_RUBRIC.criteria, null, 2)}`,
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: `Location: ${input.location}\nNeed: ${input.need}\n\nResources:\n${JSON.stringify(
            resources,
            null,
            2,
          )}\n\nGrade every criterion by id.`,
        },
      ],
      tools: [
        { name: 'submit_grade', description: 'Return the grade.', input_schema: GRADE_SCHEMA },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      tool_choice: { type: 'tool', name: 'submit_grade' },
    });
    recordCall(MODEL, out.usage);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = out.content.find((b: any) => b.type === 'tool_use') as any;
    return (block?.input?.criteria ?? []) as CriterionResult[];
  },

  async repair({ input, previous, failures }) {
    const gaps = failures.map((f) => `- [${f.id}] ${f.reasoning}${f.fix ? ` FIX: ${f.fix}` : ''}`).join('\n');
    const notes = await gatherFromWeb(
      `Improve a list of free/low-cost care resources near "${input.location}" for: ${input.need}. ` +
        `These problems were found and must be fixed:\n${gaps}\n\n` +
        `Search again to fill the gaps (e.g. find local mobile clinics, confirm addresses/costs, add source links). Existing resources:\n${JSON.stringify(
          previous,
        )}`,
    );
    const fresh = await extractResources(notes, input);
    return { resources: dedupe([...previous, ...fresh]) };
  },
};
