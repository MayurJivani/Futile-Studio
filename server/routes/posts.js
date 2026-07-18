import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { requireCsrf } from '../lib/security.js';
import { requireString, optionalString, toBoolean, requireId, ValidationError } from '../lib/validate.js';
import { stripHtml } from '../lib/sanitize.js';

const router = Router();

const LIST_COLUMNS = 'id, slug, title, excerpt, cover_url, published, created_at, updated_at';

function slugify(str) {
	return String(str)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
		.slice(0, 80);
}

function uniqueSlug(base, excludeId) {
	let slug = base || 'post';
	let n = 1;
	while (true) {
		const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
		if (!existing || existing.id === excludeId) return slug;
		n += 1;
		slug = `${base}-${n}`;
	}
}

function parsePostBody(body, { partial = false } = {}) {
	const out = {};
	if (!partial || body.title !== undefined)
		out.title = stripHtml(requireString(body.title, 'title', { maxLen: 200 }));
	if (!partial || body.excerpt !== undefined)
		out.excerpt = stripHtml(optionalString(body.excerpt, 'excerpt', { maxLen: 400 }));
	if (!partial || body.body !== undefined)
		out.body = stripHtml(requireString(body.body, 'body', { maxLen: 200_000 }));
	if (!partial || body.cover_url !== undefined)
		out.cover_url = optionalString(body.cover_url, 'cover_url', { maxLen: 2000 });
	if (!partial || body.published !== undefined) out.published = toBoolean(body.published);
	if (body.slug !== undefined) out.slug = optionalString(body.slug, 'slug', { maxLen: 80 });
	return out;
}

// GET /api/posts — published only, or everything if authed + ?all=1
router.get('/', (req, res) => {
	if (req.query.all && req.session.userId) {
		return res.json(db.prepare(`SELECT ${LIST_COLUMNS} FROM posts ORDER BY created_at DESC`).all());
	}
	res.json(
		db.prepare(`SELECT ${LIST_COLUMNS} FROM posts WHERE published = 1 ORDER BY created_at DESC`).all(),
	);
});

// GET /api/posts/:slug — published only, unless authed
router.get('/:slug', (req, res) => {
	const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(req.params.slug);
	if (!post) return res.status(404).json({ error: 'Not found' });
	if (!post.published && !req.session.userId) return res.status(404).json({ error: 'Not found' });
	res.json(post);
});

// POST /api/posts — create (protected)
router.post('/', requireAuth, requireCsrf, (req, res, next) => {
	try {
		const data = parsePostBody(req.body || {});
		const finalSlug = uniqueSlug(slugify(data.slug || data.title));
		const info = db
			.prepare(
				'INSERT INTO posts (slug, title, excerpt, body, cover_url, published) VALUES (?, ?, ?, ?, ?, ?)',
			)
			.run(finalSlug, data.title, data.excerpt, data.body, data.cover_url, data.published ? 1 : 0);

		res.status(201).json(db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid));
	} catch (err) {
		if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
		next(err);
	}
});

// PUT /api/posts/:id — update (protected)
router.put('/:id', requireAuth, requireCsrf, (req, res, next) => {
	try {
		const id = requireId(req.params.id);
		const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
		if (!existing) return res.status(404).json({ error: 'Not found' });

		const data = parsePostBody(req.body || {}, { partial: true });
		let finalSlug = existing.slug;
		if (data.slug && slugify(data.slug) !== existing.slug) {
			finalSlug = uniqueSlug(slugify(data.slug), id);
		}

		db.prepare(
			`UPDATE posts SET title=?, excerpt=?, body=?, cover_url=?, published=?, slug=?, updated_at=datetime('now') WHERE id=?`,
		).run(
			data.title ?? existing.title,
			data.excerpt ?? existing.excerpt,
			data.body ?? existing.body,
			data.cover_url ?? existing.cover_url,
			data.published !== undefined ? (data.published ? 1 : 0) : existing.published,
			finalSlug,
			id,
		);

		res.json(db.prepare('SELECT * FROM posts WHERE id = ?').get(id));
	} catch (err) {
		if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
		next(err);
	}
});

// DELETE /api/posts/:id — delete (protected)
router.delete('/:id', requireAuth, requireCsrf, (req, res, next) => {
	try {
		const id = requireId(req.params.id);
		db.prepare('DELETE FROM posts WHERE id = ?').run(id);
		res.json({ ok: true });
	} catch (err) {
		if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
		next(err);
	}
});

export default router;
