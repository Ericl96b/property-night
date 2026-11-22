// One-time data migrations, run at startup right after the KV store opens and before saves or
// presets are read (Batch 5, docs/batch5/SPEC-color-swap.md §3).
import type { KV } from './db';

/** Current stored-data version, kept in the `meta` store under `dataVersion`. */
export const DATA_VERSION = 3;
const ID = 'dataVersion';

interface VersionRecord {
  id: string;
  value: number;
}

/**
 * Version 2 (Pink/Yellow swap): saves and user board presets describe the old layout, so they
 * are deleted. Version 3 (Stage 1 §4, Vols orange and yellower mustard): saves and user board
 * presets carry the old group colors, so they are deleted again. Every bump runs the same wipe.
 * Rules presets and benchmark history stay. Running it again does nothing.
 */
export async function runMigrations(kv: KV): Promise<void> {
  const rec = await kv.get<VersionRecord>('meta', ID);
  if (rec && typeof rec.value === 'number' && rec.value >= DATA_VERSION) return;

  for (const s of await kv.list<{ id: string }>('saves')) await kv.delete('saves', s.id);
  const presets = await kv.list<{ id: string; kind?: string; builtIn?: boolean }>('presets');
  for (const p of presets) if (p.kind === 'board' && !p.builtIn) await kv.delete('presets', p.id);

  await kv.put<VersionRecord>('meta', { id: ID, value: DATA_VERSION });
}
