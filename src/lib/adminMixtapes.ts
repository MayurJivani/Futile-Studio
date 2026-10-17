/* The Mixtapes section of /admin: tracks and tapes for the Lab's tape deck.
 *
 * Everything persists through /api/mixtapes/admin (server/routes/mixtapes.js),
 * behind the same session and CSRF token as the rest of the page. Uploads go
 * through the existing /api/media route. The rows are rebuilt with innerHTML
 * on every load, so every value passes through esc().
 */
import { API_BASE, apiFetch, esc } from './api.js';

type Track = {
	id: number;
	title: string;
	artist: string;
	artwork: string;
	src: string; // 'library:<rel>' for a /collection track
	description: string;
	enabled: boolean;
	play?: string; // what the server says an <audio> can load (a signed stream for library tracks)
};
type LibTrack = { rel: string; title: string; artist: string | null; url: string };
type Album = { id: string; title: string; artist: string | null; tracks: LibTrack[] };
type Tape = { id: number; name: string; description: string; published: boolean; isDefault: boolean; trackIds: number[] };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const val = (id: string) => $<HTMLInputElement>(id).value.trim();
const abs = (src: string) => (src.startsWith('/') ? API_BASE + src : src);

let data: { tracks: Track[]; playlists: Tape[] } = { tracks: [], playlists: [] };
let say: (msg: string) => void = () => {};
let editingTrack: number | null = null;
let editingTape: number | null = null;
let order: number[] = []; // the tape being edited, track ids in play order
let bound = false;
let catalog: Promise<Album[]> | null = null; // the /collection library, read once per page

export async function loadMixtapes(status: (msg: string) => void) {
	say = status;
	if (!bound) bind();
	const res = await apiFetch('/api/mixtapes/admin');
	if (!res.ok) return say('Could not read the mixtapes.');
	data = await res.json();
	paint();
}

const trackById = (id: number) => data.tracks.find((t) => t.id === id);

function paint() {
	$('mx-tapes').innerHTML =
		data.playlists
			.map(
				(p, i) => `
			<li class="ad-row">
				<span class="ad-row-main">
					<b>${esc(p.name)}</b>
					<i>${p.published ? 'published' : 'draft'}${p.isDefault ? ' · default' : ''} · ${p.trackIds.length} tracks</i>
					<span>${esc(p.description.slice(0, 110))}</span>
				</span>
				<span class="ad-row-act">
					<button class="btn" data-up="${i}" type="button" aria-label="Move ${esc(p.name)} up" ${i ? '' : 'disabled'}>↑</button>
					<button class="btn" data-play="${p.id}" type="button">Preview</button>
					<button class="btn" data-edit="${p.id}" type="button">Edit</button>
					<button class="btn btn-del" data-del="${p.id}" type="button">Delete</button>
				</span>
			</li>`,
			)
			.join('') || '<li class="ad-row">No mixtapes yet. Add some tracks, then make a tape.</li>';

	$('mx-tracks').innerHTML =
		data.tracks
			.map(
				(t) => `
			<li class="ad-row">
				<span class="ad-row-main">
					<b>${esc(t.title)}</b>
					<i>${esc(t.artist || 'no artist')}${t.enabled ? '' : ' · switched off'}</i>
					<span>${esc(t.src)}</span>
				</span>
				<span class="ad-row-act">
					<button class="btn" data-hear="${t.id}" type="button">Preview</button>
					<button class="btn" data-toggle="${t.id}" type="button">${t.enabled ? 'Disable' : 'Enable'}</button>
					<button class="btn" data-tedit="${t.id}" type="button">Edit</button>
					<button class="btn btn-del" data-tdel="${t.id}" type="button">Delete</button>
				</span>
			</li>`,
			)
			.join('') || '<li class="ad-row">The library is empty. New track starts it.</li>';
}

/* ---------------- preview ---------------- */

let queue: Track[] = [];
function hear(list: Track[]) {
	queue = [...list];
	next();
}
function next() {
	const audio = $<HTMLAudioElement>('mx-audio');
	const t = queue.shift();
	if (!t) return void ($('mx-now').textContent = 'Preview: end of tape');
	$('mx-now').textContent = `Preview: ${t.title}${t.artist ? ' / ' + t.artist : ''}`;
	const lib = t.src.startsWith('library:') ? libTrack(t.src.slice(8)) : undefined;
	audio.src = abs(t.play ?? lib?.url ?? t.src);
	audio.play().catch(() => ($('mx-now').textContent = `Preview: ${t.title} would not play (missing file or format)`));
}

/* ---------------- the /collection library ---------------- */

let albums: Album[] = [];
const libTrack = (rel: string) => albums.flatMap((a) => a.tracks).find((t) => t.rel === rel);

/** Read the collection catalog once and fill both pickers. */
function loadCatalog() {
	catalog ??= apiFetch('/api/music')
		.then((r) => (r.ok ? r.json() : Promise.reject()))
		.then((d: { albums: Album[] }) => {
			albums = d.albums;
			$('mt-lib').innerHTML =
				'<option value="">Pick a track...</option>' +
				albums
					.map(
						(a) =>
							`<optgroup label="${esc(a.title)}${a.artist ? ' / ' + esc(a.artist) : ''}">${a.tracks
								.map((t) => `<option value="${esc(t.rel)}">${esc(t.title)}</option>`)
								.join('')}</optgroup>`,
					)
					.join('');
			$('mp-album').innerHTML =
				'<option value="">Add a whole album from the collection...</option>' +
				albums.map((a) => `<option value="${esc(a.id)}">${esc(a.title)}${a.artist ? ' / ' + esc(a.artist) : ''} (${a.tracks.length})</option>`).join('');
			return albums;
		})
		.catch(() => {
			catalog = null;
			$('mt-lib').innerHTML = '<option value="">The collection did not load</option>';
			return [];
		});
	return catalog;
}

const albumArtist = (t: LibTrack) => t.artist ?? albums.find((a) => a.tracks.includes(t))?.artist ?? '';

/* ---------------- writes ---------------- */

async function send(path: string, method: string, body?: unknown) {
	const res = await apiFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
	const out = await res.json().catch(() => ({}));
	return res.ok ? { ok: true as const, out } : { ok: false as const, error: out.error || `Failed (${res.status})` };
}

const trackBody = (t: Partial<Track>) => ({
	title: t.title,
	artist: t.artist,
	src: t.src,
	artwork: t.artwork,
	description: t.description,
	enabled: t.enabled,
});
const tapeBody = (p: Tape) => ({
	name: p.name,
	description: p.description,
	published: p.published,
	isDefault: p.isDefault,
	trackIds: p.trackIds,
});

async function upload(fileInput: string, target: string, err: HTMLElement) {
	const input = $<HTMLInputElement>(fileInput);
	const file = input.files?.[0];
	if (!file) return;
	const form = new FormData();
	form.append('file', file);
	err.textContent = 'Uploading...';
	const res = await apiFetch('/api/media', { method: 'POST', body: form });
	const out = await res.json().catch(() => ({}));
	err.textContent = res.ok ? '' : out.error || 'Upload failed.';
	if (res.ok) $<HTMLInputElement>(target).value = out.url;
	input.value = '';
}

/* ---------------- editors ---------------- */

function openTrack(t?: Track) {
	editingTrack = t?.id ?? null;
	$('mx-track-head').textContent = t ? `Edit ${t.title}` : 'New track';
	$<HTMLInputElement>('mt-title').value = t?.title ?? '';
	$<HTMLInputElement>('mt-artist').value = t?.artist ?? '';
	$<HTMLInputElement>('mt-src').value = t?.src ?? '';
	$<HTMLInputElement>('mt-artwork').value = t?.artwork ?? '';
	$<HTMLTextAreaElement>('mt-desc').value = t?.description ?? '';
	$<HTMLInputElement>('mt-enabled').checked = t?.enabled ?? true;
	$('mx-track-err').textContent = '';
	$<HTMLSelectElement>('mt-lib').value = '';
	loadCatalog();
	$<HTMLDialogElement>('mx-track-dlg').showModal();
}

function readTrack(): Partial<Track> {
	return {
		title: val('mt-title'),
		artist: val('mt-artist'),
		src: val('mt-src'),
		artwork: val('mt-artwork'),
		description: $<HTMLTextAreaElement>('mt-desc').value.trim(),
		enabled: $<HTMLInputElement>('mt-enabled').checked,
	};
}

function openTape(p?: Tape) {
	editingTape = p?.id ?? null;
	order = [...(p?.trackIds ?? [])];
	$('mx-tape-head').textContent = p ? `Edit ${p.name}` : 'New mixtape';
	$<HTMLInputElement>('mp-name').value = p?.name ?? '';
	$<HTMLTextAreaElement>('mp-desc').value = p?.description ?? '';
	$<HTMLInputElement>('mp-published').checked = p?.published ?? false;
	$<HTMLInputElement>('mp-default').checked = p?.isDefault ?? false;
	$('mx-tape-err').textContent = '';
	loadCatalog();
	paintOrder();
	$<HTMLDialogElement>('mx-tape-dlg').showModal();
}

function paintOrder() {
	$('mp-tracks').innerHTML =
		order
			.map((id, i) => {
				const t = trackById(id);
				const name = esc(t ? t.title : `#${id}`);
				return `<li class="ad-row">
				<span class="ad-row-main"><b>${i + 1}. ${name}</b><i>${esc(t?.artist ?? '')}${t && !t.enabled ? ' · switched off' : ''}</i></span>
				<span class="ad-row-act">
					<button class="btn" type="button" data-mv="${i}" data-by="-1" aria-label="Move ${name} up" ${i ? '' : 'disabled'}>↑</button>
					<button class="btn" type="button" data-mv="${i}" data-by="1" aria-label="Move ${name} down" ${i < order.length - 1 ? '' : 'disabled'}>↓</button>
					<button class="btn btn-del" type="button" data-rm="${i}" aria-label="Take ${name} off the tape">✕</button>
				</span></li>`;
			})
			.join('') || '<li class="ad-row">No tracks on this tape yet.</li>';
	const left = data.tracks.filter((t) => !order.includes(t.id));
	$('mp-add').innerHTML =
		`<option value="">${left.length ? 'Add a track...' : 'Every track is already on it'}</option>` +
		left.map((t) => `<option value="${t.id}">${esc(t.title)}${t.artist ? ' / ' + esc(t.artist) : ''}</option>`).join('');
}

function bind() {
	bound = true;

	$('mx-new-track').addEventListener('click', () => openTrack());
	$('mx-new-tape').addEventListener('click', () => openTape());
	$('mx-audio').addEventListener('ended', next);
	$('mx-audio').addEventListener('error', () => ($('mx-now').textContent += ' (could not load)'));

	$('mx-tracks').addEventListener('click', async (e) => {
		const b = (e.target as HTMLElement).closest('button');
		if (!b) return;
		const t = trackById(Number(b.dataset.hear ?? b.dataset.toggle ?? b.dataset.tedit ?? b.dataset.tdel));
		if (!t) return;
		if (b.dataset.hear) hear([t]);
		if (b.dataset.tedit) openTrack(t);
		if (b.dataset.toggle) {
			const r = await send(`/api/mixtapes/admin/tracks/${t.id}`, 'PUT', trackBody({ ...t, enabled: !t.enabled }));
			say(r.ok ? (t.enabled ? 'Track switched off.' : 'Track switched on.') : r.error);
			loadMixtapes(say);
		}
		if (b.dataset.tdel) {
			if (!confirm(`Delete ${t.title}? It comes off every tape. The uploaded file stays in /media.`)) return;
			const r = await send(`/api/mixtapes/admin/tracks/${t.id}`, 'DELETE');
			say(r.ok ? 'Track deleted.' : r.error);
			loadMixtapes(say);
		}
	});

	$('mx-tapes').addEventListener('click', async (e) => {
		const b = (e.target as HTMLElement).closest('button');
		if (!b) return;
		if (b.dataset.up) {
			const ids = data.playlists.map((p) => p.id);
			const i = Number(b.dataset.up);
			[ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
			const r = await send('/api/mixtapes/admin/order', 'PUT', { ids });
			if (!r.ok) say(r.error);
			return loadMixtapes(say);
		}
		const p = data.playlists.find((x) => x.id === Number(b.dataset.play ?? b.dataset.edit ?? b.dataset.del));
		if (!p) return;
		if (b.dataset.play) hear(p.trackIds.map(trackById).filter((t): t is Track => Boolean(t?.enabled)));
		if (b.dataset.edit) openTape(p);
		if (b.dataset.del) {
			if (!confirm(`Delete the mixtape ${p.name}? Its tracks stay in the library.`)) return;
			const r = await send(`/api/mixtapes/admin/playlists/${p.id}`, 'DELETE');
			say(r.ok ? 'Mixtape deleted.' : r.error);
			loadMixtapes(say);
		}
	});

	$('mt-lib').addEventListener('change', (e) => {
		const t = libTrack((e.target as HTMLSelectElement).value);
		if (!t) return;
		$<HTMLInputElement>('mt-title').value = t.title;
		$<HTMLInputElement>('mt-artist').value = albumArtist(t);
		$<HTMLInputElement>('mt-src').value = `library:${t.rel}`;
	});

	// A whole album onto the tape: tracks already in the library are reused, the rest are created.
	$('mp-album').addEventListener('change', async (e) => {
		const sel = e.target as HTMLSelectElement;
		const album = albums.find((a) => a.id === sel.value);
		sel.value = '';
		if (!album) return;
		const err = $('mx-tape-err');
		err.textContent = `Adding ${album.title}...`;
		for (const t of album.tracks) {
			const src = `library:${t.rel}`;
			let id = data.tracks.find((x) => x.src === src)?.id;
			if (!id) {
				const r = await send('/api/mixtapes/admin/tracks', 'POST', { title: t.title, artist: albumArtist(t), src, artwork: '', description: '', enabled: true });
				if (!r.ok) return void (err.textContent = `${t.title}: ${r.error}`);
				id = r.out.id as number;
			}
			if (!order.includes(id)) order.push(id);
		}
		await loadMixtapes(say);
		err.textContent = '';
		paintOrder();
	});

	$('mt-src-file').addEventListener('change', () => upload('mt-src-file', 'mt-src', $('mx-track-err')));
	$('mt-artwork-file').addEventListener('change', () => upload('mt-artwork-file', 'mt-artwork', $('mx-track-err')));
	$('mt-preview').addEventListener('click', () => {
		const t = readTrack();
		if (t.src) hear([{ id: 0, ...t } as Track]);
	});

	$('mt-save').addEventListener('click', async () => {
		const err = $('mx-track-err');
		const t = readTrack();
		if (!t.title || !t.src) return void (err.textContent = 'A title and an audio source are required.');
		const r = await send(editingTrack ? `/api/mixtapes/admin/tracks/${editingTrack}` : '/api/mixtapes/admin/tracks', editingTrack ? 'PUT' : 'POST', trackBody(t));
		if (!r.ok) return void (err.textContent = r.error);
		$<HTMLDialogElement>('mx-track-dlg').close();
		say(editingTrack ? 'Track saved.' : 'Track added.');
		loadMixtapes(say);
	});

	$('mp-tracks').addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest('button');
		if (!b) return;
		if (b.dataset.rm) order.splice(Number(b.dataset.rm), 1);
		if (b.dataset.mv) {
			const i = Number(b.dataset.mv);
			const j = i + Number(b.dataset.by);
			[order[i], order[j]] = [order[j], order[i]];
		}
		paintOrder();
	});
	$('mp-add').addEventListener('change', (e) => {
		const id = Number((e.target as HTMLSelectElement).value);
		if (id) order.push(id);
		paintOrder();
	});

	$('mp-save').addEventListener('click', async () => {
		const err = $('mx-tape-err');
		const p: Tape = {
			id: editingTape ?? 0,
			name: val('mp-name'),
			description: $<HTMLTextAreaElement>('mp-desc').value.trim(),
			published: $<HTMLInputElement>('mp-published').checked,
			isDefault: $<HTMLInputElement>('mp-default').checked,
			trackIds: order,
		};
		if (!p.name) return void (err.textContent = 'A name is required.');
		const r = await send(editingTape ? `/api/mixtapes/admin/playlists/${editingTape}` : '/api/mixtapes/admin/playlists', editingTape ? 'PUT' : 'POST', tapeBody(p));
		if (!r.ok) return void (err.textContent = r.error);
		$<HTMLDialogElement>('mx-tape-dlg').close();
		say(editingTape ? 'Mixtape saved.' : 'Mixtape added.');
		loadMixtapes(say);
	});
}
