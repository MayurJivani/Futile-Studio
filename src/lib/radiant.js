/**
 * The door's name as a field of dots that gives off heat.
 *
 * The real text stays in the h1 (hidden once the dots are drawn, so it still
 * holds the space and reads without script). The canvas bleeds past it so
 * scattered dots are not clipped, and takes no pointer events: only the name
 * itself reacts. A pulse is a ring running outward; dots it passes are kicked
 * away and heat from ink through red and amber to white, then cool. The name
 * pulses on its own, the pointer is a smaller source, a click is a burst, and
 * now and then a dot decays and flies off. With motion off the dots sit still.
 * Off screen it does no work at all.
 */
const AMBER = [244, 150, 48];
const WHITE = [255, 244, 214];

const rgb = (hex) => {
	const h = hex.trim().replace('#', '');
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** @param {HTMLElement} el the h1 holding .wm-text and canvas.wm-dots @param {() => boolean} still */
export function radiate(el, still) {
	const cv = el.querySelector('canvas');
	const text = el.querySelector('.wm-text');
	const cx = cv?.getContext('2d');
	if (!cv || !text || !cx) return;
	const css = getComputedStyle(document.documentElement);
	let dots = [];
	let rings = [];
	let W = 0;
	let H = 0;
	let dpr = 1;
	let mx = -1e4;
	let my = -1e4;
	let lastPulse = 0;
	let lastAuto = 0;
	let running = false;
	let raf = 0;
	let step = 5;
	let last = 0;

	const layout = () => {
		const box = cv.getBoundingClientRect();
		// whole pixels: the image data below is indexed by row width
		W = Math.round(box.width);
		H = Math.round(box.height);
		if (!W || !H) return;
		dpr = Math.min(2, devicePixelRatio || 1);
		cv.width = W * dpr;
		cv.height = H * dpr;
		const off = document.createElement('canvas');
		off.width = W;
		off.height = H;
		const o = off.getContext('2d', { willReadFrequently: true });
		const f = getComputedStyle(text);
		o.font = `${f.fontWeight} ${f.fontSize} ${f.fontFamily}`;
		if ('fontStretch' in o) o.fontStretch = 'condensed';
		if ('letterSpacing' in o) o.letterSpacing = f.letterSpacing;
		o.textBaseline = 'middle';
		for (const line of text.children) {
			const r = line.getBoundingClientRect();
			o.fillText(line.textContent, r.left - box.left, r.top - box.top + r.height / 2);
		}
		const data = o.getImageData(0, 0, W, H).data;
		step = Math.max(4, Math.round(parseFloat(f.fontSize) / 22));
		const old = dots;
		const fresh = !old.length && !still();
		dots = [];
		for (let y = 0; y < H; y += step)
			for (let x = 0; x < W; x += step)
				if (data[(y * W + x) * 4 + 3] > 128) {
					const p = old[dots.length];
					dots.push({ tx: x, ty: y, x: p ? p.x : fresh ? Math.random() * W : x, y: p ? p.y : fresh ? Math.random() * H : y, vx: 0, vy: 0, e: fresh ? 1 : 0, ph: Math.random() * 6.283 });
				}
		el.classList.toggle('is-dots', dots.length > 0);
	};

	const pulse = (x, y, power) => rings.push({ x, y, r: 0, power, speed: 520 + power * 380 });
	const local = (e) => {
		const r = cv.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top];
	};
	el.addEventListener('pointermove', (e) => {
		[mx, my] = local(e);
		if (!still() && e.timeStamp - lastPulse > 650) {
			lastPulse = e.timeStamp;
			pulse(mx, my, 0.45);
		}
	});
	el.addEventListener('pointerleave', () => (mx = my = -1e4));
	el.addEventListener('pointerdown', (e) => !still() && pulse(...local(e), 1.6));

	const tick = (now) => {
		raf = 0;
		if (!running) return;
		const dt = Math.min(0.033, (now - (last || now)) / 1000);
		last = now;
		const calm = still();
		const ink = rgb(css.getPropertyValue('--ink'));
		const red = rgb(css.getPropertyValue('--stamp'));
		cx.setTransform(dpr, 0, 0, dpr, 0, 0);
		cx.clearRect(0, 0, W, H);
		if (calm) rings = [];
		else if (dots.length) {
			if (now - lastAuto > 2200) {
				lastAuto = now;
				const d = dots[(Math.random() * dots.length) | 0];
				pulse(d.tx, d.ty, 0.7);
			}
			if (Math.random() < dt * 6) {
				const d = dots[(Math.random() * dots.length) | 0];
				const a = Math.random() * 6.283;
				const s = 500 + Math.random() * 700;
				d.vx += Math.cos(a) * s;
				d.vy += Math.sin(a) * s;
				d.e = 1;
			}
		}
		for (const g of rings) g.r += g.speed * dt;
		rings = rings.filter((g) => g.r < 420 * g.power + 200);
		for (const g of rings) {
			const fade = 1 - g.r / (420 * g.power + 200);
			cx.strokeStyle = `rgba(${red},${0.4 * fade})`;
			cx.lineWidth = 1 + 3 * fade;
			cx.beginPath();
			cx.arc(g.x, g.y, g.r, 0, 6.283);
			cx.stroke();
		}
		const R = 90;
		for (const d of dots) {
			if (!calm) {
				for (const g of rings) {
					const dx = d.x - g.x;
					const dy = d.y - g.y;
					const dist = Math.hypot(dx, dy) || 1;
					const band = Math.abs(dist - g.r);
					if (band < 14) {
						const f = (1 - band / 14) * (1 - g.r / (420 * g.power + 200)) * g.power;
						d.vx += (dx / dist) * f * 2600 * dt;
						d.vy += (dy / dist) * f * 2600 * dt;
						d.e = Math.min(1, d.e + f * 1.4);
					}
				}
				const dx = d.x - mx;
				const dy = d.y - my;
				const dd = dx * dx + dy * dy;
				if (dd < R * R) {
					const n = Math.sqrt(dd) || 1;
					const f = (1 - n / R) * 2600;
					d.vx += (dx / n) * f * dt;
					d.vy += (dy / n) * f * dt;
					d.e = Math.min(1, d.e + dt * 3);
				}
				d.vx += ((d.tx - d.x) * 30 - d.vx * 7) * dt;
				d.vy += ((d.ty - d.y) * 30 - d.vy * 7) * dt;
				d.x += d.vx * dt;
				d.y += d.vy * dt;
				d.e = Math.max(0, d.e - dt * 0.9);
			} else {
				d.x = d.tx;
				d.y = d.ty;
				d.e = 0;
			}
			const e = Math.max(0, d.e + (calm ? 0 : 0.35 * Math.sin(now / 140 + d.ph) * d.e));
			const c = e > 0.75 ? mix(AMBER, WHITE, (e - 0.75) / 0.25) : e > 0.35 ? mix(red, AMBER, (e - 0.35) / 0.4) : mix(ink, red, e / 0.35);
			cx.shadowBlur = e > 0.25 ? 12 * e : 0;
			cx.shadowColor = `rgba(${AMBER},${e})`;
			cx.fillStyle = `rgb(${c})`;
			cx.beginPath();
			cx.arc(d.x, d.y, step * (0.42 + 0.25 * e), 0, 6.283);
			cx.fill();
		}
		cx.shadowBlur = 0;
		raf = requestAnimationFrame(tick);
	};

	new IntersectionObserver(([entry]) => {
		running = entry.isIntersecting;
		last = 0;
		if (running && !raf) raf = requestAnimationFrame(tick);
	}).observe(el);
	new ResizeObserver(layout).observe(el);
	document.fonts.ready.then(layout);
}
