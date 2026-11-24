// Batching (audio Phase 0 §6): while a batch is open (queue.flush, multi-item frames), plays are
// collected; on close each ID plays at most once, at most BATCH_CAP sounds in total, chosen by
// priority (banner > money > building/property > card > everything else).

export const BATCH_CAP = 4;

export interface BatchItem<C> {
  id: string;
  priority: number;
  ctx: C;
}

type Ctx = { amount?: number; intensity?: number };

export class Batcher<C extends Ctx> {
  private depth = 0;
  private items: BatchItem<C>[] = [];

  constructor(private flushTo: (items: BatchItem<C>[]) => void, private cap = BATCH_CAP) {}

  get open(): boolean {
    return this.depth > 0;
  }

  begin(): void {
    this.depth++;
  }

  /** Collect a play while open (returns false when not batching: play it now). */
  add(item: BatchItem<C>): boolean {
    if (!this.depth) return false;
    const same = this.items.find((i) => i.id === item.id);
    if (!same) {
      this.items.push(item);
      return true;
    }
    // One play per ID: keep the largest amount (money) and the strongest intensity.
    const a = same.ctx;
    const b = item.ctx;
    const merged = { ...a } as C;
    if (b.amount !== undefined && (a.amount === undefined || b.amount > a.amount)) Object.assign(merged, b);
    if (b.intensity !== undefined && (a.intensity === undefined || b.intensity > a.intensity)) merged.intensity = b.intensity;
    same.ctx = merged;
    return true;
  }

  end(): void {
    if (!this.depth) return;
    if (--this.depth > 0) return;
    const items = this.items;
    this.items = [];
    if (items.length) this.flushTo(selectBatch(items, this.cap));
  }
}

/** Highest priority first; first-come within a priority; at most `cap`. Output in play order. */
export function selectBatch<T extends { priority: number }>(items: T[], cap = BATCH_CAP): T[] {
  const ranked = items.map((it, i) => ({ it, i })).sort((a, b) => b.it.priority - a.it.priority || a.i - b.i);
  return ranked.slice(0, cap).map((r) => r.it);
}
