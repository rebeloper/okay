import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Each content skill carries its own copy of the ASD-STE100 reference so the
// skill folder stays self-contained (see the README). Copies drift silently;
// this is what stops that. Edit one, run the tests, copy to the rest.
const SKILLS = new URL('../skills/', import.meta.url).pathname;
const REF = 'reference-asd-ste100.md';

// A skill that names the reference must ship it. Deriving the list from the
// SKILL.md files rather than from the copies that happen to exist is the
// point: filtering on existsSync could never fail on a deleted copy, so the
// owning SKILL.md would point at a missing path with no test signal.
const skillsClaimingRef = () => readdirSync(SKILLS)
  .filter((skill) => existsSync(join(SKILLS, skill, 'SKILL.md')))
  .filter((skill) => readFileSync(join(SKILLS, skill, 'SKILL.md'), 'utf8').includes(REF));

test('every skill that names the ASD-STE100 reference ships a copy', () => {
  const missing = skillsClaimingRef().filter((skill) => !existsSync(join(SKILLS, skill, REF)));
  assert.deepEqual(missing, [], `these skills name ${REF} but do not carry it`);
});

test('every ASD-STE100 reference copy is byte-identical', () => {
  const owners = skillsClaimingRef();
  assert.ok(owners.length >= 7, `expected at least seven skills to carry ${REF}, found ${owners.length}`);

  const copies = owners.map((skill) => join(SKILLS, skill, REF)).filter((p) => existsSync(p));
  const [first, ...rest] = copies;
  const expected = readFileSync(first, 'utf8');
  for (const copy of rest) {
    assert.equal(readFileSync(copy, 'utf8'), expected, `${copy} has drifted from ${first}`);
  }
});
