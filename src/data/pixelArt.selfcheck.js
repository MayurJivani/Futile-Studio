// node src/data/pixelArt.selfcheck.js
// The pixel art is data: every row the same width, every cell a known colour.
import assert from 'node:assert/strict';
import { runs, mirror } from '../lib/pixels.js';
import { jinxCat, jinxPalette, patinaScene, patinaPalette, patinaWet, postcardSprites, postcardPalette } from './pixelArt.js';

for (const [name, rows, pal, opaque] of [['jinx', jinxCat, jinxPalette, false], ['patina', patinaScene, patinaPalette, true], ...Object.entries(postcardSprites).map(([k, r]) => [k, r, postcardPalette, false])]) {
	const w = rows[0].length;
	assert.ok(rows.every((r) => r.length === w), `${name}: every row is ${w} wide`);
	for (const c of new Set(rows.join(''))) assert.ok(c === '.' || pal[c], `${name}: '${c}' is in the palette`);
	if (opaque) {
		const covered = runs(rows, pal).reduce((n, [, , len]) => n + len, 0);
		assert.equal(covered, w * rows.length, `${name}: runs cover every cell`);
	}
}
assert.equal(patinaScene[0].length / patinaScene.length, 1.6, 'patina is the screenshot ratio');
assert.ok(jinxCat.every((r) => r === [...r].reverse().join('')), 'the cat is symmetric');
assert.deepEqual(mirror(['ab']), ['abba'], 'mirror doubles a half');
assert.deepEqual(runs(['aab.'], { a: '#1', b: '#2' }), [[0, 0, 2, '#1'], [2, 0, 1, '#2']], 'runs merge and skip blanks');
assert.ok(patinaPalette[patinaScene[patinaWet.y][patinaWet.x]], 'the wet cell is on the canvas');

console.log('pixel art: checks passed');
