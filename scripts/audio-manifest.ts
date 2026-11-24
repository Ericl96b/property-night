// Scans public/audio/ for sound files (audio Phase 0 §2). Shared by the Vite plugin
// (vite.config.ts) and the registry doc script. Node only.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface ScannedFile {
  id: string;
  /** Path relative to public/, with forward slashes (audio/dice/dice_bounce_wood_01.ogg). */
  path: string;
  hash: string;
}

const NAME = /^([A-Za-z0-9_]+?)_(\d{2,})\.(ogg|wav)$/;

export function scanAudio(publicDir: string): ScannedFile[] {
  const root = join(publicDir, 'audio');
  if (!existsSync(root)) return [];
  const out: ScannedFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const m = NAME.exec(name);
      if (!m) continue;
      out.push({
        id: m[1].replace(/_/g, '.'),
        path: relative(publicDir, full).replace(/\\/g, '/'),
        hash: createHash('sha1').update(readFileSync(full)).digest('hex').slice(0, 10),
      });
    }
  };
  walk(root);
  return out;
}

/** id → file URLs (relative to the site base); .ogg before .wav, then by number. */
export function buildManifest(files: ScannedFile[], withHash: boolean): Record<string, string[]> {
  const sorted = [...files].sort((a, b) => {
    const stem = (p: string) => p.replace(/\.(ogg|wav)$/, '');
    return stem(a.path).localeCompare(stem(b.path)) || (a.path.endsWith('.ogg') ? -1 : 1);
  });
  const m: Record<string, string[]> = {};
  for (const f of sorted) (m[f.id] ??= []).push(withHash ? `${f.path}?v=${f.hash}` : f.path);
  return m;
}
