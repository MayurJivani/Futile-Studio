/* The character set and the atlas it gets rasterised into.
 *
 * Everything the renderer draws is an index into ATLAS_CHARS, so the order of
 * that string is load-bearing: the ramps below are expressed as indices into
 * it and the shader does `glyph -> atlas cell` with nothing in between.
 */

/* Every glyph the world can draw, in one string. Index 0 is a space on
   purpose, so a zeroed instance buffer draws nothing. */
export const ATLAS_CHARS =
	' .,\'`^"~:;!|/\\-_=+<>()[]{}*#%&$@0123456789' +
	'abcdefghijklmnopqrstuvwxyz' +
	'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
	'│─┌┐└┘├┤┬┴┼' + // box drawing
	'░▒▓█' + // shade blocks, light to full
	'●○▪·';

const INDEX = new Map();
for (let i = 0; i < ATLAS_CHARS.length; i++) INDEX.set(ATLAS_CHARS[i], i);

/** Index of a character in the atlas. Unknown characters draw as blank. */
export function glyph(ch) {
	const i = INDEX.get(ch);
	return i === undefined ? 0 : i;
}

/** Turn a string into an array of atlas indices. */
export function glyphs(str) {
	const out = new Uint16Array(str.length);
	for (let i = 0; i < str.length; i++) out[i] = glyph(str[i]);
	return out;
}

/* ---------------------------------------------------------------- ramps --
 * Density ramps: index by brightness 0..1 and get a character whose ink
 * coverage matches. This is the whole tonal system, one ink, varying
 * coverage, which is why the palette stays small.
 */

const ramp = (str) => glyphs(str);

/** Generic light-to-dense ramp, used for terrain shading. */
export const RAMP_TONE = ramp(" .'`:;!|*#%&@█");

/** Grass blades. Ordered so that neighbouring indices read as a blade
    leaning a little further, which is what sells the wind. */
export const RAMP_GRASS = ramp(',;:!|/\\^"\'`');

/** Water, calm to choppy. */
export const RAMP_WATER = ramp('~-=─_░▒');

/** Tree and canopy mass, matching the reference's dense Q/O/&/@ foliage. */
export const RAMP_CANOPY = ramp('.oOQ08&@%#');

/** Trunk and structure glyphs. */
export const RAMP_TRUNK = ramp('|!][)(/\\');

/** Rain, by how close the drop is to the camera. */
export const RAMP_RAIN = ramp("'`:!|/");

/** Pick from a ramp by a 0..1 brightness, clamped at both ends. */
export function fromRamp(r, t) {
	const max = r.length - 1;
	const i = Math.round(t * max);
	/* Ordered so NaN falls through to 0 rather than indexing past the end:
	   an undefined glyph becomes NaN in the instance buffer and the shader
	   then draws garbage across the whole field. */
	return r[i >= 0 ? (i > max ? max : i) : 0];
}

/**
 * A name as this atlas can actually draw it.
 *
 * The atlas is latin plus box drawing, so a name the server correctly kept
 * (मयूर, さくら) would otherwise render as a row of blank cells, which reads as
 * a bug rather than as a person. Accented latin decomposes to its base letter;
 * a name with nothing drawable left falls back to a readable placeholder.
 *
 * shortcut: latin-only labels, because the atlas is latin-only. Upgrading means
 * rasterising per-name glyphs into a second atlas page on demand.
 */
export function labelFor(name) {
	const folded = String(name || '')
		.normalize('NFKD')
		.replace(/[^\x20-\x7e]/g, '')
		.trim();
	return (folded || 'traveller').slice(0, 14);
}

/* ---------------------------------------------------------------- atlas --
 * The atlas is one canvas holding every glyph in a fixed grid, uploaded once
 * as a texture. Cells are rendered white on transparent; the shader tints
 * them, so one atlas serves every colour in the world.
 */

export const ATLAS_COLS = 16;
export const ATLAS_ROWS = Math.ceil(ATLAS_CHARS.length / ATLAS_COLS);

/**
 * Rasterise the atlas at a given cell size.
 * Supersampled 2x then relied on linear filtering, because a glyph grid at
 * fractional device-pixel-ratios otherwise shimmers as the camera moves.
 *
 * @param {number} cw cell width in device pixels
 * @param {number} ch cell height in device pixels
 */
export function buildAtlas(cw, ch) {
	const ss = 2;
	const cvs = document.createElement('canvas');
	cvs.width = ATLAS_COLS * cw * ss;
	cvs.height = ATLAS_ROWS * ch * ss;
	const ctx = cvs.getContext('2d');

	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#fff';
	/* A face with a real blade-like slash and an unambiguous zero. The stack
	   falls through to whatever mono the machine has rather than failing. */
	ctx.font = `${Math.floor(ch * ss * 0.82)}px "DM Mono","JetBrains Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace`;

	for (let i = 0; i < ATLAS_CHARS.length; i++) {
		const col = i % ATLAS_COLS;
		const row = (i / ATLAS_COLS) | 0;
		ctx.fillText(
			ATLAS_CHARS[i],
			(col + 0.5) * cw * ss,
			(row + 0.52) * ch * ss, // 0.52 centres optically rather than by metrics
		);
	}
	return cvs;
}
