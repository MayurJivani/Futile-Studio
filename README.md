# Futile Studio

Monorepo for futile.studio portfolio and projects.futile.studio hosted apps.

## Design system

Blueprint-blue palette (see CSS vars in `src/layouts/Layout.astro`), Big Shoulders
Display for headlines (Chicago-inspired condensed bold, a nod to *The Bear*), JetBrains
Mono for technical/annotation text. Scroll-reveal is driven by `[data-reveal]` +
`IntersectionObserver` in `Layout.astro` — add the attribute to any element to fade/rise
it in on scroll, or `data-reveal="line"` on an SVG wrapper with a `.draw-path` line to
have it draw in.

## Structure

```
Futile-Studio/
├── src/
│   ├── layouts/Layout.astro     # Design tokens, fonts, blueprint grid, scroll-reveal
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── VinylPlayer.astro    # Turntable modal (see Collection below)
│   │   └── CassettePlayer.astro # Tape deck modal
│   ├── data/collection.js       # Vinyl/cassette entries — edit this to add media
│   └── pages/
│       ├── index.astro          # Portfolio (futile.studio)
│       └── collection.astro     # Vinyl/cassette shelf + players (/collection)
├── mosaic/
│   ├── frontend/        # Mosaic Astro app → /mosaic
│   └── server/          # Mosaic upload + WebSocket API
├── server/              # Unified Express host for projects
├── public/
│   ├── qno/             # Built Qno frontend (assembled)
│   └── mosaic/          # Built Mosaic frontend (assembled)
└── scripts/assemble.js  # Copies build outputs into public/
```

Qno frontend and backend live in `../Qno-web/` and are built into this host at `/qno`.

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
  audioSrc: '',                 // FLAC URL on media.futile.studio — leave '' to shelve without playback
}
```

Audio is **not** bundled in this repo — point `audioSrc` at the FLAC file hosted on
your own server (e.g. `https://media.futile.studio/vinyl/album-one.flac`). Modern
Chrome/Firefox/Edge and recent Safari play FLAC natively via `<audio>`, no extra
libraries needed. Items with an empty `audioSrc` still show on the shelf with a
"no audio uploaded yet" note in the player.

`radio.futile.studio` is linked from the nav as a placeholder for a future hosted
radio station — not built yet.

## Projects host

`projects.futile.studio` serves:

| Path | App |
|------|-----|
| `/qno` | Qno card game (static + `/qno/ws`) |
| `/mosaic` | Mosaic video canvas (static + `/mosaic/ws`, `/mosaic/upload`, `/mosaic/files`) |

## Commands

```bash
# Install all workspace deps
npm install

# Build portfolio + both projects + assemble into public/
npm run build

# Run projects host (port 3000)
npm start

# Portfolio dev only
npm run dev:portfolio
```

## Deploy

Point `projects.futile.studio` at the Express process (`npm start`). Build with `npm run build` first so `public/qno` and `public/mosaic` exist.

For `futile.studio`, deploy the portfolio `dist/` separately or serve from the same host root.
