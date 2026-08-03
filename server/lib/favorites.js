// Editable favorites: server/data/favorites.json is a plain JSON file
// (albums = folder names, tracks = "Album/File.ext" rel paths). Hearts show
// on the collection page for everyone; toggling goes through the authed
// POST /api/favorites/toggle endpoint, which reads fresh, flips the entry,
// and writes back atomically. Manual edits still work and are picked up
// within the short TTL below.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'favorites.json');
const TTL_MS = 10_000;

let cache = { at: 0, albums: new Set(), tracks: new Set() };
let raw = { albums: [], tracks: [] };

async function load({ fresh = false } = {}) {
	const now = Date.now();
	if (!fresh && now - cache.at < TTL_MS) return cache;
	try {
		raw = JSON.parse(await fs.readFile(FILE, 'utf8'));
		cache = {
			at: now,
			albums: new Set((raw.albums || []).map(String)),
			tracks: new Set((raw.tracks || []).map(String)),
		};
	} catch {
		raw = { albums: [], tracks: [] };
		cache = { at: now, albums: new Set(), tracks: new Set() };
	}
	return cache;
}

async function persist() {
	const tmp = `${FILE}.tmp`;
	await fs.mkdir(path.dirname(FILE), { recursive: true });
	await fs.writeFile(tmp, JSON.stringify(raw, null, '\t'));
	await fs.rename(tmp, FILE);
}

// Serialize writes so two quick toggles can't interleave and lose one.
let writeChain = Promise.resolve();

function toggle(key, value) {
	const task = writeChain.then(async () => {
		const fav = await load({ fresh: true });
		if (fav[key].has(value)) {
			fav[key].delete(value);
			raw[key] = (raw[key] || []).filter((v) => String(v) !== value);
			await persist();
			return false;
		}
		fav[key].add(value);
		raw[key] = [...(raw[key] || []), value];
		await persist();
		return true;
	});
	writeChain = task.catch(() => {});
	return task;
}

/** Flip an album's heart. Returns the new state (true = favorited). */
export function toggleAlbum(id) {
	return toggle('albums', id);
}

/** Flip a track's heart (rel path like "Album/01 Song.flac"). */
export function toggleTrack(rel) {
	return toggle('tracks', rel);
}

/** Stamp `fav` onto every album and track record from favorites.json. */
export async function decorateAlbums(albums) {
	const fav = await load();
	for (const album of albums || []) {
		album.fav = fav.albums.has(album.id);
		for (const track of album.tracks || []) track.fav = fav.tracks.has(track.rel);
	}
	return albums;
}
