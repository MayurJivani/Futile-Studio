/* Projects and the log book, in SQLite.
 *
 * The board used to be a literal array in `src/data/projects.js`, which meant
 * every copy edit was a commit and a redeploy. The table is seeded from that
 * same file the first time it is empty, so the data has one origin and moving
 * to the database changed nothing about what the site shows on day one.
 *
 * `src/data/projects.js` is still the fallback the static build reads when the
 * database is not reachable (a CI box, a fresh clone), so a build never fails
 * for want of a database file.
 */

import { db } from '../db.js';
import { open as seedOpen, workbench as seedBench } from '../../src/data/projects.js';

db.exec(`
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		shelf TEXT NOT NULL,
		name TEXT NOT NULL,
		kind TEXT NOT NULL,
		href TEXT,
		cta TEXT NOT NULL DEFAULT 'Open',
		shipped TEXT,
		mount TEXT NOT NULL DEFAULT 'tape',
		art TEXT NOT NULL DEFAULT 'window',
		pick INTEGER NOT NULL DEFAULT 0,
		status TEXT,
		origin TEXT,
		descr TEXT NOT NULL DEFAULT '',
		stack TEXT NOT NULL DEFAULT '',
		pos INTEGER NOT NULL DEFAULT 0
	);
`);

/* `desc` is a reserved word in SQL, so the column is `descr` and the boundary
   translates. Nothing above this file should have to know that. */
const toRow = (r) => ({
	id: r.id,
	shelf: r.shelf,
	name: r.name,
	kind: r.kind,
	href: r.href || undefined,
	cta: r.cta,
	shipped: r.shipped || undefined,
	mount: r.mount,
	art: r.art,
	pick: Boolean(r.pick),
	status: r.status || undefined,
	origin: r.origin || undefined,
	desc: r.descr,
	stack: r.stack,
	pos: r.pos,
});

const insert = db.prepare(`
	INSERT INTO projects (id, shelf, name, kind, href, cta, shipped, mount, art, pick, status, origin, descr, stack, pos)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

/** First run only: copy the board in exactly as the site already shows it. */
export function seedIfEmpty() {
	const { n } = db.prepare('SELECT COUNT(*) AS n FROM projects').get();
	if (n > 0) return 0;

	let pos = 0;
	for (const [shelf, list] of [
		['open', seedOpen],
		['workbench', seedBench],
	]) {
		for (const p of list) {
			insert.run(
				p.id,
				shelf,
				p.name,
				p.kind,
				p.href ?? null,
				p.cta ?? 'Open',
				p.shipped ?? null,
				p.mount ?? 'tape',
				p.art ?? 'window',
				p.pick ? 1 : 0,
				p.status ?? null,
				p.origin ?? null,
				p.desc ?? '',
				p.stack ?? '',
				pos++,
			);
		}
	}
	return pos;
}

export function listProjects() {
	return db.prepare('SELECT * FROM projects ORDER BY pos, rowid').all().map(toRow);
}

export function getProject(id) {
	const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
	return r ? toRow(r) : null;
}

/* Only these may be written, and each is clamped at the boundary: everything
   here ends up rendered into a page, and `pick` and `shelf` decide where. */
const SHELVES = new Set(['open', 'workbench']);
const MOUNTS = new Set(['tape', 'pin', 'clip', 'corner']);
const STATUSES = new Set(['running', 'bench', 'homeless', 'monster', 'retired']);

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const orNull = (v, max) => {
	const s = str(v, max);
	return s || null;
};

/**
 * Validate an edit. Returns `{ ok: false, error }` rather than throwing so the
 * route can answer with a message a person can act on.
 */
export function validateProject(body, { requireId = false } = {}) {
	if (!body || typeof body !== 'object') return { ok: false, error: 'Expected an object' };

	const id = str(body.id, 60).toLowerCase();
	if (requireId && !/^[a-z0-9][a-z0-9-]{0,59}$/.test(id)) {
		return { ok: false, error: 'id must be lowercase letters, numbers and hyphens' };
	}

	const name = str(body.name, 80);
	if (!name) return { ok: false, error: 'name is required' };

	const shelf = str(body.shelf, 20);
	if (!SHELVES.has(shelf)) return { ok: false, error: 'shelf must be open or workbench' };

	const mount = str(body.mount, 20);
	if (mount && !MOUNTS.has(mount)) return { ok: false, error: 'unknown mount' };

	const status = str(body.status, 20);
	if (status && !STATUSES.has(status)) return { ok: false, error: 'unknown status' };

	/* Checked at full length, never truncated first: cutting '2026-04-01' to
	   seven characters turns a rejection into a silent change of meaning, and
	   the same cut on a URL would point the card somewhere else entirely. */
	const shipped = str(body.shipped, 400);
	if (shipped && !/^\d{4}(-\d{2})?$/.test(shipped)) {
		return { ok: false, error: 'shipped must be YYYY or YYYY-MM' };
	}

	const href = str(body.href, 2000);
	if (href && (!/^https?:\/\//i.test(href) || href.length > 300)) {
		return { ok: false, error: 'href must be an http or https URL, 300 characters or fewer' };
	}

	return {
		ok: true,
		value: {
			id,
			shelf,
			name,
			kind: str(body.kind, 40) || 'project',
			href: href || null,
			cta: str(body.cta, 40) || 'Open',
			shipped: shipped || null,
			mount: mount || 'tape',
			art: str(body.art, 40) || 'window',
			pick: body.pick ? 1 : 0,
			status: status || null,
			origin: orNull(body.origin, 400),
			descr: str(body.desc, 600),
			stack: str(body.stack, 200),
		},
	};
}

export function createProject(v) {
	if (getProject(v.id)) return { ok: false, error: 'a project with that id already exists' };
	const { max } = db.prepare('SELECT COALESCE(MAX(pos), -1) AS max FROM projects').get();
	insert.run(
		v.id, v.shelf, v.name, v.kind, v.href, v.cta, v.shipped,
		v.mount, v.art, v.pick, v.status, v.origin, v.descr, v.stack, max + 1,
	);
	return { ok: true, value: getProject(v.id) };
}

export function updateProject(id, v) {
	if (!getProject(id)) return { ok: false, error: 'no such project' };
	db.prepare(`
		UPDATE projects SET shelf=?, name=?, kind=?, href=?, cta=?, shipped=?,
			mount=?, art=?, pick=?, status=?, origin=?, descr=?, stack=?
		WHERE id = ?
	`).run(
		v.shelf, v.name, v.kind, v.href, v.cta, v.shipped,
		v.mount, v.art, v.pick, v.status, v.origin, v.descr, v.stack, id,
	);
	return { ok: true, value: getProject(id) };
}

export function deleteProject(id) {
	const info = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
	return info.changes > 0;
}
