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

/** The four drawers the board can be filtered by. */
export const SHELVES = ['Games', 'Experiments', 'Tools', 'Systems'];

/** @type {Record<string, string>} */
export const shelfOf = {
	borderline: 'Games',
	orbitle: 'Games',
	noggin: 'Games',
	qno: 'Games',
	chorusify: 'Games',
	hunch: 'Games',
	patina: 'Experiments',
	knock: 'Experiments',
	murmur: 'Experiments',
	mosaic: 'Tools',
	atlas: 'Tools',
	cubby: 'Systems',
	uauth: 'Systems',
};

/** Public repositories only. Private ones (Knock, Murmur) get no link. */
/** @type {Record<string, string>} */
export const sourceOf = {
	patina: 'https://github.com/MayurJivani/Patina',
	orbitle: 'https://github.com/MayurJivani/Orbitle',
	noggin: 'https://github.com/MayurJivani/Noggin',
	qno: 'https://github.com/MayurJivani/Qno-web',
	mosaic: 'https://github.com/MayurJivani/Mosaic',
	chorusify: 'https://github.com/MayurJivani/Chorus',
	cubby: 'https://github.com/MayurJivani/Cubby',
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
	{ id: 'murmur', name: 'Finish Murmur', note: 'one sound field across a pile of phones' },
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
		id: 'patina',
		variant: 'dark',
		/* the spread leads with a drawing made the way Patina is painted; the
		   phone beside it is the running product, and the archive keeps the
		   screenshot as its thumbnail */
		art: 'patina',
		shot: { src: 'shots/patina-d.webp', alt: 'Patina in the browser, running locally on its own demo seed: a year of painted districts, weathered and oxidised along their seams, with the cell inspector, the year timeline and the palette.' },
		phone: { src: 'shots/patina-m.webp', w: 430, h: 932, alt: 'Patina on a phone, zoomed into the same seeded canvas, with the inspector showing a cell three layers deep and fully cured.' },
		note: 'paint here ages and cures',
	},
	{
		id: 'orbitle',
		variant: 'offset',
		shot: { src: 'shots/orbitle-d.webp', alt: 'Orbitle mid-round: rings drawn around a planet, with the question about how far out a moon orbits beside them.' },
		note: 'drag the marker to the ring',
	},
	{
		id: 'noggin',
		variant: 'poster',
		shot: { src: 'shots/noggin-d.webp', w: 1280, h: 720, alt: 'Noggin’ on the big screen: round one of a demo quiz, five categories (Capitals, Planets, Elements, Instruments, Oceans) with 200 to 1000 point tiles, and three players on zero along the bottom.' },
		phone: { src: 'shots/noggin-m.webp', w: 430, h: 932, alt: 'A player’s phone in the same room: one enormous BUZZ button, Asha’s score in the corner and a phone-a-friend lifeline.' },
		note: 'the TV is the board, every phone is a buzzer',
	},
	{
		id: 'chorusify',
		variant: 'phones',
		shot: { src: 'shots/chorusify-d.webp', alt: 'Chorusify’s home screen: Guess your favourite music, with Artist Mode, Multiplayer, Categories, Survival, Guess the Year, Duels and the daily challenge.' },
		phone: { src: 'shots/chorusify-m.webp', w: 430, h: 932, alt: 'An Artist Mode round on a phone: Peter Cat Recording Co., song 1 of 10, a one-second clip playing, and three of their songs to choose from.' },
		note: 'one second of a song, three guesses',
	},
	{
		id: 'qno',
		variant: 'vivid',
		shot: { src: 'shots/qno-d.webp', alt: 'Qno’s landing page: Quantum-Based UNO Game, over a fan of coloured cards.' },
		note: 'the cards are quantum gates',
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
	borderline: 'shots/borderline-d.webp',
	atlas: 'shots/atlas-d.webp',
	hunch: 'shots/hunch-d.webp',
	cubby: 'shots/cubby-d.webp',
	...Object.fromEntries(featured.map((f) => [f.id, f.shot.src])),
};
