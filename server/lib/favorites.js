// Editable favorites: server/data/favorites.json is a plain JSON file you
// maintain by hand — mark album folder names and track paths (rel) to get a
// heart on the collection page. Parsed fresh on a short TTL so edits show up
// without a server restart.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'favorites.json');
const TTL_MS = 10_000;

let cache = { at: 0, albums: new Set(), tracks: new Set() };

async function load() {
	const now = Date.now();
	if (now - cache.at < TTL_MS) return cache;
	try {
		const raw = JSON.parse(await fs.readFile(FILE, 'utf8'));
		cache = {
			at: now,
			albums: new Set((raw.albums || []).map(String)),
			tracks: new Set((raw.tracks || []).map(String)),
		};
	} catch {
		cache = { at: now, albums: new Set(), tracks: new Set() };
	}
	return cache;
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
