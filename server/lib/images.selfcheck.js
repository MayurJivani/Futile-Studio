// node server/lib/images.selfcheck.js
import assert from 'node:assert/strict';
import { cleanImage } from './images.js';

const seg = (marker, body) => {
	const b = Buffer.alloc(4);
	b.writeUInt16BE(marker, 0);
	b.writeUInt16BE(body.length + 2, 2);
	return Buffer.concat([b, body]);
};
/* a little-endian EXIF block with Orientation 6 and a GPS-looking string to be stripped */
const tiff = Buffer.alloc(26);
tiff.write('II*\0', 0, 'latin1');
tiff.writeUInt32LE(8, 4);
tiff.writeUInt16LE(1, 8);
tiff.writeUInt16LE(0x0112, 10);
tiff.writeUInt16LE(3, 12);
tiff.writeUInt32LE(1, 14);
tiff.writeUInt16LE(6, 18);
const exif = seg(0xffe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, Buffer.from('GPS 51.7189N 8.7575E')]));
const jfif = seg(0xffe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
const comment = seg(0xfffe, Buffer.from('shot on a secret phone'));
const dqt = seg(0xffdb, Buffer.alloc(65, 1));
const scan = Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, exif, comment, dqt, scan]);

const j = await cleanImage(jpg);
assert.equal(j.ext, '.jpg');
assert.ok(!j.data.includes('GPS 51.7189N'), 'EXIF payload is gone');
assert.ok(!j.data.includes('secret phone'), 'comments are gone');
assert.ok(j.data.includes(dqt) && j.data.includes(scan), 'picture data is untouched');
const kept = j.data.indexOf(Buffer.from('Exif\0\0MM', 'latin1'));
assert.ok(kept > 0, 'a fresh one-tag EXIF block is written');
assert.equal(j.data.readUInt16BE(kept + 24), 6, 'and it keeps the orientation');
assert.equal(await cleanImage(Buffer.concat([jpg.subarray(0, 30), Buffer.from([0x00, 0x11])])), null, 'a broken JPEG is refused');

const crcless = (type, body) => {
	const b = Buffer.alloc(8);
	b.writeUInt32BE(body.length, 0);
	b.write(type, 4, 'latin1');
	return Buffer.concat([b, body, Buffer.alloc(4)]);
};
const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = crcless('IHDR', Buffer.alloc(13, 1));
const pngIn = Buffer.concat([sig, ihdr, crcless('tEXt', Buffer.from('Author\0Somebody')), crcless('gAMA', Buffer.alloc(4)), crcless('IDAT', Buffer.alloc(10)), crcless('IEND', Buffer.alloc(0))]);
const p = await cleanImage(pngIn);
assert.equal(p.ext, '.png');
assert.ok(!p.data.includes('Somebody') && p.data.includes('gAMA') && p.data.includes('IDAT'), 'PNG text chunks go, colour and data stay');

const riff = (id, body) => {
	const b = Buffer.alloc(8);
	b.write(id, 0, 'latin1');
	b.writeUInt32LE(body.length, 4);
	return Buffer.concat([b, body, Buffer.alloc(body.length & 1)]);
};
const vp8x = Buffer.alloc(10);
vp8x[0] = 0x0c; // EXIF and XMP flags set
const chunks = Buffer.concat([riff('VP8X', vp8x), riff('VP8 ', Buffer.alloc(11, 2)), riff('EXIF', Buffer.from('camera serial 1234')), riff('XMP ', Buffer.from('<x/>'))]);
const head = Buffer.from('RIFF\0\0\0\0WEBP', 'latin1');
head.writeUInt32LE(chunks.length + 4, 4);
const w = await cleanImage(Buffer.concat([head, chunks]));
assert.equal(w.ext, '.webp');
assert.ok(!w.data.includes('camera serial') && !w.data.includes('<x/>'), 'WebP metadata chunks go');
assert.equal(w.data[20] & 0x0c, 0, 'and the header stops announcing them');
assert.equal(w.data.readUInt32LE(4), w.data.length - 8, 'RIFF size is rewritten');

assert.equal(await cleanImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null, 'SVG is refused');
assert.equal(await cleanImage(Buffer.from('GIF89a......')), null, 'GIF is refused');
assert.equal(await cleanImage(Buffer.from('hello')), null, 'text is refused');
console.log('images: checks passed');
