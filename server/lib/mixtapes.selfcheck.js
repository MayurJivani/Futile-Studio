/* Self-check for the mixtape write boundary.
 *
 *   node server/lib/mixtapes.selfcheck.js
 *
 * Every URL accepted here ends up in an <audio> or <img> on lab.futile.studio,
 * so these are the cases that matter: script schemes, other people's hosts,
 * paths that climb out of /media, and files that are not audio.
 */

import assert from 'node:assert/strict';

process.env.MIXTAPE_AUDIO_HOSTS = 'audio.example.org';
process.env.MUSIC_DIR = '/srv/music-selfcheck';
const { validateTrack, validatePlaylist, playUrl } = await import('./mixtapes.js');

let n = 0;
const check = (name, fn) => {
	fn();
	n++;
	console.log('  ok  ' + name);
};
const track = (patch) => validateTrack({ title: 'Song', src: '/media/1-ab.mp3', ...patch });
const bad = (patch) => assert.equal(track(patch).ok, false, JSON.stringify(patch));

check('an uploaded mp3 is accepted and labels are cleaned', () => {
	const r = track({ artist: ' Someone\u0007 ', description: 'x'.repeat(900) });
	assert.equal(r.ok, true, r.error);
	assert.equal(r.value.artist, 'Someone');
	assert.equal(r.value.descr.length, 500);
	assert.equal(r.value.enabled, 1);
});
check('enabled false is kept', () => assert.equal(track({ enabled: false }).value.enabled, 0));
check('title and src are required', () => {
	bad({ title: '  ' });
	bad({ src: '' });
});
check('script and data schemes are refused', () => {
	bad({ src: 'javascript:alert(1)//.mp3' });
	bad({ src: 'data:audio/mp3;base64,AAAA' });
	bad({ artwork: 'javascript:alert(1)//.png' });
});
check('media paths cannot climb or nest', () => {
	bad({ src: '/media/../db.mp3' });
	bad({ src: '/media/a/b.mp3' });
	bad({ src: '/etc/x.mp3' });
});
check('only audio extensions play', () => {
	bad({ src: '/media/1-ab.png' });
	bad({ src: 'https://audio.example.org/a.html' });
});
check('external audio only from an allowed host', () => {
	assert.equal(track({ src: 'https://audio.example.org/tape/a.ogg' }).ok, true);
	bad({ src: 'https://evil.example.com/a.mp3' });
	bad({ src: 'https://user:pw@audio.example.org/a.mp3' });
});
check('artwork may be any http(s) image or an upload', () => {
	assert.equal(track({ artwork: 'https://img.example.com/c.jpg' }).value.artwork, 'https://img.example.com/c.jpg');
	assert.equal(track({ artwork: '/media/c.webp' }).ok, true);
	bad({ artwork: '/media/c.svg' });
});
check('collection tracks are references inside MUSIC_DIR', () => {
	assert.equal(track({ src: 'library:Album/01 Song.flac' }).value.src, 'library:Album/01 Song.flac');
	bad({ src: 'library:../etc/passwd.mp3' });
	bad({ src: 'library:Album/../../x.flac' });
	bad({ src: 'library:Album/cover.jpg' });
	bad({ src: 'library:' });
});
check('collection tracks play through a signed stream, transcoded when not native', () => {
	assert.match(playUrl('library:A/1 x.flac'), /^\/api\/music\/stream\?path=A%2F1%20x\.flac&tk=\d+-[\w-]+$/);
	assert.match(playUrl('library:A/1.ape'), /&to=mp3$/);
	assert.equal(playUrl('/media/a.mp3'), '/media/a.mp3');
});
check('playlists need a name and a clean id list', () => {
	assert.equal(validatePlaylist({ name: 'Side A', trackIds: [3, 1] }).ok, true);
	assert.equal(validatePlaylist({ name: '' }).ok, false);
	assert.equal(validatePlaylist({ name: 'x', trackIds: [1, 1] }).ok, false);
	assert.equal(validatePlaylist({ name: 'x', trackIds: ['1'] }).ok, false);
});

console.log(`mixtapes: ${n} checks passed`);
