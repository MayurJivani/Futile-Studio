/* Rate limits count per visitor, not per proxy hop. Run: node lib/security.selfcheck.js */
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
const { keyGenerator } = await import('./security.js');

const viaTunnel = (cf) => ({ ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' }, headers: { 'cf-connecting-ip': cf, 'x-forwarded-for': '127.0.0.1' } });
assert.notEqual(keyGenerator(viaTunnel('203.0.113.1')), keyGenerator(viaTunnel('203.0.113.2')), 'two visitors, two buckets');
assert.equal(keyGenerator(viaTunnel('203.0.113.1')), '203.0.113.1');
console.log('security selfcheck ok');
