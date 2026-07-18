import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'studio.db'));

db.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS posts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		slug TEXT UNIQUE NOT NULL,
		title TEXT NOT NULL,
		excerpt TEXT,
		body TEXT NOT NULL,
		cover_url TEXT,
		published INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS media (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		filename TEXT NOT NULL,
		original_name TEXT,
		mime TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS sessions (
		sid TEXT PRIMARY KEY,
		data TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	);
`);

// Sessions past their expiry are useless but not auto-removed by SQLite; sweep
// on boot and periodically so the table doesn't grow unbounded.
function pruneExpiredSessions() {
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}
pruneExpiredSessions();
setInterval(pruneExpiredSessions, 1000 * 60 * 60).unref();
