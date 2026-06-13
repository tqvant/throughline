// Throughline MCP server.
//
// Exposes the SAME engine the web app uses as Model Context Protocol tools, so
// any MCP client (Claude Desktop, Claude Code, another agent) can call them:
//
//   check_eligibility   — deterministic benefits eligibility (no API key needed)
//   find_care_resources — the self-verifying emergency-gap finder
//
// Run:  npm run mcp     (stdio transport)
//
// This is what makes Throughline composable: the orchestration that powers the
// product is also a reusable tool surface for other agents.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { computeEligibility } from '../src/lib/eligibility';
import { runFindHelp } from '../src/lib/findHelp';
import { mockHelpFinder } from '../src/lib/mockHelpFinder';
import type { HelpFinder, Reason } from '../src/lib/types';

const server = new McpServer({ name: 'throughline', version: '0.1.0' });

server.registerTool(
  'check_eligibility',
  {
    title: 'Check benefits eligibility',
    description:
      'Given a household situation, compute which health-coverage programs they likely qualify for (Medi-Cal/Medicaid, subsidized marketplace, safety-net options) using public Federal Poverty Level data. Deterministic — no model call. Surfaces the current-monthly-income Medicaid pathway and enrollment-deadline flags.',
    inputSchema: {
      state: z.string().default('CA').describe('Two-letter state code'),
      householdSize: z.number().int().min(1).describe('People in the household'),
      annualIncome: z.number().min(0).describe("Last year's / projected annual household income, USD"),
      currentMonthlyIncome: z
        .number()
        .min(0)
        .describe('Current total monthly household income right now, USD (include unemployment)'),
      reason: z
        .enum(['job_loss', 'reduced_hours', 'aging_out', 'other'])
        .default('job_loss')
        .describe('What changed'),
      hasChildren: z.boolean().default(false),
      pregnant: z.boolean().default(false),
      lostCoverageDate: z.string().optional().describe('ISO date coverage ended, if known'),
    },
  },
  async (args) => {
    const result = computeEligibility({
      state: args.state,
      householdSize: args.householdSize,
      annualIncome: args.annualIncome,
      currentMonthlyIncome: args.currentMonthlyIncome,
      reason: args.reason as Reason,
      hasChildren: args.hasChildren,
      pregnant: args.pregnant,
      lostCoverageDate: args.lostCoverageDate,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  'find_care_resources',
  {
    title: 'Find local free/low-cost care for a coverage gap',
    description:
      'Find real, local, free or low-cost immediate-care resources for someone with no coverage right now — free clinics, community health centers, mobile units, prescription assistance, and clinical trials. Self-verifies the list (local, real, sourced, free) before returning. Uses the live web when ANTHROPIC_API_KEY is set, otherwise a deterministic offline sample.',
    inputSchema: {
      location: z.string().describe('City, ZIP, or "City, ST"'),
      need: z.string().describe('What they need right now, in plain words'),
      notes: z.string().optional(),
    },
  },
  async (args) => {
    let finder: HelpFinder = mockHelpFinder;
    if (process.env.ANTHROPIC_API_KEY) {
      const { webHelpFinder } = await import('../src/lib/webSearch');
      finder = webHelpFinder;
    }
    const result = await runFindHelp(
      { location: args.location, need: args.need, notes: args.notes },
      finder,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { passed: result.passed, resources: result.final.resources },
            null,
            2,
          ),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Never write to stdout — it's the protocol channel. Log to stderr.
  console.error('Throughline MCP server running on stdio (check_eligibility, find_care_resources)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
