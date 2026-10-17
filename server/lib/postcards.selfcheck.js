// node server/lib/postcards.selfcheck.js
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { validatePostcard, makePostcards, MIN_MS_ON_PAGE } from './postcards.js';

const good = { kind: 'hello', message: 'Hi there', signed: 'Ana', reply: 'ana@example.com', elapsed: MIN_MS_ON_PAGE + 1 };
assert.ok(validatePostcard(good).ok, 'a normal card passes');
assert.ok(validatePostcard({ ...good, website: 'http://spam' }).spam, 'the honeypot catches bots');
assert.ok(validatePostcard({ ...good, elapsed: 200 }).spam, 'too fast is refused');
assert.ok(validatePostcard({ ...good, elapsed: undefined }).spam, 'no timing is refused');
assert.equal(validatePostcard({ ...good, kind: 'secret' }).ok, false, 'only the desk’s kinds');
assert.equal(validatePostcard({ ...good, message: '   ' }).ok, false, 'blank is refused');
assert.equal(validatePostcard({ ...good, message: 'x'.repeat(501) }).ok, false, 'over length is refused, not cut');
assert.equal(validatePostcard({ ...good, message: 42 }).ok, false, 'message must be text');
assert.equal(validatePostcard({ ...good, reply: 'not an email' }).ok, false, 'reply must look like an address');
assert.equal(validatePostcard({ ...good, reply: '' }).ok, true, 'reply is optional');
const ctl = validatePostcard({ ...good, message: 'a\u0000b\u0007c\nd', signed: 'x'.repeat(90) });
assert.equal(ctl.value.message, 'abc\nd', 'control characters go, newlines stay');
assert.equal(ctl.value.signed.length, 60, 'signature is bounded');
assert.equal(validatePostcard(null).ok, false, 'no body');

const box = makePostcards(new DatabaseSync(':memory:'));
const id = box.store(validatePostcard(good).value, 'SentientCat');
assert.ok(id > 0, 'stored with an id');
assert.equal(box.list()[0].visitor, 'SentientCat', 'the server-side name is kept');
assert.equal(box.remove(id), true, 'admin can remove');
console.log('postcards: checks passed');
