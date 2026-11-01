/* Draws a card's route onto WorldMap.astro: the planned way as a dashed line,
   the part already travelled solid, a dot per stop, and the card where the
   postal model says it is right now. */
import { along, progress } from '../data/postal.js';
import { LAND } from '../data/geo.js';

const xy = (p) => [p.lon + 180, LAND.top - p.lat];
const same = (a, b) => a.lat === b.lat && a.lon === b.lon;
const leg = (a, b) => Array.from({ length: 33 }, (_, i) => along(a, b, i / 32));

/* a polyline that lifts the pen where the route crosses the edge of the map */
function line(points) {
	let d = '';
	let prev = null;
	for (const p of points) {
		const [x, y] = xy(p);
		d += `${prev === null || Math.abs(x - prev) > 180 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
		prev = x;
	}
	return d;
}

export function drawRoute(svg, r, now = Date.now()) {
	const p = progress(r, now);
	const stops = r.events.filter((e, i, all) => !i || !same(e, all[i - 1]));
	svg.querySelector('[data-route-plan]').setAttribute('d', line(stops.slice(1).flatMap((s, i) => leg(stops[i], s))));

	const done = p.seen.slice(1).flatMap((s, i) => (same(s, p.seen[i]) ? [] : leg(p.seen[i], s)));
	if (!p.delivered) done.push(...leg(p.last, p.position));
	svg.querySelector('[data-route-done]').setAttribute('d', done.length > 1 ? line(done) : '');

	svg.querySelector('[data-stops]').replaceChildren(
		...stops.map((s) => {
			const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			const [x, y] = xy(s);
			Object.entries({ class: 'stop', cx: x, cy: y, r: 1.3 }).forEach(([k, v]) => c.setAttribute(k, String(v)));
			if (s.at <= now) c.setAttribute('data-passed', '');
			return c;
		}),
	);
	const [x, y] = xy(p.position);
	svg.querySelector('[data-marker]').setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
	return p;
}
