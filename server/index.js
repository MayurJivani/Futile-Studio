import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import { SqliteSessionStore } from './lib/sessionStore.js';
import { apiLimiter } from './lib/security.js';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import mediaRoutes from './routes/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// Fail fast on unsafe config rather than silently running exposed in prod.
if (isProd) {
	const secret = process.env.SESSION_SECRET;
	if (!secret || secret.length < 32 || secret === 'change-me') {
		console.error('[futile-server] Refusing to start: SESSION_SECRET is missing or too weak for production.');
		console.error(
			"Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
		);
		process.exit(1);
	}
	if (!process.env.CORS_ORIGIN) {
		console.error('[futile-server] Refusing to start: CORS_ORIGIN must be set explicitly in production.');
		process.exit(1);
	}
} else if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'change-me') {
	console.warn(
		'[futile-server] SESSION_SECRET not set — using an insecure dev default. Set it in server/.env before deploying.',
	);
}

const PORT = Number(process.env.PORT) || 4000;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4321';

const app = express();

// Behind a reverse proxy in production, this is required for secure cookies
// and rate-limit keys to see the real client IP/protocol.
if (isProd) app.set('trust proxy', 1);

app.use(
	helmet({
		// The API is consumed cross-origin by design (the Astro frontend runs
		// on a different port/domain), so the default same-origin resource
		// policy would block it from loading images/audio from /media.
		crossOriginResourcePolicy: { policy: 'cross-origin' },
		crossOriginEmbedderPolicy: false,
	}),
);
app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(cors({ origin: ORIGIN, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '1mb' }));
app.use(apiLimiter);

app.use(
	session({
		name: 'futile.sid',
		store: new SqliteSessionStore(),
		secret: process.env.SESSION_SECRET || 'change-me',
		resave: false,
		saveUninitialized: false,
		rolling: true,
		cookie: {
			httpOnly: true,
			sameSite: 'lax',
			secure: isProd,
			maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
		},
	}),
);

app.use('/media', express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false }));

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/media', mediaRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => {
	res.status(404).json({ error: 'Not found' });
});

// Centralized error handler — never leak stack traces or internals to the
// client, even for unexpected errors.
app.use((err, req, res, next) => {
	if (err?.type === 'entity.too.large') {
		return res.status(413).json({ error: 'Request body too large' });
	}
	if (err?.name === 'ValidationError') {
		return res.status(err.statusCode || 400).json({ error: err.message });
	}
	if (err?.code === 'LIMIT_FILE_SIZE') {
		return res.status(413).json({ error: 'File too large' });
	}
	console.error('[futile-server] Unhandled error:', err);
	res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
	console.log(
		`Futile Studio backend listening on http://localhost:${PORT} (${isProd ? 'production' : 'development'})`,
	);
});

function shutdown(signal) {
	console.log(`[futile-server] ${signal} received, shutting down...`);
	server.close(() => {
		try {
			db.close();
		} catch {
			// already closed
		}
		process.exit(0);
	});
	// Don't hang forever waiting for in-flight requests.
	setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
