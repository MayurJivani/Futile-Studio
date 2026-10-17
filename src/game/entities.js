/* Things that move: the player, remote peers, butterflies, rain.
 *
 * Sprites are small character grids. A space means "leave the terrain
 * showing", which is what keeps a walking figure sitting *in* the grass
 * rather than punching a rectangular hole through it.
 */

import { hash2 } from './world.js';

/* ------------------------------------------------------------- sprites -- */

/* 3 wide, 4 tall. Two walk frames per facing, plus a wade frame where the
   legs are replaced by water. Read these as pixel art; the shapes matter more
   than the individual characters. */
const S = (rows) => rows;

export const SPRITES = {
	down: [
		S(['(o)', '/|\\', ' | ', '/ \\']),
		S(['(o)', '/|\\', ' | ', ' |\\']),
	],
	up: [
		S(['(.)', '/|\\', ' | ', '/ \\']),
		S(['(.)', '/|\\', ' | ', '/| ']),
	],
	left: [
		S([' o)', '<| ', ' | ', '/\\ ']),
		S([' o)', '<| ', ' | ', ' /\\']),
	],
	right: [
		S(['(o ', ' |>', ' | ', ' /\\']),
		S(['(o ', ' |>', ' | ', '/\\ ']),
	],
};

export const SPRITE_W = 3;
export const SPRITE_H = 4;

/* ----------------------------------------------------------- appearance --
 *
 * A character is not one colour. The figure is read as a person because the
 * hair, the face, the shirt and the legs are shaded apart, and because two
 * strangers are not the same person twice.
 *
 * None of it is sent. A look is derived from the id the relay already gave the
 * socket, so every client hashes the same id to the same person: someone in a
 * flat cap wears it on every screen, and the move message stays the ~40 bytes
 * the relay already budgeted. Same trick as the terrain, a hash and not a map.
 *
 * The world is near-monochrome, so these vary mostly in value. Chroma is spent
 * on the shirt alone, because that is the attribute a player actually uses to
 * tell two figures apart across a field.
 */

/* Which part of the body a sprite cell belongs to, from the pose's own
   geometry rather than a second table that could drift out of step with it:
   the centre column is the body, the outer columns are what hangs off it. */
export function partAt(row, col) {
	if (row === 0) return col === 1 ? 'skin' : 'hair'; // face between hair
	if (row === 1) return col === 1 ? 'shirt' : 'skin'; // torso between arms
	return 'legs';
}

/* Hair sits in the two cells either side of the face. Every glyph here must
   exist in ATLAS_CHARS or the cell draws blank, which reads as a bald patch;
   the self-check asserts it. */
const HAIR = [
	['(', ')'], // cropped
	['[', ']'], // flat cap
	['/', '\\'], // swept across
	['~', '~'], // long
	['{', '}'], // curly
	['_', '_'], // bald, just a brow
];

/* Four complexions and four hair inks, all low chroma: this is a green world
   drawn in one ink, and a figure that arrives in full colour looks pasted on. */
const SKIN = [
	[0.86, 0.80, 0.70],
	[0.78, 0.68, 0.56],
	[0.62, 0.50, 0.40],
	[0.45, 0.35, 0.28],
];
const HAIR_INK = [
	[0.20, 0.17, 0.14], // near black
	[0.42, 0.30, 0.18], // brown
	[0.74, 0.64, 0.40], // fair
	[0.56, 0.56, 0.54], // grey
];

/* Eight shirts for the relay's eight colour slots, so the colour the server
   already hands out stays the thing that separates two strangers. */
const SHIRT = [
	[0.40, 0.66, 0.48],
	[0.72, 0.58, 0.34],
	[0.46, 0.56, 0.74],
	[0.76, 0.46, 0.42],
	[0.60, 0.46, 0.68],
	[0.82, 0.76, 0.48],
	[0.38, 0.62, 0.64],
	[0.70, 0.70, 0.66],
];
const LEGS = [
	[0.32, 0.34, 0.40], // denim
	[0.42, 0.36, 0.28], // canvas
	[0.26, 0.28, 0.26], // dark
];

/** Fold a peer id into an integer the hash can take. */
function foldId(id) {
	const s = String(id ?? '');
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}

/**
 * The look for one character.
 *
 * @param {string} id     the relay's socket id, stable for that socket's life
 * @param {number} colour the relay's colour slot, 0..7
 */
export function lookFor(id, colour) {
	const k = foldId(id);
	/* Separate salts, so hair style does not track complexion: with one hash
	   every fair-haired peer would also be the palest, and the crowd reads as
	   four clones rather than a dozen people. */
	const pick = (arr, salt) => arr[Math.floor(hash2(k, salt, salt * 7 + 1) * arr.length) % arr.length];
	const slot = Number.isInteger(colour) && colour >= 0 ? colour % SHIRT.length : 0;
	return {
		hair: pick(HAIR, 1),
		skin: pick(SKIN, 2),
		hairInk: pick(HAIR_INK, 3),
		shirt: SHIRT[slot],
		legs: pick(LEGS, 4),
	};
}

/* --------------------------------------------------------------- player -- */

export class Player {
	constructor(x, y, name) {
		this.x = x;
		this.y = y;
		this.vx = 0;
		this.vy = 0;
		this.facing = 'down';
		this.frame = 0;
		this.stepPhase = 0;
		this.name = name;
		this.moving = false;
		this.wading = false;
	}

	/**
	 * @param {number} dt seconds
	 * @param {{x:number,y:number}} input normalised direction
	 * @param {import('./world.js').World} world
	 */
	update(dt, input, world) {
		const wading = world.wet(Math.round(this.x), Math.round(this.y));
		const speed = wading ? 6.5 : 11.5; // cells per second

		let dx = input.x;
		let dy = input.y;
		const len = Math.hypot(dx, dy);
		if (len > 0) {
			dx /= len;
			dy /= len;
			this.moving = true;
			/* Facing follows the dominant axis, so a diagonal does not flicker
			   between two sprites every frame. */
			if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
			else this.facing = dy > 0 ? 'down' : 'up';
		} else {
			this.moving = false;
		}

		/* Axis-separated movement, so sliding along a tree reads as sliding
		   rather than sticking. */
		const nx = this.x + dx * speed * dt;
		if (!world.solid(Math.round(nx), Math.round(this.y))) this.x = nx;
		const ny = this.y + dy * speed * dt;
		if (!world.solid(Math.round(this.x), Math.round(ny))) this.y = ny;

		if (this.moving) {
			this.stepPhase += dt * (wading ? 5 : 9);
			this.frame = Math.floor(this.stepPhase) % 2;
		} else {
			this.frame = 0;
		}
		this.wading = wading;
	}
}

/* ---------------------------------------------------------- butterflies -- */

/* Butterflies wander with a slow steering force rather than a random walk, so
   their paths curve the way a real one does instead of jittering. */
export class Butterfly {
	constructor(x, y, rnd) {
		this.x = x;
		this.y = y;
		this.a = rnd() * Math.PI * 2;
		this.turn = (rnd() - 0.5) * 2;
		this.speed = 3 + rnd() * 3;
		this.flap = rnd() * 10;
		this.hue = rnd();
		this.rnd = rnd;
	}

	update(dt, t) {
		/* Steering wobbles on its own clock, plus a bias that keeps the
		   butterfly from leaving the neighbourhood entirely. */
		this.turn += (this.rnd() - 0.5) * dt * 9;
		this.turn *= 0.94;
		this.a += this.turn * dt * 2.4 + Math.sin(t * 1.7 + this.flap) * dt * 0.8;
		this.x += Math.cos(this.a) * this.speed * dt;
		this.y += Math.sin(this.a) * this.speed * dt * 0.55; // flatter than wide
		this.flap += dt * 17;
	}

	/** Open or closed wings. */
	get glyph() {
		return Math.floor(this.flap) % 2 ? '><' : '~~';
	}
}

/* ----------------------------------------------------------------- rain -- */

/* Rain is a pool of drops recycled when they land, so there is no allocation
   during a storm. Depth drives both glyph and brightness, which is what gives
   a flat glyph grid a sense of rain passing in front of and behind things. */
export class Rain {
	constructor(max = 900) {
		this.max = max;
		this.x = new Float32Array(max);
		this.y = new Float32Array(max);
		this.z = new Float32Array(max); // 0 far, 1 near
		this.live = 0;
		this.intensity = 0; // 0..1, eased toward target
		this.target = 0;
		this.splashes = [];
	}

	/** Weather drifts on its own slow clock; storms arrive and pass. */
	tick(dt, t) {
		const w = Math.sin(t * 0.021) + Math.sin(t * 0.0073 + 1.3);
		this.target = Math.max(0, Math.min(1, (w - 0.55) * 1.7));
		this.intensity += (this.target - this.intensity) * Math.min(1, dt * 0.35);
	}

	update(dt, t, view, world, rnd) {
		this.tick(dt, t);
		const want = Math.floor(this.intensity * this.max);

		// Spawn up to the current intensity, across the view plus a margin.
		while (this.live < want) {
			const i = this.live++;
			this.x[i] = view.x0 - 12 + rnd() * (view.w + 24);
			this.y[i] = view.y0 - 6 + rnd() * (view.h + 6);
			this.z[i] = rnd();
		}
		if (this.live > want) this.live = want;

		for (let i = 0; i < this.live; i++) {
			const sp = 34 + this.z[i] * 46;
			this.y[i] += sp * dt;
			this.x[i] += sp * 0.22 * dt; // wind-driven slant

			if (this.y[i] > view.y0 + view.h + 2) {
				/* Landed. A drop that lands on water leaves a ripple; one that
				   lands on grass does not, which is the cheapest way to make
				   the two surfaces read as different materials. */
				const gx = Math.round(this.x[i]);
				const gy = Math.round(this.y[i]);
				if (world.wet(gx, gy) && this.splashes.length < 120) {
					this.splashes.push({ x: gx, y: gy, t: 0 });
				}
				this.x[i] = view.x0 - 12 + rnd() * (view.w + 24);
				this.y[i] = view.y0 - 6 - rnd() * 8;
				this.z[i] = rnd();
			}
		}

		for (let i = this.splashes.length - 1; i >= 0; i--) {
			this.splashes[i].t += dt;
			if (this.splashes[i].t > 0.65) this.splashes.splice(i, 1);
		}
	}
}

/* ---------------------------------------------------------------- peers -- */

/* A remote player, smoothed. The relay sends at most ~28 messages a second and
   the screen runs at 60+, so peers are interpolated toward their last known
   position instead of being snapped to it. */
export class Peer {
	constructor(id, colour) {
		this.id = id;
		this.colour = colour;
		/* Derived once: the id outlives the socket's whole visit, so a peer
		   must not change hair halfway across the field. */
		this.look = lookFor(id, colour);
		this.x = 0;
		this.y = 0;
		this.tx = 0;
		this.ty = 0;
		this.facing = 'down';
		this.frame = 0;
		this.name = '';
		this.seen = 0;
		this.placed = false;
	}

	target(x, y, facing, frame, name) {
		this.tx = x;
		this.ty = y;
		this.facing = facing;
		this.frame = frame;
		if (name) this.name = name;
		this.seen = performance.now();
		if (!this.placed) {
			this.x = x;
			this.y = y;
			this.placed = true;
		}
	}

	update(dt) {
		const k = Math.min(1, dt * 12);
		this.x += (this.tx - this.x) * k;
		this.y += (this.ty - this.y) * k;
	}
}
