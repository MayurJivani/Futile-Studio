/* Postcards from /post. Sending is public and rate-limited; reading and
   deleting are for the signed-in owner only, through /admin. */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware.js';
import { requireCsrf } from '../lib/security.js';
import { validatePostcard } from '../lib/postcards.js';

const sendLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 6,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'That is a lot of post for one hour. Try again later.' },
});

export default function postcardRoutes({ postcards, visitors }) {
	const router = Router();

	router.post('/', sendLimiter, (req, res) => {
		const v = validatePostcard(req.body);
		if (!v.ok) return res.status(v.spam ? 422 : 400).json({ error: v.error });
		const id = postcards.store(v.value, visitors?.nameOf(req.body.token) || '');
		res.status(201).json({ id, receivedAt: new Date().toISOString() });
	});

	router.get('/', requireAuth, (req, res) => res.json({ postcards: postcards.list() }));

	router.delete('/:id', requireAuth, requireCsrf, (req, res) => {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Bad id.' });
		res.json({ deleted: postcards.remove(id) });
	});

	return router;
}
