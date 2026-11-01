// Photos on postcards come from strangers. The type is sniffed from the bytes
// (never the declared mime or the filename), only JPEG, PNG and WebP pass, and
// everything that is not picture data is cut out before the file is written:
// EXIF (GPS, camera serials), XMP, comments and text chunks. A JPEG keeps its
// orientation, rebuilt as a one-tag EXIF block, so phone photos stay upright.
// Nothing is decoded or re-encoded (there is no image library installed); a
// file whose structure does not parse is refused rather than passed through.

import { fileTypeFromBuffer } from 'file-type';

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

/** { ext, data } with the metadata gone, or null for anything else. */
export async function cleanImage(buf) {
	const type = await fileTypeFromBuffer(buf);
	const ext = type && EXT[type.mime];
	if (!ext) return null;
	const data = ext === '.jpg' ? jpeg(buf) : ext === '.png' ? png(buf) : webp(buf);
	if (!data) return null;
	const again = await fileTypeFromBuffer(data);
	return again?.mime === type.mime ? { ext, data } : null;
}

/* ---- JPEG: keep JFIF, ICC and Adobe segments and everything from the scan on ---- */
function jpeg(buf) {
	if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
	const keep = [buf.subarray(0, 2)];
	let orientation = 0;
	let i = 2;
	while (i + 4 <= buf.length) {
		if (buf[i] !== 0xff) return null;
		const marker = buf[i + 1];
		if (marker === 0xff) {
			i++;
			continue;
		}
		if (marker === 0xda) {
			keep.push(buf.subarray(i));
			if (orientation > 1) keep.splice(1, 0, exifOrientation(orientation));
			return Buffer.concat(keep);
		}
		const len = buf.readUInt16BE(i + 2);
		if (len < 2 || i + 2 + len > buf.length) return null;
		const seg = buf.subarray(i, i + 2 + len);
		const body = seg.subarray(4);
		const app = marker >= 0xe0 && marker <= 0xef;
		if (marker === 0xe1 && body.subarray(0, 6).toString('latin1') === 'Exif\0\0') orientation = readOrientation(body.subarray(6)) || orientation;
		const wanted = !app && marker !== 0xfe ? true : marker === 0xe0 || marker === 0xee || (marker === 0xe2 && body.subarray(0, 12).toString('latin1') === 'ICC_PROFILE\0');
		if (wanted) keep.push(seg);
		i += 2 + len;
	}
	return null;
}

function readOrientation(tiff) {
	if (tiff.length < 8) return 0;
	const le = tiff.toString('latin1', 0, 2) === 'II';
	const u16 = (o) => (o + 2 <= tiff.length ? (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o)) : -1);
	const u32 = (o) => (o + 4 <= tiff.length ? (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o)) : -1);
	const ifd = u32(4);
	const n = u16(ifd);
	for (let k = 0; ifd >= 0 && k < n; k++) {
		const e = ifd + 2 + k * 12;
		if (u16(e) === 0x0112) {
			const v = u16(e + 8);
			return v >= 1 && v <= 8 ? v : 0;
		}
	}
	return 0;
}

function exifOrientation(v) {
	const b = Buffer.alloc(36);
	b.writeUInt16BE(0xffe1, 0);
	b.writeUInt16BE(34, 2);
	b.write('Exif\0\0MM\0*', 4, 'latin1');
	b.writeUInt32BE(8, 14); // IFD0 right after the TIFF header
	b.writeUInt16BE(1, 18); // one entry
	b.writeUInt16BE(0x0112, 20); // Orientation
	b.writeUInt16BE(3, 22); // SHORT
	b.writeUInt32BE(1, 24);
	b.writeUInt16BE(v, 28);
	return b; // next-IFD offset stays 0
}

/* ---- PNG: critical chunks plus the ones that change how colours look ---- */
const PNG_KEEP = new Set(['tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT']);
function png(buf) {
	const out = [buf.subarray(0, 8)];
	let i = 8;
	while (i + 12 <= buf.length) {
		const len = buf.readUInt32BE(i);
		const type = buf.toString('latin1', i + 4, i + 8);
		if (i + 12 + len > buf.length) return null;
		const critical = type[0] >= 'A' && type[0] <= 'Z';
		if (critical || PNG_KEEP.has(type)) out.push(buf.subarray(i, i + 12 + len));
		i += 12 + len;
		if (type === 'IEND') return Buffer.concat(out);
	}
	return null;
}

/* ---- WebP: drop the EXIF and XMP chunks and the header flags that announce them ---- */
function webp(buf) {
	if (buf.length < 12) return null;
	const out = [];
	let i = 12;
	while (i + 8 <= buf.length) {
		const id = buf.toString('latin1', i, i + 4);
		const len = buf.readUInt32LE(i + 4);
		const end = i + 8 + len + (len & 1);
		if (i + 8 + len > buf.length) return null;
		if (id !== 'EXIF' && id !== 'XMP ') {
			const chunk = Buffer.from(buf.subarray(i, Math.min(end, buf.length)));
			if (id === 'VP8X' && len >= 1) chunk[8] &= ~0x0c;
			out.push(chunk);
		}
		i = end;
	}
	if (!out.length) return null;
	const body = Buffer.concat(out);
	const head = Buffer.from('RIFF\0\0\0\0WEBP', 'latin1');
	head.writeUInt32LE(body.length + 4, 4);
	return Buffer.concat([head, body]);
}
