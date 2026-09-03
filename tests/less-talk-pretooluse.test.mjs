import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, buildOutput } from '../skills/less-talk/scripts/pretooluse.mjs';

const bigStat = (p) => (p === 'huge.log' ? 2_200_000 : 0);
const nudges = (command) => analyze({ tool_name: 'Bash', tool_input: { command } }, bigStat).nudge;

test('cat of a large file nudges', () => {
  assert.equal(nudges('cat huge.log'), true);
});

test('non-dump commands are left alone', () => {
  assert.equal(nudges('git status'), false);
  assert.equal(nudges('ls -la'), false);
});

test('large Read nudges', () => {
  const a = analyze({ tool_name: 'Read', tool_input: { file_path: 'huge.log' } }, bigStat);
  assert.equal(a.nudge, true);
});

test('small Read is left alone', () => {
  const a = analyze({ tool_name: 'Read', tool_input: { file_path: 'tiny.txt' } }, () => 1000);
  assert.equal(a.nudge, false);
});

test('a pipe with a dump pattern nudges', () => {
  assert.equal(nudges('curl https://x | jq .'), true);
});

// Regression: compound/wrapped commands must not bypass the nudge (was an allowlist hole)
test('compound dump commands still nudge', () => {
  assert.equal(nudges('cd /tmp && cat huge.log'), true);
  assert.equal(nudges('echo $(cat huge.log)'), true);
});

// Regression: using the sandbox itself must not re-trigger the nudge
test('an okay-sandbox invocation is never nudged', () => {
  assert.equal(nudges('node "/plugin/root/skills/less-talk/scripts/okay-sandbox.mjs" --lang shell <<EOF\ngrep -c X f\nEOF'), false);
});

// Already-bounded commands are cheap — don't nudge
test('output-bounded commands are not nudged', () => {
  assert.equal(nudges('grep -c ERROR huge.log'), false);
  assert.equal(nudges('head -5 huge.log'), false);
  assert.equal(nudges('cat huge.log | wc -l'), false);
});

test('buildOutput denies provably-large Bash matches instead of nudging', () => {
  const out = buildOutput({ tool: 'Bash', nudge: true, hard: true });
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /okay-sandbox/);
});

// A dump-prone command over a provably small file must run untouched —
// denying `cat` of a 3-byte state file costs more tokens than it saves.
test('cat of a provably small file is left alone', () => {
  const a = analyze({ tool_name: 'Bash', tool_input: { command: 'cat tiny.txt' } }, (p) => (p === 'tiny.txt' ? 100 : 0));
  assert.equal(a.nudge, false);
});

// Unknown output size (no local file to stat) gets a soft nudge, not a block.
test('unknown-size dump commands soft-nudge instead of denying', () => {
  const a = analyze({ tool_name: 'Bash', tool_input: { command: 'curl https://x | jq .' } }, () => 0);
  assert.equal(a.nudge, true);
  assert.equal(a.hard, false);
  const parsed = JSON.parse(buildOutput(a));
  assert.equal(parsed.hookSpecificOutput.permissionDecision, undefined);
  assert.match(parsed.hookSpecificOutput.additionalContext, /okay-sandbox/);
});

test('cat of a large file is a hard deny', () => {
  const a = analyze({ tool_name: 'Bash', tool_input: { command: 'cat huge.log' } }, bigStat);
  assert.equal(a.hard, true);
});

// Only unbounded `content` searches can dump. The default mode and `count`
// are already bounded, so nudging them spent tokens to save none.
test('Grep nudges only for unbounded content mode', () => {
  const grep = (tool_input) => analyze({ tool_name: 'Grep', tool_input }).nudge;
  assert.equal(grep({ pattern: 'x', output_mode: 'content' }), true);
  assert.equal(grep({ pattern: 'x', output_mode: 'content', head_limit: 20 }), false);
  assert.equal(grep({ pattern: 'x', output_mode: 'files_with_matches' }), false);
  assert.equal(grep({ pattern: 'x', output_mode: 'count' }), false);
  assert.equal(grep({ pattern: 'x' }), false); // defaults to files_with_matches
});

// A long option's value names a pattern, not a command to run.
test('a dump word inside a long-option value is not a dump command', () => {
  assert.equal(nudges('git log --grep=ERROR'), false);
  assert.equal(nudges('rg --pattern=cat src/'), false);
  assert.equal(nudges('mycmd --out=find.txt'), false);
});

// The strip must not let a real dump through: the command word is untouched.
test('stripping long-option values still catches the real command', () => {
  assert.equal(nudges('cat --show-all=1 huge.log'), true);
  assert.equal(nudges('grep --color=never ERROR huge.log'), true);
});

test('buildOutput still soft-nudges Read/Grep matches', () => {
  const out = buildOutput({ tool: 'Read', nudge: true });
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.match(parsed.hookSpecificOutput.additionalContext, /okay-sandbox/);
});

test('buildOutput is empty when not nudging', () => {
  assert.equal(buildOutput({ tool: 'Bash', nudge: false }), '');
});

test('sed and awk now nudge (previously slipped through)', () => {
  assert.equal(nudges("sed -n '1,5p' huge.log"), true);
  assert.equal(nudges("awk '{print $1}' huge.log"), true);
});

// In-place sed edits write files instead of dumping output — don't deny them
test('sed -i in-place edits are not nudged', () => {
  assert.equal(nudges("sed -i 's/a/b/' config.txt"), false);
  assert.equal(nudges("sed -i '' 's/a/b/' config.txt"), false);
  assert.equal(nudges("sed -ri 's/a/b/' config.txt"), false);
});
