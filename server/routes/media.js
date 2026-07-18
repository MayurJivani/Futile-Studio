import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileTypeFromFile } from 'file-type';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { requireCsrf, uploadLimiter } from '../lib/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

// Deliberately excludes image/svg+xml — SVG is XML and can carry an
// embedded <script>, making it a stored-XSS vector if ever rendered inline.
// Keyed by the magic-byte-detected mime (never the client-declared one) to
// the extension we'll actually write to disk.
const ALLOWED_TYPES = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'audio/flac': '.flac',
	'audio/mpeg': '.mp3',
	'audio/mp4': '.m4a',
	'audio/ogg': '.ogg',
	'audio/wav': '.wav',
	'audio/aac': '.aac',
};

const storage = multer.diskStorage({
	destination: uploadDir,
	filename: (req, file, cb) => {
		// Temporary name — renamed to a safe, extension-correct name after
		// the real file type is verified below. Never trust the client's
		// filename or declared mimetype for the name we serve publicly.
		cb(null, `tmp-${crypto.randomBytes(16).toString('hex')}`);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 200 * 1024 * 1024, files: 1 }, // 200MB — enough headroom for a FLAC track
});

const router = Router();

router.post('/', requireAuth, requireCsrf, uploadLimiter, upload.single('file'), async (req, res, next) => {
	if (!req.file) return res.status(400).json({ error: 'No file received' });

	try {
		const detected = await fileTypeFromFile(req.file.path);
		const ext = detected && ALLOWED_TYPES[detected.mime];

		if (!ext) {
			await fs.unlink(req.file.path).catch(() => {});
			return res.status(400).json({ error: 'Unsupported or unrecognized file type' });
		}

		const finalName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
		await fs.rename(req.file.path, path.join(uploadDir, finalName));

		db.prepare('INSERT INTO media (filename, original_name, mime) VALUES (?, ?, ?)').run(
			finalName,
			path.basename(req.file.originalname).slice(0, 255),
			detected.mime,
		);

		res.status(201).json({ url: `/media/${finalName}`, filename: finalName, mime: detected.mime });
	} catch (err) {
		await fs.unlink(req.file.path).catch(() => {});
		next(err);
	}
});

// Multer errors (file too large, etc.) land here rather than the generic
// handler so they get a clean 4xx instead of a 500.
router.use((err, req, res, next) => {
	if (err instanceof multer.MulterError) {
		const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
		return res.status(status).json({ error: err.message });
	}
	next(err);
});

export default router;
