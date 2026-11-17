// Minimal animation queue (SPEC §12 director): animations run in order, each skippable and
// speed-scaled. The engine is the source of truth; the director only shows it.

export type Speed = 'slow' | 'normal' | 'fast' | 'instant';
export const SPEED_FACTOR: Record<Speed, number> = { slow: 0.6, normal: 1, fast: 2, instant: Infinity };

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

  /** Advance by dt seconds of wall time. Returns true while busy. */
  update(dt: number): boolean {
    let budget = 8; // allow several instant animations to complete in one frame
    while (budget-- > 0) {
      if (!this.current) {
        const next = this.queue.shift();
        if (!next) {
          this.onIdle?.();
          return false;
        }
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
