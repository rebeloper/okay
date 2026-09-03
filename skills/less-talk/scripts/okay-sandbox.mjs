#!/usr/bin/env node
// okay-sandbox — run a snippet in a subprocess and return ONLY what it
// prints, to keep raw tool output out of the context window. Zero
// third-party deps. NOT a security sandbox: snippets run with full user
// privileges, like Bash.
//
// Ported from hercules's hercules-sandbox.mjs — same interpreters, timeout,
// output cap, stderr tail, byte-safe truncation, NON_READERS regex,
// measureIn heuristic, and stats line format. Only state/stats paths differ
// (~/.okay/ instead of ~/.claude/hercules/), since this ships inside a
// plugin with its own product-state directory.

import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync, readFileSync, realpathSync, statSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// lang → interpreter. All read the program from stdin (no temp files needed).
// Compiled langs (go, rust) would need a temp-file variant — deferred (YAGNI).
export const INTERPRETERS = {
  shell:  { cmd: 'bash',    args: [] },
  js:     { cmd: 'node',    args: ['--input-type=module'] },
  python: { cmd: 'python3', args: [] },
  ruby:   { cmd: 'ruby',    args: [] },
  perl:   { cmd: 'perl',    args: [] },
};

const TIMEOUT_MS = 30000;
const MAX_CAP_BYTES = 50 * 1024;
const STDERR_TAIL_BYTES = 2 * 1024;

export function runSnippet(lang, code, { timeoutMs }) {
  const spec = INTERPRETERS[lang];
  if (!spec) return { ok: false, stdout: '', stderr: '', status: null, signal: null, missing: true };

  // Strip color-forcing from the child env: Claude Code sets FORCE_COLOR=3,
  // which (in Node, and in tools honoring the convention) beats NO_COLOR and
  // wraps even piped output in ANSI escapes — junk in the model's context.
  const env = { ...process.env, NO_COLOR: '1' };
  delete env.FORCE_COLOR;

  const res = spawnSync(spec.cmd, spec.args, {
    input: code,
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024, // capture generously; we cap the *returned* size later
    env,
  });

  if (res.error && res.error.code === 'ENOENT') {
    return { ok: false, stdout: '', stderr: '', status: null, signal: null, missing: true };
  }

  return {
    ok: !res.error && res.status === 0,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: res.status,
    signal: res.signal,
    timedOut: !!(res.error && res.error.code === 'ETIMEDOUT'),
    missing: false,
  };
}

// Keep the last <=maxBytes, starting at a line boundary so we never split a
// multi-byte UTF-8 codepoint (which would emit a replacement char).
function tail(str, maxBytes) {
  const buf = Buffer.from(str, 'utf8');
  if (buf.length <= maxBytes) return str;
  let slice = buf.subarray(buf.length - maxBytes);
  const nl = slice.indexOf(0x0a);
  if (nl >= 0 && nl < slice.length - 1) slice = slice.subarray(nl + 1);
  return slice.toString('utf8');
}

// Keep the first <=maxBytes, ending at a line boundary (same codepoint safety).
function head(str, maxBytes) {
  const buf = Buffer.from(str, 'utf8');
  if (buf.length <= maxBytes) return { text: str, truncated: false };
  let slice = buf.subarray(0, maxBytes);
  const nl = slice.lastIndexOf(0x0a);
  if (nl > 0) slice = slice.subarray(0, nl);
  return { text: slice.toString('utf8'), truncated: true };
}

export function formatResult(result, { lang, maxCapBytes, stderrTailBytes }) {
  if (result.missing) {
    const cmd = (INTERPRETERS[lang] && INTERPRETERS[lang].cmd) || lang;
    const text = `[okay-sandbox] ${lang}: ${cmd} not on PATH`;
    return { text, outBytes: Buffer.byteLength(text) };
  }
  if (result.timedOut) {
    const text = `[okay-sandbox] timed out`;
    return { text, outBytes: Buffer.byteLength(text) };
  }
  if (!result.ok) {
    const errTail = tail(result.stderr || '', stderrTailBytes);
    const text = `${errTail}\n[okay-sandbox] exit ${result.status}`;
    return { text, outBytes: Buffer.byteLength(text) };
  }
  // success
  const { text: capped, truncated } = head(result.stdout || '', maxCapBytes);
  const text = truncated
    ? capped + `\n[okay-sandbox] …truncated — narrow with grep/head/count]`
    : capped;
  return { text, outBytes: Buffer.byteLength(text) };
}

function okayDir() {
  return process.env.OKAY_DIR || join(homedir(), '.okay');
}
export function statePath() {
  return process.env.OKAY_SANDBOX_STATE || join(okayDir(), 'less-talk');
}
export function statsDir() {
  return join(okayDir(), 'less-talk-stats');
}
export function statsPath() {
  if (process.env.OKAY_SANDBOX_STATS) return process.env.OKAY_SANDBOX_STATS;
  // Key by session so concurrent Claude sessions don't share/clobber each other's
  // counters. Falls back to a shared file if the harness doesn't export the id.
  const sid = process.env.CLAUDE_CODE_SESSION_ID;
  return join(statsDir(), sid || 'default');
}
// mkdir the directory we are about to append to, not the default one:
// statsPath() honors OKAY_SANDBOX_STATS, so keying off statsDir() would
// create a stray ~/.okay/less-talk-stats even when the caller redirected
// the file elsewhere.
export function recordOut(bytes) {
  try { mkdirSync(dirname(statsPath()), { recursive: true }); appendFileSync(statsPath(), `out ${bytes}\n`); } catch { /* stats are best-effort */ }
}
export function recordIn(bytes) {
  try { mkdirSync(dirname(statsPath()), { recursive: true }); appendFileSync(statsPath(), `in ${bytes}\n`); } catch { /* stats are best-effort */ }
}

export function measuredDir() {
  return join(okayDir(), 'less-talk-measured');
}
export function measuredPath() {
  if (process.env.OKAY_SANDBOX_MEASURED) return process.env.OKAY_SANDBOX_MEASURED;
  const sid = process.env.CLAUDE_CODE_SESSION_ID;
  return join(measuredDir(), sid || 'default');
}

// Commands that name files without reading them — don't let these inflate "in".
const NON_READERS = /^\s*(?:rm|mv|cp|ln|ls|stat|chmod|chown|touch|mkdir|rmdir)\b/;

// Estimate "in" = total size of existing files the snippet reads. Heuristic (~ in
// the display): tokenize on shell/quote separators, stat each token, sum files.
// Skips obvious non-reading commands so they don't overstate the savings.
// Charged paths are logged per session (measuredPath) so re-referencing the same
// file across separate sandbox calls only counts its size once.
export function measureIn(code) {
  if (NON_READERS.test(code)) return 0;
  let total = 0;
  const seen = new Set();
  let charged = new Set();
  try { charged = new Set(readFileSync(measuredPath(), 'utf8').split('\n').filter(Boolean)); } catch { /* none charged yet */ }
  const newlyCharged = [];
  for (const tok of code.split(/[\s'"`|;&()<>=,]+/)) {
    if (!tok || seen.has(tok)) continue;
    seen.add(tok);
    const path = tok === '~' || tok.startsWith('~/') ? homedir() + tok.slice(1) : tok;
    if (charged.has(path)) continue;
    try {
      const st = statSync(path);
      if (st.isFile()) { total += st.size; newlyCharged.push(path); }
    } catch { /* not a path */ }
  }
  if (newlyCharged.length) {
    try {
      mkdirSync(dirname(measuredPath()), { recursive: true });
      appendFileSync(measuredPath(), newlyCharged.map((p) => `${p}\n`).join(''));
    } catch { /* best-effort */ }
  }
  return total;
}
export function setToggle(value) {
  mkdirSync(dirname(statePath()), { recursive: true });
  writeFileSync(statePath(), value === 'on' ? 'on' : 'off');
}

export function main(argv) {
  // expects: --lang <lang> [--timeout <s>] ; code on stdin
  let lang = null, timeoutMs = TIMEOUT_MS;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') lang = argv[++i];
    else if (argv[i] === '--timeout') { const n = Number(argv[++i]); if (Number.isFinite(n) && n > 0) timeoutMs = n * 1000; }
  }
  if (!lang) { process.stderr.write('usage: okay-sandbox --lang <lang>  (code on stdin)\n'); return 2; }
  if (process.stdin.isTTY) { process.stderr.write('okay-sandbox: no code on stdin — pipe a heredoc, e.g. node okay-sandbox.mjs --lang shell <<EOF … EOF\n'); return 2; }

  const code = readFileSync(0, 'utf8'); // fd 0 = stdin
  const inBytes = measureIn(code);
  const result = runSnippet(lang, code, { timeoutMs });
  const { text, outBytes } = formatResult(result, { lang, maxCapBytes: MAX_CAP_BYTES, stderrTailBytes: STDERR_TAIL_BYTES });
  if (inBytes > 0) recordIn(inBytes);
  recordOut(outBytes);
  process.stdout.write(text);
  if (!text.endsWith('\n')) process.stdout.write('\n');
  return result.ok ? 0 : 1;
}

// CLI entry — runs when executed directly, not when imported.
function isMain() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
}
if (isMain()) {
  process.exit(main(process.argv.slice(2)));
}
