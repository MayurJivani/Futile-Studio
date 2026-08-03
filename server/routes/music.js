// Read-only hi-res music library: auto-discovered albums from MUSIC_DIR,
// lossless byte-range streaming of raw files, and on-the-fly ffmpeg
// transcoding for formats browsers can't play natively (DSD, APE, WavPack,
// >48kHz FLAC in Safari, ...). No auth — the collection page is public.

import { Router } from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
	MUSIC_DIR,
	isAudio,
	isNativeFormat,
	listAlbums,
	findAlbumCover,
	placeholderCover,
	resolveMusicPath,
} from '../lib/music.js';
import { fetchCover } from '../lib/coverFetch.js';
import { decorateAlbums } from '../lib/favorites.js';

const router = Router();

// Transcode targets for the on-the-fly stream. FLAC is the lossless
// "hi-res" default; AAC/MP3 are lossy fallbacks for ancient browsers.
const TRANSCODE = {
	flac: { contentType: 'audio/flac', args: ['-c:a', 'flac', '-compression_level', '5', '-f', 'flac', 'pipe:1'] },
	aac: { contentType: 'audio/aac', args: ['-c:a', 'aac', '-b:a', '320k', '-f', 'adts', 'pipe:1'] },
	mp3: { contentType: 'audio/mpeg', args: ['-c:a', 'libmp3lame', '-b:a', '320k', '-f', 'mp3', 'pipe:1'] },
	wav: { contentType: 'audio/wav', args: ['-c:a', 'pcm_s24le', '-f', 'wav', 'pipe:1'] },
};

// The catalog — everything the frontend needs to build the shelf and player.
router.get('/', async (req, res, next) => {
	try {
		const albums = await decorateAlbums(await listAlbums());
		res.setHeader('Cache-Control', 'no-cache');
		res.json({ musicDir: MUSIC_DIR, albums });
	} catch (err) {
		next(err);
	}
});

// Cover art: folder.jpg/cover.jpg in the album dir, else embedded art from
// the first track, else auto-fetched from the iTunes Search API (cached to
// disk under MUSIC_DIR/.covers), else a procedural placeholder so every album
// still shows a cover. Cached aggressively — artwork doesn't change with
// scans. The in-memory cache stops repeat requests from re-parsing audio
// files or hammering the network while the album listing TTL is fresh.
const coverCache = new Map();
const COVER_CACHE_TTL_MS = 60 * 60 * 1000;

function sendCover(res, req, payload, tag) {
	const etag = `"${tag}"`;
	res.setHeader('ETag', etag);
	if (req.headers['if-none-match'] === etag) return res.status(304).end();
	res.setHeader('Content-Type', payload.mime);
	res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
	res.send(payload.data);
}

router.get('/cover', async (req, res, next) => {
	const album = String(req.query.album || '');
	if (!album) return res.status(400).json({ error: 'Missing album' });

	const hit = coverCache.get(album);
	if (hit && Date.now() - hit.at < COVER_CACHE_TTL_MS) {
		return sendCover(res, req, hit.payload, hit.tag);
	}

	try {
		// ETag changes per source so browsers that cached a placeholder get the
		// newly-discovered/fetched art instead of a misleading 304.
		const nameTag = crypto.createHash('sha1').update(album).digest('hex').slice(0, 12);

		const disk = await findAlbumCover(album);
		if (disk) {
			const tag = `${nameTag}a`;
			coverCache.set(album, { at: Date.now(), tag, payload: disk });
			return sendCover(res, req, disk, tag);
		}

		const fetched = await fetchCover(album);
		if (fetched) {
			const tag = `${nameTag}f`;
			coverCache.set(album, { at: Date.now(), tag, payload: fetched });
			return sendCover(res, req, fetched, tag);
		}

		// No art anywhere — send a generated blueprint cover.
		const payload = { mime: 'image/svg+xml', data: placeholderCover(album) };
		const tag = nameTag;
		coverCache.set(album, { at: Date.now(), tag, payload });
		return sendCover(res, req, payload, tag);
	} catch (err) {
		next(err);
	}
});

/**
 * Stream a track.
 *
 *   ?path=Album/01 Track.flac        → 302 to the raw file (/music/...) for
 *                                      lossless byte-range playback
 *   ?path=...&to=flac                → ffmpeg pipes a lossless FLAC stream
 *   ?path=...&to=aac|mp3|wav         → lossy/hi-res-PCM fallback streams
 *
 * `to` is only meaningful for formats the requesting browser can't play raw.
 */
router.get('/stream', async (req, res, next) => {
	const rel = String(req.query.path || '');
	const abs = resolveMusicPath(rel);
	if (!abs || !path.extname(rel)) {
		return res.status(400).json({ error: 'Invalid path' });
	}

	let stat;
	try {
		stat = await fs.stat(abs);
	} catch {
		return res.status(404).json({ error: 'Not found' });
	}
	if (!stat.isFile() || !isAudio(rel)) {
		return res.status(400).json({ error: 'Not an audio file' });
	}

	const to = String(req.query.to || '').toLowerCase();
	if (!to || !TRANSCODE[to]) {
		// Raw lossless playback — let express.static handle Range/seek.
		const raw = `/music/${rel.split('/').map(encodeURIComponent).join('/')}`;
		return res.redirect(302, raw);
	}

	if (isNativeFormat(path.extname(rel)) && to !== 'wav') {
		// A native format never needs transcoding; avoid the CPU cost.
		const raw = `/music/${rel.split('/').map(encodeURIComponent).join('/')}`;
		return res.redirect(302, raw);
	}

	const spec = TRANSCODE[to];
	const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', abs, '-vn', '-map_metadata', '0', ...spec.args], {
		stdio: ['ignore', 'pipe', 'ignore'],
	});

	let aborted = false;
	req.on('close', () => {
		aborted = true;
		proc.kill('SIGKILL');
	});
	proc.on('error', (err) => {
		if (err.code === 'ENOENT') {
			res.status(500).json({ error: 'ffmpeg is not installed on this server' });
		} else if (!res.headersSent) {
			next(err);
		}
	});
	proc.on('spawn', () => {
		res.setHeader('Content-Type', spec.contentType);
		res.setHeader('Content-Disposition', 'inline');
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('X-Accel-Buffering', 'no');
		res.status(200);
	});
	proc.stdout.on('error', () => {});
	proc.stdout.pipe(res);
	proc.on('exit', (code) => {
		if (!aborted && !res.headersSent) {
			res.status(500).json({ error: `Transcode failed (${code})` });
		}
	});
});

export default router;
