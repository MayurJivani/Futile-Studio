/**
 * Pixel grids: rows of characters, one per cell. Kept free of any framework so
 * the self-check can run it under plain node.
 */

/** Merge each row into runs of one colour: [x, y, length, fill]. */
export function runs(rows, palette) {
	const out = [];
	rows.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			const c = row[x];
			let n = 1;
			while (row[x + n] === c) n++;
			if (palette[c]) out.push([x, y, n, palette[c]]);
			x += n;
		}
	});
	return out;
}

/** A symmetric sprite from its left half: each row is mirrored onto itself. */
export const mirror = (half) => half.map((r) => r + [...r].reverse().join(''));

/** A blank w x h grid filled with one character, as mutable rows of cells. */
export const grid = (w, h, fill) => Array.from({ length: h }, () => Array(w).fill(fill));

/** Stamp a sprite onto a grid at (x, y). Spaces in the sprite are left alone. */
export function paint(g, sprite, x, y) {
	sprite.forEach((row, dy) =>
		[...row].forEach((c, dx) => {
			if (c !== ' ' && g[y + dy] && g[y + dy][x + dx] !== undefined) g[y + dy][x + dx] = c;
		}),
	);
}

export const toRows = (g) => g.map((r) => r.join(''));
