// Idle / on-demand rendering (SPEC_render_resolution Part B): decides when the 3D scene is drawn.
// The scene renders while anything is active (a ticker or a named activity), for a short tail
// after it ends so final poses and easing settle, and for one-off requested frames. Otherwise the
// last frame is held. Pure (no WebGL), so the rules are unit-tested with a fake clock.

/** Keep drawing this long after the last activity ends. */
export const TAIL_MS = 300;

/** Window for the overlay's "frames rendered" counter. */
export const COUNT_WINDOW_MS = 10_000;

export interface RenderInputs {
  now: number;
  /** A ticker reported itself still animating this frame. */
  tickersActive: boolean;
  /** One-off frame requested (requestRender). */
  dirty: boolean;
  /** Benchmark / test board Detailed: render every frame. */
  continuous: boolean;
  /** Dev toggle: always render (A/B comparison). */
  always: boolean;
}

export class RenderSchedule {
  private activities = new Set<string>();
  private lastActiveAt = -Infinity;
  private frames: number[] = [];

  /** Start a named, ongoing animation (renders until `end`). */
  begin(id: string, now: number): void {
    this.activities.add(id);
    this.lastActiveAt = now;
  }

  /** End a named animation; the tail keeps drawing for TAIL_MS. */
  end(id: string, now: number): void {
    if (this.activities.delete(id)) this.lastActiveAt = now;
  }

  get openActivities(): number {
    return this.activities.size;
  }

  /** Is anything animating (ticker or activity), or still in its tail? */
  isActive(now: number, tickersActive: boolean): boolean {
    if (tickersActive || this.activities.size > 0) {
      this.lastActiveAt = now;
      return true;
    }
    return now - this.lastActiveAt < TAIL_MS;
  }

  /** Draw this frame? (Also the condition for keeping the loop running.) */
  shouldRender(i: RenderInputs): boolean {
    const active = this.isActive(i.now, i.tickersActive);
    return active || i.dirty || i.continuous || i.always;
  }

  recordFrame(now: number): void {
    this.frames.push(now);
    const cut = now - COUNT_WINDOW_MS;
    let k = 0;
    while (k < this.frames.length && this.frames[k] <= cut) k++;
    if (k) this.frames.splice(0, k);
  }

  /** Frames rendered in the last `ms` (≤ COUNT_WINDOW_MS). */
  framesIn(ms: number, now: number): number {
    const cut = now - ms;
    let n = 0;
    for (let i = this.frames.length - 1; i >= 0 && this.frames[i] > cut; i--) n++;
    return n;
  }
}
