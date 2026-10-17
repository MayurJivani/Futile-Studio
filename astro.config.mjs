// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	prefetch: true,
	// staging builds set this to /<site>/ (deploy/stage.sh); production stays at the root
	base: process.env.SITE_BASE || '/',
});
