// Renders public/icon.svg to the PNG app icons (192, 512) with headless Chrome.
// Usage: node scripts/make-icons.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const svg = readFileSync(resolve('public/icon.svg'), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'pn-icons-'));
for (const size of [192, 512]) {
  const html = join(dir, `icon-${size}.html`);
  writeFileSync(html, `<!doctype html><style>html,body{margin:0;background:#2B2119}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  const out = resolve(`public/icon-${size}.png`);
  execFileSync(chrome, ['--headless=new', '--hide-scrollbars', `--window-size=${size},${size}`, `--screenshot=${out}`, '--default-background-color=00000000', pathToFileURL(html).href], { stdio: 'ignore' });
  console.log(`wrote ${out}`);
}
