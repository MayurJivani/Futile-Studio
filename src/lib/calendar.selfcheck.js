// node src/lib/calendar.selfcheck.js
import assert from 'node:assert/strict';
import { monthGrid } from './calendar.js';

const oct = monthGrid(2026, 9); // October 2026 starts on a Thursday
assert.deepEqual(oct[0].slice(0, 3).map((c) => [c.d, c.inMonth]), [[28, false], [29, false], [30, false]], 'padded from September');
assert.equal(oct[0][3].d, 1, '1 October is a Thursday');
assert.ok(oct.every((w) => w.length === 7), 'every week is seven days');
assert.equal(oct.flat().filter((c) => c.inMonth).length, 31, 'October has 31 days');
assert.equal(monthGrid(2027, 1).flat().filter((c) => c.inMonth).length, 28, 'February 2027 has 28');
assert.equal(monthGrid(2028, 1).flat().filter((c) => c.inMonth).length, 29, 'February 2028 is a leap month');
assert.equal(monthGrid(2021, 1).length, 4, 'February 2021 fits four Monday weeks exactly');
console.log('calendar: checks passed');
