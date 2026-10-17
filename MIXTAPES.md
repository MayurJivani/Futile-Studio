# Mixtapes: the Lab tape deck

The cassette deck beside the wall on lab.futile.studio plays mixtapes managed
here, on futile.studio's `/admin` page. The tracks and tapes live in the same
SQLite database as everything else (`server/data/studio.db`, tables
`mix_tracks`, `mix_playlists`, `mix_playlist_tracks`). A track plays either a
song from the `/collection` library (`MUSIC_DIR`), a file uploaded through
`/api/media`, or a link on an allowed host.

## Putting a collection album on the deck

The quickest way:

1. Open `https://futile.studio/admin`, sign in, scroll to **Mixtapes for the
   Lab deck** and press **New mixtape**.
2. Name it, then pick an album in **Add a whole album from the collection**.
   Every track of that album lands on the tape in album order (tracks already
   in the library are reused, not duplicated). Do it again for more albums,
   and use the arrows and crosses to edit the running order.
3. Tick **Published** (and **Default tape** if it should load first), then
   **Save**.

Collection tracks are stored as a reference (`library:Album/01 Song.flac`),
not a copy. Each time a visitor loads the Lab the server signs a fresh
`/api/music/stream` URL for them, exactly as the `/collection` page does, so
the files stay where they are and formats a browser cannot play raw are
transcoded. The cover is the album's cover unless the track has artwork of
its own. An album hidden with `.futile-ignore` or a file that has gone from
`MUSIC_DIR` cannot be added; if one disappears later, the deck shows that
track as unavailable and the visitor can skip it.

## Adding a track

1. Open `https://futile.studio/admin` and sign in with the admin account.
2. Scroll to **Mixtapes for the Lab deck** and press **New track**.
3. **From the collection** fills in title, artist and audio from any track on
   the `/collection` shelf. Or give it a title (required), an artist and an
   optional description by hand.
4. **Audio**: a `library:` reference from the picker above, or pick a file with the upload button (mp3, m4a, ogg, opus, wav,
   flac or aac, up to 200 MB). The field fills in with `/media/...`.
   A link to another site only works if its host is listed in
   `MIXTAPE_AUDIO_HOSTS` in `server/.env` (comma separated, then restart the
   API); anything else is refused.
5. **Artwork** is optional: upload a png, jpg, gif or webp, or paste an
   `https://` image link.
6. **Preview** plays it in the bar at the top of the section before you save.
7. **Save**. A new track is in the library but not on any tape yet.

Only upload music you have the right to share. The deck is public.

## Making and running a mixtape

- **New mixtape** (or **Edit** on an existing one): name, description, then
  add tracks from the drop-down. The arrows set the play order, the cross
  takes a track off the tape (it stays in the library).
- **Published** off keeps it a draft: visitors never see it. Use **Preview**
  on the tape's row to listen through it first, then tick Published.
- **Default tape** is the one the deck loads first. Only one tape can be the
  default; ticking it on one clears the others. With no default, the top
  published tape loads first.
- The **↑** on a tape's row moves it up the shelf. That order is the order of
  the deck's mixtape picker.
- **Disable** on a track hides it from every tape without deleting it.
  **Delete** removes it from the library and from every tape; the uploaded
  file stays in `/media`.

Every change is saved at once and shows on the Lab on the visitor's next page
load. Nothing needs a rebuild or a deploy.

## How it is wired

- `GET /api/mixtapes` is public and read-only: published tapes, enabled
  tracks, with collection tracks turned into signed stream URLs (valid six
  hours, like the collection page; a tab left open longer needs a reload). It answers any origin without credentials, so the Lab (another
  origin) can read it.
- Everything under `/api/mixtapes/admin` needs the admin session and the CSRF
  token (`401` without a session, `403` without the token). The server checks
  every field: text is trimmed and length-capped, audio must be a `library:`
  path that is on the collection shelf right now, `/media/<file>`, or an http(s) URL on an allowed host with an audio extension, artwork an
  image. `node server/lib/mixtapes.selfcheck.js` covers those rules.
- The Lab reads from `https://futile.studio` (or `http://localhost:4000` on
  localhost). Set `VITE_MIXTAPE_API` when building the Lab to point it
  elsewhere. Its CSP (`apps/server/src/index.ts` in the Lab repo) allows that
  origin for fetch and any https source for audio and artwork; the allow list
  above is what actually limits sources.
- The deck never starts sound on its own, loads no audio until Play, uses one
  `<audio>` element for the page, and turns its reels only while audio is
  actually playing (never under reduced motion). A missing file, a dropped
  network or an unsupported format shows a message on the deck instead of
  failing silently.
