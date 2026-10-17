// node server/lib/visitors.selfcheck.js
// Names must be unique under pressure, stable for a returning token, and never
// one of the studio's own.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { makeVisitors, nameProblem, ADJECTIVES, NOUNS } from './visitors.js';

const db = new DatabaseSync(':memory:');
const v = makeVisitors(db);

/* 2,000 arrivals, more than the 900 plain pairs there are: every name distinct,
   case-insensitively, and the overflow gets suffixed rather than refused. */
const names = new Set();
for (let i = 0; i < 2000; i++) {
	const { name } = v.claim(null);
	assert.ok(!names.has(name.toLowerCase()), `unique: ${name}`);
	names.add(name.toLowerCase());
}
assert.equal(names.size, 2000, '2000 visitors, 2000 names');
assert.ok(ADJECTIVES.length * NOUNS.length < 2000, 'the run really exhausted the plain pairs');

/* A forced collision: a generator that always says the same thing. */
const stuck = makeVisitors(new DatabaseSync(':memory:'), { rnd: () => 0 });
const a = stuck.claim(null);
const b = stuck.claim(null);
assert.notEqual(a.name.toLowerCase(), b.name.toLowerCase(), 'a repeat falls through to a suffixed name');

/* Returning visitors keep their name; unknown or malformed tokens get a new one. */
const first = v.claim(null);
assert.deepEqual(v.claim(first.token), first, 'same token, same name');
assert.notEqual(v.claim('x'.repeat(40)).name, first.name, 'an unknown token is a new visitor');
assert.notEqual(v.claim('<script>').token, '<script>', 'a malformed token is never stored or echoed');

/* Choosing a name: validated, reserved names refused, taken names refused. */
assert.deepEqual(v.choose(first.token, 'QuietLobster42'), { name: 'QuietLobster42' }, 'a fine name is accepted');
assert.ok(v.choose(v.claim(null).token, 'quietlobster42').error, 'taken, ignoring case');
assert.ok(v.choose(first.token, 'Admin').error, 'reserved');
assert.ok(v.choose(first.token, 'JinxTheCat').error, 'reserved prefix');
assert.ok(v.choose(first.token, 'no spaces').error, 'invalid characters');
assert.ok(v.choose('nobody-token-at-all-0000000000000000', 'Fine').error, 'unknown visitor');
assert.equal(nameProblem('Ok'), 'Letters and digits only, 3 to 20, starting with a letter.', 'too short');

/* Rerolling lands on a different, still unique name. */
const r = v.reroll(first.token);
assert.ok(r && r !== 'QuietLobster42' && !names.has(r.toLowerCase()), 'reroll gives a fresh name');
assert.equal(v.reroll('nope'), null, 'reroll needs a real visitor');

assert.equal(v.nameOf(first.token), v.claim(first.token).name, 'nameOf reads the current name');
assert.equal(v.nameOf('<b>'), '', 'nameOf ignores junk');
console.log('visitors: checks passed');
