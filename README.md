# Futile Studio

Monorepo for futile.studio portfolio and projects.futile.studio hosted apps.

## Structure

```
Futile-Studio/
├── src/                 # Portfolio site (futile.studio)
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
