// Auto-fetches album artwork for albums that have none on disk (no
// folder.jpg/cover.jpg, no embedded art). Uses the iTunes Search API — no
// key required. Successful covers are cached to disk under MUSIC_DIR/.covers
// (hidden, ignored by the scanner); failed lookups are cached in memory so the
// API isn't hammered on every page load.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { MUSIC_DIR, getAlbum } from './music.js';

const CACHE_DIR = path.join(MUSIC_DIR, '.covers');
const FETCH_TIMEOUT_MS = 8000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;

const negative = new Map(); // album name -> last-fetch timestamp

function magicType(buf) {
	if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
	if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
	if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
	if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp';
	return null;
}

function cacheFile(key) {
	return path.join(CACHE_DIR, `${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}.img`);
}

async function readCache(key) {
	try {
		const data = await fs.readFile(cacheFile(key));
		const mime = magicType(data);
		return mime ? { data, mime } : null;
	} catch {
		return null;
	}
}

async function writeCache(key, data) {
	try {
		await fs.mkdir(CACHE_DIR, { recursive: true });
		await fs.writeFile(cacheFile(key), data);
	} catch {
		// cache is best-effort
	}
}

function normalize(s) {
	return String(s || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function similarity(a, b) {
	if (!a || !b) return 0;
	if (a === b) return 1;
	const wa = new Set(a.split(' '));
	const wb = new Set(b.split(' '));
	let shared = 0;
	for (const w of wa) if (wb.has(w)) shared++;
	return shared / Math.max(wa.size, wb.size);
}

/** Strip release-group noise ("[FLAC]", "(2020)", "24-44", "WEB", …) from a folder name. */
function cleanTitle(s) {
	return String(s || '')
		.replace(/_/g, ' ')
		.replace(/\[[^\]]*\]/g, ' ')
		.replace(/\(\d{4}[^)]*\)/g, ' ')
		.replace(/\b\d{1,2}-4[0-9]\b/gi, ' ')
		.replace(/\b(WEB|FLAC|LOSSLESS|24BIT|48KHZ|44\.1KHZ|96KHZ|192KHZ|DSD|OBZEN|REMASTERED|SINGLE|EP)\b/g, ' ')
		.replace(/^\d{4}\s*[-–.]?\s*/, ' ')
		.replace(/[^a-z0-9]+/gi, ' ')
		.trim();
}

async function searchItunes(query) {
	const url = new URL('https://itunes.apple.com/search');
	url.searchParams.set('term', query);
	url.searchParams.set('entity', 'album');
	url.searchParams.set('media', 'music');
	url.searchParams.set('limit', '5');
	const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!res.ok) return [];
	const json = await res.json();
	return json.results || [];
}

function pickBest(results, album, artist) {
	const normAlbum = normalize(cleanTitle(album));
	const normArtist = normalize(artist);
	let best = null;
	let bestScore = 0;
	for (const r of results) {
		const albumSim = similarity(normAlbum, normalize(r.collectionName));
		const artistSim = normArtist ? similarity(normArtist, normalize(r.artistName)) : 1;
		const isSingle = /single/i.test(r.collectionName || '');
		const score = (albumSim * 0.7 + artistSim * 0.3) * (isSingle ? 0.6 : 1);
		if (score > bestScore) {
			bestScore = score;
			best = r;
		}
	}
	return bestScore >= 0.45 ? best : null;
}

function artworkUrl(result) {
	const u = result.artworkUrl100 || result.artworkUrl60 || result.artworkUrl30 || '';
	return u ? u.replace('100x100', '600x600').replace('60x60', '600x600').replace('30x30', '600x600') : null;
}

async function downloadArtwork(url) {
	const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!res.ok) return null;
	const data = Buffer.from(await res.arrayBuffer());
	const mime = magicType(data);
	if (!mime || data.length < 512) return null;
	return { data, mime };
}

/**
 * Return cover art for an album that has none on disk, fetching from the
 * iTunes Search API when possible. Returns { data, mime } or null.
 */
export async function fetchCover(albumName) {
	if (!albumName || albumName === '.' || albumName === '__singles') return null;

	const cached = await readCache(albumName);
	if (cached) return cached;

	const lastAttempt = negative.get(albumName);
	if (lastAttempt && Date.now() - lastAttempt < NEGATIVE_TTL_MS) return null;
	negative.set(albumName, Date.now());

	try {
		const album = await getAlbum(albumName);
		let artist = album?.artist && !/various/i.test(album.artist) ? album.artist : null;

		// Multi-artist tags ("A, B & C" / "A feat. B") — keep just the main
		// act, which is listed first. Search engines rank better against it
		// than against a delimited string. "&" is left alone since it's
		// common in band names (Simon & Garfunkel).
		if (artist) {
			const parts = artist.split(/,\s*|\s+(?:feat\.?|featuring|ft\.?)\s*/i);
			if (parts.length > 1) artist = parts[0].trim();
		}

		// No artist tag? Guess "Artist - Album" from the folder name.
		let title = cleanTitle(albumName);
		if (!artist) {
			const m = /^(.*?)\s+-\s+(.*)$/.exec(albumName);
			if (m && m[2]) {
				artist = m[1];
				title = cleanTitle(m[2]);
			}
		}

		const query = artist ? `${artist} ${title}` : title;
		let results = await searchItunes(query);
		let best = pickBest(results, title, artist);
		if (!best && artist) {
			// Delimited artist tags (feats. and co-artists) can drown the
			// match — retry on the title alone before giving up.
			results = await searchItunes(title);
			best = pickBest(results, title, null);
		}
		const url = best && artworkUrl(best);
		if (!url) return null;

		const art = await downloadArtwork(url);
		if (!art) return null;

		await writeCache(albumName, art.data);
		return art;
	} catch {
		return null;
	}
}
