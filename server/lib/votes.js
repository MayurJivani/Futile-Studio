// Tally votes for what the studio builds next.
//
// A vote is a (idea, voter) pair and voting again takes it back, so the only
// thing a visitor can do is toggle their own mark on a fixed list. The list is
// `ideas` from the site's own data: anything else is refused, so nothing a
// stranger sends is ever stored as text.
//
// The voter is an HMAC of the client address under the server secret, cut to
// 16 hex characters. Enough to stop one person ticking the same box from six
// tabs, not an address anyone can read back without the secret.
// shortcut: a household behind one address shares one vote per idea, and a
// determined person with several addresses gets several. Fine for a tally on a
// personal site; accounts would be the upgrade, and the brief rules them out.

import { createHmac } from 'node:crypto';
import { ideas } from '../../src/data/studio.js';

const IDEA_IDS = new Set(ideas.map((i) => i.id));

export function makeVotes(db, secret) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS votes (
			idea TEXT NOT NULL,
			voter TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (idea, voter)
		);
	`);

	const has = db.prepare('SELECT 1 FROM votes WHERE idea = ? AND voter = ?');
	const add = db.prepare('INSERT INTO votes (idea, voter) VALUES (?, ?)');
	const del = db.prepare('DELETE FROM votes WHERE idea = ? AND voter = ?');
	const counts = db.prepare('SELECT idea, COUNT(*) AS n FROM votes GROUP BY idea');
	const mineQ = db.prepare('SELECT idea FROM votes WHERE voter = ?');

	return {
		voterFor(ip) {
			return createHmac('sha256', secret).update(String(ip)).digest('hex').slice(0, 16);
		},

		/** Every idea, zero included, so the client never has to guess a missing key. */
		tally() {
			const out = Object.fromEntries([...IDEA_IDS].map((id) => [id, 0]));
			for (const { idea, n } of counts.all()) if (IDEA_IDS.has(idea)) out[idea] = n;
			return out;
		},

		mine(voter) {
			return mineQ.all(voter).map((r) => r.idea);
		},

		/** Returns true if the vote now stands, false if it was taken back, null if refused. */
		toggle(voter, idea) {
			if (typeof idea !== 'string' || !IDEA_IDS.has(idea)) return null;
			if (has.get(idea, voter)) {
				del.run(idea, voter);
				return false;
			}
			add.run(idea, voter);
			return true;
		},
	};
}
