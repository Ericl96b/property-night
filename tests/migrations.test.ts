import { describe, expect, it } from 'vitest';
import { memoryKV, type KV, type StoreName } from '../src/storage/db';
import { DATA_VERSION, runMigrations } from '../src/storage/migrations';

const dump = async (kv: KV) => {
  const out: Record<string, unknown[]> = {};
  for (const s of ['presets', 'saves', 'meta'] as StoreName[]) out[s] = await kv.list(s);
  return out;
};

async function seeded(): Promise<KV> {
  const kv = memoryKV();
  await kv.put('saves', { id: 'autosave', name: 'Autosave', version: 1 });
  await kv.put('saves', { id: 'slot-1', name: 'Friday', version: 1 });
  await kv.put('presets', { id: 'board-1', kind: 'board', name: 'My board' });
  await kv.put('presets', { id: 'rules-1', kind: 'rules', name: 'House rules' });
  await kv.put('meta', { id: 'benchmarks', items: [{ score: 1 }] });
  return kv;
}

describe('data migrations', () => {
  it('wipes saves and user board presets, keeps rules presets and history', async () => {
    const kv = await seeded();
    await runMigrations(kv);
    expect(await kv.list('saves')).toEqual([]);
    expect(await kv.get('presets', 'board-1')).toBeUndefined();
    expect(await kv.get('presets', 'rules-1')).toEqual({ id: 'rules-1', kind: 'rules', name: 'House rules' });
    expect(await kv.get('meta', 'benchmarks')).toEqual({ id: 'benchmarks', items: [{ score: 1 }] });
    expect(await kv.get('meta', 'dataVersion')).toEqual({ id: 'dataVersion', value: 3 });
    expect(DATA_VERSION).toBe(3);
  });

  it('does nothing when run again', async () => {
    const kv = await seeded();
    await runMigrations(kv);
    await kv.put('saves', { id: 'autosave', name: 'New game', version: 2 });
    const before = await dump(kv);
    await runMigrations(kv);
    expect(await dump(kv)).toEqual(before);
  });

  it.each([1, 2])('wipes when the stored version is %i', async (old) => {
    const kv = await seeded();
    await kv.put('meta', { id: 'dataVersion', value: old });
    await runMigrations(kv);
    expect(await kv.list('saves')).toEqual([]);
    expect(await kv.get('presets', 'board-1')).toBeUndefined();
    expect(await kv.get('meta', 'dataVersion')).toEqual({ id: 'dataVersion', value: 3 });
  });
});
