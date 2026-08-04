// Read-only hi-res music library: auto-discovered albums from MUSIC_DIR and
// lossless streaming. There are NO raw file URLs anymore — every byte goes
// through /api/music/stream behind a short-lived signed token, so a track
// URL can't be bookmarked, shared, or pointed at another file. Cover art and
// the catalog stay public.

import { Router } from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
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
	mimeForExt,
} from '../lib/music.js';
import { fetchCover } from '../lib/coverFetch.js';
import { decorateAlbums } from '../lib/favorites.js';
import { streamToken, verifyStreamToken, tokenMaxAge } from '../lib/streamToken.js';

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
// Track `url`s carry a signed token and point at /api/music/stream.
router.get('/', async (req, res, next) => {
	try {
		const albums = await decorateAlbums(await listAlbums());
		for (const album of albums) {
			for (const track of album.tracks) {
				track.url = `/api/music/stream?path=${encodeURIComponent(track.rel)}&tk=${streamToken(track.rel)}`;
			}
		}
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
//
// `?s=<px>` requests a downscaled JPEG thumbnail (via ffmpeg, which the
// transcode path already requires) so a 200px shelf tile doesn't pull a 4-7MB
// folder.jpg across the wire. Thumbs are cached to disk under
// MUSIC_DIR/.covers/thumbs and served immutable; on ffmpeg failure they fall
// back to the full-size original so nothing ever breaks.
const coverCache = new Map();
const COVER_CACHE_TTL_MS = 60 * 60 * 1000;
const THUMB_CACHE_DIR = path.join(MUSIC_DIR, '.covers', 'thumbs');

function sendCover(res, req, payload) {
	// Content-derived ETag (not per-album) so a swapped cover.jpg / newly
	// fetched remote art invalidates caches instead of an endless 304 against
	// the old image. No `immutable`: that would pin the first-seen cover for
	// the whole max-age without revalidating, so user swaps would never show.
	const etag = `"${crypto.createHash('sha1').update(payload.data).digest('hex').slice(0, 20)}"`;
	res.setHeader('ETag', etag);
	if (req.headers['if-none-match'] === etag) return res.status(304).end();
	res.setHeader('Content-Type', payload.mime);
	res.setHeader('Cache-Control', 'public, max-age=3600');
	res.send(payload.data);
}

/** Downscale image bytes to a JPEG of the given longest-side size. */
function makeThumb(data, size) {
	return new Promise((resolve) => {
		const proc = spawn(
			'ffmpeg',
			[
				'-v', 'error',
				'-i', 'pipe:0',
				'-vf', `scale='if(gt(iw,ih),-2,${size})':'if(gt(iw,ih),${size},-2)'`,
				'-frames:v', '1',
				'-q:v', '4',
				'-f', 'image2pipe',
				'-c:v', 'mjpeg',
				'pipe:1',
			],
			{ stdio: ['pipe', 'pipe', 'ignore'] },
		);
		const chunks = [];
		proc.stdout.on('data', (c) => chunks.push(c));
		proc.on('error', () => resolve(null));
		proc.on('close', (code) => {
			const buf = Buffer.concat(chunks);
			resolve(code === 0 && buf.length ? buf : null);
		});
		proc.stdin.on('error', () => {});
		proc.stdin.end(data);
	});
}

/** Thumbnail from disk cache, else generate + persist. Returns null on any failure. */
async function thumbOrCache(payload, album, size) {
	// Key on a hash of the source bytes too, so a changed cover.jpg produces a
	// fresh thumbnail instead of a stale cached one.
	const sourceHash = crypto.createHash('sha1').update(payload.data).digest('hex').slice(0, 8);
	const file = path.join(
		THUMB_CACHE_DIR,
		`${crypto.createHash('sha1').update(`${album}@${size}@${sourceHash}`).digest('hex').slice(0, 16)}.jpg`,
	);
	try {
		const cached = await fs.readFile(file);
		if (cached.length) return cached;
	} catch {
		// miss — generate below
	}
	const thumb = await makeThumb(payload.data, size);
	if (!thumb) return null;
	try {
		await fs.mkdir(THUMB_CACHE_DIR, { recursive: true });
		await fs.writeFile(file, thumb);
	} catch {
		// disk cache is best-effort
	}
	return thumb;
}

router.get('/cover', async (req, res, next) => {
	const album = String(req.query.album || '');
	const size = Number(req.query.s) || 0;
	if (!album) return res.status(400).json({ error: 'Missing album' });

	const key = size ? `${album}@${size}` : album;
	const hit = coverCache.get(key);
	if (hit && Date.now() - hit.at < COVER_CACHE_TTL_MS) {
		return sendCover(res, req, hit.payload);
	}

	try {
		let payload = null;
		const disk = await findAlbumCover(album);
		if (disk) {
			payload = disk;
		} else {
			payload = await fetchCover(album);
		}

		// Requested a small thumbnail and have raster art — downscale it.
		// Placeholder SVGs are vector and already tiny, so they're served as-is.
		if (payload && size > 0 && payload.mime !== 'image/svg+xml') {
			const thumb = await thumbOrCache(payload, album, size);
			if (thumb) {
				const thumbPayload = { mime: 'image/jpeg', data: thumb };
				coverCache.set(key, { at: Date.now(), payload: thumbPayload });
				return sendCover(res, req, thumbPayload);
			}
		}

		if (payload) {
			coverCache.set(key, { at: Date.now(), payload });
			return sendCover(res, req, payload);
		}

		// No art anywhere — send a generated blueprint cover.
		const placeholder = { mime: 'image/svg+xml', data: placeholderCover(album) };
		coverCache.set(key, { at: Date.now(), payload: placeholder });
		return sendCover(res, req, placeholder);
	} catch (err) {
		next(err);
	}
});

/**
 * Stream a track. The only way audio bytes leave the server.
 *
 *   ?path=Album/01 Track.flac&tk=<signed token>      → lossless byte-range stream
 *   ?path=...&tk=<token>&to=aac|mp3|wav              → ffmpeg transcode fallback
 *
 * The token is minted per-track in the catalog, expires after a few hours,
 * and is bound to the exact file path. `to` is only meaningful for formats
 * the requesting browser can't play raw; native formats are always served
 * raw (lossless) regardless.
 */
router.get('/stream', async (req, res, next) => {
	const rel = String(req.query.path || '');
	const abs = resolveMusicPath(rel);
	if (!abs || !path.extname(rel)) {
		return res.status(400).json({ error: 'Invalid path' });
	}
	if (!verifyStreamToken(rel, String(req.query.tk || ''))) {
		return res.status(403).json({ error: 'Invalid or expired stream token' });
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
	const ext = path.extname(rel).toLowerCase().slice(1);
	const native = isNativeFormat(ext);

	// Lossless raw byte-range stream — browsers play FLAC/WAV/MP3/… this way
	// with working seek. Native formats never need a transcode.
	if (!to || (TRANSCODE[to] && native)) {
		return streamRaw(req, res, abs, stat.size, ext);
	}

	if (!TRANSCODE[to]) {
		return res.status(400).json({ error: 'Unsupported stream target' });
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
		res.setHeader('Cache-Control', `private, max-age=${tokenMaxAge(req.query.tk)}`);
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

// Serve raw file bytes with HTTP Range support so seeking is lossless and
// doesn't require downloading the whole file. Streaming through the tokenized
// route (instead of a static /music mount) is what kills direct downloads.
function streamRaw(req, res, abs, total, ext) {
	const range = req.headers.range;
	let startByte = 0;
	let endByte = total - 1;

	if (range) {
		const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
		if (m && (m[1] !== '' || m[2] !== '')) {
			startByte = m[1] !== '' ? Number(m[1]) : 0;
			endByte = m[2] !== '' ? Math.min(Number(m[2]), total - 1) : total - 1;
			if (!Number.isFinite(startByte) || startByte > endByte || startByte >= total) {
				res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
				return;
			}
		}
	}

	res.status(range ? 206 : 200);
	res.setHeader('Content-Type', mimeForExt(`.${ext}`));
	res.setHeader('Content-Length', endByte - startByte + 1);
	res.setHeader('Content-Range', `bytes ${startByte}-${endByte}/${total}`);
	res.setHeader('Accept-Ranges', 'bytes');
	res.setHeader('Cache-Control', `private, max-age=${tokenMaxAge(req.query.tk)}`);
	res.setHeader('X-Content-Type-Options', 'nosniff');

	const stream = createReadStream(abs, { start: startByte, end: endByte });
	stream.on('error', () => {
		if (!res.headersSent) res.status(500).json({ error: 'Read failed' });
		else res.destroy();
	});
	stream.pipe(res);
}

export default router;
