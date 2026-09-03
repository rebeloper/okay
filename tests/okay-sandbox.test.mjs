import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import {
  INTERPRETERS, runSnippet, formatResult,
  recordOut, setToggle, statsPath, statePath, measureIn, measuredPath,
} from '../skills/less-talk/scripts/okay-sandbox.mjs';

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
