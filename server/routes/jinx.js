// Read-only vitals for the /jinx page, so the numbers on it are measured
// rather than written down. No auth: everything here is already implied by the
// public README, and nothing identifies the box.
//
// Deliberately NOT reported: hostname, network interfaces, usernames, env,
// disk paths, and the exact Node patch version. A homelab showcase does not
// need to hand over a fingerprint to get its point across.

import { Router } from 'express';
import os from 'node:os';

const router = Router();

const startedAt = Date.now();

router.get('/', (req, res) => {
	const total = os.totalmem();
	const free = os.freemem();

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
		cpus: os.cpus().length,
		loadavg: os.loadavg().map((n) => Number(n.toFixed(2))),
		memory: { total, free, used: total - free },
	});
});

export default router;
