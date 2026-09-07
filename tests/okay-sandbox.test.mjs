import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  INTERPRETERS, runSnippet, formatResult,
  recordOut, setToggle, statsPath, statePath, measureIn, measuredPath,
} from '../skills/less-talk/scripts/okay-sandbox.mjs';

// Some regressions only reproduce through the CLI entry point, not the exports.
const SANDBOX = new URL('../skills/less-talk/scripts/okay-sandbox.mjs', import.meta.url).pathname;

// ── dispatch + execution ────────────────────────────────────────────────
test('shell snippet returns only stdout', () => {
  const r = runSnippet('shell', 'echo hello', { timeoutMs: 5000, maxCapBytes: 50000 });
  assert.equal(r.ok, true);
  assert.equal(r.stdout.trim(), 'hello');
  assert.equal(r.missing, false);
});

test('js snippet runs as module', () => {
  const r = runSnippet('js', 'console.log(40 + 2)', { timeoutMs: 5000, maxCapBytes: 50000 });
  assert.equal(r.stdout.trim(), '42');
});

// Claude Code sets FORCE_COLOR=3, which makes Node colorize even piped
// output — snippets must not inherit it, or ANSI junk lands in the context.
test('color-forcing env vars are stripped from snippets', () => {
  const prev = process.env.FORCE_COLOR;
  process.env.FORCE_COLOR = '3';
  try {
    const r = runSnippet('js', 'console.log(40 + 2)', { timeoutMs: 5000, maxCapBytes: 50000 });
    assert.equal(r.stdout.trim(), '42');
    assert.ok(!r.stdout.includes('\x1B['), 'stdout must not contain ANSI escapes');
  } finally {
    if (prev === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = prev;
  }
});

test('python snippet runs from stdin', () => {
  const r = runSnippet('python', 'print(6 * 7)', { timeoutMs: 5000, maxCapBytes: 50000 });
  assert.equal(r.stdout.trim(), '42');
});

test('unknown language is reported, not crashed', () => {
  const r = runSnippet('cobol', 'x', { timeoutMs: 5000, maxCapBytes: 50000 });
  assert.equal(r.missing, true);
});

// ── guards ──────────────────────────────────────────────────────────────
test('successful output under cap is returned verbatim', () => {
  const { text, outBytes } = formatResult(
    { ok: true, stdout: 'line1\nline2\n', stderr: '', status: 0, missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.equal(text, 'line1\nline2\n');
  assert.equal(outBytes, Buffer.byteLength('line1\nline2\n'));
});

test('output over cap is truncated with a note', () => {
  const big = 'x'.repeat(60000);
  const { text } = formatResult(
    { ok: true, stdout: big, stderr: '', status: 0, missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.ok(text.length < big.length);
  assert.match(text, /truncated — narrow with grep\/head\/count/);
});

test('missing interpreter yields a short clean message', () => {
  const { text } = formatResult(
    { missing: true }, { lang: 'ruby', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.match(text, /^\[okay-sandbox\] ruby: ruby not on PATH/);
});

test('timeout yields a timeout message', () => {
  const { text } = formatResult(
    { ok: false, timedOut: true, stdout: '', stderr: '', status: null, missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.match(text, /timed out/);
});

test('snippet error returns exit code + bounded stderr tail', () => {
  const { text } = formatResult(
    { ok: false, timedOut: false, stdout: '', stderr: 'boom\n', status: 3, missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.match(text, /boom/);
  assert.match(text, /exit 3/);
});

// ── stats + toggle ──────────────────────────────────────────────────────
test('recordOut appends an out line to the stats file', () => {
  const f = `/tmp/okay-sandbox-stats-${process.pid}.log`;
  process.env.OKAY_SANDBOX_STATS = f;
  rmSync(f, { force: true });
  recordOut(3);
  recordOut(10);
  const lines = readFileSync(f, 'utf8').trim().split('\n');
  assert.deepEqual(lines, ['out 3', 'out 10']);
  assert.equal(statsPath(), f);
  rmSync(f, { force: true });
  delete process.env.OKAY_SANDBOX_STATS;
});

test('measureIn sums sizes of existing files the snippet references', () => {
  const f = `/tmp/okay-sandbox-in-${process.pid}.txt`;
  const measured = `/tmp/okay-sandbox-measured-${process.pid}.txt`;
  process.env.OKAY_SANDBOX_MEASURED = measured;
  rmSync(measured, { force: true });
  writeFileSync(f, 'x'.repeat(1234));
  assert.equal(measureIn(`grep -c ERROR ${f}`), 1234);
  assert.equal(measureIn('echo no files here'), 0);
  assert.equal(measureIn(`rm ${f}`), 0);
  assert.equal(measureIn(`ls -la ${f}`), 0);
  rmSync(f, { force: true });
  rmSync(measured, { force: true });
  delete process.env.OKAY_SANDBOX_MEASURED;
});

test('measureIn does not recharge a path already counted this session', () => {
  const f = `/tmp/okay-sandbox-in-dedup-${process.pid}.txt`;
  const measured = `/tmp/okay-sandbox-measured-dedup-${process.pid}.txt`;
  process.env.OKAY_SANDBOX_MEASURED = measured;
  rmSync(measured, { force: true });
  writeFileSync(f, 'x'.repeat(500));
  assert.equal(measureIn(`grep -c ERROR ${f}`), 500);
  assert.equal(measureIn(`grep -c WARN ${f}`), 0);
  rmSync(f, { force: true });
  rmSync(measured, { force: true });
  delete process.env.OKAY_SANDBOX_MEASURED;
});

test('measuredPath defaults under OKAY_DIR when set', () => {
  const dir = `/tmp/okay-sandbox-dir2-${process.pid}`;
  const prevSid = process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  process.env.OKAY_DIR = dir;
  assert.equal(measuredPath(), `${dir}/less-talk-measured/default`);
  delete process.env.OKAY_DIR;
  if (prevSid !== undefined) process.env.CLAUDE_CODE_SESSION_ID = prevSid;
});

test('setToggle writes on/off to the state file', () => {
  const f = `/tmp/okay-sandbox-state-${process.pid}`;
  process.env.OKAY_SANDBOX_STATE = f;
  setToggle('on');
  assert.equal(readFileSync(f, 'utf8'), 'on');
  setToggle('off');
  assert.equal(readFileSync(f, 'utf8'), 'off');
  assert.equal(statePath(), f);
  rmSync(f, { force: true });
  delete process.env.OKAY_SANDBOX_STATE;
});

test('statePath defaults under OKAY_DIR when set', () => {
  const dir = `/tmp/okay-sandbox-dir-${process.pid}`;
  process.env.OKAY_DIR = dir;
  assert.equal(statePath(), `${dir}/less-talk`);
  delete process.env.OKAY_DIR;
});

// ── regressions ─────────────────────────────────────────────────────────
// A non-zero exit used to discard stdout entirely. `grep -c` exits 1 on zero
// matches after printing the `0` that was the whole point of the run.
test('a non-zero exit keeps the output the snippet already printed', () => {
  const { text } = formatResult(
    { ok: false, timedOut: false, stdout: '0\n', stderr: '', status: 1, missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.match(text, /^0\n/);
  assert.match(text, /exit 1/);
});

// A successful run used to drop stderr, losing deprecation and partial-failure
// warnings without a trace.
test('a successful run still reports stderr', () => {
  const { text } = formatResult(
    { ok: true, stdout: 'ok\n', stderr: 'important warning\n', status: 0, missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.match(text, /ok/);
  assert.match(text, /important warning/);
});

// A signal-killed snippet reported `exit null`, telling the model nothing.
test('a signal-killed snippet names the signal', () => {
  const { text } = formatResult(
    { ok: false, timedOut: false, stdout: '', stderr: '', status: null, signal: 'SIGKILL', missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.match(text, /killed by SIGKILL/);
});

// Byte slicing with no newline in the slice used to split a codepoint and emit
// U+FFFD at the cut.
test('truncation never splits a multi-byte character', () => {
  const wide = '中'.repeat(20000); // no newline anywhere
  const { text } = formatResult(
    { ok: true, stdout: wide, stderr: '', status: 0, missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.ok(!text.includes('�'), 'stdout cap must not emit a replacement char');
  const { text: errText } = formatResult(
    { ok: false, timedOut: false, stdout: '', stderr: wide, status: 1, missing: false },
    { lang: 'shell', maxCapBytes: 50000, stderrTailBytes: 2000 });
  assert.ok(!errText.includes('�'), 'stderr tail must not emit a replacement char');
});

// NON_READERS was matched against the whole snippet with a non-multiline `^`,
// so a first line of `ls` zeroed the measurement for every line after it.
test('a non-reading first line does not zero the rest of the snippet', () => {
  const f = `/tmp/okay-sandbox-multiline-${process.pid}.txt`;
  const measured = `/tmp/okay-sandbox-measured-multiline-${process.pid}.txt`;
  process.env.OKAY_SANDBOX_MEASURED = measured;
  rmSync(measured, { force: true });
  writeFileSync(f, 'x'.repeat(4321));
  assert.equal(measureIn(`ls -la\ngrep -c ERROR ${f}`), 4321);
  rmSync(f, { force: true });
  rmSync(measured, { force: true });
  delete process.env.OKAY_SANDBOX_MEASURED;
});

// spawnSync wants an integer timeout: a fractional or overflowing --timeout
// threw ERR_OUT_OF_RANGE before the snippet ever ran.
test('a fractional or overflowing --timeout does not crash', () => {
  for (const arg of ['0.0005', '1e308']) {
    const r = spawnSync(process.execPath, [SANDBOX, '--lang', 'shell', '--timeout', arg], { input: 'echo hi', encoding: 'utf8' });
    assert.equal(r.error, undefined);
    assert.doesNotMatch(r.stderr || '', /ERR_OUT_OF_RANGE/);
  }
});

// A failed run used to book the full "in" savings, leaving the corrected
// re-run with nothing to claim because the path was already marked charged.
test('a failed run books no savings, so the fixed re-run books them', () => {
  const dir = `/tmp/okay-sandbox-charge-${process.pid}`;
  const f = `${dir}/data.txt`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(f, 'x'.repeat(9876));
  const env = {
    ...process.env,
    OKAY_SANDBOX_STATS: `${dir}/stats`,
    OKAY_SANDBOX_MEASURED: `${dir}/measured`,
    OKAY_SANDBOX_STATE: `${dir}/state`,
  };
  const run = (code) => spawnSync(process.execPath, [SANDBOX, '--lang', 'shell'], { input: code, encoding: 'utf8', env });
  run(`nosuchcommand ${f}`);                    // fails
  assert.doesNotMatch(readFileSync(`${dir}/stats`, 'utf8'), /^in /m, 'a failed run must not book savings');
  run(`grep -c x ${f} > /dev/null; true`);      // succeeds
  assert.match(readFileSync(`${dir}/stats`, 'utf8'), /^in 9876$/m);
  rmSync(dir, { recursive: true, force: true });
});
