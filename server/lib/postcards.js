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
//
// A card keeps everything the desk drew it with (design, paper, ink, postmark,
// prompt, photo), so /mailbox and /track can draw it again as it was sent, and
// the sender's country, which the postal model in src/data/postal.js turns
// into a 2 to 7 day journey. Each card gets a random tracking code: the
// receipt number is sequential and guessable, the code is what opens /track.
// Replies from the studio are cards too, direction 'out', with `parent`
// pointing at the card they answer.

import { randomBytes } from 'node:crypto';
import { kinds, designs, papers, inks, postmarks, MAX_CHARS } from '../../src/data/postcards.js';
import { countryName, route } from '../../src/data/postal.js';

const KIND_IDS = new Set(kinds.map((k) => k.id));
const ids = (xs) => new Set(xs.map((x) => x.id));
const DESIGNS = ids(designs);
const PAPERS = ids(papers);
const INKS = ids(inks);
export const TRACK = /^[a-f0-9]{24}$/;
const index = (v, n) => (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < n ? Number(v) : 0);
const one = (v, allowed, fallback) => (allowed.has(v) ? v : fallback);
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,180}\.[a-z]{2,24}$/i;
export const MIN_MS_ON_PAGE = 3000;

/* keep newlines and tabs; drop the rest of the control range */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

/** { ok: true, value } or { ok: false, error, spam? }. The owner's replies skip the spam checks. */
export function validatePostcard(body, { owner = false } = {}) {
	if (!body || typeof body !== 'object') return { ok: false, error: 'Bad request.' };
	if (!owner && body.website) return { ok: false, spam: true, error: 'Refused.' };
	if (!owner && !(Number(body.elapsed) >= MIN_MS_ON_PAGE)) return { ok: false, spam: true, error: 'That was quick. Take a second and send it again.' };
	if (!KIND_IDS.has(body.kind)) return { ok: false, error: 'Pick a kind of mail.' };
	/* form posts send line breaks as CRLF; the textarea counted them as one character */
	const raw = typeof body.message === 'string' ? body.message.replace(/\r\n?/g, '\n') : null;
	if (raw === null || raw.length > MAX_CHARS) return { ok: false, error: `Messages are ${MAX_CHARS} characters at most.` };
	const message = clean(raw, MAX_CHARS);
	if (!message) return { ok: false, error: 'The back of the card is blank.' };
	const reply = clean(body.reply, 120);
	if (reply && !EMAIL.test(reply)) return { ok: false, error: 'That reply address does not look like an email address.' };
	const kind = kinds.find((k) => k.id === body.kind);
	/* the look is cosmetic: an unknown value falls back to the default instead of refusing the card */
	return {
		ok: true,
		value: {
			kind: kind.id,
			message,
			signed: clean(body.signed, 60),
			reply: owner ? '' : reply,
			design: one(body.design, DESIGNS, 'classic'),
			paper: one(body.paper, PAPERS, 'cream'),
			ink: one(body.ink, INKS, 'navy'),
			postmark: index(body.postmark, postmarks.length),
			prompt: index(body.prompt, kind.prompts.length),
		},
	};
}

/** Cloudflare's CF-IPCountry, if it names a country the postal model knows. XX and T1 (Tor) do not. */
export const countryOf = (header) => (countryName(String(header ?? '').toUpperCase()) ? String(header).toUpperCase() : '');

/** A card's journey as of now, for the API: no coordinates the page cannot draw from the route itself. */
export function journey(card, now = Date.now()) {
	const r = route({ id: card.id, created_at: card.created_at, country: card.country, direction: card.direction });
	return { deliveredAt: new Date(r.deliveredAt).toISOString(), delivered: now >= r.deliveredAt };
}

const COLUMNS = {
	design: "TEXT NOT NULL DEFAULT 'classic'",
	paper: "TEXT NOT NULL DEFAULT 'cream'",
	ink: "TEXT NOT NULL DEFAULT 'navy'",
	postmark: 'INTEGER NOT NULL DEFAULT 0',
	prompt: 'INTEGER NOT NULL DEFAULT 0',
	image: "TEXT NOT NULL DEFAULT ''",
	country: "TEXT NOT NULL DEFAULT ''",
	direction: "TEXT NOT NULL DEFAULT 'in'",
	parent: 'INTEGER REFERENCES postcards(id) ON DELETE CASCADE',
	track: "TEXT NOT NULL DEFAULT ''",
};

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
	/* migration: tables from before cards remembered their look get the new columns with defaults,
	   and every old card gets a tracking code */
	const have = new Set(db.prepare('PRAGMA table_info(postcards)').all().map((c) => c.name));
	for (const [name, type] of Object.entries(COLUMNS)) if (!have.has(name)) db.exec(`ALTER TABLE postcards ADD COLUMN ${name} ${type}`);
	db.exec(`
		UPDATE postcards SET track = lower(hex(randomblob(12))) WHERE track = '';
		CREATE UNIQUE INDEX IF NOT EXISTS postcards_track ON postcards (track);
		CREATE INDEX IF NOT EXISTS postcards_parent ON postcards (parent);
	`);
	const add = db.prepare(`INSERT INTO postcards (kind, message, signed, reply, visitor, design, paper, ink, postmark, prompt, image, country, direction, parent, track)
		VALUES (:kind, :message, :signed, :reply, :visitor, :design, :paper, :ink, :postmark, :prompt, :image, :country, :direction, :parent, :track)`);
	const all = db.prepare('SELECT * FROM postcards ORDER BY id DESC LIMIT 200');
	const get = db.prepare('SELECT * FROM postcards WHERE id = ?');
	const byTrack = db.prepare('SELECT * FROM postcards WHERE track = ?');
	const children = db.prepare('SELECT * FROM postcards WHERE parent = ? ORDER BY id');
	const del = db.prepare('DELETE FROM postcards WHERE id = ? RETURNING image');
	const delChildren = db.prepare('DELETE FROM postcards WHERE parent = ? RETURNING image');
	return {
		/** { id, track } */
		store(v, { visitor = '', country = '', image = '', direction = 'in', parent = null } = {}) {
			const track = randomBytes(12).toString('hex');
			const r = add.run({ ...v, visitor, country, image, direction, parent, track });
			return { id: Number(r.lastInsertRowid), track };
		},
		list: () => all.all(),
		get: (id) => get.get(id),
		byTrack: (code) => (TRACK.test(code) ? byTrack.get(code) : undefined),
		replies: (id) => children.all(id),
		/** the photo filenames that go with the card and its replies, for the caller to unlink; null if nothing was there */
		remove(id) {
			const gone = [...delChildren.all(id), ...del.all(id)];
			return gone.length ? gone.map((r) => r.image).filter(Boolean) : null;
		},
	};
}
