import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { loginLimiter, issueCsrfToken } from '../lib/security.js';
import { requireUsername, requirePassword, ValidationError } from '../lib/validate.js';

const router = Router();

// A precomputed hash of a value nobody will ever type, used to keep the
// login response time constant whether or not the username exists — an
// unknown-user fast-path is a classic username enumeration side channel.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/login', loginLimiter, (req, res, next) => {
	try {
		const username = requireUsername(req.body?.username ?? '');
		const password = requirePassword(req.body?.password ?? '');

		const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
		const hash = user ? user.password_hash : DUMMY_HASH;
		const valid = bcrypt.compareSync(password, hash);

		if (!user || !valid) {
			return res.status(401).json({ error: 'Invalid username or password' });
		}

		req.session.regenerate((err) => {
			if (err) return next(err);
			req.session.userId = user.id;
			req.session.username = user.username;
			const csrfToken = issueCsrfToken(req.session);
			req.session.save((saveErr) => {
				if (saveErr) return next(saveErr);
				res.json({ ok: true, username: user.username, csrfToken });
			});
		});
	} catch (err) {
		if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
		next(err);
	}
});

router.post('/logout', (req, res, next) => {
	req.session.destroy((err) => {
		if (err) return next(err);
		res.clearCookie('futile.sid');
		res.json({ ok: true });
	});
});

router.get('/me', (req, res) => {
	if (!req.session.userId) {
		return res.status(401).json({ error: 'Not signed in' });
	}
	res.json({ username: req.session.username, csrfToken: issueCsrfToken(req.session) });
});

export default router;
