// Hi-res music library — scans MUSIC_DIR (default /opt/media/Music) for albums
// and streams them. Designed for directory layouts like:
//
//   /opt/media/Music/Test Album/01 Intro.flac        → flat album
//   /opt/media/Music/Sampler/Disc 1/01 A Side.flac   → multi-disc album
//   /opt/media/Music/00 Loose One.mp3                → singles
//
// Albums are discovered automatically ("auto allocation"); nothing is
// registered ahead of time. Metadata (tags, hi-res sample rate / bit depth)
// and embedded cover art come from `music-metadata`. Raw files are served with
// byte-range support for lossless seeking; unsupported formats can be
// transcoded on the fly via ffmpeg in routes/music.js.

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';

export const MUSIC_DIR = path.resolve(process.env.MUSIC_DIR || '/opt/media/Music');

// Everything a browser or the on-the-fly transcode can reasonably play.
export const AUDIO_EXTS = new Set([
	'.flac',
	'.mp3',
	'.wav',
	'.ogg',
	'.opus',
	'.m4a',
	'.aac',
	'.aif',
	'.aiff',
	'.ape',
	'.wv',
	'.dsf',
	'.dff',
]);

// Formats browsers play natively in <audio> (everything else goes through
// the ffmpeg transcode path).
export const NATIVE_EXTS = new Set(['.flac', '.mp3', '.wav', '.ogg', '.opus', '.m4a', '.aac']);

const EXT_MIME = {
	'.flac': 'audio/flac',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.opus': 'audio/ogg',
	'.m4a': 'audio/mp4',
	'.aac': 'audio/aac',
	'.aif': 'audio/aiff',
	'.aiff': 'audio/aiff',
	'.ape': 'audio/x-ape',
	'.wv': 'audio/x-wavpack',
	'.dsf': 'audio/x-dsf',
	'.dff': 'audio/x-dff',
};

const COVER_FILENAMES = [
	'cover.jpg',
	'cover.jpeg',
	'cover.png',
	'folder.jpg',
	'folder.jpeg',
	'front.jpg',
	'front.png',
	'album.jpg',
	'album.png',
];

const naturalCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const CACHE_TTL_MS = 30_000;
let cache = { at: 0, albums: null, error: null };

export function isAudio(filename) {
	return AUDIO_EXTS.has(path.extname(filename).toLowerCase());
}

/**
 * Resolve a user-supplied path relative to MUSIC_DIR. Returns an absolute
 * path only if it stays inside the library root — guards against `..`
 * traversal. Callers validate file/dir semantics (and the audio extension)
 * separately.
 */
export function resolveMusicPath(rel) {
	if (typeof rel !== 'string' || !rel || rel.includes('\0')) return null;
	const abs = path.resolve(MUSIC_DIR, rel);
	const relative = path.relative(MUSIC_DIR, abs);
	if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return null;
	if (relative.includes('/../') || relative.endsWith('/..')) return null;
	return abs;
}

/** Strip a leading "01 " / "01 - " track number from a filename. */
function stripTrackNum(name) {
	return name
		.replace(/^\s*(\d{1,3})\s*[-._]?\s+/, '')
		.replace(/\.[^.]+$/, '')
		.trim();
}

/**
 * Read tags for one audio file. Returns a compact, serializable record or
 * null if the file can't be parsed. Embedded pictures are skipped here —
 * cover art is served on demand by /api/music/cover.
 */
async function readTrack(abs, rel, disc) {
	let stat;
	let meta;
	try {
		[stat, meta] = await Promise.all([
			fs.stat(abs),
			parseFile(abs, { duration: true, skipCovers: true }),
		]);
	} catch {
		// A corrupt or unreadable file still gets a shelf entry; it just has
		// no tags to display.
		return {
			file: path.basename(rel),
			rel,
			ext: path.extname(rel).toLowerCase().slice(1),
			track: null,
			title: stripTrackNum(path.basename(rel)),
			artist: null,
			duration: null,
			sampleRate: null,
			bitDepth: null,
			codec: null,
			disc: disc || null,
			size: 0,
		};
	}
	const fmt = meta.format || {};
	const common = meta.common || {};
	return {
		file: path.basename(rel),
		rel,
		ext: path.extname(rel).toLowerCase().slice(1),
		track: common.track?.no ?? null,
		title: common.title || stripTrackNum(path.basename(rel)),
		artist: common.artist || common.albumartist || null,
		album: common.album || null,
		albumartist: common.albumartist || null,
		year: common.year ?? null,
		duration: fmt.duration ?? null,
		sampleRate: fmt.sampleRate ?? null,
		bitDepth: fmt.bitsPerSample ?? null,
		codec: fmt.codec ? String(fmt.codec).toUpperCase() : null,
		disc: disc || null,
		size: stat.size,
	};
}

/** Map a batch of (abs, rel, disc) through readTrack with bounded concurrency. */
async function readAll(trackRefs) {
	const out = new Array(trackRefs.length);
	const CONCURRENCY = 8;
	let i = 0;
	async function worker() {
		while (i < trackRefs.length) {
			const j = i++;
			out[j] = await readTrack(trackRefs[j].abs, trackRefs[j].rel, trackRefs[j].disc);
		}
	}
	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, trackRefs.length) }, worker));
	return out;
}

function sortTracks(tracks) {
	return tracks
		.map((t) => ({ t, sort: t.track ?? null, name: t.file }))
		.sort((a, b) => {
			if (a.sort != null && b.sort != null) return a.sort - b.sort;
			return naturalCompare.compare(a.name, b.name);
		})
		.map((x) => x.t);
}

/**
 * Build one album record from a directory inside MUSIC_DIR. Handles flat
 * albums (files directly in the dir) and multi-disc albums (subdirectories
 * that each contain audio files — "Disc 1" / "Disc 2", "Side A" / "Side B",
 * or arbitrary nesting like "Mixtape/#1 Melodies/Side A/01 Track.flac").
 */
async function collectAudio(abs, rel, out = []) {
	const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => []);
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue;
		const childAbs = path.join(abs, entry.name);
		const childRel = `${rel}/${entry.name}`;
		if (entry.isFile()) {
			if (isAudio(entry.name)) out.push({ abs: childAbs, rel: childRel });
		} else if (entry.isDirectory()) {
			await collectAudio(childAbs, childRel, out);
		}
	}
	return out;
}

/** Release-group noise ("[FLAC]", "(2019)", "24-44", leading year, …) to strip from folder names. */
function cleanFolderTitle(name) {
	return String(name || '')
		.replace(/_/g, ' ')
		.replace(/^\d{4}\s*[-–.]\s*/, '')
		.replace(/^\[\d{4}\.\d{2}\.\d{2}\]\s*/, '')
		.replace(/\s*\(\d{4}[^)]*\)/g, '')
		.replace(/\s*\[[^\]]*\]/g, '')
		.replace(/\b\d{1,2}-4[0-9]\b/gi, ' ')
		.replace(/\b(WEB|FLAC|LOSSLESS|24BIT|48KHZ|44\.1KHZ|96KHZ|192KHZ|DSD|OBZEN|REMASTERED|SINGLE|EP)\b/gi, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/** True for tag values that aren't a useful album title ("Unreleased", "Unknown", …). */
function isGenericTitle(title) {
	const t = String(title || '').toLowerCase().trim();
	return (
		!t ||
		t.length < 2 ||
		['unknown', 'unreleased', 'none', 'n/a', 'various', 'untitled', 'album', 'single'].includes(t)
	);
}

/** Cut very long album titles at a word boundary and append an ellipsis. */
function truncateTitle(title, max = 42) {
	const s = String(title || '').trim();
	if (s.length <= max) return s;
	let cut = s.slice(0, max - 1);
	const space = cut.lastIndexOf(' ');
	if (space > max * 0.6) cut = cut.slice(0, space);
	return cut.trimEnd() + '…';
}

/** Pull a plausible 4-digit year out of a folder name ("2013 - Random Access Memories"). */
function parseFolderYear(name) {
	const m = /(19|20)\d{2}/.exec(String(name || ''));
	return m ? Number(m[0]) : null;
}

/** The year to display for an album — tag year if plausible, else from the folder name. */
function albumYear(tracks, dirName) {
	const tagged = tracks.find((t) => t.year && t.year >= 1950 && t.year <= 2100);
	return tagged?.year ?? parseFolderYear(dirName);
}

/** The album title shared by a clear majority of tracks — null for compilations. */
function dominantTag(tracks) {
	const counts = new Map();
	for (const t of tracks) {
		if (!t.album || isGenericTitle(t.album)) continue;
		const key = String(t.album).toLowerCase().trim();
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	if (!counts.size) return null;
	let bestKey = null;
	let bestCount = 0;
	for (const [key, count] of counts) {
		if (count > bestCount) {
			bestKey = key;
			bestCount = count;
		}
	}
	return bestCount >= Math.ceil(tracks.length / 2)
		? tracks.find((t) => t.album && String(t.album).toLowerCase().trim() === bestKey)?.album
		: null;
}

/** "Various artists" for mixed compilations, else the shared album artist / first track artist. */
function albumArtistName(tracks) {
	const albumArtist = tracks.find((t) => t.albumartist)?.albumartist;
	if (albumArtist) return albumArtist;
	const distinct = new Set(tracks.map((t) => t.artist).filter(Boolean));
	if (tracks.length >= 2 && distinct.size > tracks.length / 2) return 'Various artists';
	return tracks.find((t) => t.artist)?.artist || null;
}

async function buildAlbum(dirName, abs, isSingles = false) {
	const refs = await collectAudio(abs, dirName);
	if (!refs.length) return null;

	// Group tracks into discs by the first path segment after the album dir.
	// A flat album (all files directly in the album dir) is one disc.
	const direct = refs.filter((r) => path.dirname(r.rel) === dirName);
	let groups;
	if (direct.length === refs.length) {
		groups = [{ disc: null, refs }];
	} else {
		const byDisc = new Map();
		for (const r of refs) {
			const seg =
				path.dirname(r.rel) === dirName ? null : path.dirname(r.rel).slice(dirName.length + 1).split('/')[0];
			if (!byDisc.has(seg)) byDisc.set(seg, []);
			byDisc.get(seg).push(r);
		}
		groups = [...byDisc.entries()]
			.sort((a, b) => naturalCompare.compare(String(a[0] ?? ''), String(b[0] ?? '')))
			.map(([disc, discRefs]) => ({ disc, refs: discRefs }));
	}

	const trackRefs = [];
	groups.forEach((g, i) => {
		g.refs.forEach((r) =>
			trackRefs.push({ abs: r.abs, rel: r.rel, disc: groups.length > 1 ? i + 1 : null }),
		);
	});

	const tracks = sortTracks(await readAll(trackRefs));
	const first = tracks[0] || {};
	const firstMeta = first.codec ? first : tracks.find((t) => t.codec);

	const hiRes = tracks.some((t) => (t.sampleRate ?? 0) > 48000 || (t.bitDepth ?? 0) > 16);

	// Display metadata: prefer real tags over folder names. Folder names are
	// often release noise ("ZAYN - KONNAKOL [Deluxe] (2026) 24-44"), so the
	// album tag shared by most tracks wins when it's a useful title.
	const title = isSingles ? 'Singles & Loose Tracks' : truncateTitle(dominantTag(tracks) || cleanFolderTitle(dirName));
	const artist = isSingles ? 'Various artists' : albumArtistName(tracks);
	const year = albumYear(tracks, dirName);

	return {
		id: dirName,
		title,
		artist,
		year,
		albumArtist: artist,
		path: dirName,
		format: firstMeta.codec ? `${firstMeta.codec}${firstMeta.bitDepth ? ` ${firstMeta.bitDepth}/${firstMeta.sampleRate / 1000}` : ''}` : null,
		hiRes,
		discs: groups.length,
		tracks,
		cover: `/api/music/cover?album=${encodeURIComponent(dirName)}`,
		rel: dirName,
	};
}

/** Album folders to hide from the collection, one per line in MUSIC_DIR/.futile-ignore. */
async function loadIgnoreList() {
	try {
		const text = await fs.readFile(path.join(MUSIC_DIR, '.futile-ignore'), 'utf8');
		return new Set(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
	} catch {
		return new Set();
	}
}

/** Scan the library. Results are cached briefly so metadata parsing doesn't run on every request. */
export async function listAlbums() {
	const now = Date.now();
	if (cache.albums && now - cache.at < CACHE_TTL_MS) return cache.albums;

	const ignore = await loadIgnoreList();
	const albums = [];
	try {
		await fs.access(MUSIC_DIR);
	} catch {
		cache = { at: now, albums: [], error: `MUSIC_DIR not readable: ${MUSIC_DIR}` };
		return cache.albums;
	}

	const top = await fs.readdir(MUSIC_DIR, { withFileTypes: true });
	const loose = [];
	for (const entry of top) {
		if (entry.name.startsWith('.')) continue;
		const abs = path.join(MUSIC_DIR, entry.name);
		if (entry.isDirectory()) {
			if (ignore.has(entry.name)) continue;
			const album = await buildAlbum(entry.name, abs);
			if (album) albums.push(album);
		} else if (entry.isFile() && isAudio(entry.name)) {
			loose.push(entry.name);
		}
	}

	// Loose top-level files become one "Singles & Loose Tracks" album.
	if (loose.length) {
		const refs = loose
			.sort(naturalCompare.compare)
			.map((name) => ({ abs: path.join(MUSIC_DIR, name), rel: name, disc: null }));
		const tracks = sortTracks(await readAll(refs));
		const first = tracks[0] || {};
		albums.push({
			id: '__singles',
			title: 'Singles & Loose Tracks',
			artist: first.artist || 'Various artists',
			path: '.',
			format: first.codec || null,
			hiRes: tracks.some((t) => (t.sampleRate ?? 0) > 48000 || (t.bitDepth ?? 0) > 16),
			discs: 1,
			tracks,
			cover: '',
			rel: '.',
			singles: true,
		});
	}

	cache = { at: now, albums, error: null };
	return albums;
}

/** Return a full album record by its top-level directory name. */
export async function getAlbum(dirName) {
	const albums = await listAlbums();
	return albums.find((a) => a.id === dirName) || null;
}

/** Find a picture for an album: folder.jpg/cover.jpg first, then embedded art from the first track. */
export async function findAlbumCover(dirName) {
	if (dirName === '.' || dirName === '__singles') return null;
	const dirAbs = resolveMusicPath(dirName);
	if (!dirAbs) return null;

	// Case-insensitive: "Cover.jpg", "cover.JPG", … all count. Keeps the
	// priority order of COVER_FILENAMES (cover before folder before front…).
	const wanted = new Set(COVER_FILENAMES);
	let entries = [];
	try {
		entries = await fs.readdir(dirAbs);
	} catch {
		// no readable dir — fall through to embedded art
	}
	const candidates = entries
		.filter((name) => wanted.has(name.toLowerCase()))
		.sort((a, b) => COVER_FILENAMES.indexOf(a.toLowerCase()) - COVER_FILENAMES.indexOf(b.toLowerCase()));
	for (const name of candidates) {
		const file = path.join(dirAbs, name);
		try {
			const stat = await fs.stat(file);
			if (stat.isFile()) return { data: await fs.readFile(file), ext: path.extname(name), mime: mimeFor(name) };
		} catch {
			// keep looking
		}
	}

	// Fall back to embedded artwork from the first playable file in the album
	// (recursive — handles disc/side-nested layouts).
	const refs = await collectAudio(dirAbs, dirName);
	for (const { abs } of refs) {
		try {
			const meta = await parseFile(abs, { skipCovers: false, duration: false });
			const pic = meta.common.picture?.[0];
			if (pic?.data?.length) {
				const mime = pic.format || 'image/jpeg';
				const ext = mime === 'image/png' ? '.png' : '.jpg';
				// music-metadata hands back a Uint8Array; Express would
				// JSON-encode that, so make it a real Buffer for res.send().
				return { data: Buffer.from(pic.data), ext, mime };
			}
		} catch {
			// try next
		}
	}
	return null;
}

function mimeFor(name) {
	const ext = path.extname(name).toLowerCase();
	return ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
}

export function mimeForExt(ext) {
	return EXT_MIME[ext] || 'application/octet-stream';
}

export function isNativeFormat(ext) {
	return NATIVE_EXTS.has(`.${ext.replace(/^\./, '')}`);
}

function escapeXml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

/** Wrap a title into centered lines for the placeholder cover. */
function wrapLines(text, maxChars = 20) {
	const words = String(text || '').split(/\s+/).filter(Boolean);
	const lines = [];
	let current = '';
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length > maxChars && current) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
		if (lines.length === 3) return lines;
	}
	if (current) lines.push(current);
	return lines.slice(0, 3);
}

/**
 * Procedural "blueprint" cover served when an album has no artwork on disk,
 * so every shelf tile still displays a cover. Rendered as our own SVG inside
 * an <img> tag (no script execution) — safe, and matches the site's look.
 */
export function placeholderCover(title, subtitle = '') {
	const lines = wrapLines(title).map(escapeXml);
	const lineY = 830 - (lines.length - 1) * 34;
	const sub = escapeXml(subtitle || 'FUTILE RECORDING CO');
	const lineEls = lines
		.map((line, i) => `<text x="500" y="${lineY + i * 68}" text-anchor="middle" fill="#e8f4ff">${line}</text>`)
		.join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <rect width="1000" height="1000" fill="#0a1220"/>
  <circle cx="500" cy="440" r="380" fill="none" stroke="#1d3a5f" stroke-width="2"/>
  <circle cx="500" cy="440" r="300" fill="none" stroke="#1d3a5f" stroke-width="2"/>
  <circle cx="500" cy="440" r="220" fill="none" stroke="#1d3a5f" stroke-width="2"/>
  <circle cx="500" cy="440" r="140" fill="none" stroke="#1d3a5f" stroke-width="2"/>
  <circle cx="500" cy="440" r="52" fill="#54c8e8"/>
  <circle cx="500" cy="440" r="8" fill="#0a1220"/>
  <g font-family="sans-serif" font-weight="700" letter-spacing="2">
    ${lineEls}
  </g>
  <text x="500" y="905" text-anchor="middle" font-family="sans-serif" font-size="22" letter-spacing="6" fill="#7fb2ff">${sub}</text>
  <text x="50" y="55" font-family="sans-serif" font-size="20" letter-spacing="4" fill="#1d3a5f">DIGITAL MASTER</text>
  <text x="950" y="55" text-anchor="end" font-family="sans-serif" font-size="20" letter-spacing="4" fill="#1d3a5f">NO COVER ART</text>
</svg>
`;
}
