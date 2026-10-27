// node server/lib/presence.selfcheck.js
import assert from 'node:assert/strict';
import { clientIp } from './presence.js';

const loop = { remoteAddress: '127.0.0.1' };
/* what reaches the API on Jinx: Caddy has rewritten X-Forwarded-For to loopback */
const viaTunnel = (cf) => ({ socket: loop, headers: { 'cf-connecting-ip': cf, 'x-forwarded-for': '127.0.0.1' } });

assert.equal(clientIp(viaTunnel('203.0.113.7'), true), '203.0.113.7', 'Cloudflare names the visitor');
assert.notEqual(clientIp(viaTunnel('203.0.113.7'), true), clientIp(viaTunnel('198.51.100.2'), true), 'two visitors stay two');
assert.equal(clientIp({ socket: loop, headers: { 'x-forwarded-for': '6.6.6.6, 198.51.100.2' } }, true), '198.51.100.2', 'other proxies: last hop');
assert.equal(clientIp(viaTunnel('203.0.113.7'), false), '127.0.0.1', 'headers ignored unless behind the proxy');
assert.equal(clientIp({ socket: {}, headers: {} }, true), 'unknown');

console.log('presence: 5 checks passed');
