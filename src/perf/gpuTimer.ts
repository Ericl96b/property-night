// GPU frame time via EXT_disjoint_timer_query_webgl2 (SPEC-benchmark §2.1). One TIME_ELAPSED query
// wraps each frame's render; results are read a few frames later. Results from a disjoint period
// (GPU_DISJOINT_EXT set) are discarded. When the extension is missing, `available` is false and
// GPU time is reported as unavailable, never estimated.

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

const MAX_PENDING = 16;

export class GpuTimer {
  readonly available: boolean;
  private ext: TimerExt | null;
  private pending: { q: WebGLQuery; id: number }[] = [];
  private free: WebGLQuery[] = [];
  private active: { q: WebGLQuery; id: number } | null = null;

  constructor(private gl: WebGL2RenderingContext | WebGLRenderingContext) {
    const isGl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    this.ext = isGl2 ? (gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null) : null;
    this.available = !!this.ext;
  }

  begin(id: number): void {
    if (!this.ext || this.active) return;
    const gl = this.gl as WebGL2RenderingContext;
    if (this.pending.length >= MAX_PENDING) {
      // Results stopped arriving (context busy or lost): drop the oldest.
      const old = this.pending.shift()!;
      gl.deleteQuery(old.q);
    }
    const q = this.free.pop() ?? gl.createQuery();
    if (!q) return;
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = { q, id };
  }

  end(): void {
    if (!this.ext || !this.active) return;
    (this.gl as WebGL2RenderingContext).endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Read finished queries, oldest first; calls back with (frame id, GPU ms). */
  poll(cb: (id: number, ms: number) => void): void {
    if (!this.ext || this.pending.length === 0) return;
    const gl = this.gl as WebGL2RenderingContext;
    const disjoint = !!gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.pending.length) {
      const p = this.pending[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT) as number;
      this.pending.shift();
      this.free.push(p.q);
      if (!disjoint) cb(p.id, ns / 1e6);
    }
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}
