// node src/data/postal.selfcheck.js
import assert from 'node:assert/strict';
import { route, progress, km, along } from './postal.js';
import { countries } from './geo.js';

const D = 864e5;
const start = Date.parse('2026-10-01T00:00:00Z');
for (const code of [...Object.keys(countries), '', 'XX', 'T1']) {
	for (let i = 0; i < 40; i++) {
		const id = i * 7 + code.length + 1;
		const created_at = new Date(start + i * 0.37 * D).toISOString();
		for (const direction of ['in', 'out']) {
			const r = route({ id, created_at, country: code, direction });
			const days = (r.deliveredAt - Date.parse(created_at)) / D;
			/* "two days" is two delivery days after the posting day, so a card posted late can take 36 hours */
			assert.ok(days >= 1.4 && days <= 7, `${code} ${direction} #${id}: ${days.toFixed(2)} days`);
			r.events.forEach((e, k) => k && assert.ok(e.at > r.events[k - 1].at, `${code} #${id}: scans run forwards (${e.text})`));
			assert.notEqual(new Date(r.deliveredAt + Math.round(r.to.lon / 15) * 36e5).getUTCDay(), 0, `${code} #${id}: no Sunday delivery rounds, in local time`);
			assert.deepEqual(route({ id, created_at, country: code, direction }), r, 'the same card always takes the same route');
		}
	}
}
const us = route({ id: 3, created_at: '2026-10-05 09:00:00', country: 'US' });
assert.ok(us.events.some((e) => e.text.startsWith('Customs')), 'mail from the US clears customs');
assert.ok(us.events.some((e) => e.place.includes('New York')), 'and leaves through New York');
assert.ok(!route({ id: 3, created_at: '2026-10-05 09:00:00', country: 'FR' }).events.some((e) => e.text.startsWith('Customs')), 'none inside the EU');
assert.equal(route({ id: 3, created_at: '2026-10-05 09:00:00', country: 'DE' }).days, 2, 'two days inside Germany');
assert.ok(route({ id: 3, created_at: '2026-10-05 09:00:00', country: 'AU' }).days >= 6, 'Australia is far');
assert.ok(Math.abs(km({ lat: 51.5, lon: -0.12 }, { lat: 40.71, lon: -74.0 }) - 5570) < 20, 'London to New York is about 5570 km');
const mid = along({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }, 0.5);
assert.ok(Math.abs(mid.lon - 45) < 1e-9 && Math.abs(mid.lat) < 1e-9, 'halfway along the equator');
const p = progress(us, us.events[0].at - 1);
assert.equal(p.delivered, false);
assert.equal(progress(us, us.deliveredAt).delivered, true, 'delivered at the last scan');
console.log('postal: checks passed');
