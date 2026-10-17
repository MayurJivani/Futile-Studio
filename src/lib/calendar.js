/**
 * A month as a wall calendar draws it: weeks starting on Monday, padded with
 * the neighbouring months' days so every row is seven long.
 */

/** @returns {Array<Array<{ d: number, inMonth: boolean, y: number, m: number }>>} */
export function monthGrid(year, month) {
	const first = new Date(year, month, 1);
	const lead = (first.getDay() + 6) % 7; // Monday = 0
	const days = new Date(year, month + 1, 0).getDate();
	const cells = [];
	for (let i = -lead; cells.length < lead + days || cells.length % 7; i++) {
		const date = new Date(year, month, 1 + i);
		cells.push({ d: date.getDate(), inMonth: date.getMonth() === month, y: date.getFullYear(), m: date.getMonth() });
	}
	const weeks = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
	return weeks;
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
