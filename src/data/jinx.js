/**
 * What Jinx is made of, and what it hands out.
 *
 * Static on purpose: this is the shape of the box, which only changes when I
 * change it. The numbers that move come from the live /api/jinx endpoint, so
 * every figure on the page is measured at the moment you load it.
 *
 * Rebuilt on 2026-10-17 after the old disk failed: Debian 13 straight on the
 * hardware, no hypervisor and no Docker, one systemd unit per app (see
 * FRC/DEPLOY.md, "Deploying to Jinx").
 */

export const layers = [
	{
		name: 'Debian 13',
		role: 'The floor everything stands on',
		note: 'One operating system straight on the hardware. No VMs and no Docker: every app is a systemd unit running Node 22, with its own memory cap and the same hardening lines.',
	},
	{
		name: 'Services',
		role: 'One unit per project',
		note: 'Each app with a server of its own runs as its own service on its own port, reachable only through Caddy. The ones that need real persistence share one local Postgres 17, a role and a database each.',
	},
	{
		name: 'Caddy',
		role: 'The doorman',
		note: 'Reads the hostname and either serves the files itself or hands the request to whichever service answers to it.',
	},
	{
		name: 'Cloudflare Tunnel',
		role: 'The way in',
		note: 'cloudflared dials out from the box and holds the line open, so from the internet Cloudflare is the only way in.',
	},
	{
		name: 'The disk',
		role: 'The weak spot',
		note: 'Failing, by its own SMART report. Logs, /tmp and swap live in RAM and the disk is mounted to write as little as it can; only the apps and Postgres are written to it.',
	},
	{
		name: 'Copies off the box',
		role: 'The thankless one',
		note: 'The box is treated as disposable: a rebuild is a rerun of the setup, and anything that matters has to be copied off it, the databases first.',
	},
];

/* Which running projects are their own service and which are plain files Caddy
   serves itself. Checked against `systemctl` and the Caddy config on Jinx; a
   project not listed in either simply does not appear. */
export const SERVICES = ['patina', 'noggin', 'qno', 'mosaic', 'chorusify'];
export const STATIC = ['borderline', 'orbitle', 'knock'];
