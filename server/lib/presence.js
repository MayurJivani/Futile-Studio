// Anonymous cursor presence, the one feature from the reference site that
// cannot be done as static HTML (FRC/Lab/THEME-B.md calls it out by name).
//
// Design notes:
//  - Nothing identifying is stored or sent. A connection gets a random short id
//    and a colour index, both forgotten the moment it closes. No IP, no cookie,
//    no session, and the coordinates are never logged.
//  - Rooms are keyed by page path so /jinx visitors do not haunt the homepage.
//  - x is a FRACTION of document width and y is an absolute page offset, so a
//    phone and a widescreen agree on where the paper is even though they
//    disagree about pixels.
//  - Everything inbound is treated as hostile: payload size, message rate,
//    socket count per IP and total sockets are all capped before any work.

import { createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { cleanDisplayName } from './validate.js';

const MAX_SOCKETS = 200; // total, across every room
const MAX_PER_IP = 6; // one person with tabs open is fine; a script is not
const MAX_PER_ROOM = 40; // beyond this the page is soup anyway
const MAX_PAYLOAD = 256; // bytes; a move message is ~40
const MIN_MS_BETWEEN = 35; // ~28 msg/s ceiling per socket
const IDLE_MS = 60_000; // drop a socket that stops answering pings

/** Paper-friendly cursor colours, picked to read on the kraft ground. */
const COLOURS = 8;

const rooms = new Map(); // path -> Set<ws>
const perIp = new Map(); // ip -> count

let seq = 0;
const nextId = () => `c${(++seq).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Only ever let a client steer us to a path we would serve anyway. */
function cleanRoom(raw) {
	if (typeof raw !== 'string') return '/';
	const path = raw.split('?')[0].split('#')[0];
	if (!/^\/[a-z0-9/_-]{0,40}$/i.test(path)) return '/';
	return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* The ASCII world rides this relay as one more room, so a game move is just
   another message type with the same caps. Names are the only free text any
   client can send, so they are sanitised here and not only in the browser. */
const WORLD_LIMIT = 1_000_000; // cells; past this the terrain hash is mush anyway

/* The shared studio is one more room. Everyone in it is listed on arrival
   (an explorer per visitor, no position needed) and it is the only room that
   takes votes. */
const STUDIO = '/studio';
const MIN_MS_BETWEEN_VOTES = 400;
const MIN_MS_BETWEEN_MARKS = 1500;
const MIN_MS_BETWEEN_NAMES = 2000;

/* Every socket that belongs to one visitor (several tabs share a token). */
function socketsOf(wss, vkey) {
	return [...wss.clients].filter((c) => c.vkey && c.vkey === vkey);
}

/* Behind Cloudflare, cloudflared and Caddy every socket arrives from loopback,
   and Caddy, not trusting that hop, rewrites X-Forwarded-For to say loopback
   too. Read either and the whole site is one visitor: one shared vote, six
   sockets between everyone. CF-Connecting-IP is Cloudflare's, and nobody can
   forge it while the box is only reachable through the tunnel. The last
   X-Forwarded-For entry stays as the fallback for any other proxy. */
export function clientIp(req, trustProxy) {
	if (trustProxy) {
		const cf = String(req.headers['cf-connecting-ip'] || '').trim();
		if (cf) return cf;
		const fwd = String(req.headers['x-forwarded-for'] || '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (fwd.length) return fwd[fwd.length - 1];
	}
	return req.socket.remoteAddress || 'unknown';
}

function send(ws, obj) {
	if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj, except) {
	const peers = rooms.get(room);
	if (!peers) return;
	const msg = JSON.stringify(obj);
	for (const peer of peers) {
		if (peer !== except && peer.readyState === peer.OPEN) peer.send(msg);
	}
}

function leave(ws) {
	const peers = rooms.get(ws.room);
	if (peers) {
		peers.delete(ws);
		if (peers.size === 0) rooms.delete(ws.room);
	}
	const n = (perIp.get(ws.ip) || 1) - 1;
	if (n > 0) perIp.set(ws.ip, n);
	else perIp.delete(ws.ip);

	broadcast(ws.room, { t: 'bye', id: ws.id, name: ws.name });
}

export function attachPresence(server, { allowedOrigin, trustProxy = false, votes = null, visitors = null, marks = null } = {}) {
	const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
	/* moderation empties the board: everyone watching it sees that at once */
	marks?.onClear(() => broadcast(STUDIO, { t: 'marks', marks: [] }));

	server.on('upgrade', (req, socket, head) => {
		let path;
		try {
			path = new URL(req.url, 'http://localhost').pathname;
		} catch {
			socket.destroy();
			return;
		}
		if (path !== '/ws/presence') return; // leave other upgrades alone

		// Browsers send Origin on cross-site WS, and unlike fetch the server has
		// to enforce it: ws does not consult the CORS middleware above.
		if (allowedOrigin && req.headers.origin && req.headers.origin !== allowedOrigin) {
			socket.destroy();
			return;
		}
		if (wss.clients.size >= MAX_SOCKETS) {
			socket.destroy();
			return;
		}

		wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
	});

	wss.on('connection', (ws, req) => {
		const ip = clientIp(req, trustProxy);
		const open = perIp.get(ip) || 0;
		if (open >= MAX_PER_IP) {
			ws.close(1013, 'too many');
			return;
		}
		perIp.set(ip, open + 1);

		ws.ip = ip;
		ws.id = nextId();
		ws.colour = Math.floor(Math.random() * COLOURS);
		ws.room = null;
		ws.last = 0;
		ws.lastVote = 0;
		ws.lastMark = 0;
		ws.lastName = 0;
		ws.name = null;
		ws.vkey = null;
		ws.voter = votes ? votes.voterFor(ip) : null;
		ws.alive = true;
		ws.on('pong', () => {
			ws.alive = true;
		});

		ws.on('message', (raw) => {
			let msg;
			try {
				msg = JSON.parse(raw);
			} catch {
				return; // not JSON, not interesting
			}
			if (!msg || typeof msg !== 'object') return;

			if (msg.t === 'hello') {
				if (ws.room) return; // one room per socket, chosen once
				const room = cleanRoom(msg.room);
				const peers = rooms.get(room) || new Set();
				if (peers.size >= MAX_PER_ROOM) {
					ws.close(1013, 'room full');
					return;
				}
				ws.room = room;
				peers.add(ws);
				rooms.set(room, peers);

				/* The visitor's name is the server's to give: the client only
				   hands back the token it was given last time, if any. */
				let you = null;
				if (visitors) {
					try {
						you = visitors.claim(msg.token);
						ws.name = you.name;
						ws.vkey = createHash('sha256').update(you.token).digest('hex');
					} catch (err) {
						console.error('[presence] name failed:', err.message);
					}
				}

				send(ws, {
					t: 'welcome',
					id: ws.id,
					colour: ws.colour,
					...(you ? { name: you.name, token: you.token } : {}),
					peers: [...peers]
						.filter((p) => p !== ws && (room === STUDIO || finite(p.x) || p.g))
						.map((p) => ({ id: p.id, colour: p.colour, name: p.name, x: p.x, y: p.y, g: p.g })),
				});
				broadcast(room, { t: 'hi', id: ws.id, colour: ws.colour, name: ws.name }, ws);
				if (room === STUDIO && votes) {
					send(ws, { t: 'tally', votes: votes.tally() });
					send(ws, { t: 'mine', ideas: votes.mine(ws.voter) });
				}
				if (room === STUDIO && marks) send(ws, { t: 'marks', marks: marks.list() });
				return;
			}

			/* A new name: a fresh random one, or one the visitor chose. Applied
			   to every tab the visitor has open, and told to each room. */
			if ((msg.t === 'reroll' || msg.t === 'name') && visitors && ws.vkey) {
				const now = Date.now();
				if (now - ws.lastName < MIN_MS_BETWEEN_NAMES) return;
				ws.lastName = now;
				const token = msg.token;
				if (typeof token !== 'string' || createHash('sha256').update(token).digest('hex') !== ws.vkey) return;
				const result = msg.t === 'reroll' ? { name: visitors.reroll(token) } : visitors.choose(token, msg.name);
				if (!result.name) return send(ws, { t: 'name-no', error: result.error || 'Could not rename.' });
				const was = ws.name;
				for (const c of socketsOf(wss, ws.vkey)) {
					c.name = result.name;
					send(c, { t: 'you', name: result.name });
					broadcast(c.room, { t: 'name', id: c.id, name: result.name, was }, c);
				}
				marks?.rename(ws.vkey, result.name);
				if (marks) broadcast(STUDIO, { t: 'marks', marks: marks.list() });
				return;
			}

			/* A mark on the studio's board, or lifting one of your own. */
			if ((msg.t === 'mark' || msg.t === 'unmark') && marks && ws.room === STUDIO && ws.vkey) {
				const now = Date.now();
				if (now - ws.lastMark < MIN_MS_BETWEEN_MARKS) return;
				ws.lastMark = now;
				if (msg.t === 'mark') {
					const placed = marks.place(ws.vkey, ws.name, msg);
					if (!placed) return;
					broadcast(STUDIO, { t: 'marks', marks: marks.list() });
					broadcast(STUDIO, { t: 'act', who: ws.name, did: 'mark', kind: placed.kind });
				} else if (typeof msg.id === 'string' && marks.lift(ws.vkey, msg.id)) {
					broadcast(STUDIO, { t: 'marks', marks: marks.list() });
				}
				return;
			}

			/* A vote: toggle this visitor's mark on one idea from the fixed
			   list, then tell the whole room the new tally. */
			if (msg.t === 'v') {
				if (ws.room !== STUDIO || !votes) return;
				const now = Date.now();
				if (now - ws.lastVote < MIN_MS_BETWEEN_VOTES) return;
				ws.lastVote = now;
				let stands;
				try {
					stands = votes.toggle(ws.voter, msg.idea);
				} catch (err) {
					console.error('[presence] vote failed:', err.message);
					return;
				}
				if (stands === null) return;
				broadcast(STUDIO, { t: 'tally', votes: votes.tally() });
				broadcast(STUDIO, { t: 'act', who: ws.name, did: stands ? 'vote' : 'unvote', idea: msg.idea });
				send(ws, { t: 'mine', ideas: votes.mine(ws.voter) });
				return;
			}

			if (msg.t === 'm') {
				if (!ws.room) return;
				const now = Date.now();
				if (now - ws.last < MIN_MS_BETWEEN) return; // throttle, silently
				ws.last = now;
				if (!finite(msg.x) || !finite(msg.y)) return;
				ws.x = clamp(msg.x, 0, 1);
				ws.y = clamp(msg.y, 0, 1_000_000);
				broadcast(ws.room, { t: 'm', id: ws.id, x: ws.x, y: ws.y }, ws);
				return;
			}

			/* Game move. Same throttle and the same hostile-input treatment as
			   a cursor move: validate every field, clamp the rest, keep the
			   name sanitised so one player cannot write markup into another
			   player's screen. */
			if (msg.t === 'g') {
				if (!ws.room) return;
				const now = Date.now();
				if (now - ws.last < MIN_MS_BETWEEN) return;
				ws.last = now;
				if (!finite(msg.x) || !finite(msg.y)) return;

				const f = Number.isInteger(msg.f) ? clamp(msg.f, 0, 3) : 0;
				const a = Number.isInteger(msg.a) ? clamp(msg.a, 0, 3) : 0;
				const n = cleanDisplayName(msg.n);

				ws.g = {
					x: clamp(msg.x, -WORLD_LIMIT, WORLD_LIMIT),
					y: clamp(msg.y, -WORLD_LIMIT, WORLD_LIMIT),
					f,
					a,
					n,
				};
				broadcast(
					ws.room,
					{ t: 'g', id: ws.id, colour: ws.colour, ...ws.g },
					ws,
				);
			}
		});

		ws.on('close', () => leave(ws));
		ws.on('error', () => leave(ws));
	});

	// Drop sockets that stopped answering rather than letting rooms fill with ghosts.
	const beat = setInterval(() => {
		for (const ws of wss.clients) {
			if (!ws.alive) {
				ws.terminate();
				continue;
			}
			ws.alive = false;
			try {
				ws.ping();
			} catch {
				ws.terminate();
			}
		}
	}, IDLE_MS / 2);
	beat.unref();

	return wss;
}
