/**
 * The two pieces of pixel art on the site, drawn on fixed grids with small
 * palettes. Shapes are placed by hand; dithering and the moon are the only
 * things computed, and both are fixed patterns, never random, so every build
 * draws the same picture.
 */
import { grid, paint, toRows, mirror } from '../lib/pixels.js';

/* ---------------------------------------------------------------- Jinx ----
   The cat the server is named after, head and shoulders, 20 x 18. Drawn from
   the left half and mirrored. The colours are the back room's, not a claim
   about the cat's. */
export const jinxPalette = {
	k: '#141820', // outline
	g: '#3a4152', // fur
	h: '#56607a', // fur, lit
	i: '#c97b6b', // inside the ears
	e: '#c6e84a', // eyes, in the studio's one acid note
	p: '#0b0e14', // pupils
	n: '#e3a3a0', // nose
	w: '#ece4d2', // whiskers
};
export const jinxCat = mirror([
	'..kk......',
	'..kik.....',
	'..kiik....',
	'..kgiikkkk',
	'.kgggggggg',
	'.kgghhgggg',
	'kgghhggggg',
	'kgggkkkggg',
	'kggkeepkgg',
	'kggkeeekgg',
	'kgggkkkggg',
	'kggggggggn',
	'kwwwggggkg',
	'kgggggggkk',
	'.kgggggggg',
	'..kggggggg',
	'...kkggggg',
	'.....kkkkk',
]);

/* -------------------------------------------------------------- Patina ----
   A corner of the shared canvas, 64 x 40, the same 1.6 ratio as a screenshot
   slot: a night landscape several hands have painted at once. A house and a
   tree, a lake under the moon, somebody's heart and somebody's HI, and where
   two of them meet the paint has been fought over and oxidised, rust on the
   warm side and verdigris on the cool, which is the thing Patina is about. */
export const patinaPalette = {
	'0': '#0a1424', // sky, top
	'1': '#10203a', // sky, middle
	'2': '#1a3256', // sky, horizon
	'*': '#f1e6c8', // stars
	m: '#f1e6c8', // moon
	M: '#c9bc98', // moon, shaded
	a: '#2b3f66', // far ridge
	b: '#18263f', // near hills
	g: '#1e3a2b', // grass
	G: '#2f5d3a', // grass, lit
	w: '#122b49', // water
	W: '#3c6ea8', // water, catching light
	h: '#c4402a', // house
	R: '#6b2a1f', // roof
	y: '#f0d36b', // lit window
	d: '#1b1110', // door, trunk shadow
	t: '#2f7d3a', // leaves
	T: '#5a3b2a', // trunk
	p: '#e86a8a', // the heart
	l: '#c6e84a', // the HI
	r: '#a4532f', // rust
	v: '#4f9a8a', // verdigris
};

const W = 64;
const H = 40;
const g = grid(W, H, '0');
const put = (x, y, c) => {
	if (g[y] && g[y][x] !== undefined) g[y][x] = c;
};

/* Sky in three bands, with a two-row checker dither between them. */
for (let y = 0; y < 26; y++) {
	for (let x = 0; x < W; x++) {
		const band = y < 8 ? '0' : y < 15 ? '1' : '2';
		const dither = (y === 7 || y === 8) && (x + y) % 2 ? '1' : (y === 14 || y === 15) && (x + y) % 2 ? (y === 14 ? '2' : '1') : band;
		put(x, y, dither);
	}
}

/* Stars, placed. */
for (const [x, y] of [[4, 2], [11, 5], [17, 1], [23, 4], [29, 2], [35, 6], [41, 1], [58, 3], [61, 9], [7, 9], [27, 10], [38, 11], [14, 12]]) put(x, y, '*');

/* The moon: a disc of radius 5 with its lower right in shade. */
for (let y = 0; y < 12; y++) {
	for (let x = 44; x < 58; x++) {
		const dx = x - 50.5;
		const dy = y - 5.5;
		if (dx * dx + dy * dy <= 22) put(x, y, dx + dy > 3 ? 'M' : 'm');
	}
}

/* Far ridge then near hills, from height maps drawn column by column. */
const ridge = [18, 17, 16, 15, 15, 14, 14, 15, 16, 16, 17, 16, 15, 14, 13, 13, 12, 13, 14, 15, 16, 17, 17, 18, 18, 17, 16, 15, 15, 16, 17, 18, 19, 19, 18, 17, 16, 16, 15, 14, 14, 15, 16, 17, 18, 18, 19, 19, 18, 17, 17, 16, 16, 17, 17, 18, 19, 19, 20, 20, 19, 19, 20, 20];
const hills = [22, 22, 21, 21, 21, 20, 20, 20, 21, 21, 22, 22, 22, 23, 23, 23, 22, 22, 21, 21, 21, 22, 22, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 23, 23, 22, 22, 21, 21, 21, 20, 20, 20, 21, 21, 22, 22, 22, 23, 23, 22, 22, 22, 23];
for (let x = 0; x < W; x++) {
	for (let y = ridge[x]; y < 26; y++) put(x, y, 'a');
	for (let y = hills[x]; y < 26; y++) put(x, y, 'b');
}

/* Ground. */
/* Ground: a lit edge along the top and tufts on a regular stagger. */
for (let y = 26; y < H; y++) for (let x = 0; x < W; x++) put(x, y, (y === 26 && x % 4 !== 0) || (y > 29 && y % 3 === 0 && (x + y * 2) % 8 === 0) ? 'G' : 'g');

/* The lake, with the moon's reflection broken into dashes. */
const lake = [[26, 22, 44], [27, 19, 47], [28, 18, 48], [29, 18, 48], [30, 19, 47], [31, 21, 45], [32, 24, 42]];
for (const [y, x0, x1] of lake) for (let x = x0; x < x1; x++) put(x, y, (x + y * 4) % 13 === 0 ? 'W' : 'w');
for (const [y, x0, x1] of [[27, 30, 34], [28, 31, 33], [29, 29, 35], [30, 31, 34], [31, 32, 33]]) for (let x = x0; x < x1; x++) put(x, y, 'W');

/* Somebody's house. */
paint(
	g,
	[
		'    RR    ',
		'   RRRR   ',
		'  RRRRRR  ',
		' RRRRRRRR ',
		'RRRRRRRRRR',
		' hhhhhhhh ',
		' hyyhhhdh ',
		' hyyhhhdh ',
		' hhhhhhdh ',
	],
	4,
	18,
);

/* Somebody else's tree. */
paint(
	g,
	[
		'  ttt  ',
		' ttttt ',
		'ttttttt',
		'ttttttt',
		' ttttt ',
		'  dTd  ',
		'   T   ',
		'   T   ',
	],
	53,
	19,
);

/* A heart in the corner, and the seam where it was painted over the grass
   for a week: rust where warm paint was fought over, verdigris on the cool. */
paint(
	g,
	[
		' pp pp ',
		'ppppppp',
		'ppppppp',
		' ppppp ',
		'  ppp  ',
		'   p   ',
	],
	3,
	31,
);

/* And an HI, in three-wide letters, by a third painter. */
paint(
	g,
	[
		'l l  lll',
		'l l   l ',
		'lll   l ',
		'l l   l ',
		'l l  lll',
	],
	48,
	32,
);

/* Where paint has been fought over it oxidises: a dithered halo traced round
   each claim, rust round the warm heart, verdigris round the cool HI. */
const halo = (inside, ink) => {
	const near = [];
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++)
			if (g[y][x] === 'g' || g[y][x] === 'G')
				if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] === inside) && (x + y) % 2 === 0) near.push([x, y]);
	near.forEach(([x, y]) => put(x, y, ink));
};
halo('p', 'r');
halo('l', 'v');

export const patinaScene = toRows(g);

/* The newest cell on the canvas, still wet: the one the page may blink. */
export const patinaWet = { x: 11, y: 24 };

/* ------------------------------------------------------------ postcards ----
   One small picture per kind of mail, 16 x 16, drawn from the left half. */
export const postcardPalette = {
	k: '#1b2132',
	y: '#f0d36b',
	o: '#e09a4a',
	r: '#c4402a',
	w: '#fbf9f4',
	g: '#8a8f9c',
	b: '#2f5d8a',
};
export const postcardSprites = {
	/* a sun that says hello */
	hello: mirror([
		'........',
		'.......y',
		'..y....y',
		'...y....',
		'.....kkk',
		'....kooo',
		'...koooo',
		'yy.kokoo',
		'...koooo',
		'...kooko',
		'....kokk',
		'.....kkk',
		'..y.....',
		'.y.....y',
		'.......y',
		'........',
	]),
	/* a bulb, with two sparks */
	idea: mirror([
		'........',
		'.r...kkk',
		'r...kyyy',
		'...kyyyy',
		'...kyywy',
		'...kyyyy',
		'...kyyyy',
		'....kyyy',
		'.....kyy',
		'.....kyy',
		'.....ggg',
		'.....kkk',
		'.....ggg',
		'......kk',
		'........',
		'........',
	]),
	/* two pencils, crossed */
	collab: mirror([
		'rr......',
		'.rr.....',
		'..yy....',
		'...yy...',
		'....yy..',
		'.....yy.',
		'......yy',
		'.......y',
		'.......y',
		'......yy',
		'.....yy.',
		'....yy..',
		'...yy...',
		'..oo....',
		'.ko.....',
		'k.......',
	]),
	/* a beetle, found in the works */
	bug: mirror([
		'....k...',
		'.....k..',
		'......kk',
		'...k.kkk',
		'....krrr',
		'..kkrrrr',
		'....rrkr',
		'..kkrrrr',
		'....rrrk',
		'..kkrkrk',
		'....rrrk',
		'.....rrk',
		'......kk',
		'........',
		'........',
		'........',
	]),
};
