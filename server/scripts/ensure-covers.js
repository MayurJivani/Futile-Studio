// One-shot: drop a cover file (cover.jpg / cover.png) into every album folder
// that doesn't have one. Source is the same cascade the cover endpoint uses —
// embedded art first, then the auto-fetched iTunes art. Audio files are never
// touched. Safe to re-run; folders that already have a cover are skipped.
//
//   MUSIC_DIR=/home/icarusfalls/Music node scripts/ensure-covers.js

import fs from 'node:fs/promises';
import path from 'node:path';
import { MUSIC_DIR, listAlbums, findAlbumCover, resolveMusicPath } from '../lib/music.js';
import { fetchCover } from '../lib/coverFetch.js';

const COVER_RE = /^(cover|folder|front|album)\.(jpe?g|png)$/i;

const albums = await listAlbums();
let wrote = 0;
let skipped = 0;
let failed = 0;

for (const album of albums) {
	if (album.id === '.' || album.id === '__singles') continue;
	const dirAbs = resolveMusicPath(album.id);
	if (!dirAbs) continue;

	const entries = await fs.readdir(dirAbs).catch(() => null);
	if (!entries) {
		failed++;
		console.log(`  ! unreadable folder: ${album.id}`);
		continue;
	}
	if (entries.some((name) => COVER_RE.test(name))) {
		skipped++;
		continue;
	}

	let art = await findAlbumCover(album.id);
	if (!art) art = await fetchCover(album.id);
	if (!art?.data?.length) {
		failed++;
		console.log(`  ! no artwork available: ${album.id}`);
		continue;
	}

	const ext = art.mime === 'image/png' ? 'png' : art.mime === 'image/webp' ? 'webp' : 'jpg';
	const target = path.join(dirAbs, `cover.${ext}`);
	await fs.writeFile(target, art.data);
	console.log(`  + ${target} (${art.data.length} bytes, ${art.mime})`);
	wrote++;
}

console.log(`\n${wrote} cover(s) written, ${skipped} folder(s) already had one, ${failed} failed.`);
console.log(`Library: ${MUSIC_DIR}`);
