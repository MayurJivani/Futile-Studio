/**
 * What Jinx is made of, and what it hands out.
 *
 * Static on purpose: this is the shape of the box, which only changes when I
 * change it. The numbers that move come from the live
 * /api/jinx endpoint, so every figure on the page is measured at the moment
 * you load it.
 */

export const layers = [
	{
		name: 'Proxmox',
		role: 'The floor everything stands on',
		note: 'Bare metal, carved into VMs so a careless experiment stays inside its own.',
		art: 'layers',
	},
	{
		name: 'Docker',
		role: 'One box per project',
		note: 'One container each, with its own memory cap, published on loopback.',
		art: 'crate',
	},
	{
		name: 'Caddy',
		role: 'The doorman',
		note: 'Reads the hostname and hands the request to whichever container answers to it.',
		art: 'door',
	},
	{
		name: 'Cloudflare Tunnel',
		role: 'The way in',
		note: 'The tunnel dials out from the box and holds the line open, so Cloudflare is the only way in.',
		art: 'tunnel',
	},
	{
		name: 'Backups',
		role: 'The thankless one',
		note: 'Nightly, off the box, and restored on purpose now and then, because a restored backup is the only kind that counts.',
		art: 'archive',
	},
];
