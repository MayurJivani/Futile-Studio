/* The world: terrain, wind, sky.
 *
 * Terrain is generated on demand from a hash rather than stored, so the map is
 * unbounded and every client agrees on it from the seed alone. That is what
 * lets multiplayer peers render each other's surroundings without the server
 * ever sending a tile.
 */

export const TILE = {
	GRASS: 0,
	WATER: 1,
	SAND: 2,
	TREE: 3,
	ROCK: 4,
	FLOWER: 5,
};

/* ---------------------------------------------------------------- noise -- */

/** Integer hash to [0,1). Deterministic across machines. */
export function hash2(x, y, seed) {
	let h = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 1442695040;
	h = (h ^ (h >>> 13)) >>> 0;
	h = Math.imul(h, 1274126177) >>> 0;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Value noise in [0,1]. */
function noise2(x, y, seed) {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = smooth(x - xi);
	const yf = smooth(y - yi);
	const a = hash2(xi, yi, seed);
	const b = hash2(xi + 1, yi, seed);
	const c = hash2(xi, yi + 1, seed);
	const d = hash2(xi + 1, yi + 1, seed);
	return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** Fractal noise, a few octaves. */
export function fbm(x, y, seed, octaves = 4) {
	let sum = 0;
	let amp = 0.5;
	let tot = 0;
	for (let i = 0; i < octaves; i++) {
		sum += noise2(x, y, seed + i * 7919) * amp;
		tot += amp;
		x *= 2;
		y *= 2;
		amp *= 0.5;
	}
	return sum / tot;
}

/* -------------------------------------------------------------- terrain -- */

export class World {
	constructor(seed = 1337) {
		this.seed = seed;
		this.cache = new Map(); // "x,y" -> tile, bounded below
	}

	/** Height field in [0,1]. Water sits below the shore line. */
	height(x, y) {
		return fbm(x * 0.012, y * 0.012, this.seed, 5);
	}

	/** Moisture, used to decide where trees cluster. */
	moisture(x, y) {
		return fbm(x * 0.03 + 100, y * 0.03 + 100, this.seed + 555, 3);
	}

	/** Tile at a world cell. Cached, since terrain is read many times a frame. */
	tile(x, y) {
		const key = x + ',' + y;
		const hit = this.cache.get(key);
		if (hit !== undefined) return hit;

		const h = this.height(x, y);
		let t;
		if (h < 0.36) t = TILE.WATER;
		else if (h < 0.40) t = TILE.SAND;
		else {
			const m = this.moisture(x, y);
			const r = hash2(x, y, this.seed + 31);
			if (m > 0.62 && r > 0.80) t = TILE.TREE;
			else if (h > 0.70 && r > 0.90) t = TILE.ROCK;
			else if (r > 0.988) t = TILE.FLOWER;
			else t = TILE.GRASS;
		}

		/* Bounded cache: terrain is cheap to recompute and the player walks in
		   one direction for a long time, so an unbounded map is a slow leak. */
		if (this.cache.size > 60000) this.cache.clear();
		this.cache.set(key, t);
		return t;
	}

	/** True where an entity cannot stand. */
	solid(x, y) {
		const t = this.tile(x, y);
		return t === TILE.TREE || t === TILE.ROCK;
	}

	/** True where an entity gets its feet wet (used for ripples and wading). */
	wet(x, y) {
		return this.tile(x, y) === TILE.WATER;
	}

	/** Per-cell stable randomness, for picking a blade variant that does not
	    change every frame. */
	jitter(x, y) {
		return hash2(x, y, this.seed + 7);
	}
}

/* ----------------------------------------------------------------- wind -- */

/* Wind is a sum of two travelling waves plus a slow gust envelope. Two waves
   rather than one because a single sine makes the whole field pulse in unison,
   which reads as a screen effect instead of weather. */
export function windAt(x, y, t) {
	const a = Math.sin(x * 0.09 + y * 0.045 + t * 1.6);
	const b = Math.sin(x * 0.033 - y * 0.07 + t * 0.9 + 2.1);
	const gust = 0.55 + 0.45 * Math.sin(t * 0.21 + Math.sin(t * 0.07) * 2);
	return (a * 0.6 + b * 0.4) * gust;
}

/* ------------------------------------------------------------------ sky -- */

/** Day length in seconds. Long enough to be ambient, short enough to see. */
export const DAY_SECONDS = 240;

/**
 * Sky state for a given time.
 * phase 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = midnight.
 */
export function skyAt(t) {
	const phase = (t % DAY_SECONDS) / DAY_SECONDS;
	const sunUp = Math.sin(phase * Math.PI * 2);
	const isDay = sunUp > 0;
	const light = Math.max(0, sunUp);

	/* The body that casts the reflection: sun by day, moon by night. Its
	   column is where it sits across the viewport, 0..1. */
	const bodyX = (phase * 2) % 1;
	const bodyAlt = Math.abs(sunUp);

	return {
		phase,
		isDay,
		light, // 0 at night, 1 at noon
		night: Math.max(0, -sunUp),
		bodyX,
		bodyAlt,
		/* Ambient tint, applied to every terrain colour. Night is cold and
		   blue, noon is neutral, dawn and dusk warm. */
		tint: isDay
			? [0.72 + 0.28 * light, 0.78 + 0.22 * light, 0.70 + 0.22 * light]
			: [0.34, 0.44, 0.58],
	};
}
