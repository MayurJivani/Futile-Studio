// Tiny marks on the shared studio's board: a sticker, placed by a visitor,
// seen by everyone in the room.
//
// Deliberately small and forgetful. Marks live in memory, so a restart wipes
// the board; each visitor has at most PER_VISITOR on it (a new one replaces
// their oldest); the board holds at most MAX (the oldest goes first); and
// nothing survives TTL_MS. There is no free text: a mark is one of KINDS at a
// position, so there is nothing to moderate beyond "clear the board", which
// an admin can do. A visitor can lift only their own marks.

import { randomBytes } from 'node:crypto';

export const KINDS = ['star', 'heart', 'cat', 'spiral', 'stamp', 'flower'];
export const PER_VISITOR = 3;
export const MAX = 60;
export const TTL_MS = 24 * 60 * 60 * 1000;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function makeMarks({ now = () => Date.now() } = {}) {
	let marks = []; // oldest first
	const listeners = new Set();
	const prune = () => {
		const cutoff = now() - TTL_MS;
		marks = marks.filter((m) => m.at >= cutoff);
	};
	/* What a client may see: never the owner key, only the display name. */
	const view = (m) => ({ id: m.id, kind: m.kind, x: m.x, y: m.y, name: m.name, at: m.at });

	return {
		list() {
			prune();
			return marks.map(view);
		},

		/** Returns the placed mark (public view), or null if refused. */
		place(owner, name, raw) {
			if (!owner || !raw || typeof raw !== 'object') return null;
			if (!KINDS.includes(raw.kind)) return null;
			if (typeof raw.x !== 'number' || typeof raw.y !== 'number' || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
			prune();
			const mine = marks.filter((m) => m.owner === owner);
			if (mine.length >= PER_VISITOR) marks = marks.filter((m) => m !== mine[0]);
			if (marks.length >= MAX) marks.shift();
			const m = { id: randomBytes(6).toString('hex'), owner, name, kind: raw.kind, x: clamp01(raw.x), y: clamp01(raw.y), at: now() };
			marks.push(m);
			return view(m);
		},

		/** Only the visitor who placed a mark can lift it. */
		lift(owner, id) {
			const before = marks.length;
			marks = marks.filter((m) => !(m.id === id && m.owner === owner));
			return marks.length < before;
		},

		/** A renamed visitor's marks carry the new name. */
		rename(owner, name) {
			for (const m of marks) if (m.owner === owner) m.name = name;
		},

		/** Moderation: empty the board, and tell whoever is watching. */
		clear() {
			marks = [];
			listeners.forEach((fn) => fn());
		},
		onClear(fn) {
			listeners.add(fn);
		},
	};
}
