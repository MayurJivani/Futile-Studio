/**
 * Field Guide progress: which stamps this browser has earned.
 *
 * Kept in localStorage under one key and nowhere else. Nothing about it goes
 * to the server, so the shared studio never learns who has collected what.
 * Storage can be blocked (private windows, strict settings); then a stamp still
 * lands for the visit and is simply forgotten afterwards.
 */

const KEY = 'futile-guide';
const ID = /^[a-z0-9-]{1,40}$/;

/** @returns {Set<string>} */
export function collected() {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
		return new Set(Array.isArray(raw) ? raw.filter((id) => typeof id === 'string' && ID.test(id)) : []);
	} catch {
		return memory;
	}
}

/* Fallback for a browser that refuses storage, so a stamp still holds for the visit. */
const memory = new Set();

function save(set) {
	try {
		localStorage.setItem(KEY, JSON.stringify([...set]));
	} catch {
		for (const id of set) memory.add(id);
	}
}

/** Earn a stamp. Returns true only the first time, so callers can celebrate once. */
export function collect(id) {
	if (!ID.test(id)) return false;
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
