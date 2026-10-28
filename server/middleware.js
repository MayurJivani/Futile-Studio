export function requireAuth(req, res, next) {
	if (!req.session.userId) {
		return res.status(401).json({ error: 'Not signed in' });
	}
	next();
}

/* Cloudflare Access is the owner's login for /mailbox: the "App admin" Access
   app covers futile.studio/mailbox and /api/mailbox, and forwards a signed JWT.
   The origin does not take the edge's word for it: Lab verifies the token (the
   same check every app's /admin gets through Caddy). Fails closed. */
const ACCESS_VERIFY_URL = process.env.ACCESS_VERIFY_URL || 'http://127.0.0.1:4018/api/jinx/verify';

export async function requireAccess(req, res, next, verify = fetch) {
	const token = req.get('cf-access-jwt-assertion');
	if (token) {
		try {
			const r = await verify(ACCESS_VERIFY_URL, {
				headers: { 'Cf-Access-Jwt-Assertion': token },
				signal: AbortSignal.timeout(5000),
			});
			if (r.status === 204) return next();
		} catch {
			/* Lab down or slow: refuse, below */
		}
	}
	res.status(401).json({ error: 'Sign in through Cloudflare Access.' });
}
