// Minimal animation queue (SPEC §12 director): animations run in order, each skippable and
// speed-scaled. The engine is the source of truth; the director only shows it.

export type Speed = 'slow' | 'normal' | 'fast' | 'instant';
/**
 * Owner request (2026-11-18): everything slower. "slow" is labeled Relaxed (new, slowest);
 * Normal is the old Slow; Fast is the old Normal; the old 2× Fast was dropped. Keys are kept
 * so stored settings and `?speed=` stay valid.
 */
export const SPEED_FACTOR: Record<Speed, number> = { slow: 0.45, normal: 0.6, fast: 1, instant: Infinity };
export const SPEED_LABEL: Record<Speed, string> = { slow: 'Relaxed', normal: 'Normal', fast: 'Fast', instant: 'Instant' };

export interface Animation {
  /** Called once when the animation starts. May return a tick (true while running). */
  start(): ((dt: number) => boolean) | void;
  /** Jump to the end state. */
  finish?(): void;
  label?: string;
}

export class AnimationQueue {
  private queue: Animation[] = [];
  private current?: { anim: Animation; tick?: (dt: number) => boolean };
  speed: Speed = 'normal';
  onIdle?: () => void;
  /**
   * Audio Phase 0 §6: everything started together (a skip, or several instant items in one
   * frame) runs inside one sound batch, so their sounds don't all fire at once.
   */
  batch?: { begin(): void; end(): void };
  private wasBusy = false;

  get factor(): number {
    return SPEED_FACTOR[this.speed];
  }

  get busy(): boolean {
    return !!this.current || this.queue.length > 0;
  }

  push(...anims: Animation[]): void {
    this.queue.push(...anims);
  }

  /** Skip: finish the current animation immediately (Confirm skips to the end state). */
  skip(): void {
    if (!this.current) return;
    this.current.anim.finish?.();
    this.current = undefined;
  }

  /** Skip everything queued: each animation jumps straight to its end state. */
  flush(): void {
    this.batch?.begin();
    try {
      this.skip();
      let guard = 0;
      while (this.queue.length && guard++ < 10_000) {
        const next = this.queue.shift()!;
        next.start();
        next.finish?.();
      }
    } finally {
      this.batch?.end();
    }
    this.wasBusy = false;
    this.onIdle?.();
  }

  /** Advance by dt seconds of wall time. Returns true while busy. */
  update(dt: number): boolean {
    this.batch?.begin();
    try {
      return this.step(dt);
    } finally {
      this.batch?.end();
    }
  }

  private step(dt: number): boolean {
    let budget = 8; // allow several instant animations to complete in one frame
    while (budget-- > 0) {
      if (!this.current) {
        const next = this.queue.shift();
        if (!next) {
          // Fire onIdle once per busy → idle transition, not every frame.
          if (this.wasBusy) {
            this.wasBusy = false;
            this.onIdle?.();
          }
          return false;
        }
        this.wasBusy = true;
        const tick = next.start() ?? undefined;
        this.current = { anim: next, tick };
        if (!tick) {
          this.current = undefined;
          continue;
        }
        if (this.speed === 'instant') {
          next.finish?.();
          this.current = undefined;
          continue;
        }
      }
      const running = this.current.tick!(dt);
      if (!running) {
        this.current = undefined;
        dt = 0;
        continue;
      }
      return true;
    }
    return true;
  }
}
