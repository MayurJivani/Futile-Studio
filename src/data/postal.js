/**
 * The Futile Post's postal model: how long a card takes and what happens to
 * it on the way. Nothing runs on a timer. A card's whole journey is computed
 * from what was stored when it was posted (its id, when, which country and
 * which way), so the server and every page agree on where it is right now.
 *
 * The legs follow real letter post: collection at the evening pickup, the
 * outward mail centre overnight, the international gateway, a flight (or a
 * truck, inside Europe), Frankfurt's international postal centre on the
 * German side, customs for mail from outside the EU (a postcard needs no
 * declaration), the inward mail centre, and a morning delivery round. No
 * deliveries on Sundays. Inside Germany: two days. Abroad: three days plus a
 * day per 4000 km, plus up to a day of luck, capped at seven.
 */

import { countries } from './geo.js';

const H = 3600e3;
const D = 24 * H;
export const STUDIO = { name: 'Paderborn, Germany', lat: 51.72, lon: 8.75 };
const FRANKFURT = { name: 'International Postal Centre, Frankfurt', lat: 50.05, lon: 8.57 };
const EU = new Set('AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(' '));
/* Big countries send their international mail out through one gateway, not from the middle of the map. */
const GATEWAYS = {
	US: ['New York', 40.64, -73.78],
	CA: ['Toronto', 43.68, -79.62],
	MX: ['Mexico City', 19.44, -99.07],
	BR: ['São Paulo', -23.43, -46.47],
	AR: ['Buenos Aires', -34.82, -58.54],
	GB: ['London', 51.47, -0.45],
	RU: ['Moscow', 55.97, 37.41],
	IN: ['Mumbai', 19.09, 72.87],
	CN: ['Beijing', 40.08, 116.58],
	JP: ['Tokyo', 35.77, 140.39],
	ID: ['Jakarta', -6.13, 106.66],
	AU: ['Sydney', -33.94, 151.18],
	ZA: ['Johannesburg', -26.13, 28.24],
};

export const countryName = (code) => countries[code]?.[0] ?? '';

const rad = (d) => (d * Math.PI) / 180;
export function km(a, b) {
	const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The point a fraction f of the way from a to b along the great circle. */
export function along(a, b, f) {
	const v = (p) => [Math.cos(rad(p.lat)) * Math.cos(rad(p.lon)), Math.cos(rad(p.lat)) * Math.sin(rad(p.lon)), Math.sin(rad(p.lat))];
	const [p, q] = [v(a), v(b)];
	const w = Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
	if (w < 1e-9) return { lat: a.lat, lon: a.lon };
	const [s, t] = [Math.sin((1 - f) * w) / Math.sin(w), Math.sin(f * w) / Math.sin(w)];
	const [x, y, z] = p.map((n, i) => s * n + t * q[i]);
	return { lat: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI, lon: (Math.atan2(y, x) * 180) / Math.PI };
}

/* deterministic 0..1 from the card id, one draw per k */
const luck = (id, k) => (Math.imul(id * 2654435761 + k * 40503, 2246822519) >>> 0) / 2 ** 32;
// shortcut: local time is the longitude's solar offset, no time zone database or daylight saving; enough for scan times
const offset = (p) => Math.round(p.lon / 15);
const dayOf = (t, off) => Math.floor((t + off * H) / D);
const hourOf = (t, off) => ((t + off * H) % D) / H;
const at = (day, hour, off) => day * D + (hour - off) * H;
const sunday = (day) => (day + 4) % 7 === 0;

export const parseTime = (s) => Date.parse(/[TZ]/.test(s) ? s : `${s.replace(' ', 'T')}Z`);

/**
 * The journey of one card: { days, from, to, events: [{ at, text, place, lat, lon }] }.
 * `direction` is 'in' for a visitor's card to the studio, 'out' for the studio's reply.
 */
export function route({ id, created_at, country, direction = 'in' }) {
	const t0 = parseTime(created_at);
	const c = countries[country];
	const far = c ? { name: c[0], lat: c[1], lon: c[2] } : { ...FRANKFURT, name: 'Somewhere, origin not recorded' };
	const domestic = !c || country === 'DE';
	const g = GATEWAYS[country];
	const gate = domestic ? null : g ? { name: `International mail gateway, ${g[0]}`, lat: g[1], lon: g[2] } : { ...far, name: `Office of exchange, ${far.name}` };
	const inbound = direction !== 'out';
	const [from, to] = inbound ? [far, STUDIO] : [STUDIO, far];
	const [outGate, inGate] = inbound ? [gate, FRANKFURT] : [FRANKFURT, gate];
	const distance = km(from, to);
	const days = domestic ? (c ? 2 : 3) : Math.min(7, Math.max(3, Math.round(3 + distance / 4000 + luck(id, 1))));
	const [offF, offT] = [offset(from), offset(to)];

	let collect = dayOf(t0, offF) + (hourOf(t0, offF) < 17 ? 0 : 1);
	if (sunday(collect)) collect++;
	const first = dayOf(at(collect, 17, offF), offT) + (domestic ? 1 : 2);
	/* the delivery round nearest to `days` after posting, never on a Sunday, and never past seven days */
	let deliver = Math.max(dayOf(t0 + days * D, offT), first);
	if (sunday(deliver)) deliver++;
	let r = journey(deliver);
	while (r.deliveredAt - t0 > 7 * D && deliver - 1 >= first) r = journey(sunday(--deliver) ? --deliver : deliver);
	return r;

	function journey(deliver) {
		const ev = [];
		const add = (t, text, p) => ev.push({ at: Math.round(t / 6e4) * 6e4, text, place: p.name, lat: p.lat, lon: p.lon });
		add(t0, inbound ? 'Posted' : 'Posted at the studio', from);
		add(at(collect, 17, offF) + luck(id, 2) * 40 * 6e4, 'Collected from the postbox', from);
		add(at(collect, 21, offF) + luck(id, 3) * H, 'Sorted at the outward mail centre', from);
		if (!domestic) {
			const ready = at(collect + 1, 5, offset(outGate)) + luck(id, 4) * H;
			add(ready, outGate === FRANKFURT || outGate.lat === from.lat ? 'At the office of exchange, waiting for dispatch' : 'Arrived at the international gateway', outGate);
			const legKm = km(outGate, inGate);
			const road = legKm < 1200;
			const travel = (road ? legKm / 60 + 2 : legKm / 750 + 4) * H;
			const arrive = Math.max(at(deliver - 1, 6, offset(inGate)) + luck(id, 5) * 2 * H, ready + 2 * H + travel);
			add(arrive - travel, `${road ? 'Left by road' : 'Departed by air'} for ${inbound ? 'Germany' : far.name}`, outGate);
			add(arrive, 'Arrived in the destination country', inGate);
			if (!EU.has(country)) add(arrive + 2 * H, 'Customs: correspondence, no declaration needed, released', inGate);
		}
		add(at(deliver - 1, 22, offT), 'Sorted at the inward mail centre', inbound ? { ...STUDIO, name: 'Mail centre, Paderborn' } : { ...far, name: `Mail centre, ${far.name}` });
		add(at(deliver, 8, offT), 'Out for delivery', to);
		add(at(deliver, 11, offT) + luck(id, 6) * 100 * 6e4, inbound ? "Delivered to the studio's mailbox" : 'Delivered', to);
		/* a late international leg can run into the next step; nothing in the post happens backwards */
		for (let i = 1; i < ev.length; i++) ev[i].at = Math.max(ev[i].at, ev[i - 1].at + 30 * 6e4);
		return { days, from, to, events: ev, deliveredAt: ev.at(-1).at };
	}
}

/** Where a card is at `now`: the scans so far, and its position on the map. */
export function progress(r, now = Date.now()) {
	const seen = r.events.filter((e) => e.at <= now);
	const last = seen.at(-1) ?? r.events[0];
	const next = r.events[seen.length];
	const f = next ? Math.max(0, Math.min(1, (now - last.at) / (next.at - last.at))) : 1;
	return { delivered: now >= r.deliveredAt, seen, last, position: next ? along(last, next, f) : { lat: last.lat, lon: last.lon } };
}
