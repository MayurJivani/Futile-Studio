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

import { WebSocketServer } from 'ws';

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

	broadcast(ws.room, { t: 'bye', id: ws.id });
}

export function attachPresence(server, { allowedOrigin } = {}) {
	const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

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
		const ip = req.socket.remoteAddress || 'unknown';
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

				send(ws, {
					t: 'welcome',
					id: ws.id,
					colour: ws.colour,
					peers: [...peers]
						.filter((p) => p !== ws && finite(p.x))
						.map((p) => ({ id: p.id, colour: p.colour, x: p.x, y: p.y })),
				});
				broadcast(room, { t: 'hi', id: ws.id, colour: ws.colour }, ws);
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
