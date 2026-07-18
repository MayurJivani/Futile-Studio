import { Store } from 'express-session';
import { db } from '../db.js';

const getStmt = db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?');
const upsertStmt = db.prepare(
	'INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?) ' +
		'ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at',
);
const destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
const touchStmt = db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Minimal express-session Store backed by node:sqlite. Avoids the default
 * MemoryStore, which leaks memory and doesn't survive a restart or scale
 * past a single process — not viable in production.
 */
export class SqliteSessionStore extends Store {
	get(sid, callback) {
		try {
			const row = getStmt.get(sid);
			if (!row || row.expires_at < Date.now()) return callback(null, null);
			callback(null, JSON.parse(row.data));
		} catch (err) {
			callback(err);
		}
	}

	set(sid, session, callback) {
		try {
			const maxAge = session.cookie?.maxAge ?? DAY_MS;
			const expiresAt = Date.now() + maxAge;
			upsertStmt.run(sid, JSON.stringify(session), expiresAt);
			callback?.(null);
		} catch (err) {
			callback?.(err);
		}
	}

	destroy(sid, callback) {
		try {
			destroyStmt.run(sid);
			callback?.(null);
		} catch (err) {
			callback?.(err);
		}
	}

	touch(sid, session, callback) {
		try {
			const maxAge = session.cookie?.maxAge ?? DAY_MS;
			touchStmt.run(Date.now() + maxAge, sid);
			callback?.(null);
		} catch (err) {
			callback?.(err);
		}
	}
}
