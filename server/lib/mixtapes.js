/* Mixtapes: the playlists the Lab's tape deck plays.
 *
 * A track is a library entry (title, artist, artwork, audio source); a mixtape
 * is a named, ordered list of tracks. The same track can sit on several tapes.
 * A track's audio is one of three things: a file uploaded through /api/media,
 * a URL on a host named in MIXTAPE_AUDIO_HOSTS, or `library:<rel>`, a track
 * from the /collection library (MUSIC_DIR). Library tracks are stored as that
 * reference and get a freshly signed /api/music/stream URL every time the list
 * is read, the same way the collection page plays them.
 *
 * Drafts and disabled tracks stay in the tables and never reach publicView().
 */

import { db } from '../db.js';
import { isAudio, isNativeFormat, listAlbums, resolveMusicPath } from './music.js';
import { streamToken } from './streamToken.js';

db.exec(`
	CREATE TABLE IF NOT EXISTS mix_tracks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		artist TEXT NOT NULL DEFAULT '',
		artwork TEXT NOT NULL DEFAULT '',
		src TEXT NOT NULL,
		descr TEXT NOT NULL DEFAULT '',
		enabled INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE TABLE IF NOT EXISTS mix_playlists (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		descr TEXT NOT NULL DEFAULT '',
		published INTEGER NOT NULL DEFAULT 0,
		is_default INTEGER NOT NULL DEFAULT 0,
		pos INTEGER NOT NULL DEFAULT 0
	);
	CREATE TABLE IF NOT EXISTS mix_playlist_tracks (
		playlist_id INTEGER NOT NULL,
		track_id INTEGER NOT NULL,
		pos INTEGER NOT NULL,
		PRIMARY KEY (playlist_id, track_id)
	);
`);

/* ---------------- validation ---------------- */

const AUDIO_EXT = /\.(mp3|m4a|ogg|oga|opus|wav|flac|aac)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;
// Exactly the names routes/media.js writes: no slashes, no dot segments.
const MEDIA_PATH = /^\/media\/[A-Za-z0-9._-]+$/;

/* Hosts an admin may point a track at besides our own /media. Empty by
   default: nothing external plays until someone names a host on purpose. */
export const audioHosts = () =>
	new Set(
		String(process.env.MIXTAPE_AUDIO_HOSTS || '')
			.split(',')
			.map((h) => h.trim().toLowerCase())
			.filter(Boolean),
	);

// Control characters are never wanted in a label and can break a log line or a layout.
const clean = (v, max) =>
	typeof v === 'string' ? v.replace(/\p{Cc}/gu, ' ').trim().slice(0, max) : '';

/** '' | '/media/x.ext' | an http(s) URL. Returns null when it is not acceptable. */
function checkUrl(raw, ext, hosts) {
	const s = typeof raw === 'string' ? raw.trim() : '';
	if (!s) return '';
	if (s.length > 500) return null;
	if (s.startsWith('/')) return MEDIA_PATH.test(s) && ext.test(s) ? s : null;
	let u;
	try {
		u = new URL(s);
	} catch {
		return null;
	}
	if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
	if (u.username || u.password) return null;
	if (!ext.test(u.pathname)) return null;
	if (hosts && !hosts.has(u.hostname.toLowerCase())) return null;
	return u.href;
}

/* ---------------- the /collection library ---------------- */

const LIB = 'library:';
const isLibrary = (v) => typeof v === 'string' && v.startsWith(LIB);
const relOf = (src) => src.slice(LIB.length);

/** Shape only: a path that stays inside MUSIC_DIR and names an audio file. */
function checkLibrary(raw) {
	const rel = relOf(raw.trim());
	return rel.length <= 500 && resolveMusicPath(rel) && isAudio(rel) ? LIB + rel : null;
}

/** True when the track is on the collection shelf right now (exists, not ignored). Non-library sources pass. */
export async function inCollection(src) {
	if (!isLibrary(src)) return true;
	const rel = relOf(src);
	return (await listAlbums()).some((a) => a.tracks.some((t) => t.rel === rel));
}

/** What an <audio> can load: a signed stream URL for library tracks, transcoded when the browser cannot play the file raw. */
export function playUrl(src) {
	if (!isLibrary(src)) return src;
	const rel = relOf(src);
	const ext = rel.split('.').pop();
	return `/api/music/stream?path=${encodeURIComponent(rel)}&tk=${streamToken(rel)}${isNativeFormat(ext) ? '' : '&to=mp3'}`;
}

/** Artwork set on the track, else the album cover the collection already serves. */
function coverOf(t) {
	if (t.artwork || !isLibrary(t.src) || !relOf(t.src).includes('/')) return t.artwork;
	return `/api/music/cover?album=${encodeURIComponent(relOf(t.src).split('/')[0])}&s=300`;
}

export function validateTrack(body) {
	if (!body || typeof body !== 'object') return { ok: false, error: 'Expected an object' };
	const title = clean(body.title, 120);
	if (!title) return { ok: false, error: 'title is required' };
	const src = isLibrary(body.src) ? checkLibrary(body.src) : checkUrl(body.src, AUDIO_EXT, audioHosts());
	if (!src) {
		return {
			ok: false,
			error: 'audio must be a collection track, an uploaded /media file or an http(s) URL on an allowed host, ending in mp3, m4a, ogg, opus, wav, flac or aac',
		};
	}
	const artwork = checkUrl(body.artwork, IMAGE_EXT, null);
	if (artwork === null) return { ok: false, error: 'artwork must be an uploaded image or an http(s) image URL' };
	return {
		ok: true,
		value: {
			title,
			artist: clean(body.artist, 120),
			artwork,
			src,
			descr: clean(body.description, 500),
			enabled: body.enabled === false ? 0 : 1,
		},
	};
}

export function validatePlaylist(body) {
	if (!body || typeof body !== 'object') return { ok: false, error: 'Expected an object' };
	const name = clean(body.name, 80);
	if (!name) return { ok: false, error: 'name is required' };
	const ids = body.trackIds ?? [];
	if (!Array.isArray(ids) || ids.length > 500 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
		return { ok: false, error: 'trackIds must be a list of track ids' };
	}
	if (new Set(ids).size !== ids.length) return { ok: false, error: 'a track can only be on a tape once' };
	return {
		ok: true,
		value: {
			name,
			descr: clean(body.description, 500),
			published: body.published ? 1 : 0,
			isDefault: Boolean(body.isDefault),
			trackIds: ids,
		},
	};
}

/* ---------------- reads ---------------- */

const trackOut = (r) => ({
	id: r.id,
	title: r.title,
	artist: r.artist,
	artwork: r.artwork,
	src: r.src,
	play: playUrl(r.src),
	cover: coverOf(r),
	description: r.descr,
	enabled: Boolean(r.enabled),
});

const tracksOf = db.prepare(`
	SELECT t.* FROM mix_playlist_tracks pt JOIN mix_tracks t ON t.id = pt.track_id
	WHERE pt.playlist_id = ? ORDER BY pt.pos
`);

export function adminView() {
	const playlists = db.prepare('SELECT * FROM mix_playlists ORDER BY pos, id').all();
	return {
		tracks: db.prepare('SELECT * FROM mix_tracks ORDER BY id DESC').all().map(trackOut),
		playlists: playlists.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.descr,
			published: Boolean(p.published),
			isDefault: Boolean(p.is_default),
			trackIds: tracksOf.all(p.id).map((t) => t.id),
		})),
	};
}

/** What a visitor may see: published tapes, enabled tracks, nothing else. */
export function publicView() {
	const playlists = db
		.prepare('SELECT * FROM mix_playlists WHERE published = 1 ORDER BY is_default DESC, pos, id')
		.all()
		.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.descr,
			tracks: tracksOf
				.all(p.id)
				.filter((t) => t.enabled)
				.map((t) => ({
					id: t.id,
					title: t.title,
					artist: t.artist,
					artwork: coverOf(t),
					src: playUrl(t.src),
					description: t.descr,
				})),
		}));
	return { defaultId: playlists[0]?.id ?? null, playlists };
}

/* ---------------- writes ---------------- */

const exists = (table, id) => Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id));

function tx(fn) {
	db.exec('BEGIN');
	try {
		const out = fn();
		db.exec('COMMIT');
		return out;
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
}

export function createTrack(v) {
	const { lastInsertRowid } = db
		.prepare('INSERT INTO mix_tracks (title, artist, artwork, src, descr, enabled) VALUES (?, ?, ?, ?, ?, ?)')
		.run(v.title, v.artist, v.artwork, v.src, v.descr, v.enabled);
	return Number(lastInsertRowid);
}

export function updateTrack(id, v) {
	return (
		db
			.prepare('UPDATE mix_tracks SET title=?, artist=?, artwork=?, src=?, descr=?, enabled=? WHERE id = ?')
			.run(v.title, v.artist, v.artwork, v.src, v.descr, v.enabled, id).changes > 0
	);
}

export function deleteTrack(id) {
	return tx(() => {
		db.prepare('DELETE FROM mix_playlist_tracks WHERE track_id = ?').run(id);
		return db.prepare('DELETE FROM mix_tracks WHERE id = ?').run(id).changes > 0;
	});
}

/** Create (id null) or replace a playlist, its track order included. */
export function savePlaylist(id, v) {
	const missing = v.trackIds.find((t) => !exists('mix_tracks', t));
	if (missing) return { ok: false, status: 400, error: `no track ${missing}` };
	if (id && !exists('mix_playlists', id)) return { ok: false, status: 404, error: 'no such playlist' };
	return tx(() => {
		if (id) {
			db.prepare('UPDATE mix_playlists SET name=?, descr=?, published=? WHERE id = ?').run(v.name, v.descr, v.published, id);
		} else {
			const { max } = db.prepare('SELECT COALESCE(MAX(pos), -1) AS max FROM mix_playlists').get();
			id = Number(
				db.prepare('INSERT INTO mix_playlists (name, descr, published, pos) VALUES (?, ?, ?, ?)').run(v.name, v.descr, v.published, max + 1)
					.lastInsertRowid,
			);
		}
		db.prepare('DELETE FROM mix_playlist_tracks WHERE playlist_id = ?').run(id);
		const put = db.prepare('INSERT INTO mix_playlist_tracks (playlist_id, track_id, pos) VALUES (?, ?, ?)');
		v.trackIds.forEach((t, i) => put.run(id, t, i));
		// Exactly one default: setting it here clears it everywhere else.
		if (v.isDefault) db.prepare('UPDATE mix_playlists SET is_default = (id = ?)').run(id);
		else db.prepare('UPDATE mix_playlists SET is_default = 0 WHERE id = ?').run(id);
		return { ok: true, id };
	});
}

export function deletePlaylist(id) {
	return tx(() => {
		db.prepare('DELETE FROM mix_playlist_tracks WHERE playlist_id = ?').run(id);
		return db.prepare('DELETE FROM mix_playlists WHERE id = ?').run(id).changes > 0;
	});
}

/** Shelf order of the tapes. Must name every playlist exactly once. */
export function orderPlaylists(ids) {
	const all = db.prepare('SELECT id FROM mix_playlists').all().map((r) => r.id);
	if (!Array.isArray(ids) || ids.length !== all.length || new Set(ids).size !== ids.length || !ids.every((i) => all.includes(i))) {
		return false;
	}
	tx(() => ids.forEach((id, i) => db.prepare('UPDATE mix_playlists SET pos = ? WHERE id = ?').run(i, id)));
	return true;
}
