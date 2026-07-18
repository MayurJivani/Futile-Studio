# Futile Studio

Portfolio (`futile.studio`) plus a small backend for the blog and hosted media.

## Design system

Blueprint-blue palette (see CSS vars in `src/layouts/Layout.astro`), Big Shoulders
Display for headlines (Chicago-inspired condensed bold, a nod to *The Bear*), JetBrains
Mono for technical/annotation text.

Animation is GSAP + ScrollTrigger, set up once in `Layout.astro`:
- `data-reveal` — fade/rise an element in on scroll (`data-reveal="line"` on an SVG
  wrapper with a `.draw-path` line draws it in instead)
- `data-split-group` — kinetic word-by-word reveal; either hand-author `.split-mask >
  .split-word` spans (needed for headlines with `<br>`/`<em>`), or add `data-split` to
  auto-wrap a flat-text element's words
- `data-magnetic="0.35"` — pulls the element toward the cursor on hover (number is
  strength, optional)
- `data-glimpse` + a nested `<template>` — hover shows the template's contents in a
  floating preview panel (see the project cards on the homepage)
- Custom cursor, preloader, and the `<Marquee items={[...]} />` component are also
  defined here; all animation is skipped for `prefers-reduced-motion` and the custom
  cursor/magnetic/glimpse effects auto-disable on touch devices

## Structure

```
Futile-Studio/
├── src/
│   ├── layouts/Layout.astro     # Design tokens, fonts, animation engine (see above)
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── Marquee.astro
│   │   ├── VinylPlayer.astro    # Turntable modal (see Collection below)
│   │   └── CassettePlayer.astro # Tape deck modal
│   ├── data/collection.js       # Vinyl/cassette entries — edit this to add media
│   ├── lib/api.js               # Fetch helper for talking to server/
│   └── pages/
│       ├── index.astro          # Portfolio (futile.studio)
│       ├── collection.astro     # Vinyl/cassette shelf + players (/collection)
│       ├── login.astro          # Studio sign-in
│       ├── write.astro          # Protected post editor (/write)
│       └── thoughts/            # Public blog listing + post detail
├── server/                      # Backend — see below
└── public/
```

## Backend (`server/`)

A small Express + SQLite (`node:sqlite`, built into Node 22+, no native deps) API for:
sign-in, blog posts, and media uploads (images for posts, or audio for the collection).

```bash
cd server
npm install
cp .env.example .env        # then set a real SESSION_SECRET
npm run create-admin -- <username> <password>   # first-time setup, or to reset a password
npm run dev                  # http://localhost:4000
```

Run the frontend (`npm run dev` in the repo root, port 4321) alongside it — `src/lib/api.js`
points at `http://localhost:4000` automatically when the frontend is on localhost.

**Endpoints:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`GET/POST/PUT/DELETE /api/posts`, `POST /api/media` (protected, multipart `file` field,
returns `{ url }`), static files served at `/media/*`.

**Writing a post:** sign in at `/login`, then `/write`. Drag an image into the body
field (or use "Insert image") to upload it and drop a markdown reference at the cursor.
Posts are markdown; the public pages render it with `marked`.

**Hosting an album:** the same `/api/media` upload endpoint accepts audio files
(FLAC/MP3/WAV/OGG/AAC, up to 200MB) — upload one (e.g. via the write page's image
button, or `curl`) and point a `collection.js` entry's `audioSrc` at the returned URL.

**Deploying:** in production, reverse-proxy `/api` and `/media` on the portfolio's
domain to this Express process, and set `CORS_ORIGIN` / `NODE_ENV=production` in
`server/.env`. `src/lib/api.js` uses same-origin relative paths once it's not on
localhost, so no frontend changes are needed.

### Security model

- **Config fail-fast:** with `NODE_ENV=production` the server refuses to start unless
  `SESSION_SECRET` is ≥32 chars and `CORS_ORIGIN` is set explicitly.
- **Sessions** are stored in SQLite (survive restarts, no MemoryStore leak), with
  `httpOnly` + `SameSite=Lax` + `Secure` (prod) cookies, and the session ID is
  regenerated on login. Expired rows are pruned hourly.
- **CSRF:** state-changing endpoints require an `X-CSRF-Token` header; the token is
  issued at login and via `GET /api/auth/me`. The frontend's `apiFetch` attaches it
  automatically.
- **Rate limits:** 10 login attempts / 15 min, 30 uploads / 15 min, 120 requests / min
  overall. Login uses a constant-time compare against a dummy hash so usernames can't
  be enumerated by timing.
- **Stored XSS:** post title/excerpt/body are stripped of HTML server-side
  (`sanitize-html`); the post page additionally runs `marked` output through
  `DOMPurify`, and list templates escape all interpolated text.
- **Uploads:** file type is verified from magic bytes (`file-type`), never the
  client's declared mimetype; SVG is deliberately rejected (script-in-XML vector);
  files are stored under generated names with extensions derived from the detected type.
- **Headers:** `helmet` defaults (CSP, HSTS, nosniff, frame-ancestors...), plus
  compression and `morgan` access logs. Errors return generic messages — no stack
  traces leave the process.

### Code quality

Both packages have ESLint (flat config) and Prettier wired up:

```bash
npm run lint     # in / and in server/
npm run format
```

Frontend TypeScript uses Astro's `strict` tsconfig. A production build
(`npm run build`) is the pre-deploy smoke test.

Known accepted risk: `npm audit` reports a low-severity esbuild advisory affecting
the **dev server only** (fix requires the Astro 7 major); it does not ship to
production builds.

## Collection page (vinyl + cassette players)

`/collection` reads from `src/data/collection.js`. Each entry looks like:

```js
{
  id: 'unique-slug',
  format: 'vinyl',              // 'vinyl' | 'cassette'
  title: 'Album Title',
  artist: 'Artist Name',
  year: 2001,
  cover: '',                    // optional: '/collection/cover.jpg' (drop file in public/collection/)
  audioSrc: '',                 // hosted FLAC URL — leave '' to shelve without playback
}
```

Modern Chrome/Firefox/Edge and recent Safari play FLAC natively via `<audio>`, no
extra libraries needed. Items with an empty `audioSrc` still show on the shelf with a
"no audio uploaded yet" note in the player.

No radio station — streaming the owned collection as a live broadcast needs a
license this doesn't have. Playback here stays on-demand, one listener at a time.

## Commands

```bash
npm install       # frontend deps
npm run dev        # portfolio dev server, :4321
npm run build       # static build → dist/
```

See "Backend" above for `server/` commands.

## Deploy

Build the portfolio (`npm run build`) and deploy `dist/` as a static site. Run
`server/` as a long-lived Node process behind a reverse proxy that also routes
`/api` and `/media` to it on the same domain (see the Backend section).
