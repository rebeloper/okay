import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Nothing else parses these files until Claude Code loads the plugin, where a
// typo is silent: the marketplace entry just does not appear. Delivery also
// hangs off the version field (see docs/RELEASING.md), so it is checked here.
const ROOT = new URL('../', import.meta.url).pathname;
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const MANIFESTS = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'hooks/hooks.json',
  'package.json',
];

test('every manifest is valid JSON', () => {
  for (const rel of MANIFESTS) {
    assert.doesNotThrow(() => readJson(rel), `${rel} is not valid JSON`);
  }
});

test('the plugin version is a plain semver triple', () => {
  assert.match(readJson('.claude-plugin/plugin.json').version, /^\d+\.\d+\.\d+$/);
});

test('the marketplace entry points at this plugin', () => {
  const [entry, ...rest] = readJson('.claude-plugin/marketplace.json').plugins;
  assert.deepEqual(rest, [], 'expected exactly one plugin entry');
  assert.equal(entry.name, readJson('.claude-plugin/plugin.json').name);
  assert.equal(entry.source, './');
});

// A skill whose frontmatter name does not match its folder is invoked under a
// name the folder does not explain, and every cross-skill `/okay:x` reference
// in the family points at the wrong thing.
test('each skill frontmatter name matches its folder', () => {
  const skills = readdirSync(join(ROOT, 'skills'))
    .filter((s) => existsSync(join(ROOT, 'skills', s, 'SKILL.md')));
  assert.ok(skills.length >= 9, `expected at least nine skills, found ${skills.length}`);
  for (const skill of skills) {
    const name = read(`skills/${skill}/SKILL.md`).match(/^name:\s*(\S+)/m);
    assert.ok(name, `skills/${skill}/SKILL.md has no name in its frontmatter`);
    assert.equal(name[1], skill);
  }
});

// hooks.json names its scripts by path. A rename that misses this file leaves
// the hook silently doing nothing on every session.
test('every hook command points at a script that exists', () => {
  const events = Object.values(readJson('hooks/hooks.json').hooks).flat();
  const commands = events.flatMap((e) => e.hooks).map((h) => h.command);
  assert.ok(commands.length >= 2, 'expected at least two hook commands');
  for (const command of commands) {
    const path = command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)"/);
    assert.ok(path, `hook command does not resolve against CLAUDE_PLUGIN_ROOT: ${command}`);
    assert.ok(existsSync(join(ROOT, path[1])), `hook script is missing: ${path[1]}`);
  }
});
