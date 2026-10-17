/* Multiplayer client for the ASCII world.
 *
 * This rides the presence relay the site already runs (server/lib/presence.js)
 * rather than standing up a second socket server: that relay already caps
 * payload size, message rate, sockets per IP and sockets per room, and already
 * keys rooms by path. The game is one more room on it.
 *
 * It sends nothing identifying. The display name is whatever the player typed,
 * it is never persisted server-side, and the relay still forgets the id and
 * colour the moment the socket closes.
 */

const SEND_MS = 45; // ~22/s, inside the relay's 35ms floor with room to spare
const FACINGS = ['down', 'up', 'left', 'right'];

function wsUrl() {
	const base = import.meta.env?.PUBLIC_API_BASE;
	if (base) return base.replace(/^http/, 'ws') + '/ws/presence';
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${proto}//${location.host}/ws/presence`;
}

/** Trim a name to something the 256-byte payload cap can always carry. */
function cleanName(raw) {
	return String(raw || '')
		.replace(/[^\p{L}\p{N} _-]/gu, '')
		.trim()
		.slice(0, 14) || 'wanderer';
}

/**
 * @param {{room:string,name:string,onPeer:Function,onGone:Function}} opts
 */
export function connect(opts) {
	let ws;
	let closed = false;
	let lastSend = 0;
	let retry = 0;
	const name = cleanName(opts.name);

	/* Only resend when something actually changed. A standing player should
	   cost nothing, which matters because the relay's budget is shared with
	   the cursor presence on the rest of the site. */
	let lastX = NaN;
	let lastY = NaN;
	let lastF = -1;
	let lastFr = -1;

	function open() {
		if (closed) return;
		try {
			ws = new WebSocket(wsUrl());
		} catch {
			schedule();
			return;
		}

		ws.onopen = () => {
			retry = 0;
			ws.send(JSON.stringify({ t: 'hello', room: opts.room }));
		};

		ws.onmessage = (ev) => {
			let m;
			try {
				m = JSON.parse(ev.data);
			} catch {
				return;
			}
			if (!m || typeof m !== 'object') return;

			if (m.t === 'welcome') {
				/* Our own id and colour slot. Every other client derives our
				   appearance from these, so we draw ourselves from them too,
				   or we would be the only one seeing a different person. */
				opts.onSelf?.(m.id, m.colour ?? 0);
				for (const p of m.peers || []) {
					if (p.g) {
						opts.onPeer(p.id, p.colour, p.g.x, p.g.y, FACINGS[p.g.f] || 'down', p.g.a, p.g.n);
					}
				}
				return;
			}
			if (m.t === 'g') {
				opts.onPeer(m.id, m.colour ?? 0, m.x, m.y, FACINGS[m.f] || 'down', m.a, m.n);
				return;
			}
			if (m.t === 'bye') opts.onGone(m.id);
		};

		ws.onclose = () => {
			if (!closed) schedule();
		};
		ws.onerror = () => {
			try {
				ws.close();
			} catch {
				/* already gone */
			}
		};
	}

	/* Exponential backoff, capped. A player who loses the relay keeps playing
	   single-player rather than seeing an error. */
	function schedule() {
		if (closed) return;
		const wait = Math.min(15000, 600 * 2 ** retry++);
		setTimeout(open, wait + Math.random() * 400);
	}

	open();

	return {
		send(x, y, facing, frame) {
			if (!ws || ws.readyState !== WebSocket.OPEN) return;
			const now = performance.now();
			if (now - lastSend < SEND_MS) return;

			const f = FACINGS.indexOf(facing);
			const rx = Math.round(x * 4) / 4; // quarter-cell is past visible
			const ry = Math.round(y * 4) / 4;
			if (rx === lastX && ry === lastY && f === lastF && frame === lastFr) return;

			lastSend = now;
			lastX = rx;
			lastY = ry;
			lastF = f;
			lastFr = frame;
			ws.send(JSON.stringify({ t: 'g', x: rx, y: ry, f, a: frame, n: name }));
		},
		close() {
			closed = true;
			try {
				ws?.close();
			} catch {
				/* already gone */
			}
		},
	};
}
