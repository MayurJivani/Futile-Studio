/* Moderation for the shared studio: the owner can empty the marks board. */

import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { requireCsrf } from '../lib/security.js';

export default function studioRoutes({ marks }) {
	const router = Router();
	router.get('/marks', requireAuth, (req, res) => res.json({ marks: marks.list() }));
	router.post('/marks/clear', requireAuth, requireCsrf, (req, res) => {
		marks.clear();
		res.json({ cleared: true });
	});
	return router;
}
