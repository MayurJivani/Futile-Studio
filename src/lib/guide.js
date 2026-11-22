/**
 * Field Guide progress: which stamps this browser has earned.
 *
 * Kept in localStorage under one key and nowhere else. Nothing about it goes
 * to the server, so the shared studio never learns who has collected what.
 * Storage can be blocked (private windows, strict settings); then a stamp still
 * lands for the visit and is simply forgotten afterwards.
 */

import { stamps } from '../data/stamps.js';

const KEY = 'futile-guide';
/* Only stamps that exist count: a retired project's stamp stays in storage
   (it comes back if the project does) but never inflates the tally, and a
   project with no stamp of its own earns nothing. */
const KNOWN = new Set(stamps.map((s) => s.id));

/** @returns {Set<string>} */
export function collected() {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
		return new Set(Array.isArray(raw) ? raw.filter((id) => KNOWN.has(id)) : []);
	} catch {
		return memory;
	}
}

/* Fallback for a browser that refuses storage, so a stamp still holds for the visit. */
const memory = new Set();

function save(set) {
	try {
		const kept = JSON.parse(localStorage.getItem(KEY) || '[]');
		const old = Array.isArray(kept) ? kept.filter((id) => typeof id === 'string' && !KNOWN.has(id)) : [];
		localStorage.setItem(KEY, JSON.stringify([...old, ...set]));
	} catch {
		for (const id of set) memory.add(id);
	}
}

/** Earn a stamp. Returns true only the first time, so callers can celebrate once. */
export function collect(id) {
	if (!KNOWN.has(id)) return false;
	const set = collected();
	if (set.has(id)) return false;
	set.add(id);
	save(set);
	window.dispatchEvent(new CustomEvent('futile-stamp', { detail: { id } }));
	return true;
}

export function resetGuide() {
	memory.clear();
	try {
		localStorage.removeItem(KEY);
	} catch {
		/* nothing stored to clear */
	}
	window.dispatchEvent(new CustomEvent('futile-stamp', { detail: { id: null } }));
}
