// node server/lib/votes.selfcheck.js
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { makeVotes } from './votes.js';
import { ideas } from '../../src/data/studio.js';

const v = makeVotes(new DatabaseSync(':memory:'), 'test-secret');
const a = v.voterFor('203.0.113.7');
const b = v.voterFor('198.51.100.2');
const first = ideas[0].id;

assert.equal(a, v.voterFor('203.0.113.7'), 'same address, same voter');
assert.notEqual(a, b, 'different address, different voter');
assert.match(a, /^[0-9a-f]{16}$/, 'voter is a short hash, not the address');

assert.deepEqual(Object.keys(v.tally()).sort(), ideas.map((i) => i.id).sort(), 'tally lists every idea');
assert.equal(v.toggle(a, first), true);
assert.equal(v.toggle(b, first), true);
assert.equal(v.tally()[first], 2);
assert.equal(v.toggle(a, first), false, 'second toggle takes the vote back');
assert.equal(v.tally()[first], 1);
assert.deepEqual(v.mine(b), [first]);

for (const bad of ['nope', '', null, 42, { id: first }, '<script>', `${first} `]) {
	assert.equal(v.toggle(a, bad), null, `refuses ${JSON.stringify(bad)}`);
}
assert.equal(Object.values(v.tally()).reduce((s, n) => s + n, 0), 1, 'refused votes stored nothing');

console.log('votes: 14 checks passed');
