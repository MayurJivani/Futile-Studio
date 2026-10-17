/**
 * The Futile Post: every collectible stamp in the Field Guide, in one place.
 *
 * Three things are kept apart on purpose:
 *   - the artwork lives in `StampArt.astro`, keyed by `motif`;
 *   - how a stamp is earned lives here, as `unlock` (prose for the visitor)
 *     plus whatever on the page carries `data-clue="<id>"`;
 *   - whether this visitor has it lives in `src/lib/guide.js`.
 * Adding a stamp is one entry here and, if it is hidden somewhere, one
 * `data-clue` attribute there. Nothing in the Field Guide needs rewriting.
 *
 * Ids are the ones progress was already stored under (`p-<project>` and the
 * clue names), so nobody's collection resets with the redesign. A project can
 * have more stamps later: give the new one its own id and `project`.
 *
 * `where` names the place on the studio map the stamp belongs to.
 * Palettes are [paper, ink, accent], drawn from the site's own tokens.
 */

const FOREST = '#1f3a2c';
const INK = '#1b2132';
const RED = '#c4402a';
const LIME = '#b7d43c';
const OCHRE = '#c98a2b';
const BLUE = '#2f5d8a';
const PAPER = '#f6f1e4';
const CREAM = '#efe6cf';

const opened = (name) => `Open ${name} from anywhere on the site, or find the stamp tucked into its spread.`;

export const stamps = [
	// ---- projects: the running things ----
	{
		id: 'p-patina',
		project: 'patina',
		title: 'Patina',
		motif: 'patina',
		palette: [PAPER, FOREST, OCHRE],
		format: 'portrait',
		denom: '4096',
		serial: 'FS-001',
		where: 'work',
		note: 'Greetings from a canvas that is a year old by the time it is finished. One pixel at a time, and every one of them is aging as you read this.',
		hint: 'Look along the edge of the Patina spread.',
		unlock: opened('Patina'),
	},
	{
		id: 'p-orbitle',
		project: 'orbitle',
		title: 'Orbitle',
		motif: 'orbitle',
		palette: [INK, CREAM, OCHRE],
		format: 'square',
		denom: '5.19',
		serial: 'FS-002',
		where: 'work',
		note: 'Written from somewhere past the Moon. Today’s question is how far out it goes; drag the marker and find out how wrong you were.',
		hint: 'Something is in orbit near the Orbitle screenshot.',
		unlock: opened('Orbitle'),
	},
	{
		id: 'p-noggin',
		project: 'noggin',
		title: "Noggin'",
		motif: 'noggin',
		palette: [INK, OCHRE, RED],
		format: 'landscape',
		denom: '1 BZ',
		serial: 'FS-003',
		where: 'work',
		note: 'Sent from a room full of phones and one big screen. Somebody buzzed in a millisecond before you did.',
		hint: 'The Noggin’ spread is hiding a ticket. Check under it.',
		unlock: opened("Noggin'"),
	},
	{
		id: 'p-chorusify',
		project: 'chorusify',
		title: 'Chorusify',
		motif: 'chorusify',
		palette: [PAPER, BLUE, RED],
		format: 'tall',
		denom: '10♪',
		serial: 'FS-004',
		where: 'work',
		note: 'Greetings from the daily music game. You heard two seconds and you were sure. You were not.',
		hint: 'The Chorusify phones have something stuck between them.',
		unlock: opened('Chorusify'),
	},
	{
		id: 'p-qno',
		project: 'qno',
		title: 'Qno',
		motif: 'qno',
		palette: [CREAM, BLUE, RED],
		format: 'portrait',
		denom: '|ψ⟩',
		serial: 'FS-005',
		where: 'work',
		note: 'Postmarked from a superposition. This card is both a +2 and a skip until somebody looks at it.',
		hint: 'One of the Qno cards is not a card.',
		unlock: opened('Qno'),
	},
	{
		id: 'p-knock',
		project: 'knock',
		title: 'Knock',
		motif: 'knock',
		palette: [PAPER, INK, LIME],
		format: 'square',
		denom: '18kHz',
		serial: 'FS-006',
		where: 'work',
		note: 'Delivered by a sound you could not hear. Your phone stayed in your pocket the whole time.',
		hint: 'Listen near the Knock spread. Or just look closely.',
		unlock: opened('Knock'),
	},
	{
		id: 'p-mosaic',
		project: 'mosaic',
		title: 'Mosaic',
		motif: 'mosaic',
		palette: [FOREST, LIME, PAPER],
		format: 'landscape',
		denom: 'LIVE',
		serial: 'FS-007',
		where: 'work',
		note: 'Greetings from a stream overlay. A mod dropped this onto the broadcast while the streamer kept playing.',
		hint: 'A tile in the Mosaic spread is the wrong shape.',
		unlock: opened('Mosaic'),
	},
	{
		id: 'p-borderline',
		project: 'borderline',
		title: 'Borderline',
		motif: 'borderline',
		palette: [CREAM, FOREST, RED],
		format: 'landscape',
		denom: '0 km',
		serial: 'FS-008',
		where: 'archive',
		note: 'From somewhere along a border you drew yourself. The real one was about forty kilometres to the left.',
		hint: 'Open Borderline from the archive.',
		unlock: 'Open Borderline from the archive.',
	},
	{
		id: 'p-cubby',
		project: 'cubby',
		title: 'Cubby',
		motif: 'cubby',
		palette: [PAPER, INK, OCHRE],
		format: 'square',
		denom: 'E2E',
		serial: 'FS-009',
		where: 'archive',
		note: 'This card was encrypted before it left. The post office only ever saw ciphertext.',
		hint: 'Read Cubby’s source from the archive.',
		unlock: 'Open Cubby’s source from the archive.',
	},

	// ---- clues: things found around the studio ----
	{
		id: 'explorer',
		title: 'Said hello',
		motif: 'explorer',
		palette: [PAPER, INK, RED],
		format: 'portrait',
		denom: 'HI',
		serial: 'FS-010',
		where: 'door',
		note: 'The explorer waves back. They have been standing at the door since the site went up.',
		hint: 'Somebody at the door would like a wave.',
		unlock: 'Click or tap the explorer at the entrance.',
	},
	{
		id: 'desk',
		title: 'Rearranged',
		motif: 'desk',
		palette: [CREAM, INK, OCHRE],
		format: 'portrait',
		denom: '1 NOTE',
		serial: 'FS-018',
		where: 'door',
		note: 'You moved something on somebody else’s desk. It will be exactly where you left it until you reload, and then it will not.',
		hint: 'One of the papers on the front desk is not stuck down.',
		unlock: 'Drag the yellow note on the front desk, or focus it and nudge it with the arrow keys.',
	},
	{
		id: 'lamp',
		title: 'Lights',
		motif: 'lamp',
		palette: [INK, LIME, OCHRE],
		format: 'tall',
		denom: '40W',
		serial: 'FS-011',
		where: 'door',
		note: 'Same paper, later in the evening. The lamp remembers which way you left it.',
		hint: 'There is a cord at the top of the page. Pull it.',
		unlock: 'Pull the lamp cord, or switch the lamp in the desk drawer.',
	},
	{
		id: 'log',
		title: 'Archivist',
		motif: 'log',
		palette: [CREAM, FOREST, OCHRE],
		format: 'landscape',
		denom: '2022',
		serial: 'FS-012',
		where: 'about',
		note: 'Every repository since October 2022, dated from git rather than from memory.',
		hint: 'Follow an entry on this year’s page of the log book.',
		unlock: 'Follow any linked entry on this year’s log book page to where it lives.',
	},
	{
		id: 'jinx',
		title: 'Back room',
		motif: 'jinx',
		palette: [INK, PAPER, LIME],
		format: 'square',
		denom: 'UP',
		serial: 'FS-013',
		where: 'backroom',
		note: 'Postmarked from a flat in Paderborn, where every project on this page is actually running.',
		hint: 'Go and meet the server, or look closely in the back room.',
		unlock: 'Visit the Jinx page, or find the stamp on the back room diagram.',
	},
	{
		id: 'vote',
		title: 'Had a say',
		motif: 'vote',
		palette: [PAPER, RED, INK],
		format: 'portrait',
		denom: 'IIII',
		serial: 'FS-014',
		where: 'studio',
		note: 'Your mark is on the board with everybody else’s. Nobody knows which one is yours.',
		hint: 'Mark a tally in the shared studio.',
		unlock: 'Vote on an idea in the shared studio.',
	},
	{
		id: 'toys',
		title: 'Fidget',
		motif: 'toys',
		palette: [CREAM, RED, FOREST],
		format: 'square',
		denom: '✂',
		serial: 'FS-015',
		where: 'contact',
		note: 'You found the things on the desk. They do nothing useful, which is the point of them.',
		hint: 'The desk at the bottom has tools on it.',
		unlock: 'Use one of the tools on the closing desk.',
	},
	{
		id: 'wink',
		title: 'Small print',
		motif: 'wink',
		palette: [PAPER, INK, RED],
		format: 'tall',
		denom: '?',
		serial: 'FS-016',
		where: 'contact',
		note: 'Named in a mood. Kept out of habit. Now you know.',
		hint: 'The footer admits where the name came from.',
		unlock: 'Click the line in the footer about the name.',
	},
	{
		id: 'post',
		title: 'Last post',
		motif: 'post',
		palette: [FOREST, PAPER, RED],
		format: 'landscape',
		denom: 'FIN',
		serial: 'FS-017',
		edition: 'Special edition',
		where: 'contact',
		note: 'You read all the way to the bottom of a portfolio. That alone deserves a stamp.',
		hint: 'Post something at the very end of the page.',
		unlock: 'Press Post it at the end of the page, or send a postcard from the postcard desk.',
	},
];

export const stampById = Object.fromEntries(stamps.map((s) => [s.id, s]));

/** Places on the studio map, in walking order. Anchors are real sections. */
export const places = [
	{ id: 'door', name: 'The door', href: '#top' },
	{ id: 'work', name: 'Selected work', href: '#work' },
	{ id: 'archive', name: 'The archive', href: '#archive' },
	{ id: 'about', name: 'The journal', href: '#about' },
	{ id: 'backroom', name: 'Back room', href: '#backroom' },
	{ id: 'studio', name: 'Shared studio', href: '#studio' },
	{ id: 'contact', name: 'Post office', href: '#contact' },
];
