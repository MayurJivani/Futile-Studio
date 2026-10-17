// Playful visitor names: SentientCat, SillyCucumber, SleepyMoth.
//
// A name is a display identity, not a credential. The browser keeps a random
// token it was handed (localStorage, never a cookie, never a fingerprint); the
// server keeps only a hash of that token, the name, and when it was last seen.
// Hand the token back and you get the same name in every tab and on every
// return; lose it and you are someone new. Nothing else about a visitor is
// stored.
//
// Uniqueness is the database's job, not the client's: `name` is UNIQUE
// (case-insensitive) and every assignment is an INSERT or UPDATE that either
// succeeds or hits the constraint, so two visitors asking at the same moment
// cannot both get one name. node:sqlite is synchronous, so each attempt is
// atomic within the process as well.
//
// Names come back into the pool once their visitor has been away for
// RELEASE_DAYS; the sweep runs on assignment, so there is no timer to forget.

import { createHash, randomBytes } from 'node:crypto';

export const ADJECTIVES = [
	'Sentient', 'Silly', 'Sleepy', 'Chaotic', 'Curious', 'Grumpy', 'Polite', 'Wobbly', 'Sneaky', 'Cosmic',
	'Fuzzy', 'Brave', 'Dramatic', 'Tiny', 'Quiet', 'Restless', 'Lucky', 'Feral', 'Gentle', 'Dizzy',
	'Hungry', 'Nervous', 'Sparkly', 'Soggy', 'Rusty', 'Velvet', 'Stubborn', 'Jolly', 'Moody', 'Spicy',
];
export const NOUNS = [
	'Cat', 'Cucumber', 'Moth', 'Pigeon', 'Toaster', 'Walrus', 'Pickle', 'Otter', 'Teapot', 'Badger',
	'Comet', 'Noodle', 'Raccoon', 'Kettle', 'Penguin', 'Cactus', 'Goose', 'Turnip', 'Lobster', 'Owl',
	'Sock', 'Pebble', 'Ferret', 'Muffin', 'Hedgehog', 'Snail', 'Radish', 'Yeti', 'Crumpet', 'Gecko',
];

const RELEASE_DAYS = 30;
const NAME = /^[A-Za-z][A-Za-z0-9]{2,19}$/;
/* Names nobody may take: they would read as the site, its owner or its staff. */
const RESERVED = ['admin', 'administrator', 'mod', 'moderator', 'system', 'staff', 'futile', 'futilestudio', 'studio', 'mayur', 'jinx', 'owner', 'root', 'support', 'official', 'anonymous', 'nobody'];

const hash = (token) => createHash('sha256').update(token).digest('hex');
const pick = (xs, rnd) => xs[Math.floor(rnd() * xs.length)];

/** Why a wanted name is refused, or null when it may be used. */
export function nameProblem(raw) {
	if (typeof raw !== 'string' || !NAME.test(raw)) return 'Letters and digits only, 3 to 20, starting with a letter.';
	const low = raw.toLowerCase();
	if (RESERVED.some((r) => low === r || low.startsWith(r))) return 'That name belongs to the studio.';
	return null;
}

export function makeVisitors(db, { rnd = Math.random } = {}) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS visitors (
			token_hash TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE COLLATE NOCASE,
			last_seen INTEGER NOT NULL
		);
	`);
	const byToken = db.prepare('SELECT name FROM visitors WHERE token_hash = ?');
	const insert = db.prepare('INSERT INTO visitors (token_hash, name, last_seen) VALUES (?, ?, ?)');
	const rename = db.prepare('UPDATE visitors SET name = ?, last_seen = ? WHERE token_hash = ?');
	const touch = db.prepare('UPDATE visitors SET last_seen = ? WHERE token_hash = ?');
	const sweep = db.prepare('DELETE FROM visitors WHERE last_seen < ?');

	const generated = () => `${pick(ADJECTIVES, rnd)}${pick(NOUNS, rnd)}`;
	const isTaken = (err) => /UNIQUE constraint failed: visitors\.name/.test(String(err?.message));

	/* Try fresh pairs first; once the pool is crowded, a numbered suffix keeps
	   the playful part and still lands on something free. */
	function withFreshName(write) {
		for (let i = 0; i < 40; i++) {
			const name = i < 20 ? generated() : `${generated()}${Math.floor(rnd() * 900) + 100}`;
			try {
				write(name);
				return name;
			} catch (err) {
				if (!isTaken(err)) throw err;
			}
		}
		throw new Error('no free name after 40 tries');
	}

	return {
		/** Returns { token, name }: the visitor's own, or a new one if the token is unknown. */
		claim(token) {
			const now = Date.now();
			sweep.run(now - RELEASE_DAYS * 864e5);
			if (typeof token === 'string' && /^[A-Za-z0-9_-]{32,64}$/.test(token)) {
				const row = byToken.get(hash(token));
				if (row) {
					touch.run(now, hash(token));
					return { token, name: row.name };
				}
			}
			const fresh = randomBytes(24).toString('base64url');
			const name = withFreshName((n) => insert.run(hash(fresh), n, now));
			return { token: fresh, name };
		},

		/** The name behind a token, without creating one. */
		nameOf(token) {
			if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return '';
			return byToken.get(hash(token))?.name ?? '';
		},

		/** A new random name for an existing visitor. */
		reroll(token) {
			if (typeof token !== 'string' || !byToken.get(hash(token))) return null;
			return withFreshName((n) => rename.run(n, Date.now(), hash(token)));
		},

		/** { name } on success, { error } when the name is invalid, reserved or taken. */
		choose(token, wanted) {
			if (typeof token !== 'string' || !byToken.get(hash(token))) return { error: 'Unknown visitor.' };
			const problem = nameProblem(wanted);
			if (problem) return { error: problem };
			try {
				rename.run(wanted, Date.now(), hash(token));
				return { name: wanted };
			} catch (err) {
				if (isTaken(err)) return { error: 'Somebody already goes by that.' };
				throw err;
			}
		},
	};
}
