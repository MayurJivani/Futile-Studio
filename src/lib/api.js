const isLocal =
	typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

// In prod this assumes /api and /media are reverse-proxied to the Node backend
// on the same origin. See the README's deploy note.
export const API_BASE = isLocal ? 'http://localhost:4000' : '';

// CSRF token for state-changing requests. The backend issues it on login and
// echoes it from /api/auth/me; apiFetch attaches it to every non-GET call.
let csrfToken = null;

export function setCsrfToken(token) {
	csrfToken = token || null;
}

export async function apiFetch(path, options = {}) {
	const isForm = options.body instanceof FormData;
	const method = (options.method || 'GET').toUpperCase();
	const res = await fetch(`${API_BASE}${path}`, {
		credentials: 'include',
		...options,
		headers: {
			...(isForm ? {} : { 'Content-Type': 'application/json' }),
			...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
			...(options.headers || {}),
		},
	});
	return res;
}

/**
 * Escape a string for interpolation into an HTML template literal. The
 * backend strips tags at write time, but rendering untrusted text with
 * innerHTML without escaping would still be an XSS foothold if that ever
 * regressed — cheap defense in depth.
 */
export function esc(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
