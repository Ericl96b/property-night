// Benchmark history (SPEC-benchmark §3.6): the last 10 result summaries (no raw samples) in the
// IndexedDB `meta` store under `benchmarks`, newest first.
import type { KV } from '../storage/db';
import { pushHistory, type BenchSummary } from '../perf/summary';

const ID = 'benchmarks';

interface Record {
  id: string;
  items: BenchSummary[];
}

export class BenchHistory {
  constructor(private kv: KV) {}

  async list(): Promise<BenchSummary[]> {
    try {
      return (await this.kv.get<Record>('meta', ID))?.items ?? [];
    } catch {
      return [];
    }
  }

  async add(s: BenchSummary): Promise<BenchSummary[]> {
    // Plain copy: summaries may be reactive proxies, which IndexedDB cannot store.
    const items = pushHistory(await this.list(), JSON.parse(JSON.stringify(s)));
    await this.kv.put<Record>('meta', { id: ID, items });
    return items;
  }

  async clear(): Promise<void> {
    await this.kv.delete('meta', ID);
  }
}
