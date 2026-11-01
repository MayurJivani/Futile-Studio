/* Paints a stored card onto a Postcard.astro card, so the desk, the mailbox
   and the tracking page all draw it from the same data the same way.
   Everything in `c` may have come from a stranger: it is only ever set as
   text, an attribute the page chose, or an image URL the server named. */
import { kinds, inks, postmarks, postmarkTilt } from '../data/postcards.js';
import { countryName } from '../data/postal.js';

export const cardNo = (id) => `FP-${String(id).padStart(6, '0')}`;
export const STUDIO_ADDRESS = ['Mayur Jivani', 'futile.studio', 'Paderborn, DE'];
const EMPTY = 'Your message appears here as you write.';

/** Who a card is addressed to: the studio, or for a reply, the visitor and their country. */
export const addressOf = (card) => (card.direction === 'out' ? [card.addressee || 'A visitor', countryName(card.country) || 'Somewhere on Earth'] : STUDIO_ADDRESS);

/** A stored card as paint() wants it. `media` is where the API serves photos from. */
export const fromStored = (card, media) => ({
	...card,
	image: /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(card.image) ? `${media}/api/postcards/photos/${card.image}` : '',
	date: postmarkDate(`${card.created_at.replace(' ', 'T')}Z`),
	to: addressOf(card),
});

/* a long message gets smaller writing instead of running off the card; newlines cost a short line each */
export const writingSize = (text) => Math.max(2.1, Math.min(3.4, Math.sqrt(4000 / Math.max(1, text.length + (text.match(/\n/g)?.length ?? 0) * 14))));

/**
 * c: { kind, design, paper, ink, postmark, prompt, message, signed, image (URL or ''), date, to (lines) }.
 * `still` makes the postmark and stamp plain pictures, for cards that are being read, not written.
 */
export function paint(wrap, c, { still = false } = {}) {
	const q = (s) => wrap.querySelector(s);
	const k = kinds.find((x) => x.id === c.kind) ?? kinds[0];
	wrap.dataset.kind = k.id;
	wrap.dataset.paper = c.paper || 'cream';
	wrap.dataset.design = c.design || 'classic';
	wrap.style.setProperty('--ink', (inks.find((i) => i.id === c.ink) ?? inks[0]).color);
	wrap.querySelectorAll('[data-for]').forEach((el) => (el.hidden = el.dataset.for !== k.id));
	q('[data-greeting]').textContent = k.greeting;
	q('[data-prompt]').textContent = k.prompts[c.prompt] ?? k.prompts[0];

	const text = (c.message ?? '').trim();
	const t = q('[data-text]');
	t.textContent = text || EMPTY;
	t.dataset.empty = String(!text);
	t.style.fontSize = `${writingSize(text)}cqi`;
	q('[data-from]').textContent = c.signed ? `from ${c.signed}` : '';

	const i = Number(c.postmark) || 0;
	const [a, b] = postmarks[i] ?? postmarks[0];
	const pm = q('[data-postmark]');
	pm.querySelector('.pm-1').textContent = a;
	pm.querySelector('.pm-2').textContent = b === 'today' ? c.date : b;
	pm.style.setProperty('--pm-rot', `${postmarkTilt[i] ?? -12}deg`);

	const img = q('[data-photo]');
	if (c.image) {
		if (img.getAttribute('src') !== c.image) img.src = c.image;
		wrap.dataset.photo = '';
	} else {
		img.removeAttribute('src');
		delete wrap.dataset.photo;
	}
	img.hidden = !c.image;

	const to = q('[data-to]');
	to.replaceChildren(...(c.to ?? STUDIO_ADDRESS).flatMap((line, n) => (n ? [document.createElement('br'), line] : [line])));

	if (still) {
		pm.disabled = true;
		pm.removeAttribute('aria-label');
		const stamp = q('[data-stamp]');
		stamp.disabled = true;
		stamp.querySelector('.visually-hidden').textContent = `Stamp: ${k.stamp.title}`;
	}
}

/** Turn a card over. The side facing away is inert, so nobody tabs into what they cannot see. */
export function turn(wrap, toBack) {
	wrap.querySelector('.card').classList.toggle('is-back', toBack);
	wrap.querySelector('[data-face="front"]').inert = toBack;
	wrap.querySelector('[data-face="back"]').inert = !toBack;
}

/** The date a postmark prints: day, month, year, as the desk shows it. */
export const postmarkDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
