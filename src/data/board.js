/**
 * What the board actually shows, at build time.
 *
 * The admin page writes projects into SQLite; this reads them back so the
 * pages stay server rendered with no client fetch and no flash of empty board.
 * The literals in `projects.js` remain the seed and the fallback: a clone with
 * no database (CI, a fresh checkout, a machine that has never run the server)
 * builds the site exactly as it was before any of this existed, rather than
 * failing or rendering an empty shelf.
 *
 * shortcut: read once at build, so an edit in the admin page appears on the
 * next build rather than immediately. The site is a static bundle; making it
 * live means rendering these two pages on the server instead.
 */

import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { open as seedOpen, workbench as seedBench } from './projects.js';

/* Resolved from the working directory, not from this module's own URL: the
   build runs this through Vite, where `import.meta.url` is a virtual path and
   walking up from it lands nowhere near the repository. */
const DB_PATH = path.join(process.cwd(), 'server', 'data', 'studio.db');

function fromDatabase() {
	if (!fs.existsSync(DB_PATH)) return null;
	try {
		const db = new DatabaseSync(DB_PATH, { readOnly: true });
		try {
			const rows = db
				.prepare('SELECT * FROM projects ORDER BY pos, rowid')
				.all()
				.map((r) => ({
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
				}));
			if (!rows.length) return null;
			return {
				open: rows.filter((p) => p.shelf === 'open'),
				workbench: rows.filter((p) => p.shelf === 'workbench'),
			};
		} finally {
			db.close();
		}
	} catch (err) {
		/* No table yet, a locked file, an older node: the seed is still true.
		   Said out loud, because a silent fall back to the seed looks exactly
		   like an admin edit that saved and then did not appear. */
		console.warn(`[board] could not read ${DB_PATH}, using the seed instead:`, err.message);
		return null;
	}
}

/**
 * @typedef {{ id: string, shelf?: string, name: string, kind: string, href?: string, cta: string,
 *   shipped?: string, mount: string, art: string, pick?: boolean, status?: string, origin?: string,
 *   desc: string, stack: string }} Project
 */

const live = fromDatabase();

/** @type {Project[]} */
export const open = live ? live.open : seedOpen;
/** @type {Project[]} */
export const workbench = live ? live.workbench : seedBench;
export const projects = open;
