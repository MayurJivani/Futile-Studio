// node server/lib/access.selfcheck.js
import assert from 'node:assert/strict';
import { requireAccess } from '../middleware.js';

/* One request through the gate: did it pass, and what status did it get otherwise. */
async function run(token, verify) {
	let passed = false;
	let status = 0;
	const req = { get: (h) => (h === 'cf-access-jwt-assertion' ? token : undefined) };
	const res = { status: (s) => ((status = s), { json: () => {} }) };
	await requireAccess(req, res, () => (passed = true), verify);
	return { passed, status };
}
const answer = (status) => async () => ({ status });

assert.deepEqual(await run('jwt', answer(204)), { passed: true, status: 0 }, 'a token Lab accepts passes');
assert.deepEqual(await run('jwt', answer(401)), { passed: false, status: 401 }, 'a token Lab refuses is refused');
assert.deepEqual(await run('jwt', answer(503)), { passed: false, status: 401 }, 'Access unconfigured on Lab refuses');
assert.deepEqual(await run('jwt', answer(200)), { passed: false, status: 401 }, 'only 204 counts');
assert.deepEqual(await run(undefined, answer(204)), { passed: false, status: 401 }, 'no token never asks Lab');
assert.deepEqual(await run('jwt', async () => { throw new Error('down'); }), { passed: false, status: 401 }, 'Lab down refuses');
let sent;
await run('the-jwt', async (_url, init) => ((sent = init.headers), { status: 204 }));
assert.deepEqual(sent, { 'Cf-Access-Jwt-Assertion': 'the-jwt' }, 'only the Access token goes to Lab');
console.log('access selfcheck: ok');
