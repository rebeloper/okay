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

// A command line often chains several commands, and boundedness has to hold for
// the one that dumps — `tail -5 small.txt && cat huge.log` is not bounded, and
// `cp huge.log bak && cat small.txt` dumps only the small file. Split on
// statement separators (never on `|`, which is one pipeline) and judge each
// segment on its own.
const segments = (cmd) => cmd.split(/(?:&&|\|\||;|\n)+/).filter((seg) => seg.trim());

// A dump word only counts in command position: the start of a segment, after a
// pipe, or inside $( ) / backticks. Anywhere else it is a path or an argument —
// `python3 run.py /data/cat/huge.log` runs no `cat`.
const CMD_POS = String.raw`(?:^|\||\$\(|\x60)\s*(?:sudo\s+|time\s+|xargs\s+)?`;
// Commands that tend to dump large output into the transcript.
const DUMP_PATTERNS = ['cat', 'less', 'head', 'tail', 'curl', 'wget', 'jq', 'find', 'grep', 'sed', 'awk']
  .map((word) => new RegExp(CMD_POS + word + String.raw`\b`));

// Commands already bounded/cheap — don't nudge these. Anchored at command
// position for the same reason: an unanchored `\bwc\b` meant the trailing
// comment in `cat huge.log  # wc` switched the whole gate off.
const BOUNDED = new RegExp([
  String.raw`${CMD_POS}wc\b`,                                   // wc prints counts
  String.raw`\|\s*(?:head|wc)\b`,                               // piped into head/wc
  String.raw`${CMD_POS}(?:head|tail)\b`,                        // a slice, 10 lines by default
  String.raw`${CMD_POS}grep\b[^|]*(?:\s-\w*c\b|\s--count\b)`,  // grep -c / --count
  String.raw`${CMD_POS}sed\s+-[a-zA-Z]*i\b`,                    // in-place edit, writes a file
].join('|'));

// The sandbox invoking itself must not re-trigger the gate. Match the actual
// invocation shape, not the bare name: an unanchored name let `cat huge.log
// # okay-sandbox` and `grep okay-sandbox huge.log` switch the gate off.
const SELF_INVOCATION = /^\s*(?:\w+=\S+\s+)*node\s+["']?\S*okay-sandbox\.mjs\b/;
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
  // The payload is whatever the harness piped in. A non-object, or a field of
  // the wrong type, used to throw an uncaught TypeError — which failed the hook
  // open and dumped a stack trace into the transcript.
  const call = payload && typeof payload === 'object' ? payload : {};
  const tool = call.tool_name;
  const input = call.tool_input && typeof call.tool_input === 'object' ? call.tool_input : {};

  if (tool === 'Read') {
    const filePath = typeof input.file_path === 'string' ? input.file_path : '';
    return { tool, nudge: statSize(filePath) >= READ_NUDGE_THRESHOLD };
  }
  if (tool === 'Grep') {
    // Only `content` mode dumps matched lines, and only without a head_limit.
    // The default (`files_with_matches`) and `count` are already bounded, so
    // nudging them spent tokens on every scoped search to save none.
    const mode = input.output_mode || 'files_with_matches';
    return { tool, nudge: mode === 'content' && !input.head_limit };
  }
  if (tool === 'Bash') {
    const cmd = typeof input.command === 'string' ? input.command : '';
    if (SELF_INVOCATION.test(cmd)) return { tool, nudge: false };  // already using the sandbox
    const dumping = segments(cmd).filter((seg) =>
      DUMP_PATTERNS.some((re) => re.test(stripFlagValues(seg))) && !BOUNDED.test(seg));
    if (!dumping.length) return { tool, nudge: false };
    // Only hard-deny what is provably large. A dump-prone command over a
    // provably small file runs untouched (denying `cat` of a 3-byte state
    // file costs more tokens than it saves); unknown size (curl, globs,
    // pipes with no local file) gets a soft nudge instead of a block.
    // Size comes from the dumping segments only, so a large file that is
    // merely copied alongside a small dump does not trigger a block.
    const size = Math.max(0, ...dumping.map((seg) => maxReferencedFileSize(seg, statSize)));
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
  // The whole body is guarded, not just the parse: a hook that throws fails
  // open anyway, so it should do that quietly instead of writing a stack trace
  // into the transcript this mode exists to keep small.
  try {
    const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const out = buildOutput(analyze(payload));
    if (out) process.stdout.write(out);
  } catch { /* never block a tool call on a hook bug */ }
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
