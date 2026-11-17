/// <reference types="vitest/config" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Dev-only: POST a data URL to /__snap?name=foo and it is saved as .snapshots/foo.jpg.
 * Used for visual review captures of the live canvas (never part of the build).
 */
function snapshots(): Plugin {
  return {
    name: 'pn-snapshots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__snap', (req, res) => {
        if (req.method !== 'POST') return res.end();
        const name = (new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'snap').replace(/[^\w-]/g, '');
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const dir = resolve('.snapshots');
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, `${name}.jpg`), Buffer.from(body.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/property-night/' : '/',
  plugins: [svelte(), snapshots()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120_000 },
}));
