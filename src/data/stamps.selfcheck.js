// node src/data/stamps.selfcheck.js
// The registry is the one place stamps are defined; this keeps it honest.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { stamps, places } from './stamps.js';
import { open } from './projects.js';

const ids = stamps.map((s) => s.id);
assert.equal(new Set(ids).size, ids.length, 'stamp ids are unique');

// Progress was stored under these ids before the redesign; renaming one would
// silently empty somebody's album.
for (const legacy of ['explorer', 'lamp', 'log', 'jinx', 'vote', 'toys', 'wink', ...open.map((p) => `p-${p.id}`)]) {
	assert.ok(ids.includes(legacy), `legacy stamp id still exists: ${legacy}`);
}

const art = readFileSync(new URL('../components/StampArt.astro', import.meta.url), 'utf8');
const placeIds = new Set(places.map((p) => p.id));
for (const s of stamps) {
	for (const f of ['title', 'motif', 'format', 'denom', 'serial', 'note', 'hint', 'unlock', 'where']) {
		assert.ok(s[f], `${s.id} has ${f}`);
	}
	assert.equal(s.palette.length, 3, `${s.id} has a three-ink palette`);
	assert.ok(['portrait', 'landscape', 'square', 'tall'].includes(s.format), `${s.id} format`);
	assert.ok(placeIds.has(s.where), `${s.id} sits somewhere on the map`);
	assert.ok(art.includes(`s.motif === '${s.motif}'`), `${s.id} has artwork for motif ${s.motif}`);
	assert.ok(!/[—–]/.test(s.note + s.hint + s.unlock + s.title), `${s.id} copy has no dashes`);
	if (s.project) assert.ok(open.some((p) => p.id === s.project), `${s.id} points at a real project`);
}

// Every stamp must still be findable. A clue is a `data-clue` somewhere in the
// components or pages (project stamps use a template, so `p-${p.id}` counts for
// all of them). lamp, jinx and desk are earned by state, a visit and a drag, so
// for those the code that collects them must exist instead.
const src = ['../components', '../pages']
	.flatMap((d) => readdirSync(new URL(d, import.meta.url)).map((f) => new URL(`${d}/${f}`, import.meta.url)))
	.filter((u) => u.pathname.endsWith('.astro'))
	.map((u) => readFileSync(u, 'utf8'))
	.join('\n');
for (const s of stamps) {
	if (['lamp', 'jinx', 'desk'].includes(s.id)) continue;
	const found = s.project ? src.includes('data-clue={`p-${p.id}`}') : src.includes(`data-clue="${s.id}"`);
	assert.ok(found, `${s.id} has a data-clue somewhere on the site`);
}
for (const id of ['jinx', 'lamp', 'desk']) assert.ok(src.includes(`collect('${id}')`), `${id} is still collected somewhere`);

console.log(`stamps: ${stamps.length} stamps checked`);
