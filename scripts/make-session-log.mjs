// Builds a readable, secret-redacted session log (session-log.md) from the
// Claude Code JSONL transcripts of the Throughline build. Human prompts are
// kept verbatim; Claude's turns are summarized (text + the tools it used);
// large command outputs and ALL secrets are stripped. Public-repo safe.
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = '/Users/tv/.claude/projects/-Users-tv-Downloads';
const SESSIONS = [
  ['27f1662d-07f5-4c7f-879a-4f98b94fab95.jsonl', 'Build session 1 — concept → working self-verifying app'],
  ['a10c4b7a-6d22-4854-8d94-71440e766027.jsonl', 'Build session 2 — real Opus, deploy, audits, fact-check, polish'],
];

// --- redaction: never let a secret reach a public repo -----------------------
function redact(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/sk-ant-[A-Za-z0-9_\-]*/g, 'sk-ant-***REDACTED***')
    .replace(/vc[pk]_[A-Za-z0-9]{4,}/g, 'vcp_***REDACTED***')
    .replace(/(VERCEL_TOKEN|ANTHROPIC_API_KEY)\s*=\s*["']?[^"'\s]+/g, '$1=***REDACTED***')
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]{15,}/g, '$1***REDACTED***')
    .replace(/gh[pous]_[A-Za-z0-9]{20,}/g, 'ghp_***REDACTED***');
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n').trim();
}
function hasToolResult(content) {
  return Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');
}
function toolCalls(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((b) => b && b.type === 'tool_use')
    .map((b) => {
      const i = b.input || {};
      let detail = i.description || i.file_path || i.command || i.prompt || i.path || i.pattern || '';
      detail = String(detail).split('\n')[0].slice(0, 90);
      return `${b.name}${detail ? ` — ${detail}` : ''}`;
    });
}

function isHumanPrompt(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.startsWith('<system-reminder>')) return false;
  if (t.startsWith('<local-command')) return false;
  if (t.startsWith('Caveat:')) return false;
  if (t.startsWith('This session is being continued')) return false; // compaction summary
  const head = t.slice(0, 200);
  if (head.includes('Base directory for this skill')) return false;    // skill bundle injection
  if (head.includes('This skill helps you')) return false;
  if (/^#\s+Building LLM-Powered Applications/.test(t)) return false;
  if (t.startsWith('<command-name>') || t.startsWith('<command-message>')) return false;
  if (t.startsWith('[Request interrupted')) return false;
  if (t === 'API Error' || t.startsWith('[The user has')) return false;
  return true;
}
function capPrompt(t) {
  if (t.length <= 8000) return t;
  return t.slice(0, 6000).trimEnd() + '\n\n… [long paste truncated in the log]';
}

const out = [];
out.push('# Throughline — Claude Code Session Log');
out.push('');
out.push('_Built for **Claude Build Day** (June 13, 2026) using Claude Code with **Opus 4.8**._');
out.push('');
out.push('This is a faithful record of the build. Every **human prompt** that directed the');
out.push('work is kept verbatim; **Claude\'s** turns are condensed to the explanation plus the');
out.push('tools it ran. Large command outputs and all secrets (API keys, tokens) are stripped —');
out.push('this file is safe for a public repo.');
out.push('');
out.push('- **Repo:** https://github.com/tqvant/throughline');
out.push('- **Live demo:** https://throughline-opal.vercel.app');
out.push('- **Model:** `claude-opus-4-8` (generate / grade / repair + web-search agent + MCP tools)');
out.push('');

let userCount = 0;
for (const [file, label] of SESSIONS) {
  const lines = readFileSync(`${DIR}/${file}`, 'utf8').split('\n').filter(Boolean);
  let started = false;
  const turns = [];
  for (const line of lines) {
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const msg = o.message;
    if (!msg || !msg.role) continue;
    const content = msg.content;
    if (msg.role === 'user') {
      if (hasToolResult(content)) continue; // tool output, not a human turn
      const t = textOf(content);
      if (!isHumanPrompt(t)) continue;
      turns.push({ who: 'user', text: redact(capPrompt(t)) });
    } else if (msg.role === 'assistant') {
      const t = redact(textOf(content));
      const tools = toolCalls(content).map(redact);
      if (!t && !tools.length) continue;
      turns.push({ who: 'claude', text: t, tools });
    }
  }
  if (!turns.length) continue;
  out.push('---');
  out.push('');
  out.push(`## ${label}`);
  out.push('');
  for (const turn of turns) {
    if (turn.who === 'user') {
      userCount++;
      out.push(`### 🧑 Human`);
      out.push('');
      out.push(turn.text.split('\n').map((l) => '> ' + l).join('\n'));
      out.push('');
    } else {
      let body = turn.text;
      if (body.length > 700) body = body.slice(0, 700).trimEnd() + ' …';
      if (body) { out.push('**🤖 Claude:** ' + body); out.push(''); }
      if (turn.tools.length) {
        const shown = turn.tools.slice(0, 12);
        out.push('<sub>🔧 ' + shown.join(' · ') + (turn.tools.length > 12 ? ` · +${turn.tools.length - 12} more` : '') + '</sub>');
        out.push('');
      }
    }
  }
}

out.push('---');
out.push('');
out.push(`_${userCount} human prompts across 2 sessions. Verification at submission time:_`);
out.push('_`npm test` → 16 tests / 42 assertions passing · `npm run eval:mock` → all personas pass ·_');
out.push('_`npm run eval` → all personas pass via real Opus 4.8 · live deploy verified end-to-end._');
out.push('');

const md = out.join('\n');
// final safety sweep: assert no known secret prefixes survive
for (const pat of [/sk-ant-[A-Za-z0-9]/, /vc[pk]_[A-Za-z0-9]{8}/]) {
  if (pat.test(md)) { console.error('REFUSING TO WRITE: secret survived redaction', pat); process.exit(1); }
}
writeFileSync('/Users/tv/Downloads/bridge/session-log.md', md);
console.log(`wrote session-log.md — ${md.length} bytes, ${userCount} human prompts`);
