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
		id: 'borderline',
		name: 'Borderline',
		kind: 'daily game',
		href: 'https://borderline.futile.studio',
		cta: 'Play today',
		shipped: '2026-01',
		mount: 'tape',
		art: 'postcard',
		pick: true,
		desc: 'Five geography rounds a day that ask you to draw, not to name. Two neighbouring countries arrive as one landmass with the border missing and you draw where you think it runs, or a city is named and you click where it sits. The reveal lays the real answer over your guess and scores it in kilometres.',
		stack: 'Astro, React, static, 29 tests',
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
		pick: true,
		desc: 'A shared 4096×4096 canvas that stays open for a full year, one pixel at a time, open to anyone. Paint here ages and cures where you left it rather than being painted over.',
		stack: 'Vanilla JS, zero dependencies',
	},
	{
		id: 'orbitle',
		shipped: '2026-10',
		name: 'Orbitle',
		kind: 'daily game',
		href: 'https://orbitle.futile.studio',
		cta: 'Play today',
		mount: 'pin',
		art: 'orbitle',
		pick: true,
		desc: 'A daily guessing game about orbits. Five rounds: how far out a thing orbits, how long one lap takes, how fast it moves. Drag the marker to the ring you think is right; the angle is pure decoration.',
		stack: 'Astro, static, 23 tests',
	},
	{
		id: 'noggin',
		name: "Noggin'",
		kind: 'party game',
		href: 'https://noggin.futile.studio',
		cta: 'Play it',
		shipped: '2026-09',
		mount: 'tape',
		art: 'noggin',
		desc: 'A TV quiz show for a room full of phones. Picture, audio and video clues, millisecond buzzer racing, teams and lifelines, all on the hardware people walked in with.',
		stack: 'Astro, React, WebSockets',
	},
	{
		id: 'qno',
		name: 'Qno',
		kind: 'card game',
		href: 'https://qno.futile.studio/',
		cta: 'Play it',
		shipped: '2024-08',
		mount: 'clip',
		art: 'qno',
		pick: true,
		origin: 'Started as a C# desktop app in 2023. It worked, and nobody could play it without installing something.',
		desc: 'Uno, except the cards are quantum gates. Superposition and entanglement arrive as hand mechanics you actually hold, which gets the idea across rather better than a lecture slide.',
		stack: 'React, Node, WebSockets',
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
		id: 'cubby',
		shipped: '2026-10',
		name: 'Cubby',
		kind: 'tool',
		href: 'https://github.com/MayurJivani/Cubby',
		cta: 'Read the source',
		mount: 'clip',
		art: 'cubby',
		desc: 'A drop box between your own devices. Encrypted in the browser before it leaves, so the thing in the middle only ever holds ciphertext.',
		stack: 'Web Crypto, Node',
	},
];

/** Half-built. On the board so the page is not only the flattering half. */
export const workbench = [
	{
		id: 'uauth',
		name: 'UAuth',
		kind: 'research',
		status: 'bench',
		mount: 'corner',
		art: 'cubby',
		desc: 'A university project group comparing four ways of proving who you are: passwords, WebAuthn passkeys, face recognition and the EU Digital Identity Wallet. Run as a full Scrum process, which is its own kind of experiment.',
		stack: 'React, TypeScript, Express',
	},
	{
		id: 'murmur',
		name: 'Murmur',
		kind: 'audio',
		status: 'monster',
		mount: 'tape',
		art: 'murmur',
		desc: 'One sound field rendered across a pile of phones scattered round a room. The capstone of the audio work, and still waiting on the part that works out where each phone actually is.',
		stack: 'Web Audio, WebRTC',
	},
];

/** Everything on the board, in one list, for counts and the log. */
export const projects = open;
