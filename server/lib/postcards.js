// Postcards from the /post desk, kept in the studio's own database and read
// in /admin. This is the delivery path: a card is "sent" once it is stored
// here, and the visitor's receipt carries the row id that proves it.
//
// Everything that arrives is untrusted. The kind must be one the desk offers,
// the message has a hard length, control characters go, and the two optional
// fields are bounded. The sender's visitor name is resolved on the server from
// their token, never taken from the form. Spam gets two cheap filters before
// it costs a row: a honeypot field people never see, and a minimum time spent
// on the page; the route adds a per-address rate limit on top.

import { kinds, MAX_CHARS } from '../../src/data/postcards.js';

const KIND_IDS = new Set(kinds.map((k) => k.id));
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,180}\.[a-z]{2,24}$/i;
export const MIN_MS_ON_PAGE = 3000;

/* keep newlines and tabs; drop the rest of the control range */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

/** { ok: true, value } or { ok: false, error, spam? } */
export function validatePostcard(body) {
	if (!body || typeof body !== 'object') return { ok: false, error: 'Bad request.' };
	if (body.website) return { ok: false, spam: true, error: 'Refused.' };
	if (!(Number(body.elapsed) >= MIN_MS_ON_PAGE)) return { ok: false, spam: true, error: 'That was quick. Take a second and send it again.' };
	if (!KIND_IDS.has(body.kind)) return { ok: false, error: 'Pick a kind of mail.' };
	if (typeof body.message !== 'string' || body.message.length > MAX_CHARS) return { ok: false, error: `Messages are ${MAX_CHARS} characters at most.` };
	const message = clean(body.message, MAX_CHARS);
	if (!message) return { ok: false, error: 'The back of the card is blank.' };
	const reply = clean(body.reply, 120);
	if (reply && !EMAIL.test(reply)) return { ok: false, error: 'That reply address does not look like an email address.' };
	return { ok: true, value: { kind: body.kind, message, signed: clean(body.signed, 60), reply } };
}

export function makePostcards(db) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS postcards (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kind TEXT NOT NULL,
			message TEXT NOT NULL,
			signed TEXT NOT NULL DEFAULT '',
			reply TEXT NOT NULL DEFAULT '',
			visitor TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
	`);
	const add = db.prepare('INSERT INTO postcards (kind, message, signed, reply, visitor) VALUES (?, ?, ?, ?, ?)');
	const all = db.prepare('SELECT * FROM postcards ORDER BY id DESC LIMIT 200');
	const del = db.prepare('DELETE FROM postcards WHERE id = ?');
	return {
		store(v, visitor = '') {
			const r = add.run(v.kind, v.message, v.signed, v.reply, visitor);
			return Number(r.lastInsertRowid);
		},
		list: () => all.all(),
		remove: (id) => del.run(id).changes > 0,
	};
}
