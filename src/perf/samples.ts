// Per-frame timing samples (Batch 4, SPEC-benchmark §2.2). Pure: no DOM.

export interface FrameSample {
  /** Frame number (monotonic, per renderer). */
  id: number;
  /** rAF timestamp of the frame, ms. */
  t: number;
  /** Time since the previous rendered frame, ms. */
  interval: number;
  /** CPU time for tickers + render submission, ms. */
  cpuMs: number;
  /** GPU time from a timer query, ms (null until it arrives, or when unavailable). */
  gpuMs: number | null;
  calls: number;
  triangles: number;
}

/**
 * Fixed-size ring of samples. Slots are preallocated and overwritten in place, so recording a
 * frame never allocates.
 */
export class SampleRing {
  private slots: FrameSample[];
  private next = 0;

  constructor(readonly capacity = 2000) {
    this.slots = Array.from({ length: capacity }, () => ({ id: -1, t: 0, interval: 0, cpuMs: 0, gpuMs: null, calls: 0, triangles: 0 }));
  }

  /** Id the next pushed sample will get. */
  get nextId(): number {
    return this.next;
  }

  push(t: number, interval: number, cpuMs: number, calls: number, triangles: number): number {
    const id = this.next++;
    const s = this.slots[id % this.capacity];
    s.id = id;
    s.t = t;
    s.interval = interval;
    s.cpuMs = cpuMs;
    s.gpuMs = null;
    s.calls = calls;
    s.triangles = triangles;
    return id;
  }

  /** Fill in a GPU time that arrived late (ignored if the slot was already overwritten). */
  setGpu(id: number, ms: number): void {
    const s = this.slots[id % this.capacity];
    if (s.id === id) s.gpuMs = ms;
  }

  /** Copies of samples with fromId ≤ id < toId that are still in the ring, oldest first. */
  range(fromId: number, toId = this.next): FrameSample[] {
    const out: FrameSample[] = [];
    const start = Math.max(fromId, this.next - this.capacity, 0);
    for (let id = start; id < toId; id++) {
      const s = this.slots[id % this.capacity];
      if (s.id === id) out.push({ ...s });
    }
    return out;
  }

  /** Copies of samples whose timestamp is at or after `sinceT`, oldest first. */
  since(sinceT: number): FrameSample[] {
    let from = this.next;
    const floor = Math.max(0, this.next - this.capacity);
    while (from > floor) {
      const s = this.slots[(from - 1) % this.capacity];
      if (s.id !== from - 1 || s.t < sinceT) break;
      from--;
    }
    return this.range(from);
  }
}
