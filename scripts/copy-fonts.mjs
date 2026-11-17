// Copies self-hosted woff2 fonts from npm packages into public/fonts (SPEC §2).
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('public/fonts');
mkdirSync(out, { recursive: true });
const files = [
  ['@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2', 'fraunces-var.woff2'],
  ['@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2', 'source-sans-3-400.woff2'],
  ['@fontsource/source-sans-3/files/source-sans-3-latin-500-normal.woff2', 'source-sans-3-500.woff2'],
  ['@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff2', 'source-sans-3-600.woff2'],
  ['@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff2', 'source-sans-3-700.woff2'],
];
for (const [src, dst] of files) copyFileSync(resolve('node_modules', src), resolve(out, dst));
console.log(`copied ${files.length} fonts to public/fonts`);
