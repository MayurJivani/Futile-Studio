/* Self-check for the board's write boundary.
 *
 *   node server/lib/projects.selfcheck.js
 *
 * Everything here ends up rendered into a page by a static build, so the only
 * thing standing between a typo (or a stolen session) and the live site is
 * validateProject. These are the cases that would be expensive to notice late:
 * a javascript: URL on a project card, a stamp the Stamp component has no
 * shape for, a shelf that makes a project vanish from both lists.
 *
 * No framework on purpose: it runs anywhere node does.
 */

import assert from 'node:assert/strict';
import { validateProject } from './projects.js';

let n = 0;
const check = (name, fn) => {
	fn();
	n++;
	console.log('  ok  ' + name);
};

const base = { id: 'thing', name: 'Thing', shelf: 'open' };
const ok = (patch) => validateProject({ ...base, ...patch }, { requireId: true });

check('a plain project is accepted', () => {
	const r = ok({ desc: 'does a thing', stack: 'Astro' });
	assert.equal(r.ok, true, r.error);
	assert.equal(r.value.descr, 'does a thing');
});

check('a name is required', () => {
	assert.equal(ok({ name: '   ' }).ok, false);
});

check('only the two real shelves exist', () => {
	assert.equal(ok({ shelf: 'open' }).ok, true);
	assert.equal(ok({ shelf: 'workbench' }).ok, true);
	/* Anything else and the project is written but appears on neither list. */
	for (const bad of ['', 'shelf', 'OPEN', 'archive', null, 7]) {
		assert.equal(ok({ shelf: bad }).ok, false, `accepted shelf ${String(bad)}`);
	}
});

check('a link must be http or https', () => {
	assert.equal(ok({ href: 'https://a.dev' }).ok, true);
	assert.equal(ok({ href: 'http://a.dev' }).ok, true);
	assert.equal(ok({ href: '' }).ok, true, 'no link at all is fine');
	/* The card renders this straight into an href. */
	for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'vbscript:x', '//evil.dev']) {
		assert.equal(ok({ href: bad }).ok, false, `accepted href ${bad}`);
	}
});

check('a stamp must be one the component can draw', () => {
	for (const s of ['running', 'bench', 'homeless', 'monster', 'retired', '']) {
		assert.equal(ok({ status: s }).ok, true, `rejected status ${s}`);
	}
	assert.equal(ok({ status: 'exploded' }).ok, false);
});

check('a date is a year or a year and month', () => {
	for (const d of ['2026', '2026-04', '']) assert.equal(ok({ shipped: d }).ok, true, `rejected ${d}`);
	for (const d of ['soon', '26-4', '2026-4', '2026-04-01', 'YYYY']) {
		assert.equal(ok({ shipped: d }).ok, false, `accepted ${d}`);
	}
});

check('an id is a slug, and only a slug', () => {
	for (const id of ['a', 'thing', 'qno-2', 'x1']) {
		assert.equal(validateProject({ ...base, id }, { requireId: true }).ok, true, `rejected ${id}`);
	}
	/* A path separator here would address a different row through the URL. */
	for (const id of ['', '-lead', 'with space', 'a/b', '../x', 'a.b', 'a_b']) {
		assert.equal(validateProject({ ...base, id }, { requireId: true }).ok, false, `accepted ${id}`);
	}
	/* Case is normalised rather than refused: 'Caps' and 'caps' are the same
	   intent, unlike a truncated date, which is a different fact. */
	const caps = validateProject({ ...base, id: 'Caps' }, { requireId: true });
	assert.equal(caps.ok, true);
	assert.equal(caps.value.id, 'caps');
});

check('long text is cut rather than refused', () => {
	const r = ok({ desc: 'x'.repeat(5000), stack: 'y'.repeat(5000) });
	assert.equal(r.ok, true);
	assert.equal(r.value.descr.length, 600);
	assert.equal(r.value.stack.length, 200);
});

check('unknown keys cannot reach the row', () => {
	/* The update statement names its columns, but the validated object is what
	   gets spread into it, so it must not carry anything extra. */
	const r = ok({ pos: 999, rowid: 1, evil: 'x' });
	assert.equal(r.ok, true);
	for (const k of ['pos', 'rowid', 'evil']) assert.equal(k in r.value, false, `${k} survived`);
});

check('pick is a flag, whatever was sent', () => {
	assert.equal(ok({ pick: true }).value.pick, 1);
	assert.equal(ok({ pick: 'yes' }).value.pick, 1);
	assert.equal(ok({ pick: undefined }).value.pick, 0);
	assert.equal(ok({ pick: 0 }).value.pick, 0);
});

check('rubbish in place of a body is refused, not thrown on', () => {
	for (const bad of [null, undefined, 'string', 42, []]) {
		const r = validateProject(bad, { requireId: true });
		assert.equal(r.ok, false, `accepted ${String(bad)}`);
	}
});

console.log(`\n${n} checks passed.`);
