// node server/lib/marks.selfcheck.js
import assert from 'node:assert/strict';
import { makeMarks, PER_VISITOR, MAX, TTL_MS } from './marks.js';

let t = 1_000_000;
const b = makeMarks({ now: () => t });

assert.equal(b.place('a', 'A', { kind: 'nope', x: 0.5, y: 0.5 }), null, 'unknown kind refused');
assert.equal(b.place('a', 'A', { kind: 'star', x: NaN, y: 0.5 }), null, 'non-finite position refused');
assert.equal(b.place('a', 'A', { kind: 'star', x: '1', y: 0.5 }), null, 'string position refused');
assert.equal(b.place(null, 'A', { kind: 'star', x: 0.5, y: 0.5 }), null, 'no owner, no mark');
const m = b.place('a', 'A', { kind: 'star', x: 7, y: -3, owner: 'z' });
assert.deepEqual([m.x, m.y], [1, 0], 'positions are clamped to the board');
assert.ok(!('owner' in m), 'the owner key is never handed out');

for (let i = 0; i < PER_VISITOR + 2; i++) b.place('a', 'A', { kind: 'heart', x: 0.1, y: 0.1 });
assert.equal(b.list().filter((x) => x.name === 'A').length, PER_VISITOR, 'one visitor keeps at most PER_VISITOR');

for (let i = 0; i < MAX + 10; i++) b.place(`v${i}`, `V${i}`, { kind: 'cat', x: 0.2, y: 0.2 });
assert.equal(b.list().length, MAX, 'the board holds at most MAX');

const mine = b.place('me', 'Me', { kind: 'spiral', x: 0.3, y: 0.3 });
assert.equal(b.lift('someone-else', mine.id), false, 'nobody lifts another visitor’s mark');
assert.equal(b.lift('me', mine.id), true, 'you can lift your own');

b.place('r', 'Old', { kind: 'stamp', x: 0.4, y: 0.4 });
b.rename('r', 'New');
assert.ok(b.list().some((x) => x.name === 'New') && !b.list().some((x) => x.name === 'Old'), 'a rename follows the marks');

t += TTL_MS + 1;
assert.equal(b.list().length, 0, 'everything expires');

let told = 0;
b.onClear(() => told++);
b.place('a', 'A', { kind: 'flower', x: 0.5, y: 0.5 });
b.clear();
assert.equal(b.list().length + told, 1, 'clear empties the board and notifies');

console.log('marks: checks passed');
