// node server/lib/postcards.selfcheck.js
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { validatePostcard, makePostcards, MIN_MS_ON_PAGE, countryOf, journey } from './postcards.js';

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
assert.equal(validatePostcard({ ...good, message: `${'x'.repeat(498)}\r\ny` }).value.message, `${'x'.repeat(498)}\ny`, 'a form CRLF is one character, as the textarea counted it');
assert.equal(ctl.value.signed.length, 60, 'signature is bounded');
assert.equal(validatePostcard(null).ok, false, 'no body');

const look = validatePostcard({ ...good, design: 'night', paper: 'graph', ink: 'forest', postmark: '3', prompt: '2' }).value;
assert.deepEqual([look.design, look.paper, look.ink, look.postmark, look.prompt], ['night', 'graph', 'forest', 3, 2], 'the look is kept, numbers from a form included');
const odd = validatePostcard({ ...good, design: '<script>', paper: 'gold', postmark: 99, prompt: -1 }).value;
assert.deepEqual([odd.design, odd.paper, odd.postmark, odd.prompt], ['classic', 'cream', 0, 0], 'an unknown look falls back to the default');
assert.ok(validatePostcard({ ...good, website: 'x', elapsed: 0 }, { owner: true }).ok, 'the owner skips the spam checks');
assert.equal(validatePostcard({ ...good }, { owner: true }).value.reply, '', 'and has no reply address');
assert.equal(countryOf('us'), 'US');
assert.equal(countryOf('XX'), '', 'unknown country');
assert.equal(countryOf('T1'), '', 'Tor');
assert.equal(countryOf(undefined), '');

/* a box from before cards remembered their look: the migration adds columns and tracking codes */
const old = new DatabaseSync(':memory:');
old.exec(`CREATE TABLE postcards (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, message TEXT NOT NULL, signed TEXT NOT NULL DEFAULT '',
	reply TEXT NOT NULL DEFAULT '', visitor TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
	INSERT INTO postcards (kind, message) VALUES ('hello', 'Test card from the postcard fix.');`);
const migrated = makePostcards(old).list()[0];
assert.equal(migrated.message, 'Test card from the postcard fix.', 'old cards survive');
assert.equal(migrated.design, 'classic', 'with the default look');
assert.match(migrated.track, /^[a-f0-9]{24}$/, 'and a tracking code');
makePostcards(old);
assert.equal(makePostcards(old).list()[0].track, migrated.track, 'migrating twice changes nothing');

const box = makePostcards(new DatabaseSync(':memory:'));
const { id, track } = box.store(validatePostcard(good).value, { visitor: 'SentientCat', country: 'FR', image: 'abc.jpg' });
assert.ok(id > 0, 'stored with an id');
assert.equal(box.list()[0].visitor, 'SentientCat', 'the server-side name is kept');
assert.equal(box.byTrack(track).id, id, 'found by its tracking code');
assert.equal(box.byTrack("' OR 1=1 --"), undefined, 'only real codes are looked up');
const reply = box.store(validatePostcard(good, { owner: true }).value, { direction: 'out', parent: id, country: 'FR', image: 'def.png' });
assert.deepEqual(box.replies(id).map((r) => r.id), [reply.id], 'a reply hangs off its card');
const fresh = box.get(id);
assert.equal(journey(fresh).delivered, false, 'a card that was just posted is still on its way');
assert.equal(journey(fresh, Date.parse(journey(fresh).deliveredAt)).delivered, true, 'and arrives on schedule');
assert.deepEqual(box.remove(id).sort(), ['abc.jpg', 'def.png'], 'removing a card hands back its photos and its replies');
assert.equal(box.list().length, 0, 'replies go with it');
assert.equal(box.remove(id), null, 'nothing to remove twice');
console.log('postcards: checks passed');
