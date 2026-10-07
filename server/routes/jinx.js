// Read-only vitals for the /jinx page, so the numbers on it are measured
// rather than written down. No auth: everything here is already implied by the
// public README, and nothing identifies the box.
//
// Deliberately NOT reported: hostname, network interfaces, usernames, env,
// disk paths, and the exact Node patch version. A homelab showcase does not
// need to hand over a fingerprint to get its point across.

import { Router } from 'express';
import os from 'node:os';
import { statfs } from 'node:fs/promises';

const router = Router();

const startedAt = Date.now();

/* Requests this process has answered since it woke up. Reset by a restart, and
   labelled that way on the page, so it stays a true statement either way. */
let served = 0;
export function countRequest() {
	served += 1;
}

/* The CPU model is the one hardware detail worth showing on a homelab page.
   Read once: it cannot change without a reboot, and os.cpus() walks every core. */
const cpu = os.cpus();
const cpuModel = (cpu[0]?.model || 'unknown').replace(/\s+/g, ' ').trim();

router.get('/', async (req, res) => {
	const total = os.totalmem();
	const free = os.freemem();

	/* Disk is the one figure that needs the filesystem. If it refuses, the rest
	   of the payload still goes out: a partial answer beats a 500 here. */
	let disk;
	try {
		const fs = await statfs('/');
		const blockTotal = fs.blocks * fs.bsize;
		const blockFree = fs.bavail * fs.bsize;
		disk = { total: blockTotal, free: blockFree, used: blockTotal - blockFree };
	} catch {
		disk = null;
	}


	res.set('Cache-Control', 'public, max-age=15');
	res.json({
		ok: true,
		// Seconds. The page formats these; the server stays unopinionated.
		processUptime: Math.floor(process.uptime()),
		hostUptime: Math.floor(os.uptime()),
		servingSince: startedAt,
		platform: process.platform,
		arch: process.arch,
		// Major only: "which runtime" is the interesting part, the patch
		// number is just a hint about what is unpatched.
		node: process.versions.node.split('.')[0],
		cpus: cpu.length,
		cpuModel,
		loadavg: os.loadavg().map((n) => Number(n.toFixed(2))),
		memory: { total, free, used: total - free },
		disk,
		served,
	});
});

export default router;
