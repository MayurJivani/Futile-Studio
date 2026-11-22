/**
 * The bits of the studio that are not a project's own copy: which drawer a
 * project lives in, where its source is, what the Field Guide asks of a
 * visitor, and what the shared studio can vote on.
 *
 * Kept apart from `projects.js` because that file is the admin page's seed and
 * these are not editable there.
 * shortcut: shelf and source are keyed by project id here rather than stored
 * per project, so a project added in /admin lands under "Experiments" with no
 * source link until it gets a line below. Move them into the projects table if
 * that starts happening often.
 */

/** The drawers the board can be filtered by. */
export const SHELVES = ['Games', 'Experiments', 'Tools'];

/** @type {Record<string, string>} */
export const shelfOf = {
	noggin: 'Games',
	haggle: 'Games',
	croon: 'Games',
	hunch: 'Games',
	chorusify: 'Games',
	bleep: 'Games',
	curio: 'Games',
	avalon: 'Games',
	patina: 'Experiments',
	knock: 'Experiments',
	mosaic: 'Tools',
};

/** Public repositories only. Private ones (Knock) get no link. */
/** @type {Record<string, string>} */
export const sourceOf = {
	patina: 'https://github.com/MayurJivani/Patina',
	noggin: 'https://github.com/MayurJivani/Noggin',
	mosaic: 'https://github.com/MayurJivani/Mosaic',
	chorusify: 'https://github.com/MayurJivani/Chorus',
	croon: 'https://github.com/MayurJivani/Croon',
	bleep: 'https://github.com/MayurJivani/Bleep',
	curio: 'https://github.com/MayurJivani/curio',
	avalon: 'https://github.com/MayurJivani/avalon',
};

/** Status words a stranger understands, mapped from the studio's own stamps. */
/** @param {{ shelf?: string, status?: string, href?: string }} p */
export function statusOf(p) {
	if (p.shelf === 'workbench' || p.status) {
		return (
			{ bench: 'Work in progress', monster: 'Experiment', homeless: 'Finished, no home', retired: 'Archived' }[
				p.status
			] ?? 'Work in progress'
		);
	}
	return p.href && !p.href.includes('github.com') ? 'Live' : 'Source only';
}

/**
 * What the shared studio can vote on next. The server imports this list and
 * refuses anything not on it, so a vote is never free text.
 */
export const ideas = [
	{ id: 'turntable', name: 'A turntable you can actually spin', note: 'for the record shelf in /collection' },
	{ id: 'pets', name: 'Studio pets, from scratch', note: 'the old ones were taken out back' },
	{ id: 'field', name: 'Open up the field', note: 'the ASCII world, currently behind a locked door' },
];

/**
 * The featured spreads, in page order. Each gets its own layout (`variant`)
 * so no two read alike, and real screenshots of the running product, captured
 * from the live sites (public/shots). Annotations only restate what the
 * project's own description or screenshot shows.
 */
export const featured = [
	{
		id: 'chorusify',
		variant: 'phones',
		shot: { src: 'shots/chorusify-d.webp', alt: 'Chorusify’s home screen: Guess your favourite music, with Artist Mode, Multiplayer, Categories, Survival, Guess the Year, Duels and the daily challenge.' },
		phone: { src: 'shots/chorusify-m.webp', w: 430, h: 932, alt: 'An Artist Mode round on a phone: Peter Cat Recording Co., song 1 of 10, a one-second clip playing, and three of their songs to choose from.' },
		note: 'one second of a song, three guesses',
	},
	{
		id: 'noggin',
		variant: 'poster',
		shot: { src: 'shots/noggin-d.webp', w: 1280, h: 720, alt: 'Noggin’ on the big screen: round one of a demo quiz, five categories (Capitals, Planets, Elements, Instruments, Oceans) with 200 to 1000 point tiles, and three players on zero along the bottom.' },
		phone: { src: 'shots/noggin-m.webp', w: 430, h: 932, alt: 'A player’s phone in the same room: one enormous BUZZ button, Asha’s score in the corner and a phone-a-friend lifeline.' },
		note: 'the TV is the board, every phone is a buzzer',
	},
	{
		id: 'haggle',
		variant: 'vivid',
		shot: { src: 'shots/haggle-d.webp', alt: 'Haggle’s floor: a ticker of simulated prices across the top, the line “a live stock market for the whole room”, and the biggest movers of the last round, INTC up 26% and UBER down 13%.' },
		note: 'same prices, same news, one clock',
	},
	{
		id: 'croon',
		variant: 'sheet',
		shot: { src: 'shots/croon-d.webp', alt: 'Croon’s lounge: a cassette deck with a karaoke video queued and its lyric line on screen, a room code to join, and Sing it loud with Start a room and Sing solo beside it.' },
		note: 'the TV is the stage, the phone is the mic',
	},
	{
		id: 'hunch',
		variant: 'offset',
		shot: { src: 'shots/hunch-d.webp', alt: 'Hunch’s floating island of hex tiles, forest, mountain, water and desert, under the line Follow the clues. Find the creature.' },
		note: 'each of you knows one thing about where',
	},
	{
		id: 'knock',
		variant: 'paper',
		shot: { src: 'shots/knock-d.webp', alt: 'Knock’s host screen broadcasting room r7d3: the Broadcast button lit, volume at 0.6, 990ms per frame with the nonce rotating every 5 seconds.' },
		phone: { src: 'shots/knock-m.webp', w: 430, h: 932, alt: 'A phone listening: the live spectrum between 17 and 19.5 kHz with the eight data tones, and room r7d3 received three times at a 17 dB margin.' },
		note: 'one screen sounds it, every phone hears the room',
	},
	{
		id: 'mosaic',
		variant: 'crop',
		shot: { src: 'shots/mosaic-d.webp', alt: 'Mosaic’s mod board: the stream preview, four layers (a text callout and three emoji), and the 16:9 stage they sit on.' },
		live: {
			src: 'shots/mosaic-live.webp',
			still: 'shots/mosaic-live-still.webp',
			alt: 'A mod placing things on the stage in sequence: the text callout “breath, it’s just a stream”, then a party popper, a fire and a crown dragged into place.',
		},
		note: 'a mod drags it on, the stream has it',
	},
];

/** Real captures for the archive thumbnails, where a project has one. */
/** @type {Record<string, string>} */
export const thumbOf = {
	bleep: 'shots/bleep-d.webp',
	curio: 'shots/curio-d.webp',
	avalon: 'shots/avalon-d.webp',
	patina: 'shots/patina-d.webp',
	...Object.fromEntries(featured.map((f) => [f.id, f.shot.src])),
};
