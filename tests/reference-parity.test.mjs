import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Each content skill carries its own copy of the ASD-STE100 reference so the
// skill folder stays self-contained (see the README). Copies drift silently;
// this is what stops that. Edit one, run the tests, copy to the rest.
const SKILLS = new URL('../skills/', import.meta.url).pathname;
const REF = 'reference-asd-ste100.md';

test('every ASD-STE100 reference copy is byte-identical', () => {
  const copies = readdirSync(SKILLS)
    .map((skill) => join(SKILLS, skill, REF))
    .filter((p) => existsSync(p));

  assert.ok(copies.length >= 5, `expected the five content skills to carry ${REF}`);

  const [first, ...rest] = copies;
  const expected = readFileSync(first, 'utf8');
  for (const copy of rest) {
    assert.equal(readFileSync(copy, 'utf8'), expected, `${copy} has drifted from ${first}`);
  }
});
