// Where each sound ID is used in src/ (audio Phase 0): play('id') / fx / cue / banner calls,
// their ternary arms, and `return 'id'` from mapping helpers (paymentSoundId). Shared by the
// registry test and the docs/audio-registry.md generator. Node only.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface CallSite {
  file: string;
  line: number;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|svelte)$/.test(n) ? [p] : [];
  });
}

const CALL = /\b(?:play|fx|cue|banner)\(\s*([^,)]*)|\breturn\s+('[^']+')/g;
const ID = /'([a-zA-Z]+(?:\.[a-zA-Z]+)+)'/g;

export function findCallSites(root: string, srcDir = 'src'): Map<string, CallSite[]> {
  const found = new Map<string, CallSite[]>();
  for (const f of sources(join(root, srcDir))) {
    const rel = relative(root, f).replace(/\\/g, '/');
    if (rel === 'src/audio/registry.ts') continue;
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(CALL)) {
      const arg = m[1] ?? m[2] ?? '';
      const line = text.slice(0, m.index).split('\n').length;
      const src = text.split('\n')[line - 1].trim();
      if (src.startsWith('//') || src.startsWith('*') || src.startsWith('/*')) continue; // comments
      for (const l of arg.matchAll(ID)) found.set(l[1], [...(found.get(l[1]) ?? []), { file: rel, line }]);
    }
  }
  return found;
}
