/**
 * This browser's studio identity: the token the relay handed out and the name
 * that goes with it. The server is the authority; this only remembers what it
 * said, so every tab and every return asks for the same name, and so a page
 * without a live connection (the postcard desk) can still say who you are.
 *
 * localStorage only. No cookie, no fingerprint, and nothing here is secret:
 * the token decides a display name and nothing else.
 */

const KEY = 'futile-visitor';

/** @returns {{ token?: string, name?: string }} */
export function visitor() {
	try {
		const v = JSON.parse(localStorage.getItem(KEY) || '{}');
		return v && typeof v === 'object' ? v : {};
	} catch {
		return {};
	}
}

/** Store what the server said and tell the page. */
export function remember(token, name) {
	const v = { ...visitor(), ...(token ? { token } : {}), ...(name ? { name } : {}) };
	try {
		localStorage.setItem(KEY, JSON.stringify(v));
	} catch {
		/* storage blocked: the name still holds for this page */
	}
	if (name) window.dispatchEvent(new CustomEvent('futile-name', { detail: { name } }));
}

/** The relay's hello, carrying the token if this browser has one. */
export const hello = (room) => ({ t: 'hello', room, ...(visitor().token ? { token: visitor().token } : {}) });
