/**
 * The postcard desk at /post: the kinds of mail, their stamps and prompts,
 * the papers and inks, and the postmarks the cancellation cycles through.
 *
 * The stamp notes are fiction, and the page says so. Everything a card is
 * made of here is stored with it, so /mailbox and /track draw it again
 * exactly as it was sent.
 */

export const STUDIO_EMAIL = 'mayur@futile.studio';
export const MAX_CHARS = 500;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const kinds = [
	{
		id: 'hello',
		label: 'Hello',
		greeting: 'Greetings from the studio',
		klass: 'First class, friendly',
		stamp: { id: 'pc-hello', title: 'Hello', motif: 'explorer', palette: ['#f6f1e4', '#1b2132', '#c4402a'], format: 'portrait', denom: 'HI', serial: 'PC-01' },
		lore: { issued: '1 March 2026', edition: 'First issue, unlimited', story: 'Printed the week the studio opened its door, for anybody who wanted to say they had been by. The explorer on it has been waving ever since.' },
		prompts: ['What brought you here?', 'Which project did you open first?', 'Say hello. That is the whole assignment.', 'What are you building at the moment?'],
	},
	{
		id: 'idea',
		label: 'Strange Idea',
		greeting: 'Wish this existed',
		klass: 'Priority: whenever, probably later',
		stamp: { id: 'pc-idea', title: 'Strange idea', motif: 'lamp', palette: ['#1b2132', '#c6e84a', '#c98a2b'], format: 'tall', denom: '?!', serial: 'PC-02' },
		lore: { issued: '1 April 2026', edition: 'Second issue, printed slightly crooked', story: 'Issued for ideas that sound pointless at first. Half of the studio started as one of these, which is either encouraging or a warning.' },
		prompts: ['A game you wish existed', 'Something small that should be a website', 'A pointless tool you would actually use', 'What would you do with a shared canvas for a year?'],
	},
	{
		id: 'collab',
		label: 'Collaboration',
		greeting: 'Shall we make something',
		klass: 'Registered, needs a reply',
		stamp: { id: 'pc-collab', title: 'Together', motif: 'toys', palette: ['#efe6cf', '#2f5d8a', '#c4402a'], format: 'square', denom: '2×', serial: 'PC-03' },
		lore: { issued: '1 June 2026', edition: 'Joint issue, two inks', story: 'The only stamp in the set printed by two presses at once. They disagreed about the blue, so it is both.' },
		prompts: ['What would we build together?', 'The problem, in one sentence', 'Where you work and what you need', 'A deadline, if there is one, and how serious it is'],
	},
	{
		id: 'bug',
		label: 'Bug Report',
		greeting: 'Found something broken',
		klass: 'Express, handle with care',
		stamp: { id: 'pc-bug', title: 'Bug found', motif: 'jinx', palette: ['#1b2132', '#ece4d2', '#c4402a'], format: 'square', denom: '404', serial: 'PC-04' },
		lore: { issued: '13 October 2026', edition: 'Errata edition', story: 'Named for the cat, who is responsible for most of the unplanned downtime, and issued to everyone who has politely pointed out the rest.' },
		prompts: ['Which page, and what happened?', 'What did you expect instead?', 'Browser, device, and how to make it happen again', 'Was it the cat?'],
	},
	{
		id: 'thanks',
		label: 'Thank You',
		greeting: 'With many thanks',
		klass: 'Second class, entirely sincere',
		stamp: { id: 'pc-thanks', title: 'Thanks', motif: 'desk', palette: ['#efe6cf', '#1b2132', '#c4402a'], format: 'portrait', denom: 'TY', serial: 'PC-05' },
		lore: { issued: '28 October 2026', edition: 'Short run, hand cancelled', story: 'Printed for the people who write in only to say something was nice. There are more of them than anyone expected, so the press is kept warm.' },
		prompts: ['What made your day a bit better?', 'Which project should get a thank you?', 'Thank somebody. It does not have to be the studio.', 'Something small you noticed and liked'],
	},
	{
		id: 'wish',
		label: 'Wish You Were Here',
		greeting: 'Wish you were here',
		klass: 'Surface mail, the scenic route',
		stamp: { id: 'pc-wish', title: 'Far away', motif: 'orbitle', palette: ['#1b2132', '#efe6cf', '#c98a2b'], format: 'landscape', denom: 'GO', serial: 'PC-06' },
		lore: { issued: '28 October 2026', edition: 'Travel issue, airmail rate', story: 'For cards written somewhere else. The studio cannot go anywhere, being a website, so it collects the views instead.' },
		prompts: ['Where are you writing from?', 'What can you see from where you are?', 'The weather, in one sentence', 'Somewhere everyone should go once'],
	},
];

/* The picture side. Any design can carry a photo; 'photo' gives it the whole card. */
export const designs = [
	{ id: 'classic', label: 'Classic' },
	{ id: 'letters', label: 'Big letters' },
	{ id: 'night', label: 'Night' },
	{ id: 'blueprint', label: 'Blueprint' },
	{ id: 'photo', label: 'Photo' },
];

export const papers = [
	{ id: 'cream', label: 'Cream card' },
	{ id: 'kraft', label: 'Kraft' },
	{ id: 'airmail', label: 'Airmail' },
	{ id: 'graph', label: 'Graph paper' },
];

export const inks = [
	{ id: 'navy', label: 'Blue-black', color: '#1b2a4a' },
	{ id: 'red', label: 'Vermilion', color: '#b13a25' },
	{ id: 'pencil', label: 'Pencil', color: '#55555c' },
	{ id: 'forest', label: 'Forest', color: '#1f3a2c' },
];

/* Each postmark lands at its own angle, so the same card always looks the same. */
export const postmarkTilt = [-12, 8, -6, 14, -15, 5];

/* What the cancellation says, in turn, each time it is pressed. */
export const postmarks = [
	['Paderborn', 'today'],
	['Nothing', 'matters'],
	['Build cool', 'shit anyway'],
	['Par avion', 'futile post'],
	['Opened by', 'the cat'],
	['Fragile', 'contains ideas'],
];
