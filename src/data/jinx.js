/**
 * What Jinx is made of, and what it hands out.
 *
 * Static on purpose: this is the shape of the box, which only changes when I
 * change it. The numbers that move (uptime, load, memory) come from the live
 * /api/jinx endpoint instead, so nothing on the page is a figure I typed in.
 */

export const layers = [
	{
		name: 'Proxmox',
		role: 'The floor everything stands on',
		note: 'Bare metal, carved into VMs so one careless experiment cannot take the rest down with it.',
		art: 'layers',
	},
	{
		name: 'Docker',
		role: 'One box per project',
		note: 'Every site here is a container with its own memory cap, read-only where it can be, published on loopback only.',
		art: 'crate',
	},
	{
		name: 'Caddy',
		role: 'The doorman',
		note: 'Matches the hostname on the way in and hands the request to whichever container answers to it.',
		art: 'door',
	},
	{
		name: 'Cloudflare Tunnel',
		role: 'The way in',
		note: 'No port forwarded, no static IP, nothing of mine exposed directly. The tunnel reaches out, not the other way round.',
		art: 'tunnel',
	},
	{
		name: 'Backups',
		role: 'The bit nobody thanks you for',
		note: 'Nightly, off the box, and restored on purpose every so often, because a backup you have never restored is a rumour.',
		art: 'archive',
	},
];

/** Public front doors. Each one is a container on the box. */
export const serves = [
	{ host: 'futile.studio', what: 'this page', href: 'https://futile.studio' },
	{ host: 'lab.futile.studio', what: 'the experiments index', href: 'https://lab.futile.studio' },
	{ host: 'patina.futile.studio', what: 'the year-long canvas', href: 'https://patina.futile.studio' },
	{ host: 'noggin.futile.studio', what: 'the quiz show', href: 'https://noggin.futile.studio' },
	{ host: 'qno.futile.studio', what: 'the quantum card game', href: 'https://qno.futile.studio' },
	{ host: 'mosaic.futile.studio', what: 'the stream overlay', href: 'https://mosaic.futile.studio' },
	{ host: 'chorusify.com', what: 'the music guessing game', href: 'https://chorusify.com' },
	{ host: 'knock.futile.studio', what: 'the inaudible handshake', href: 'https://knock.futile.studio' },
	{ host: '15mm.futile.studio', what: 'the deduction game', href: 'https://15mm.futile.studio' },
];
