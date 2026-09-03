#!/usr/bin/env node
// PreToolUse hook for less-talk's sandbox. When toggled on, nudges the
// model to route dump-prone commands through okay-sandbox.mjs and
// records estimated bytes-avoided.
//
// Ported from hercules's pretooluse.mjs — same READ_NUDGE_THRESHOLD,
// DUMP_PATTERNS, BOUNDED, analyze()/buildOutput() branching. Only the
// self-exclusion string and NUDGE_MSG's example command differ, since this
// ships inside a plugin (resolved path, no PATH shim) instead of a loose
// skill folder.

import { readFileSync, statSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { statePath } from './okay-sandbox.mjs';

const READ_NUDGE_THRESHOLD = 50 * 1024; // bytes
// Commands that tend to dump large output into the transcript.
const DUMP_PATTERNS = [/\bcat\b/, /\bless\b/, /\bhead\b/, /\btail\b/, /\bcurl\b/, /\bwget\b/, /\bjq\b/, /\bfind\b/, /\bgrep\b/, /\bsed\b/, /\bawk\b/];
// Commands already bounded/cheap — don't nudge these (grep -c, wc, head/tail -N,
// | head|wc, and in-place sed -i edits, which write files rather than dump output).
const BOUNDED = /\bwc\b|\bgrep\b[^|;&]*\s-\w*c|\b(?:head|tail)\b\s+-n?\s*\d+|\|\s*(?:head|wc)\b|\bsed\s+-[a-zA-Z]*i\b/;
// A long option's value names a pattern or a path, never a command to run:
// `git log --grep=ERROR` is not a grep. Strip those before pattern-matching so
// they can't read as dump commands. Only DUMP_PATTERNS sees the stripped form
// — BOUNDED and the file-size measurement keep the original, so this can only
// remove false positives, never widen what gets denied.
const stripFlagValues = (cmd) => cmd.replace(/--[\w-]+=\S*/g, ' ');

// The resolved sandbox invocation the model should use instead. Built from
// CLAUDE_PLUGIN_ROOT (inherited from the bash shim's environment) so the
// nudge always shows a real, already-expanded path — never a $VAR the model
// would have to expand itself.
function sandboxInvocation() {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  const path = root ? `${root}/skills/less-talk/scripts/okay-sandbox.mjs` : 'skills/less-talk/scripts/okay-sandbox.mjs';
  return `node "${path}" --lang <shell|js|python>`;
}
const NUDGE_MSG = 'This is likely to flood the context window. Route it through '
  + `\`${sandboxInvocation()}\` (code on stdin) and print only the `
  + 'specific result you need, instead of dumping raw output.';

function realStatSize(p) {
  try {
    const st = statSync(p);
    return st.isFile() ? st.size : 0;
  } catch { return 0; }
}

// Largest existing file the command references — same tokenization as the
// sandbox's measureIn. 0 means "no referenced file found" (size unknown).
export function maxReferencedFileSize(cmd, statSize) {
  let max = 0;
  for (const tok of cmd.split(/[\s'"`|;&()<>=,]+/)) {
    if (!tok || tok.startsWith('-')) continue;
    const path = tok === '~' || tok.startsWith('~/') ? homedir() + tok.slice(1) : tok;
    const size = statSize(path);
    if (size > max) max = size;
  }
  return max;
}

// Pure nudge decision. "in"/"out" measurement lives in the engine, not here.
export function analyze(payload, statSize = realStatSize) {
  const tool = payload.tool_name;
  const input = payload.tool_input || {};

  if (tool === 'Read') {
    return { tool, nudge: statSize(input.file_path || '') >= READ_NUDGE_THRESHOLD };
  }
  if (tool === 'Grep') {
    // Only `content` mode dumps matched lines, and only without a head_limit.
    // The default (`files_with_matches`) and `count` are already bounded, so
    // nudging them spent tokens on every scoped search to save none.
    const mode = input.output_mode || 'files_with_matches';
    return { tool, nudge: mode === 'content' && !input.head_limit };
  }
  if (tool === 'Bash') {
    const cmd = input.command || '';
    if (/\bokay-sandbox\b/.test(cmd)) return { tool, nudge: false };    // already using the sandbox
    if (!DUMP_PATTERNS.some((re) => re.test(stripFlagValues(cmd)))) return { tool, nudge: false };
    if (BOUNDED.test(cmd)) return { tool, nudge: false };                   // already output-bounded
    // Only hard-deny what is provably large. A dump-prone command over a
    // provably small file runs untouched (denying `cat` of a 3-byte state
    // file costs more tokens than it saves); unknown size (curl, globs,
    // pipes with no local file) gets a soft nudge instead of a block.
    const size = maxReferencedFileSize(cmd, statSize);
    if (size >= READ_NUDGE_THRESHOLD) return { tool, nudge: true, hard: true };
    if (size > 0) return { tool, nudge: false };
    return { tool, nudge: true, hard: false };
  }
  return { tool, nudge: false };
}

// Bash matches referencing a provably large file are hard-denied (the model
// has a direct reroute: okay-sandbox). Everything else — Read, Grep, and
// unknown-size Bash — stays a soft nudge.
// Both shapes follow the hook protocol: decision JSON on stdout, exit 0.
export function buildOutput(analysis) {
  if (!analysis.nudge) return '';
  if (analysis.tool === 'Bash' && analysis.hard) {
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: NUDGE_MSG },
    });
  }
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: NUDGE_MSG },
  });
}

function isOn() {
  try { return readFileSync(statePath(), 'utf8').trim() === 'on'; } catch { return false; }
}

export function main() {
  if (!isOn()) return 0;
  let payload = {};
  try { payload = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return 0; }
  const analysis = analyze(payload);
  const out = buildOutput(analysis);
  if (out) process.stdout.write(out);
  return 0;
}

function isMain() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
}
if (isMain()) {
  process.exit(main());
}
