/* The ASCII world: loop, camera, terrain shading, weather, HUD.
 *
 * Draw order is strictly back to front, because a glyph grid has no depth
 * buffer: terrain, then water surface effects, then ground clutter, then
 * entities, then rain in front of everything, then the HUD. Anything written
 * later simply wins the cell.
 */

import { GlyphRenderer } from './renderer.js';
import { RAMP_GRASS, RAMP_WATER, RAMP_CANOPY, RAMP_RAIN, fromRamp, glyph, labelFor } from './glyphs.js';
import { World, TILE, windAt, skyAt } from './world.js';
import { Player, Butterfly, Rain, Peer, SPRITES, SPRITE_W, SPRITE_H, partAt, lookFor } from './entities.js';
import { connect } from './net.js';

/* Near-monochrome: one green ink for living things, one cool grey for
   structure and water. Everything else is density, per the reference. */
const INK = {
	grassDark: [0.07, 0.20, 0.10],
	grassMid: [0.16, 0.47, 0.22],
	grassLit: [0.36, 0.84, 0.44],
	water: [0.36, 0.49, 0.56],
	waterLit: [0.70, 0.84, 0.90],
	sand: [0.40, 0.42, 0.34],
	trunk: [0.52, 0.56, 0.54],
	canopy: [0.24, 0.58, 0.32],
	rock: [0.44, 0.47, 0.49],
	flower: [0.74, 0.76, 0.52],
	player: [0.88, 0.93, 0.90],
	rain: [0.52, 0.64, 0.70],
	hud: [0.78, 0.88, 0.80],
	hudDim: [0.38, 0.48, 0.41],
};

/* How you are drawn before the relay has named you: flat, in one ink, exactly
   as the field looked when nobody was in it. Your real look needs the socket
   id, because that is what every other client derives it from, so this is also
   what a player with no relay keeps for the whole visit. */
const FLAT = {
	hair: ['(', ')'],
	skin: INK.player,
	hairInk: INK.player,
	shirt: INK.player,
	legs: INK.player,
};

const mix = (a, b, t) => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t,
];

/**
 * Where the glyph grid starts, and how far short of a cell it sits.
 *
 * The grid is integral and the camera is not. `x0,y0` is the world cell drawn
 * at grid 0,0, and `fx,fy` is the leftover fraction the renderer slides the
 * whole grid by. Everything standing on the ground is placed from `x0,y0`, so
 * terrain and entities share one origin: computing it twice is how a figure
 * ends up drifting half a cell against the grass it is standing in.
 */
export function gridOrigin(camX, camY, cols, rows) {
	const left = camX - cols / 2;
	const top = camY - rows / 2;
	const x0 = Math.floor(left);
	const y0 = Math.floor(top);
	return { x0, y0, fx: left - x0, fy: top - y0 };
}

/** Small deterministic RNG so butterflies and rain are reproducible per seed. */
function mulberry(seed) {
	let a = seed >>> 0;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export class AsciiWorld {
	constructor(canvas, opts = {}) {
		this.r = new GlyphRenderer(canvas, opts.cellPx || 11);
		this.world = new World(opts.seed || 20260413);
		this.rnd = mulberry(opts.seed || 20260413);
		this.name = opts.name || 'wanderer';
		/* Ambient mode is the site background: the same world, with nobody in
		   it. No player, no HUD, no socket, so it costs a terrain pass and
		   nothing else. */
		this.ambient = Boolean(opts.ambient);

		const spawn = this.findSpawn();
		this.player = new Player(spawn.x, spawn.y, this.name);

		this.look = FLAT;
		this.cam = { x: this.player.x, y: this.player.y };
		this.rain = new Rain();
		this.butterflies = [];
		this.peers = new Map();

		this.input = { x: 0, y: 0 };
		this.keys = new Set();
		this.t = 0;
		this.fps = 0;
		this.frameMs = 0;
		this._acc = 0;
		this._frames = 0;
		this.running = false;

		/* Character sheet. Cosmetic, but the reference's HUD is half the
		   image, so the numbers have to be real and move. */
		this.stats = { hp: 1989, hpMax: 3813, mp: 134, mpMax: 142, lv: 12, gold: 4307 };

		this.net = null;
		this.touch = null; // {id, ox, oy} while a finger is down
		this.onKey = this.onKey.bind(this);
		this.onPointerDown = this.onPointerDown.bind(this);
		this.onPointerMove = this.onPointerMove.bind(this);
		this.onPointerUp = this.onPointerUp.bind(this);
	}

	/**
	 * Somewhere standable, with water in sight.
	 *
	 * Standable alone is not enough: the sun and moon only cast their
	 * reflection on water, so a spawn with no shoreline in view hides one of
	 * the things the world is actually for. This walks outward until it finds
	 * dry footing within sight of a lake, and falls back to any dry footing if
	 * the seed really has none nearby.
	 */
	findSpawn() {
		const w = this.world;
		const standable = (x, y) => !w.solid(x, y) && !w.wet(x, y);

		/* The test is the actual viewport, not a guessed radius. A circle of 26
		   cells sounds close but the view is far wider than it is tall, so water
		   that passed a radius test could still sit above or below the screen.
		   Half the real grid, inset a little so the shoreline is properly in
		   frame rather than clipped at the edge. */
		const halfW = Math.max(8, Math.floor(this.r.cols / 2) - 6);
		const halfH = Math.max(6, Math.floor(this.r.rows / 2) - 4);
		const waterInView = (x, y) => {
			for (let dy = -halfH; dy <= halfH; dy += 2) {
				for (let dx = -halfW; dx <= halfW; dx += 2) {
					if (w.wet(x + dx, y + dy)) return true;
				}
			}
			return false;
		};

		let fallback = null;
		/* Expanding rings from the origin, so the chosen spot is the nearest
		   one that qualifies rather than the first one in scan order. */
		for (let r = 0; r < 220; r += 2) {
			for (let a = 0; a < 360; a += 12) {
				const x = Math.round(Math.cos((a * Math.PI) / 180) * r);
				const y = Math.round(Math.sin((a * Math.PI) / 180) * r);
				if (!standable(x, y)) continue;
				if (!fallback) fallback = { x, y };
				if (waterInView(x, y)) return { x, y };
			}
		}
		return fallback || { x: 0, y: 0 };
	}

	start() {
		if (this.running) return;
		this.running = true;
		window.addEventListener('keydown', this.onKey);
		window.addEventListener('keyup', this.onKey);
		if (!this.ambient) {
			/* Drag-anywhere stick rather than an on-screen dpad: the field is the
			   whole screen and a dpad would cover the part you are walking into.
			   touch-action is set in CSS so the drag does not scroll the page. */
			const c = this.r.canvas;
			c.addEventListener('pointerdown', this.onPointerDown);
			c.addEventListener('pointermove', this.onPointerMove);
			c.addEventListener('pointerup', this.onPointerUp);
			c.addEventListener('pointercancel', this.onPointerUp);
		}
		/* No resize listener: the renderer observes its own canvas, which also
		   catches the box arriving after construction. */
		if (this.ambient) {
			this.last = performance.now();
			this._raf = requestAnimationFrame(this.loop.bind(this));
			return;
		}
		this.net = connect({
			room: '/ascii',
			name: this.name,
			onPeer: (id, colour, x, y, facing, frame, name) => {
				let p = this.peers.get(id);
				if (!p) {
					p = new Peer(id, colour);
					this.peers.set(id, p);
				}
				p.target(x, y, facing, frame, name);
			},
			onSelf: (id, colour) => {
				this.look = lookFor(id, colour);
			},
			onGone: (id) => this.peers.delete(id),
		});
		this.last = performance.now();
		this._raf = requestAnimationFrame(this.loop.bind(this));
	}

	stop() {
		this.running = false;
		cancelAnimationFrame(this._raf);
		window.removeEventListener('keydown', this.onKey);
		window.removeEventListener('keyup', this.onKey);
		const c = this.r.canvas;
		c.removeEventListener('pointerdown', this.onPointerDown);
		c.removeEventListener('pointermove', this.onPointerMove);
		c.removeEventListener('pointerup', this.onPointerUp);
		c.removeEventListener('pointercancel', this.onPointerUp);
		this.touch = null;
		this.keys.clear();
		this.input.x = 0;
		this.input.y = 0;
		this.net?.close();
		this.net = null;
	}

	/** Full teardown. stop() is the pause; this releases the observer too. */
	destroy() {
		this.stop();
		this.r.dispose();
	}

	onKey(e) {
		const down = e.type === 'keydown';
		const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
		const movement =
			k === 'w' || k === 'a' || k === 's' || k === 'd' ||
			k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight';
		if (!movement) return;
		e.preventDefault();
		if (down) this.keys.add(k);
		else this.keys.delete(k);

		const K = this.keys;
		this.input.x = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0);
		this.input.y = (K.has('s') || K.has('ArrowDown') ? 1 : 0) - (K.has('w') || K.has('ArrowUp') ? 1 : 0);
	}

	/* ------------------------------------------------------------ touch -- */

	onPointerDown(e) {
		if (e.pointerType === 'mouse') return; // the mouse has a keyboard next to it
		this.touch = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
		this.r.canvas.setPointerCapture?.(e.pointerId);
	}

	onPointerMove(e) {
		if (!this.touch || e.pointerId !== this.touch.id) return;
		const dx = e.clientX - this.touch.ox;
		const dy = e.clientY - this.touch.oy;
		const len = Math.hypot(dx, dy);
		/* A small dead zone, so resting a thumb does not walk you into a lake. */
		if (len < 14) {
			this.input.x = 0;
			this.input.y = 0;
			return;
		}
		/* Past the dead zone the stick is full speed in that direction: this is
		   a walk, not a drive, so analogue magnitude buys nothing. */
		this.input.x = dx / len;
		this.input.y = dy / len;
	}

	onPointerUp(e) {
		if (!this.touch || e.pointerId !== this.touch.id) return;
		this.touch = null;
		this.input.x = 0;
		this.input.y = 0;
	}

	loop(now) {
		if (!this.running) return;
		const dt = Math.min(0.05, (now - this.last) / 1000);
		this.last = now;
		this.t += dt;

		const t0 = performance.now();
		this.update(dt);
		this.render();
		this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1;

		this._acc += dt;
		this._frames++;
		if (this._acc >= 0.5) {
			this.fps = Math.round(this._frames / this._acc);
			this._acc = 0;
			this._frames = 0;
		}

		this._raf = requestAnimationFrame(this.loop.bind(this));
	}

	get view() {
		const { x0, y0 } = gridOrigin(this.cam.x, this.cam.y, this.r.cols, this.r.rows);
		return { x0, y0, w: this.r.cols, h: this.r.rows };
	}

	update(dt) {
		if (this.ambient) {
			/* Drift the camera so the field keeps moving without anyone
			   driving it. Slow enough to read as weather, not as scrolling. */
			this.cam.x += dt * 2.6;
			this.cam.y += Math.sin(this.t * 0.11) * dt * 1.4;
			const v = this.view;
			this.rain.update(dt, this.t, v, this.world, this.rnd);
			const wantBf = this.rain.intensity > 0.35 ? 0 : 5;
			while (this.butterflies.length < wantBf) {
				this.butterflies.push(
					new Butterfly(v.x0 + this.rnd() * v.w, v.y0 + this.rnd() * v.h, this.rnd),
				);
			}
			if (this.butterflies.length > wantBf) this.butterflies.length = wantBf;
			for (const b of this.butterflies) {
				b.update(dt, this.t);
				if (b.x < v.x0 - 4) b.x = v.x0 + v.w + 2;
				if (b.x > v.x0 + v.w + 4) b.x = v.x0 - 2;
				if (b.y < v.y0 - 4) b.y = v.y0 + v.h + 2;
				if (b.y > v.y0 + v.h + 4) b.y = v.y0 - 2;
			}
			return;
		}
		this.player.update(dt, this.input, this.world);

		/* Camera lags the player slightly. A hard lock makes the whole glyph
		   field jump a full cell at a time, which is unreadable. */
		const k = Math.min(1, dt * 7);
		this.cam.x += (this.player.x - this.cam.x) * k;
		this.cam.y += (this.player.y - this.cam.y) * k;

		const view = this.view;
		this.rain.update(dt, this.t, view, this.world, this.rnd);

		/* Keep a small flock near the player, recycled rather than allocated. */
		const wantBf = this.rain.intensity > 0.35 ? 0 : 7; // they shelter in rain
		while (this.butterflies.length < wantBf) {
			this.butterflies.push(
				new Butterfly(
					view.x0 + this.rnd() * view.w,
					view.y0 + this.rnd() * view.h,
					this.rnd,
				),
			);
		}
		if (this.butterflies.length > wantBf) this.butterflies.length = wantBf;

		for (const b of this.butterflies) {
			b.update(dt, this.t);
			/* Wrap them back into view instead of letting them wander off. */
			if (b.x < view.x0 - 4) b.x = view.x0 + view.w + 2;
			if (b.x > view.x0 + view.w + 4) b.x = view.x0 - 2;
			if (b.y < view.y0 - 4) b.y = view.y0 + view.h + 2;
			if (b.y > view.y0 + view.h + 4) b.y = view.y0 - 2;
		}

		for (const p of this.peers.values()) p.update(dt);

		/* Drop peers the relay never said goodbye for (tab closed hard). */
		const now = performance.now();
		for (const [id, p] of this.peers) if (now - p.seen > 15000) this.peers.delete(id);

		this.net?.send(this.player.x, this.player.y, this.player.facing, this.player.frame);

		/* MP trickles back; HP drops a little while wading. Cosmetic, but a
		   HUD whose numbers never move is obviously a picture of a HUD. */
		this.stats.mp = Math.min(this.stats.mpMax, this.stats.mp + dt * 2.2);
		if (this.player.wading) this.stats.hp = Math.max(1, this.stats.hp - dt * 9);
		else this.stats.hp = Math.min(this.stats.hpMax, this.stats.hp + dt * 3.5);
	}

	/* ------------------------------------------------------------ render -- */

	render() {
		const r = this.r;
		const sky = skyAt(this.t);
		r.clear();

		/* One origin for everything standing on the ground. The fractional part
		   goes to the renderer, which slides the whole grid by it, so anything
		   placed here is placed on integer cells from the same origin: shift it
		   twice and it drifts against the terrain it is standing on. */
		const { x0: ox, y0: oy, fx, fy } = gridOrigin(this.cam.x, this.cam.y, r.cols, r.rows);
		const view = { x0: ox, y0: oy, w: r.cols, h: r.rows };

		this.drawTerrain(r, view, sky);
		this.drawSkyBody(r, sky);
		this.drawButterflies(r, ox, oy, sky);
		if (!this.ambient) {
			this.drawPeers(r, ox, oy);
			this.drawPlayer(r, ox, oy);
		}
		this.drawRain(r, ox, oy, sky);
		if (!this.ambient) this.drawHud(r);

		/* Night does not go black, it goes blue: a pure black ground loses the
		   glyph grid entirely and the world stops reading as a place. */
		const bg = sky.isDay
			? [0.016 + sky.light * 0.02, 0.035 + sky.light * 0.03, 0.025 + sky.light * 0.02]
			: [0.018, 0.028, 0.044];
		r.draw(bg, fx, fy);
	}

	drawTerrain(r, view, sky) {
		const w = this.world;
		const tint = sky.tint;
		const refl = Math.round(sky.bodyX * r.cols); // reflection column
		const reflStrength = sky.bodyAlt;

		for (let row = 0; row < r.rows; row++) {
			const wy = view.y0 + row;
			for (let col = 0; col < r.cols; col++) {
				const wx = view.x0 + col;
				const tile = w.tile(wx, wy);
				const j = w.jitter(wx, wy);

				let g, c;

				if (tile === TILE.GRASS || tile === TILE.FLOWER) {
					/* Wind bends the blade: the wind value picks which blade
					   glyph shows, the jitter decorrelates neighbours so the
					   field does not ripple as one sheet. */
					const wind = windAt(wx, wy, this.t);
					const bend = (wind * 0.5 + 0.5) * 0.75 + j * 0.25;
					g = fromRamp(RAMP_GRASS, bend);

					/* Brightness is height-in-the-blade plus wind, which is
					   what makes the field look lit from one side. */
					const lit = 0.30 + 0.45 * (wind * 0.5 + 0.5) + j * 0.25;
					c = mix(INK.grassDark, INK.grassLit, Math.min(1, lit));
					if (tile === TILE.FLOWER && j > 0.5) {
						g = glyph('*');
						c = INK.flower;
					}
				} else if (tile === TILE.WATER) {
					/* Two crossing wave trains, so the surface shears instead
					   of marching. */
					const a = Math.sin(wx * 0.30 + this.t * 2.1) + Math.sin(wy * 0.44 - this.t * 1.5);
					const wave = a * 0.25 + 0.5;
					g = fromRamp(RAMP_WATER, wave);
					c = INK.water;

					/* Sun or moon reflection: a column of brighter, choppier
					   water under the body, broken up so it reads as glinting
					   rather than as a painted stripe. */
					const d = Math.abs(col - refl);
					if (d < 7 && reflStrength > 0.05) {
						const fall = (1 - d / 7) * reflStrength;
						const glint = Math.sin(wy * 1.9 - this.t * 4.2) * 0.5 + 0.5;
						if (glint * fall > 0.34) {
							g = fromRamp(RAMP_WATER, Math.min(1, wave + 0.45));
							c = mix(INK.water, INK.waterLit, Math.min(1, fall * glint * 1.5));
						}
					}
				} else if (tile === TILE.SAND) {
					g = fromRamp(RAMP_GRASS, j * 0.3);
					c = mix(INK.sand, INK.grassDark, j * 0.4);
				} else if (tile === TILE.TREE) {
					/* Canopy density from local moisture, so a wood has mass
					   instead of being a scatter of identical trees. */
					const m = w.moisture(wx, wy);
					const sway = windAt(wx * 0.4, wy * 0.4, this.t * 0.35) * 0.12;
					g = fromRamp(RAMP_CANOPY, Math.min(1, m * 0.9 + j * 0.2 + sway));
					c = mix(INK.canopy, INK.grassLit, j * 0.35);
				} else {
					g = fromRamp(RAMP_CANOPY, 0.3 + j * 0.3);
					c = INK.rock;
				}

				r.set(col, row, g, c[0] * tint[0], c[1] * tint[1], c[2] * tint[2]);
			}
		}
	}

	/** The sun or moon itself, sitting in the top band of the view. */
	drawSkyBody(r, sky) {
		/* Sky, not ground: its position is already screen-relative, and a body
		   that slid with the camera would read as hanging just overhead. */
		r.pinned = true;
		const col = Math.round(sky.bodyX * r.cols);
		const row = Math.round((1 - sky.bodyAlt) * (r.rows * 0.30)) + 1;
		const c = sky.isDay ? [1.0, 0.95, 0.72] : [0.82, 0.88, 1.0];
		const a = 0.25 + sky.bodyAlt * 0.75;
		/* A small disc of full blocks reads as a body at this cell size; a
		   single glyph just reads as debris in the field. */
		const disc = [
			[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1],
		];
		for (const [dx, dy] of disc) {
			r.set(col + dx, row + dy, glyph('█'), c[0] * a, c[1] * a, c[2] * a);
		}
		r.pinned = false;
	}

	drawButterflies(r, ox, oy, sky) {
		/* They are pale at night, which is the only concession to the fact
		   that real ones are asleep. */
		const base = sky.isDay ? [0.95, 0.90, 0.55] : [0.55, 0.60, 0.72];
		for (const b of this.butterflies) {
			const col = Math.round(b.x - ox);
			const row = Math.round(b.y - oy);
			const g = b.glyph;
			const c = mix(base, INK.flower, b.hue * 0.5);
			r.set(col, row, glyph(g[0]), c[0], c[1], c[2]);
			r.set(col + 1, row, glyph(g[1]), c[0], c[1], c[2]);
		}
	}

	/**
	 * One figure, shaded by part.
	 *
	 * @param {object} look from entities.lookFor
	 * @param {number} gain brightness multiplier; the player is lit a little
	 *   hotter than everyone else, which is how you find yourself in a crowd.
	 */
	drawSprite(r, col, row, facing, frame, look, wading, gain = 1) {
		const frames = SPRITES[facing] || SPRITES.down;
		const art = frames[frame % frames.length];
		/* Wading hides the legs: the water keeps showing through the bottom
		   row, which is what sells standing in it rather than on it. */
		const rows = wading ? SPRITE_H - 1 : SPRITE_H;
		for (let y = 0; y < rows; y++) {
			const line = art[y];
			for (let x = 0; x < SPRITE_W; x++) {
				let ch = line[x];
				/* A space stays a space, so the hair substitution below cannot
				   fill in the gap a profile pose deliberately leaves. */
				if (ch === ' ') continue;
				/* Facing away there is no face, so the whole top row is head. */
				const part = y === 0 && facing === 'up' ? 'hair' : partAt(y, x);
				if (part === 'hair' && y === 0 && x !== 1) ch = look.hair[x > 1 ? 1 : 0];
				const c = part === 'hair' ? look.hairInk : look[part];
				r.set(col + x, row + y, glyph(ch), c[0] * gain, c[1] * gain, c[2] * gain);
			}
		}
	}

	/** A name floating above a figure, as in the reference. */
	drawLabel(r, col, row, name, colour) {
		const text = labelFor(name);
		const start = col + Math.round((SPRITE_W - text.length) / 2);
		r.text(start, row - 1, text, colour);
	}

	drawPeers(r, ox, oy) {
		for (const p of this.peers.values()) {
			const col = Math.round(p.x - ox) - 1;
			const row = Math.round(p.y - oy) - 2;
			const wet = this.world.wet(Math.round(p.x), Math.round(p.y));
			this.drawSprite(r, col, row, p.facing, p.frame, p.look, wet);
			/* The label takes the shirt's colour, so a name belongs to a figure
			   even where several are standing close enough to overlap. */
			this.drawLabel(r, col, row, p.name || 'someone', mix(p.look.shirt, INK.hud, 0.25));
		}
	}

	/* Terrain, peers, rain and butterflies all slide together now, and a peer
	   holds still against the grass because its rounding and the origin move
	   by the same whole number. The player is the exception: the camera tracks
	   it, so its own rounding flips between two cells as it walks, which reads
	   as a half-cell wobble at the centre of the screen while the ground
	   glides.
	   shortcut: the player quantises to a cell like everything else, so it
	   wobbles up to half a cell against a smoothly sliding ground. Fixing it
	   means pinning the figure to the exact centre cell and letting the world
	   slide under it, which also means the feet no longer sit on a definite
	   blade of grass. Worth doing once someone has watched it walk. */
	drawPlayer(r, ox, oy) {
		const col = Math.round(this.player.x - ox) - 1;
		const row = Math.round(this.player.y - oy) - 2;
		this.drawSprite(r, col, row, this.player.facing, this.player.frame, this.look, this.player.wading, 1.22);
		this.drawLabel(r, col, row, this.name, INK.hud);
	}

	drawRain(r, ox, oy, sky) {
		const rain = this.rain;
		if (rain.intensity < 0.01) return;

		/* Rain has no colour of its own, it is only what it reflects, so a
		   storm at midnight is felt rather than seen. Never zero: rain that
		   vanishes at night reads as the weather breaking, not as darkness. */
		const lit = 0.45 + sky.light * 0.55;

		for (let i = 0; i < rain.live; i++) {
			const col = Math.round(rain.x[i] - ox);
			const row = Math.round(rain.y[i] - oy);
			const z = rain.z[i];
			const g = fromRamp(RAMP_RAIN, z);
			const a = (0.30 + z * 0.55) * lit;
			r.set(col, row, g, INK.rain[0] * a, INK.rain[1] * a, INK.rain[2] * a);
		}

		for (const s of rain.splashes) {
			const col = Math.round(s.x - ox);
			const row = Math.round(s.y - oy);
			const k = 1 - s.t / 0.65;
			const spread = Math.round(s.t * 4);
			const a = k * 0.8;
			r.set(col - spread, row, glyph('('), INK.waterLit[0] * a, INK.waterLit[1] * a, INK.waterLit[2] * a);
			r.set(col + spread, row, glyph(')'), INK.waterLit[0] * a, INK.waterLit[1] * a, INK.waterLit[2] * a);
		}
	}

	/* The HUD box from the reference: a thin bordered panel, name and frame
	   timing on one line, two bars, then level and gold. */
	drawHud(r) {
		/* Pinned, or the whole panel would jitter by up to a cell as the
		   player walks. Cleared at the end, and by draw() in any case. */
		r.pinned = true;
		const W = 34;
		const H = 6;
		const x = 2;
		const y = 1;
		const c = INK.hud;
		const d = INK.hudDim;

		// Frame
		for (let i = 1; i < W - 1; i++) {
			r.set(x + i, y, glyph('─'), d[0], d[1], d[2]);
			r.set(x + i, y + H - 1, glyph('─'), d[0], d[1], d[2]);
		}
		for (let i = 1; i < H - 1; i++) {
			r.set(x, y + i, glyph('│'), d[0], d[1], d[2]);
			r.set(x + W - 1, y + i, glyph('│'), d[0], d[1], d[2]);
		}
		r.set(x, y, glyph('┌'), d[0], d[1], d[2]);
		r.set(x + W - 1, y, glyph('┐'), d[0], d[1], d[2]);
		r.set(x, y + H - 1, glyph('└'), d[0], d[1], d[2]);
		r.set(x + W - 1, y + H - 1, glyph('┘'), d[0], d[1], d[2]);

		const name = labelFor(this.name).slice(0, 10);
		r.text(x + 2, y + 1, name, c);
		r.text(x + 14, y + 1, `FPS ${String(this.fps).padStart(3)}`, d);
		r.text(x + 23, y + 1, `${this.frameMs.toFixed(1)}ms`, d);

		this.bar(r, x + 2, y + 2, 'HP', this.stats.hp, this.stats.hpMax, [0.80, 0.34, 0.30]);
		this.bar(r, x + 2, y + 3, 'MP', this.stats.mp, this.stats.mpMax, [0.40, 0.60, 0.84]);

		r.text(x + 2, y + 4, `LV ${this.stats.lv}`, c);
		r.text(x + 9, y + 4, `${Math.round(this.stats.gold)}g`, [0.78, 0.68, 0.38]);

		const peers = this.peers.size;
		const label = peers === 1 ? '1 other here' : `${peers} others here`;
		r.text(x + 18, y + 4, peers ? label : 'alone', d);
		r.pinned = false;
	}

	bar(r, x, y, label, val, max, colour) {
		const d = INK.hudDim;
		r.text(x, y, label, d);
		const w = 14;
		const filled = Math.round((val / max) * w);
		for (let i = 0; i < w; i++) {
			const on = i < filled;
			const g = on ? glyph('█') : glyph('░');
			const cc = on ? colour : [d[0] * 0.6, d[1] * 0.6, d[2] * 0.6];
			r.set(x + 3 + i, y, g, cc[0], cc[1], cc[2]);
		}
		r.text(x + 19, y, `${Math.round(val)}/${max}`, d);
	}
}
