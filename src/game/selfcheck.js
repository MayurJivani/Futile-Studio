/* Self-check for the ASCII world's pure logic.
 *
 *   node src/game/selfcheck.js
 *
 * Covers the parts that fail silently in a glyph field: terrain determinism
 * (multiplayer peers must agree on the map without the server sending one),
 * ramp clamping (an out-of-range index writes NaN into the instance buffer and
 * corrupts the whole frame), collision, rain recycling, and the one piece of
 * attacker-controlled text in the system.
 *
 * No framework on purpose: it runs anywhere node does.
 */

import assert from 'node:assert/strict';
import { World, TILE, windAt, skyAt, DAY_SECONDS } from './world.js';
import { RAMP_GRASS, RAMP_WATER, fromRamp, glyph, labelFor, ATLAS_CHARS } from './glyphs.js';
import { Player, Rain, Peer, SPRITES, SPRITE_W, partAt, lookFor } from './entities.js';
import { gridOrigin } from './game.js';
import { cleanDisplayName } from '../../server/lib/validate.js';

let n = 0;
const check = (name, fn) => {
	fn();
	n++;
	console.log('  ok  ' + name);
};

/* ------------------------------------------------------------- terrain -- */

check('terrain is deterministic for one seed', () => {
	const a = new World(42);
	const b = new World(42);
	for (let i = -40; i < 40; i += 7) {
		for (let j = -40; j < 40; j += 7) {
			assert.equal(a.tile(i, j), b.tile(i, j), `tile ${i},${j} disagreed`);
		}
	}
});

check('a different seed makes a different map', () => {
	const a = new World(42);
	const b = new World(43);
	let diff = 0;
	for (let i = 0; i < 200; i++) if (a.tile(i, i) !== b.tile(i, i)) diff++;
	assert.ok(diff > 10, `seeds barely differed (${diff}/200)`);
});

check('every tile is a known kind', () => {
	const w = new World(7);
	const kinds = new Set(Object.values(TILE));
	for (let i = -60; i < 60; i++) assert.ok(kinds.has(w.tile(i, i * 3)));
});

check('solid and wet agree with the tile under them', () => {
	const w = new World(99);
	for (let i = -200; i < 200; i += 3) {
		for (let j = -30; j < 30; j += 11) {
			const t = w.tile(i, j);
			assert.equal(w.solid(i, j), t === TILE.TREE || t === TILE.ROCK);
			assert.equal(w.wet(i, j), t === TILE.WATER);
		}
	}
});

check('the tile cache stays bounded', () => {
	const w = new World(3);
	for (let i = 0; i < 70000; i++) w.tile(i, 0);
	assert.ok(w.cache.size <= 60001, `cache grew to ${w.cache.size}`);
});

check('the map contains both water and land', () => {
	const w = new World(20260413);
	const seen = new Set();
	for (let i = -150; i < 150; i += 2) for (let j = -80; j < 80; j += 2) seen.add(w.tile(i, j));
	assert.ok(seen.has(TILE.WATER), 'no water anywhere, reflection would never show');
	assert.ok(seen.has(TILE.GRASS), 'no grass anywhere');
	assert.ok(seen.has(TILE.TREE), 'no trees anywhere');
});

/* --------------------------------------------------------------- ramps -- */

check('ramps clamp instead of running off the end', () => {
	for (const r of [RAMP_GRASS, RAMP_WATER]) {
		for (const t of [-5, -0.0001, 0, 0.5, 1, 1.0001, 99, NaN]) {
			const g = fromRamp(r, t);
			assert.equal(typeof g, 'number', `t=${t} gave ${g}`);
			assert.ok(Number.isFinite(g), `t=${t} gave a non-finite glyph`);
			assert.ok(g >= 0 && g < ATLAS_CHARS.length, `t=${t} gave index ${g}`);
		}
	}
});

check('unknown characters fall back to blank, not to garbage', () => {
	assert.equal(glyph('☃'), 0);
	assert.equal(glyph(''), 0);
	assert.ok(glyph('A') > 0);
	/* Index 0 must be blank, because a zeroed instance buffer draws it. */
	assert.equal(ATLAS_CHARS[0], ' ');
});

/* ----------------------------------------------------------- wind, sky -- */

check('wind stays in range', () => {
	for (let t = 0; t < 60; t += 0.37) {
		for (let x = -50; x < 50; x += 13) {
			const v = windAt(x, x * 2, t);
			assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.001, `wind ${v} out of range`);
		}
	}
});

check('the day cycle actually cycles', () => {
	const noon = skyAt(DAY_SECONDS * 0.25);
	const midnight = skyAt(DAY_SECONDS * 0.75);
	assert.ok(noon.isDay && noon.light > 0.9, 'noon was not bright');
	assert.ok(!midnight.isDay && midnight.night > 0.9, 'midnight was not dark');
	for (let t = 0; t < DAY_SECONDS; t += 3) {
		const s = skyAt(t);
		assert.ok(s.bodyAlt >= 0 && s.bodyAlt <= 1, `bodyAlt ${s.bodyAlt}`);
		assert.ok(s.bodyX >= 0 && s.bodyX <= 1, `bodyX ${s.bodyX}`);
		assert.ok(s.tint.every(Number.isFinite));
	}
});

/* -------------------------------------------------------------- player -- */

check('the player cannot walk into something solid', () => {
	const w = new World(20260413);
	// Find a solid cell with a standable cell to its left.
	let sx = null;
	let sy = 0;
	for (let i = 0; i < 4000 && sx === null; i++) {
		for (let j = -20; j < 20; j++) {
			if (w.solid(i, j) && !w.solid(i - 1, j)) {
				sx = i;
				sy = j;
				break;
			}
		}
	}
	assert.ok(sx !== null, 'found no obstacle to test against');

	const p = new Player(sx - 1, sy, 'test');
	for (let i = 0; i < 400; i++) p.update(1 / 60, { x: 1, y: 0 }, w); // push right, hard
	assert.ok(!w.solid(Math.round(p.x), Math.round(p.y)), 'player ended up inside an obstacle');
	assert.ok(p.x < sx, `player passed through at ${p.x} (obstacle ${sx})`);
});

check('facing follows the dominant axis and never goes blank', () => {
	const w = new World(1);
	const p = new Player(0, 0, 'test');
	const cases = [
		[{ x: 1, y: 0 }, 'right'],
		[{ x: -1, y: 0 }, 'left'],
		[{ x: 0, y: 1 }, 'down'],
		[{ x: 0, y: -1 }, 'up'],
		[{ x: 0.9, y: 0.2 }, 'right'],
		[{ x: 0.2, y: -0.9 }, 'up'],
	];
	for (const [input, want] of cases) {
		p.update(1 / 60, input, w);
		assert.equal(p.facing, want, `input ${JSON.stringify(input)}`);
	}
	// Standing still keeps the last facing rather than resetting.
	p.update(1 / 60, { x: 0, y: 0 }, w);
	assert.equal(p.facing, 'up');
	assert.equal(p.moving, false);
});

check('wading is slower than walking', () => {
	const w = new World(20260413);
	let wet = null;
	for (let i = 0; i < 6000 && !wet; i++) {
		for (let j = -20; j < 20; j++) if (w.wet(i, j) && w.wet(i + 1, j)) { wet = [i, j]; break; }
	}
	assert.ok(wet, 'found no water to wade in');

	const dry = new Player(0, 0, 't');
	// Place the dry walker somewhere definitely not water.
	let land = null;
	for (let i = 0; i < 6000 && !land; i++) {
		for (let j = -20; j < 20; j++) {
			if (!w.wet(i, j) && !w.solid(i, j) && !w.wet(i + 1, j) && !w.solid(i + 1, j)) { land = [i, j]; break; }
		}
	}
	assert.ok(land, 'found no open land');
	dry.x = land[0];
	dry.y = land[1];
	const swim = new Player(wet[0], wet[1], 't');

	dry.update(1 / 60, { x: 1, y: 0 }, w);
	swim.update(1 / 60, { x: 1, y: 0 }, w);
	assert.ok(swim.x - wet[0] < dry.x - land[0], 'wading was not slower');
	assert.equal(swim.wading, true);
	assert.equal(dry.wading, false);
});

/* ---------------------------------------------------------------- rain -- */

check('rain recycles instead of growing without bound', () => {
	const w = new World(5);
	const rain = new Rain(120);
	const view = { x0: 0, y0: 0, w: 80, h: 40 };
	let seed = 1;
	const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

	rain.intensity = 1;
	rain.target = 1;
	for (let i = 0; i < 1200; i++) {
		rain.tick = () => {}; // hold intensity steady for the test
		rain.update(1 / 60, i / 60, view, w, rnd);
		assert.ok(rain.live <= rain.max, `live ${rain.live} exceeded max`);
		assert.ok(rain.splashes.length <= 120, 'splashes grew without bound');
	}
	// Every live drop stays near the view rather than falling to infinity.
	for (let i = 0; i < rain.live; i++) {
		assert.ok(rain.y[i] < view.y0 + view.h + 3, `drop ${i} fell past the view at ${rain.y[i]}`);
	}
});

/* ---------------------------------------------------------------- peer -- */

check('a peer interpolates toward its target and settles', () => {
	const p = new Peer('x', 3);
	p.target(10, -4, 'left', 1, 'friend');
	assert.equal(p.x, 10, 'first update should snap, not glide in from 0,0');
	p.target(20, -4, 'left', 0, 'friend');
	for (let i = 0; i < 200; i++) p.update(1 / 60);
	assert.ok(Math.abs(p.x - 20) < 0.01, `peer settled at ${p.x}`);
});

/* ----------------------------------------------------- name sanitising -- */

check('display names cannot carry markup or run long', () => {
	// Stripped of every markup character, then cut to the 14-char cap.
	assert.equal(cleanDisplayName('<img src=x onerror=alert(1)>'), 'img srcx onerr');
	assert.equal(cleanDisplayName('</div>'), 'div');
	assert.equal(cleanDisplayName('a'.repeat(400)).length, 14);
	assert.equal(cleanDisplayName('  spaced  '), 'spaced');
	assert.equal(cleanDisplayName('ok_name-1'), 'ok_name-1');
	assert.equal(cleanDisplayName(' [2J'), '2J');
	assert.equal(cleanDisplayName(null), '');
	assert.equal(cleanDisplayName(undefined), '');
	assert.equal(cleanDisplayName({ toString: () => 'x' }), '');
	assert.equal(cleanDisplayName(12345), '');
	// Non-latin names survive, because dropping them would be a worse bug.
	assert.equal(cleanDisplayName('मयूर'), 'मयूर');
	assert.equal(cleanDisplayName('さくら'), 'さくら');
});

check('every label is drawable by the atlas', () => {
	const names = ['मयूर', 'さくら', 'Zoë', 'ok_name-1', '', '   ', 'ก้อง', 'Ångström999'];
	for (const name of names) {
		const label = labelFor(name);
		assert.ok(label.length > 0, `"${name}" produced an empty label`);
		assert.ok(label.length <= 14, `"${name}" produced ${label.length} chars`);
		for (const ch of label) {
			assert.ok(glyph(ch) > 0 || ch === ' ', `"${name}" -> "${label}" has undrawable "${ch}"`);
		}
	}
	// Latin with accents keeps its letters rather than falling back.
	assert.equal(labelFor('Zoë'), 'Zoe');
	// Nothing drawable left is a named person, not a blank gap.
	assert.equal(labelFor('मयूर'), 'traveller');
});

/* ---------------------------------------------------- character appearance --
 *
 * A look is never sent: every client derives it from the peer id the relay
 * hands out. That makes two failures possible which are both invisible rather
 * than loud, and both are covered here: a part with no colour (writes
 * undefined into the instance buffer, which corrupted whole frames once
 * before), and a hair glyph the atlas does not carry (draws a blank cell,
 * which reads as a bald patch rather than as a bug).
 */

check('every drawn sprite cell maps to a part the look actually has', () => {
	const look = lookFor('c1abc', 3);
	for (const facing of Object.keys(SPRITES)) {
		for (const frame of SPRITES[facing]) {
			frame.forEach((line, y) => {
				for (let x = 0; x < SPRITE_W; x++) {
					if (line[x] === ' ') continue;
					const part = partAt(y, x);
					const c = part === 'hair' ? look.hairInk : look[part];
					assert.ok(Array.isArray(c) && c.length === 3, `${facing} ${y},${x} -> ${part} has no colour`);
					for (const ch of c) assert.ok(Number.isFinite(ch), `${facing} ${y},${x} colour is not finite`);
				}
			});
		}
	}
});

check('a look is the same person every time, on any client', () => {
	for (const id of ['c1abc', 'c2zzz', 'cqq9', '']) {
		const a = lookFor(id, 2);
		const b = lookFor(id, 2);
		assert.deepEqual(a, b, `${id} came back as two different people`);
	}
});

check('a crowd is not one person repeated', () => {
	/* The failure this catches is a hash whose salts collide, which makes
	   every stranger identical and the whole feature pointless. */
	const seen = new Set();
	for (let i = 0; i < 60; i++) {
		const l = lookFor(`c${i.toString(36)}x`, i % 8);
		seen.add(l.hair.join('') + l.skin.join() + l.hairInk.join() + l.legs.join());
	}
	assert.ok(seen.size > 12, `60 ids produced only ${seen.size} distinct looks`);
});

check('every hair glyph is in the atlas', () => {
	for (let i = 0; i < 200; i++) {
		const { hair } = lookFor(`c${i.toString(36)}`, 0);
		for (const ch of hair) {
			assert.ok(ATLAS_CHARS.includes(ch), `hair glyph "${ch}" is not in the atlas`);
			assert.ok(glyph(ch) > 0, `hair glyph "${ch}" resolves to blank`);
		}
	}
});

check('every look colour is inside the renderer range', () => {
	for (let i = 0; i < 200; i++) {
		const l = lookFor(`c${i}`, i);
		for (const key of ['skin', 'hairInk', 'shirt', 'legs']) {
			for (const ch of l[key]) {
				assert.ok(ch >= 0 && ch <= 1, `${key} channel ${ch} is outside 0..1`);
			}
		}
	}
});

check('a colour slot off the wire cannot produce an undefined shirt', () => {
	/* colour arrives from the relay, so it gets the same hostile-input
	   treatment as every other field: anything that is not a usable slot
	   falls back rather than indexing past the end of the array. */
	for (const bad of [-1, -40, 999, 8, 1.5, NaN, Infinity, null, undefined, 'x', {}, []]) {
		const l = lookFor('c1abc', bad);
		assert.ok(Array.isArray(l.shirt) && l.shirt.length === 3, `colour ${String(bad)} gave no shirt`);
		for (const ch of l.shirt) assert.ok(Number.isFinite(ch), `colour ${String(bad)} gave ${ch}`);
	}
});

check('a peer carries its look from the moment it exists', () => {
	/* Built in the constructor on purpose: deriving it at draw time would let
	   a peer change hair halfway across the field. */
	const p = new Peer('c7qq', 5);
	assert.deepEqual(p.look, lookFor('c7qq', 5));
	const same = new Peer('c7qq', 5);
	assert.deepEqual(p.look, same.look);
});

/* ------------------------------------------------------- camera and grid --
 *
 * The grid is integral and the camera is not, so a cell is placed from an
 * integer origin and the whole grid is then slid by the leftover fraction.
 * Get that wrong in either direction and the ground still moves, it just
 * moves by the wrong amount: the player drifts against the grass under them,
 * which is the kind of thing that looks like bad art rather than bad maths.
 */

check('a cell lands where the camera says it should', () => {
	const cols = 80;
	const rows = 24;
	for (const cam of [0, 0.5, 1.25, -3.75, 12.1, -0.01, 1000.99]) {
		const { x0, fx } = gridOrigin(cam, cam, cols, rows);
		for (const wx of [x0, x0 + 1, x0 + 40, x0 + cols - 1]) {
			/* Where the cell truly is, in continuous screen cells. */
			const truth = wx - (cam - cols / 2);
			/* Where the renderer puts it: integer grid column, slid by fx. */
			const drawn = wx - x0 - fx;
			assert.ok(Math.abs(truth - drawn) < 1e-9, `cam ${cam} cell ${wx}: ${drawn} not ${truth}`);
		}
	}
});

check('the slide is always forward and under one cell', () => {
	/* A negative or >=1 fraction means the origin was floored wrongly, and the
	   grid would show a blank strip at an edge instead of sliding. */
	for (let i = -400; i < 400; i++) {
		const cam = i * 0.37;
		const { fx, fy, x0, y0 } = gridOrigin(cam, -cam, 81, 25);
		assert.ok(fx >= 0 && fx < 1, `fx ${fx} out of range at ${cam}`);
		assert.ok(fy >= 0 && fy < 1, `fy ${fy} out of range at ${cam}`);
		assert.ok(Number.isInteger(x0) && Number.isInteger(y0), `origin not integral at ${cam}`);
	}
});

check('walking a whole cell advances the origin exactly one cell', () => {
	/* The seam test: crossing a cell boundary must hand exactly one cell from
	   the fraction to the origin, or the world jumps at every boundary. */
	const a = gridOrigin(10.25, 0, 80, 24);
	const b = gridOrigin(11.25, 0, 80, 24);
	assert.equal(b.x0 - a.x0, 1);
	assert.ok(Math.abs(b.fx - a.fx) < 1e-9, 'the fraction changed across a whole-cell step');
});

console.log(`\n${n} checks passed.`);
