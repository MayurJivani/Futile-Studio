<div align="center">

# Futile Studio

**My studio site: small software, built and shipped, pasted into a scrapbook as it lands.**

[Open it](https://futile.studio) · [Postcards](POSTCARDS.md) · [Mixtapes](MIXTAPES.md)

[![live](https://img.shields.io/badge/live-futile.studio-c6ff00?style=flat-square&labelColor=0b0b0b)](https://futile.studio)
![Astro](https://img.shields.io/badge/Astro-7-0b0b0b?style=flat-square&logo=astro)
![Express](https://img.shields.io/badge/Express-5-0b0b0b?style=flat-square&logo=express)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-0b0b0b?style=flat-square&logo=sqlite)
[![last commit](https://img.shields.io/github/last-commit/MayurJivani/Futile-Studio?style=flat-square&labelColor=0b0b0b&color=c6ff00)](https://github.com/MayurJivani/Futile-Studio/commits/main)

</div>

> **Futile Studio** · the studio site itself · live at futile.studio

## Overview

This is the site at [futile.studio](https://futile.studio). It is a static Astro build with a small Express + SQLite backend next to it. The homepage is a desk: a board of the projects I have open, a workbench, a featured spread, an explorer you can wave at, and a shared studio where you can see other visitors' cursors if you turn that on.

Around it there are a few side rooms:

- `/post`: write me a postcard and follow it across a map on `/track`. I answer from `/mailbox`. The details are in [POSTCARDS.md](POSTCARDS.md).
- `/jinx`: the homelab box everything runs on, with live (read-only) vitals.
- `/collection`: my vinyl and cassette shelf with playable players, plus a hi-res music library. Unlisted.
- `/ascii`: a small ASCII world you can walk around in with whoever else is in it. A toy, `noindex`.
- `/admin`: the back office. It edits the project board and the mixtapes for the cassette deck on lab.futile.studio (see [MIXTAPES.md](MIXTAPES.md)). Unlisted, `noindex`.

## Stack

- Frontend: Astro 7, GSAP + ScrollTrigger, Motion, TypeScript (Astro `strict` tsconfig)
- Backend (`server/`): Express 5, `node:sqlite` (built into Node 22+, no native deps), `ws`, `music-metadata`, `multer`, `helmet`
- Node `>=22.12.0` for both packages
- Hosting: Caddy serves the static `dist/`, the API runs as a container under Coolify on my homelab box (Jinx)

## Design system

Two themes, picked per page in `src/layouts/Layout.astro`:

- **scrapbook** (default): paper, ink and stamp red, with tape, pins and margin notes. Fonts are Dela Gothic One, League Gothic, Spectral, Martian Mono, Reenie Beanie and Sniglet. It has a lamp switch (dark mode), a high contrast mode and its own motion setting.
- **booth** (`/collection`, `/ascii`): the older look, Big Shoulders Display for headlines (Chicago-style condensed bold, a nod to *The Bear*) and JetBrains Mono for annotations.

Animation is GSAP + ScrollTrigger, set up once in `Layout.astro`:

- `data-reveal`: fade or rise an element in on scroll (`data-reveal="line"` on an SVG wrapper with a `.draw-path` line draws it in instead).
- `data-split-group`: kinetic word-by-word reveal. Hand-author `.split-mask > .split-word` spans (needed for headlines with `<br>`/`<em>`), or add `data-split` to auto-wrap a flat-text element's words.
- `data-magnetic="0.35"`: pulls the element toward the cursor on hover (the number is strength, optional).
- `data-glimpse` + a nested `<template>`: hover shows the template's contents in a floating preview panel.
- Custom cursor, preloader and the `<Marquee items={[...]} />` component live here too. Animation is skipped for `prefers-reduced-motion` (the scrapbook's motion setting overrides the OS one both ways), and the cursor, magnetic and glimpse effects turn off on touch devices.

**Field Guide:** stamps for opening projects and finding clues, kept in `localStorage` under `futile-guide` and never sent anywhere. Any element with `data-clue="id"` earns that stamp when clicked (`src/components/StampCollector.astro`).

## Running it locally

Frontend:

```bash
npm install
npm run dev        # portfolio dev server, http://localhost:4321
npm run build      # static build into dist/
npm run preview
npm run check      # astro check
```

Backend, in a second terminal:

```bash
cd server
npm install
cp .env.example .env        # then set a real SESSION_SECRET
npm run create-admin -- <username> <password>   # first-time setup, or to reset a password
npm run dev                  # http://localhost:4000
```

`src/lib/api.js` points at `http://localhost:4000` automatically when the frontend is on localhost. Once it is not on localhost it uses same-origin relative paths, so production needs no frontend changes.

The project board is read from SQLite at build time (`src/data/board.js` looks in `server/data/studio.db`). A fresh clone with no database falls back to the literals in `src/data/projects.js`, so the build still works. Edits made in `/admin` show up on the next build.

### Lint, format and self-checks

Both packages have ESLint (flat config) and Prettier:

```bash
npm run lint     # in / and in server/
npm run format
```

There is no test runner. The tricky bits have small assert-based self-checks you run with node, for example:

```bash
node server/lib/votes.selfcheck.js
node server/lib/presence.selfcheck.js
node src/data/postal.selfcheck.js
```

The rest are the other `*.selfcheck.js` files in `server/lib/`, `src/data/` and `src/lib/`. A production build (`npm run build`) is the pre-deploy smoke test.

## Configuration

`server/.env` (see `server/.env.example`):

| Variable | What it does |
| --- | --- |
| `PORT` | API port, 4000 by default |
| `SESSION_SECRET` | Session signing secret. In production it must be at least 32 characters |
| `CORS_ORIGIN` | The site's origin. Required in production, also checked on WebSocket upgrades |
| `NODE_ENV` | `production` turns on the fail-fast config checks and proxy trust |
| `MUSIC_DIR` | Folder for the hi-res library, `/opt/media/Music` by default |
| `MIXTAPE_AUDIO_HOSTS` | Hosts besides `/media` that a mixtape track may stream from (comma separated, empty means none) |
| `STREAM_SECRET` | Optional. Signs music stream URLs, falls back to `SESSION_SECRET` |
| `STUDIO_DATA_DIR` | Optional. Where `studio.db` lives, `server/data` by default |
| `STUDIO_UPLOAD_DIR` | Optional. Where uploads go, `server/uploads` by default |
| `ACCESS_VERIFY_URL` | Optional. Endpoint that verifies the Cloudflare Access token for `/mailbox` |

Frontend: `SITE_BASE` sets Astro's `base` for staging builds (`deploy/stage.sh`). Production stays at `/`.

## API

- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Media: `POST /api/media` (protected, multipart `file` field, returns `{ url }`), files served at `/media/*`.
- Hi-res library (no auth): `GET /api/music`, `GET /api/music/cover?album=...`, `GET /api/music/stream?path=...&to=flac|aac|mp3|wav`.
- Also: `/api/projects` (the board, writes need auth), `/api/mixtapes`, `/api/favorites`, `/api/postcards`, `/api/mailbox` (behind Cloudflare Access), `/api/studio`, `/api/jinx`.

**Live bits:** `GET /api/jinx` returns the read-only vitals the `/jinx` page shows (process and host uptime, load, memory, cores, platform). It reports no hostname, no interfaces and only the Node major version, so the page can show the box is awake without handing over a fingerprint.

`/ws/presence` is an anonymous cursor relay for the opt-in "show other people's cursors" setting: throwaway ids, positions only, nothing logged, capped per IP, per room and overall. The same relay runs the homepage's shared studio as the `/studio` room (one explorer per connected visitor, plus a tally of votes on what to build next) and the `/ascii` field. Votes are toggles on a fixed list (`src/data/studio.js`), stored in SQLite against an HMAC of the client address, never as free text. Behind Cloudflare the relay reads the client address from `CF-Connecting-IP`, since Caddy rewrites `X-Forwarded-For` to loopback.

## The collection page

`/collection` is unlisted: no nav link, `noindex`, reachable only by direct URL. It reads from `src/data/collection.js`. Each entry looks like:

```js
{
  id: 'unique-slug',
  format: 'vinyl',              // 'vinyl' | 'cassette'
  title: 'Album Title',
  artist: 'Artist Name',
  year: 2001,
  cover: '',                    // optional: '/collection/cover.jpg' (drop file in public/collection/)
  audioSrc: '',                 // hosted FLAC URL, leave '' to shelve without playback
}
```

Modern Chrome, Firefox, Edge and recent Safari play FLAC natively via `<audio>`, no extra libraries. Items with an empty `audioSrc` still show on the shelf with a "no audio uploaded yet" note in the player.

**Hosting an album:** `/api/media` accepts audio files (FLAC/MP3/WAV/OGG/AAC, up to 200MB). Upload one (with `curl`, say) and point a `collection.js` entry's `audioSrc` at the returned URL.

**Hi-res library:** the page also has an auto-discovered "Hi-Res library" shelf. Point `MUSIC_DIR` at a folder and drop music in, no registration needed. Accepted layouts:

```
/opt/media/Music/Test Album/01 Intro.flac        # flat album
/opt/media/Music/Sampler/Disc 1/01 A Side.flac   # multi-disc album (Disc 1, Disc 2, ...)
/opt/media/Music/00 Loose One.mp3                # "Singles & Loose Tracks"
```

Tags (title, artist, duration, sample rate, bit depth) and cover art (a `folder.jpg`/`cover.jpg` in the album dir, or embedded artwork) come from `music-metadata`. Playback is lossless:

- FLAC/MP3/WAV/OGG/OPUS/M4A/AAC stream as-is with HTTP byte-range support, so seeking works and quality is untouched. 24/96 FLAC plays natively in Chrome, Firefox and Edge. Safari gets hi-res FLAC from this library via transcode.
- Anything else (DSD `.dsf`/`.dff`, APE, WavPack, AIFF, ...) is transcoded on the fly to lossless FLAC via `ffmpeg` (AAC 320k as a last resort for browsers that can't play FLAC). This needs `ffmpeg` on the server's `PATH`.

The shelf re-scans on its own (30s cache), so files added to `MUSIC_DIR` appear without a redeploy.

No radio station: streaming the owned collection as a live broadcast needs a licence this doesn't have. Playback stays on-demand, one listener at a time.

## Security model

- **Config fail-fast:** with `NODE_ENV=production` the server refuses to start unless `SESSION_SECRET` is at least 32 characters and `CORS_ORIGIN` is set explicitly.
- **Sessions** are stored in SQLite (they survive restarts, no MemoryStore leak), with `httpOnly` + `SameSite=Lax` cookies and the session ID regenerated on login. The cookie is flagged `Secure` automatically when the request is HTTPS (trusted via the reverse proxy) and relaxed on plain HTTP. A hardcoded `Secure` behind a proxy without TLS silently breaks login: it "signs in" but `/api/auth/me` returns 401, because the browser refuses to store the cookie. Expired rows are pruned hourly.
- **CSRF:** state-changing endpoints require an `X-CSRF-Token` header. The token is issued at login and via `GET /api/auth/me`, and the frontend's `apiFetch` attaches it.
- **Rate limits:** 10 login attempts per 15 min, 30 uploads per 15 min, 120 requests per minute overall. Login uses a constant-time compare against a dummy hash so usernames can't be enumerated by timing.
- **Uploads:** file type is checked from magic bytes (`file-type`), never the client's declared mimetype. SVG is rejected on purpose (script in XML). Files are stored under generated names with extensions from the detected type.
- **Headers:** `helmet` defaults (CSP, HSTS, nosniff, frame-ancestors...), plus compression and `morgan` access logs. Errors return generic messages and no stack traces leave the process.
- **Mailbox:** `/api/mailbox` sits behind Cloudflare Access, and the server verifies the token itself (fails closed). Replies also need an `X-Futile-Post` header, see [POSTCARDS.md](POSTCARDS.md).

Known accepted risk: `npm audit` may report a low-severity esbuild advisory that affects the dev server only. It does not ship in production builds.

## Deploying

The site and the API ship separately:

- **Site:** `deploy/deploy.sh` (run by `.github/workflows/deploy.yml` on push to `main`, or from a laptop) fast-forwards the checkout on the box, copies the live `studio.db` in so the board is current, and runs `npm run build`. Caddy serves `dist/`.
- **API:** `.github/workflows/image.yml` builds `server/Dockerfile` into `ghcr.io/mayurjivani/futile-api` and Coolify runs it (`deploy/compose.yaml`). The image is built from the repo root because the API shares `src/data`.
- **Staging:** `npm run stage` builds with `SITE_BASE=/futile-studio/` and puts it on a staging host, without the live API.
- `deploy/install.sh` is a one-time ownership fix on the box.

If you host it yourself: reverse-proxy `/api`, `/music`, `/media` and `/ws/presence` on the site's domain to the Express process, and set `CORS_ORIGIN` and `NODE_ENV=production`. `/ws/presence` needs WebSocket upgrades passed through. If the proxy swallows them, the cursors never appear and the rest of the site is fine. In production the relay also rejects any upgrade whose `Origin` is not `CORS_ORIGIN`.

## Project structure

```
Futile-Studio/
├── src/
│   ├── layouts/Layout.astro   # themes, fonts, animation engine
│   ├── components/            # Board, Postcard, VinylPlayer, CassettePlayer, ...
│   ├── data/                  # projects, board, collection, postal, stamps
│   ├── game/                  # the /ascii field
│   ├── lib/                   # api.js, guide.js, postcard.js, ...
│   └── pages/                 # index, post, track, mailbox, jinx, collection, ascii, admin
├── server/                    # Express + SQLite API
├── deploy/                    # deploy, staging and compose files
├── public/                    # favicons, cv.pdf, project screenshots in shots/
├── POSTCARDS.md
└── MIXTAPES.md
```

## Licence

No licence file yet, all rights reserved.

---

<p align="center"><sub>Built by <a href="https://github.com/MayurJivani">Mayur Jivani</a> at <a href="https://futile.studio">Futile Studio</a>. Everything is futile. Do it anyway.</sub></p>
