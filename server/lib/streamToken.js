// Short-lived signed URLs for audio streaming. The catalog endpoint embeds a
// token per track so playback works in the browser, but the URL itself is
// useless after it expires and can't be re-pointed at another file. This is
// not DRM — a determined client can still capture any stream — it just kills
// direct/downloadable file URLs and hotlinking.

import crypto from 'node:crypto';

// Long enough to cover a full listen + seeks; short enough that a leaked URL
// rots quickly.
const TTL_MS = 6 * 60 * 60 * 1000;

function secret() {
	// STREAM_SECRET overrides; otherwise the session secret (enforced ≥32
	// chars in prod) does double duty.
	return process.env.STREAM_SECRET || process.env.SESSION_SECRET || 'dev-stream-secret';
}

function hmac(payload) {
	return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Token format: `<expiryMs>-<base64url hmac of "path|expiryMs">`. */
export function streamToken(rel) {
	const expiry = Date.now() + TTL_MS;
	return `${expiry}-${hmac(`${rel}|${expiry}`)}`;
}

/** True when the token is well-formed, unexpired, and signs exactly this path. */
export function verifyStreamToken(rel, token) {
	if (typeof token !== 'string' || !token) return false;
	const dash = token.indexOf('-');
	if (dash < 1) return false;
	const expiry = Number(token.slice(0, dash));
	const sig = token.slice(dash + 1);
	if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

	const expected = hmac(`${rel}|${expiry}`);
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}

/** Remaining lifetime for a valid token, in seconds (for Cache-Control). */
export function tokenMaxAge(token) {
	const expiry = Number(String(token || '').split('-')[0]);
	return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
}
