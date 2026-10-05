/**
 * Everything pasted onto the board, and the dates the shipping log reads.
 *
 * `shipped` is deliberately allowed to be missing or coarse: 'YYYY-MM' when the
 * month is known, 'YYYY' when only the year is, and absent when neither was
 * written down. The log places month-precise entries on their month, drops
 * year-only ones into the loose tray, and counts the undated rest rather than
 * guessing, which on a portfolio would be inventing a fact.
 *
 * `mount` is assigned by hand, never randomised. A mix of pin, tape, clip and
 * photo corners reads as deliberate; a random one reads as noise. (Guideline B)
 */

/** @type {Array<{id:string,name:string,kind:string,href?:string,cta:string,shipped?:string,mount:string,art:string,pick?:boolean,desc:string,stack:string}>} */
export const open = [
	{
		id: 'patina',
		name: 'Patina',
		kind: 'canvas',
		href: 'https://patina.futile.studio/',
		cta: 'Open it',
		shipped: '2026',
		mount: 'corner',
		art: 'patina',
		pick: true,
		desc: 'A shared 4096×4096 canvas that stays open for a full year, one pixel at a time, no account needed. Unlike r/place nothing here gets overwritten: paint ages and cures where you left it.',
		stack: 'Vanilla JS, zero dependencies',
	},
	{
		id: 'orbitle',
		name: 'Orbitle',
		kind: 'daily game',
		href: 'https://orbitle.futile.studio',
		cta: 'Play today',
		mount: 'pin',
		art: 'orbitle',
		pick: true,
		desc: 'A daily guessing game about orbits. Five rounds: how far out a thing orbits, how long one lap takes, how fast it is moving. Drag the marker to the ring you think is right, and the angle is pure decoration.',
		stack: 'Astro, no backend, 23 tests',
	},
	{
		id: 'noggin',
		name: "Noggin'",
		kind: 'party game',
		href: 'https://noggin.futile.studio',
		cta: 'Play it',
		shipped: '2026',
		mount: 'tape',
		art: 'noggin',
		desc: 'A TV quiz show for a room full of phones. Picture, audio and video clues, millisecond buzzer racing, teams and lifelines, and no hardware beyond what people walked in with.',
		stack: 'Astro, React, WebSockets',
	},
	{
		id: 'drowned-parish',
		name: 'The Drowned Parish',
		kind: 'social deduction',
		href: 'https://15mm.futile.studio',
		cta: 'Play it',
		mount: 'pin',
		art: 'parish',
		desc: 'No storyteller sitting the round out, no app to install. Just phones around a table and fifteen minutes of everyone lying to each other, with the rules keeping themselves.',
		stack: 'Astro, WebSockets',
	},
	{
		id: 'qno',
		name: 'Qno',
		kind: 'card game',
		href: 'https://qno.futile.studio/',
		cta: 'Play it',
		shipped: '2025-12',
		mount: 'clip',
		art: 'qno',
		pick: true,
		desc: 'Uno, except the cards are quantum gates. Superposition and entanglement arrive as hand mechanics you actually hold, which gets the idea across rather better than a lecture slide.',
		stack: 'React, Node, WebSockets',
	},
	{
		id: 'knock',
		name: 'Knock',
		kind: 'experiment',
		href: 'https://knock.futile.studio',
		cta: 'Try it',
		mount: 'tape',
		art: 'knock',
		pick: true,
		desc: 'Join a room by being in it. A sound nobody in the room can hear does the job a QR code usually does, so nobody has to point a camera at anything.',
		stack: 'Web Audio, vanilla JS',
	},
	{
		id: 'mosaic',
		name: 'Mosaic',
		kind: 'stream tool',
		href: 'https://mosaic.futile.studio/',
		cta: 'Open it',
		shipped: '2025',
		mount: 'pin',
		art: 'mosaic',
		desc: 'A live overlay that lets mods drop emotes, clips and sound onto a broadcast while the streamer keeps playing. No OBS scene juggling, and changes reach the viewer as they land.',
		stack: 'Astro, React, WebSockets',
	},
	{
		id: 'chorusify',
		name: 'Chorusify',
		kind: 'music game',
		href: 'https://chorusify.com',
		cta: 'Play it',
		shipped: '2024-01',
		mount: 'corner',
		art: 'chorus',
		desc: 'A Wordle-shaped daily music guessing game: daily, multiplayer and artist modes, a ten-song challenge and a leaderboard, with the clips playing in the browser rather than sending you elsewhere.',
		stack: 'React 18, TypeScript, Deezer Web API, Postgres',
	},
	{
		id: 'cubby',
		name: 'Cubby',
		kind: 'tool',
		href: 'https://github.com/MayurJivani/Cubby',
		cta: 'Read the source',
		mount: 'clip',
		art: 'cubby',
		desc: 'A drop box between your own devices. Encrypted in the browser before it leaves, so the thing in the middle only ever holds something it cannot read.',
		stack: 'Web Crypto, Node',
	},
];

/** Half-built. On the board so the page is not only the flattering half. */
export const workbench = [
	{
		id: 'uauth',
		name: 'UAuth',
		kind: 'research',
		mount: 'corner',
		art: 'cubby',
		desc: 'A university project group comparing how people actually cope with four ways of proving who they are: passwords, WebAuthn passkeys, biometric face recognition and the EU Digital Identity Wallet. Run as a full Scrum process, which is its own kind of experiment.',
		stack: 'React, TypeScript, Express',
	},
	{
		id: 'chorus-place',
		name: 'Chorus Place',
		kind: 'instrument',
		mount: 'clip',
		art: 'patina',
		desc: "r/place with instruments instead of pixels. A 32x16 grid that never stops playing, two bars at 100bpm on a downbeat everyone shares, and the only way to clear somebody's note is to put your own where it was. Finished, but it has nowhere to live yet.",
		stack: 'Node, WebSockets, Web Audio',
	},
	{
		id: 'sextant',
		name: 'Sextant',
		kind: 'positioning',
		mount: 'pin',
		art: 'sextant',
		desc: 'Phones working out where they are by listening to each other. The maths is settled; turning it into something that survives a real room is not.',
		stack: 'Web Audio, time-of-flight',
	},
	{
		id: 'murmur',
		name: 'Murmur',
		kind: 'audio',
		mount: 'tape',
		art: 'murmur',
		desc: 'One sound field rendered across a pile of phones scattered round a room. The capstone of the audio work, and gated on Sextant knowing where each phone is.',
		stack: 'Web Audio, WebRTC',
	},
];

/** Everything on the board, in one list, for counts and the log. */
export const projects = open;

/** Month-precise entries, for the log's calendar strip. */
export const dated = open.filter((p) => p.shipped?.includes('-'));

/** Year-only entries, for the log's loose tray. */
export const undated = open.filter((p) => p.shipped && !p.shipped.includes('-'));

/** No date written down at all. Counted, never placed. */
export const unlogged = open.filter((p) => !p.shipped);
