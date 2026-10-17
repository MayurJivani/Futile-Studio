/* Mixtapes for the Lab's tape deck.
 *
 * GET / is public and read-only: published tapes, enabled tracks. It is read
 * cross-origin by lab.futile.studio without credentials, so it answers any
 * origin and never with credentials. Everything else is the admin's, behind
 * the session and the CSRF token the login already issues.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import { requireCsrf } from '../lib/security.js';
import {
	adminView,
	publicView,
	validateTrack,
	inCollection,
	validatePlaylist,
	createTrack,
	updateTrack,
	deleteTrack,
	savePlaylist,
	deletePlaylist,
	orderPlaylists,
} from '../lib/mixtapes.js';

const router = Router();
const idOf = (req) => (/^[1-9]\d{0,9}$/.test(req.params.id) ? Number(req.params.id) : null);

router.get('/', (req, res) => {
	// The global cors() pins one credentialed origin; this one route is public data for any page.
	res.set('Access-Control-Allow-Origin', '*');
	res.removeHeader('Access-Control-Allow-Credentials');
	res.set('Cache-Control', 'no-cache');
	res.json(publicView());
});

const admin = Router();
admin.use(requireAuth);
admin.use((req, res, next) => (req.method === 'GET' ? next() : requireCsrf(req, res, next)));

admin.get('/', (req, res) => res.json(adminView()));

const NOT_ON_SHELF = { error: 'that track is not in the /collection library' };

admin.post('/tracks', async (req, res, next) => {
	try {
		const v = validateTrack(req.body);
		if (!v.ok) return res.status(400).json({ error: v.error });
		if (!(await inCollection(v.value.src))) return res.status(400).json(NOT_ON_SHELF);
		res.status(201).json({ id: createTrack(v.value) });
	} catch (err) {
		next(err);
	}
});

admin.put('/tracks/:id', async (req, res, next) => {
	try {
		await putTrack(req, res);
	} catch (err) {
		next(err);
	}
});

async function putTrack(req, res) {
	const id = idOf(req);
	const v = validateTrack(req.body);
	if (!v.ok) return res.status(400).json({ error: v.error });
	if (!(await inCollection(v.value.src))) return res.status(400).json(NOT_ON_SHELF);
	if (!id || !updateTrack(id, v.value)) return res.status(404).json({ error: 'no such track' });
	res.json({ id });
}

admin.delete('/tracks/:id', (req, res) => {
	const id = idOf(req);
	if (!id || !deleteTrack(id)) return res.status(404).json({ error: 'no such track' });
	res.json({ ok: true });
});

admin.post('/playlists', (req, res) => {
	const v = validatePlaylist(req.body);
	if (!v.ok) return res.status(400).json({ error: v.error });
	const r = savePlaylist(null, v.value);
	if (!r.ok) return res.status(r.status).json({ error: r.error });
	res.status(201).json({ id: r.id });
});

admin.put('/playlists/:id', (req, res) => {
	const id = idOf(req);
	if (!id) return res.status(404).json({ error: 'no such playlist' });
	const v = validatePlaylist(req.body);
	if (!v.ok) return res.status(400).json({ error: v.error });
	const r = savePlaylist(id, v.value);
	if (!r.ok) return res.status(r.status).json({ error: r.error });
	res.json({ id });
});

admin.delete('/playlists/:id', (req, res) => {
	const id = idOf(req);
	if (!id || !deletePlaylist(id)) return res.status(404).json({ error: 'no such playlist' });
	res.json({ ok: true });
});

admin.put('/order', (req, res) => {
	if (!orderPlaylists(req.body?.ids)) return res.status(400).json({ error: 'ids must list every playlist once' });
	res.json({ ok: true });
});

router.use('/admin', admin);

export default router;
