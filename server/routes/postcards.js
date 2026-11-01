/* Postcards from /post. Sending is public and rate-limited; reading and
   deleting are for the owner only: through /admin's session, or through
   /mailbox behind Cloudflare Access. Tracking is public to whoever holds a
   card's random tracking code, which only its sender's receipt shows. */

import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requireAuth, requireAccess } from '../middleware.js';
import { requireCsrf, keyGenerator } from '../lib/security.js';
import { validatePostcard, countryOf, journey } from '../lib/postcards.js';
import { cleanImage } from '../lib/images.js';
import { MAX_IMAGE_BYTES } from '../../src/data/postcards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/* the names are random, never the sender's */
const photoDir = path.join(process.env.STUDIO_UPLOAD_DIR || path.join(__dirname, '..', 'uploads'), 'postcards');

const sendLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 6,
	standardHeaders: true,
	keyGenerator,
	legacyHeaders: false,
	message: { error: 'That is a lot of post for one hour. Try again later.' },
});

/* the photo stays in memory until the card has passed every check, so refused cards never touch the disk */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 20, fieldSize: 4096 } }).single('image');
function photo(req, res, next) {
	upload(req, res, (err) => {
		if (!err) return next();
		const big = err.code === 'LIMIT_FILE_SIZE';
		res.status(big ? 413 : 400).json({ error: big ? 'That photo is over 4 MB. Try a smaller one.' : 'That upload did not look right.' });
	});
}

/** Checks the photo and writes it; '' when there is none, null when it was refused. */
async function savePhoto(file) {
	if (!file) return '';
	const img = await cleanImage(file.buffer);
	if (!img) return null;
	await fs.mkdir(photoDir, { recursive: true });
	const name = `${crypto.randomBytes(16).toString('hex')}${img.ext}`;
	await fs.writeFile(path.join(photoDir, name), img.data, { flag: 'wx' });
	return name;
}
const unlinkPhotos = (names) => Promise.all((names ?? []).map((n) => fs.unlink(path.join(photoDir, n)).catch(() => {})));

async function storeCard(postcards, req, res, value, meta) {
	const image = await savePhoto(req.file);
	if (image === null) return res.status(400).json({ error: 'Photos can be JPEG, PNG or WebP.' });
	try {
		const card = postcards.store(value, { ...meta, image });
		res.status(201).json({ ...card, receivedAt: new Date().toISOString(), deliveredAt: journey(postcards.get(card.id)).deliveredAt });
	} catch (err) {
		await unlinkPhotos([image].filter(Boolean));
		throw err;
	}
}

const del = (postcards) => async (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Bad id.' });
	const photos = postcards.remove(id);
	await unlinkPhotos(photos);
	res.json({ deleted: photos !== null });
};

/* What a tracking page may see. The studio's reply stays sealed until it is delivered. */
function tracked(card, postcards) {
	const j = journey(card);
	const sealed = card.direction === 'out' && !j.delivered;
	const rest = { ...card };
	delete rest.reply;
	delete rest.visitor;
	const parent = card.direction === 'out' ? postcards.get(card.parent) : null;
	return {
		...rest,
		addressee: parent ? parent.signed || parent.visitor : '',
		...j,
		...(sealed ? { message: '', signed: '', image: '', sealed: true } : {}),
		replies: card.direction === 'in' ? postcards.replies(card.id).map((r) => ({ id: r.id, track: r.track, ...journey(r) })) : [],
	};
}

export default function postcardRoutes({ postcards, visitors }) {
	const router = Router();

	router.post('/', sendLimiter, photo, async (req, res) => {
		const v = validatePostcard(req.body);
		if (!v.ok) return res.status(v.spam ? 422 : 400).json({ error: v.error });
		await storeCard(postcards, req, res, v.value, { visitor: visitors?.nameOf(req.body.token) || '', country: countryOf(req.get('cf-ipcountry')) });
	});

	/* under /api because the production proxy sends only /api and /ws to this server */
	router.use('/photos', express.static(photoDir, { dotfiles: 'deny', index: false }));

	router.get('/track/:code', (req, res) => {
		const card = postcards.byTrack(req.params.code);
		if (!card) return res.status(404).json({ error: 'No card with that tracking code.' });
		res.json({ card: tracked(card, postcards) });
	});

	router.get('/', requireAuth, (req, res) => res.json({ postcards: postcards.list() }));
	router.delete('/:id', requireAuth, requireCsrf, del(postcards));

	return router;
}

/** /api/mailbox: the same box, for /mailbox, behind Cloudflare Access instead of a password. */
export function mailboxRoutes({ postcards }) {
	const router = Router();
	router.use(requireAccess);
	router.get('/', (req, res) => {
		const cards = postcards.list();
		const byId = new Map(cards.map((c) => [c.id, c]));
		const addressee = (c) => (c.direction === 'out' ? (byId.get(c.parent) ?? postcards.get(c.parent))?.signed || c.visitor : '');
		res.json({ postcards: cards.map((c) => ({ ...c, ...journey(c), addressee: addressee(c) })) });
	});
	router.delete('/:id', del(postcards));

	/* Futile Mail: the studio writes back. A form post is a simple request a foreign page could make
	   with the owner's Access cookie, so a custom header is required; CORS refuses it cross-origin. */
	router.post('/:id/reply', (req, res, next) => (req.get('x-futile-post') === '1' ? next() : res.status(403).json({ error: 'Refused.' })), photo, async (req, res) => {
		const parent = postcards.get(Number(req.params.id));
		if (!parent || parent.direction !== 'in') return res.status(404).json({ error: 'No such card.' });
		if (!journey(parent).delivered) return res.status(409).json({ error: 'That card has not arrived yet.' });
		const v = validatePostcard(req.body, { owner: true });
		if (!v.ok) return res.status(400).json({ error: v.error });
		await storeCard(postcards, req, res, v.value, { direction: 'out', parent: parent.id, country: parent.country, visitor: parent.visitor });
	});
	return router;
}
