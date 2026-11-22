/**
 * Everything pasted onto the board, and the dates the shipping log reads.
 *
 * `shipped` is deliberately allowed to be missing or coarse: 'YYYY-MM' when the
 * month is known, 'YYYY' when only the year is, and absent when neither was
 * written down. The log places month-precise entries on their month, drops
 * year-only ones into the loose tray, and counts the undated rest rather than
 * guessing, which on a portfolio would be inventing a fact.
 *
 * `origin` is optional and only present where the log book actually records an
 * earlier attempt. It is lineage, not flavour: no project gets a backstory
 * invented for it.
 *
 * `status` only appears on the workbench. Everything in `open` is running by
 * definition, so storing a status there would be a second place for the same
 * fact to go stale.
 *
 * `mount` is assigned by hand, never randomised. A mix of pin, tape, clip and
 * photo corners reads as deliberate; a random one reads as noise. (Guideline B)
 */

/** @type {Array<{id:string,name:string,kind:string,href?:string,cta:string,shipped?:string,mount:string,art:string,pick?:boolean,desc:string,stack:string}>} */
export const open = [
	{
		id: 'noggin',
		name: "Noggin'",
		kind: 'party game',
		href: 'https://noggin.futile.studio',
		cta: 'Play it',
		shipped: '2026-09',
		mount: 'tape',
		art: 'noggin',
		pick: true,
		desc: 'A TV quiz show for a room full of phones. Picture, audio and video clues, millisecond buzzer racing, teams and lifelines, all on the hardware people walked in with.',
		stack: 'Astro, React, WebSockets',
	},
	{
		id: 'haggle',
		shipped: '2026-10',
		name: 'Haggle',
		kind: 'market game',
		href: 'https://haggle.futile.studio',
		cta: 'Play it',
		mount: 'corner',
		art: 'crate',
		pick: true,
		desc: 'A live stock market for the whole room. 500 players, 75 real companies, simulated prices, one opening bell.',
		stack: 'React, Vite, Express, WebSockets, Postgres',
	},
	{
		id: 'croon',
		shipped: '2026-11',
		name: 'Croon',
		kind: 'karaoke',
		href: 'https://croon.futile.studio',
		cta: 'Sing it',
		mount: 'pin',
		art: 'chorus',
		pick: true,
		desc: 'A karaoke lounge in the browser. Put a room on the TV, everyone joins from their phone, and the queue rotates so everybody sings. Lyrics timed to the word, pitch scored from the phone’s microphone, and the audio never leaves the phone.',
		stack: 'React 19, Node, Socket.IO, Postgres',
	},
	{
		id: 'hunch',
		shipped: '2026-10',
		name: 'Hunch',
		kind: 'party game',
		href: 'https://hunch.futile.studio',
		cta: 'Play it',
		mount: 'tape',
		art: 'door',
		desc: 'A 3D deduction game for three to five players. Read your clue, question the others, find the habitat.',
		stack: 'React, three.js, Socket.IO',
	},
	{
		id: 'knock',
		shipped: '2026-09',
		name: 'Knock',
		kind: 'experiment',
		href: 'https://knock.futile.studio',
		cta: 'Try it',
		mount: 'tape',
		art: 'knock',
		pick: true,
		desc: 'Join a room by being in it. A sound pitched past hearing does the job a QR code usually does, so everyone can keep their phone in their pocket.',
		stack: 'Web Audio, vanilla JS',
	},
	{
		id: 'mosaic',
		name: 'Mosaic',
		kind: 'stream tool',
		href: 'https://mosaic.futile.studio/',
		cta: 'Open it',
		shipped: '2026-04',
		mount: 'pin',
		art: 'mosaic',
		desc: 'A live overlay that lets mods drop emotes, clips and sound onto a broadcast while the streamer keeps playing. Changes reach the viewer the moment they land.',
		stack: 'Astro, React, WebSockets',
	},
	{
		id: 'chorusify',
		name: 'Chorusify',
		kind: 'music game',
		href: 'https://chorusify.com',
		cta: 'Play it',
		shipped: '2023-12',
		mount: 'corner',
		art: 'chorus',
		origin: 'The second attempt. The first was a PHP thing in 2022 that proved the idea was good and the execution was not.',
		desc: 'A Wordle-shaped daily music guessing game: daily, multiplayer and artist modes, a ten-song challenge and a leaderboard, with the clips playing in the browser rather than sending you elsewhere.',
		stack: 'React 18, TypeScript, Deezer Web API, Postgres',
	},
	{
		id: 'patina',
		name: 'Patina',
		kind: 'canvas',
		href: 'https://patina.futile.studio/',
		cta: 'Open it',
		shipped: '2026-09',
		mount: 'corner',
		art: 'patina',
		desc: 'A shared 4096×4096 canvas that stays open for a full year, one pixel at a time, open to anyone. Paint here ages and cures where you left it rather than being painted over.',
		stack: 'Vanilla JS, zero dependencies',
	},
	{
		id: 'bleep',
		shipped: '2026-11',
		name: 'Bleep',
		kind: 'word game',
		href: 'https://bleep.futile.studio',
		cta: 'Play it',
		mount: 'clip',
		art: 'door',
		desc: 'Think alike. Speak in code. A multiplayer word-deduction game.',
		stack: 'React 19, Express, Socket.IO',
	},
	{
		id: 'curio',
		shipped: '2026-11',
		name: 'Curio',
		kind: 'auction game',
		href: 'https://curio.futile.studio',
		cta: 'Play it',
		mount: 'corner',
		art: 'crate',
		desc: 'A contemporary art auction for 3 to 5 players. Real museum paintings, five invented artists, four rounds, one market that keeps changing its mind.',
		stack: 'React 19, Express, Socket.IO',
	},
	{
		id: 'avalon',
		shipped: '2026-11',
		name: 'Avalon',
		kind: 'social deduction',
		href: 'https://avalon.futile.studio',
		cta: 'Play it',
		mount: 'tape',
		art: 'door',
		desc: 'A real-time social deduction game for 5 to 10 players. Loyalty is a lie.',
		stack: 'React 19, Express, Socket.IO, Zustand',
	},
];

/** Half-built. On the board so the page is not only the flattering half. */
export const workbench = [];

/** Everything on the board, in one list, for counts and the log. */
export const projects = open;
