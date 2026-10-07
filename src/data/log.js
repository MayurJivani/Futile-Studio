/**
 * The log book: every project, dated from its GitHub repository rather than
 * from memory. The date is the month the repo was created, which is the month
 * the thing started existing, and the only date here that is a fact rather than
 * a recollection.
 *
 * Wider than the board on purpose. The board is the curated handful worth
 * opening; this is the whole run, including the early ones that taught me
 * something and then stopped.
 *
 * Client work and coursework stay out: those repos belong to other people.
 */
export const entries = [
	{ month: '2022-10', name: 'Chorus (PHP)', note: 'the first swing at the music game' },
	{ month: '2023-04', name: 'Zenspace' },
	{ month: '2023-05', name: 'KemChoAhmdavad bot' },
	{ month: '2023-08', name: 'Qno (desktop)', note: 'the C# original' },
	{ month: '2023-12', name: 'Chorusify', note: 'the one that stuck' },
	{ month: '2024-07', name: 'Mysic' },
	{ month: '2024-08', name: 'Qno for the web' },
	{ month: '2025-02', name: 'Peerly' },
	{ month: '2026-03', name: 'Futile Studio', note: 'this page' },
	{ month: '2026-04', name: 'Mosaic' },
	{ month: '2026-09', name: "Noggin'" },
	{ month: '2026-09', name: 'Knock' },
	{ month: '2026-09', name: 'Sextant' },
	{ month: '2026-09', name: 'Murmur' },
	{ month: '2026-09', name: 'Patina' },
	{ month: '2026-10', name: 'Orbitle' },
	{ month: '2026-10', name: 'Cubby' },
	{ month: '2026-10', name: 'Lab' },
];

/** Grouped by month, so a busy month is one lookup rather than a filter. */
export const byMonth = entries.reduce((acc, e) => {
	(acc[e.month] ||= []).push(e);
	return acc;
}, {});

export const firstYear = Number(entries[0].month.slice(0, 4));
