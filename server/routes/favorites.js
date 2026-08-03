// Authed favorites toggle. Hearts are readable by everyone (they're stamped
// on the catalog), but only a signed-in user can change them — guests get
// 401 on every mutation here.

import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { requireCsrf } from '../lib/security.js';
import { requireString, ValidationError } from '../lib/validate.js';
import { toggleAlbum, toggleTrack } from '../lib/favorites.js';

const router = Router();

router.post('/toggle', requireAuth, requireCsrf, async (req, res, next) => {
	try {
		const type = requireString(req.body?.type, 'type', { maxLen: 10 }).toLowerCase();
		const id = requireString(req.body?.id, 'id', { maxLen: 500 });

		let fav;
		if (type === 'album') {
			fav = await toggleAlbum(id);
		} else if (type === 'track') {
			fav = await toggleTrack(id);
		} else {
			return res.status(400).json({ error: 'type must be "album" or "track"' });
		}

		res.json({ ok: true, type, id, fav });
	} catch (err) {
		if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
		next(err);
	}
});

export default router;
