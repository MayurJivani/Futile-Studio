import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';

// Brute-force protection on the login endpoint specifically — far stricter
// than the general API limit, and keyed so it can't be used to lock out an
// unrelated user (rate limited per-IP, not per-account).
export const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many login attempts. Try again later.' },
});

// General ceiling on the rest of the API so no single client can hammer it.
export const apiLimiter = rateLimit({
	windowMs: 60 * 1000,
	limit: 120,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests. Slow down.' },
});

// Uploads are heavier (disk I/O, up to 200MB) — keep this tighter than the
// general API limit.
export const uploadLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many uploads. Try again later.' },
});

/**
 * Synchronizer-token CSRF protection. A token is minted into the session on
 * login and must be echoed back in the X-CSRF-Token header on every
 * state-changing request. SameSite=Lax + locked-down CORS already block the
 * common CSRF vectors here, but this is cheap defense in depth against the
 * remaining ones (e.g. a bare HTML form POST, which respects neither).
 */
export function issueCsrfToken(session) {
	if (!session.csrfToken) {
		session.csrfToken = crypto.randomBytes(32).toString('hex');
	}
	return session.csrfToken;
}

export function requireCsrf(req, res, next) {
	const provided = req.get('x-csrf-token');
	if (!provided || !req.session.csrfToken || provided !== req.session.csrfToken) {
		return res.status(403).json({ error: 'Invalid or missing CSRF token' });
	}
	next();
}
