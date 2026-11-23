// Renderer + post chain (SPEC §10.3, §10.10): ACES Filmic tone mapping, sRGB output,
// MSAA 4× render target on High, FXAA on Low. Renders on demand (SPEC_render_resolution Part B):
// the loop only draws while something animates (tickers, activities, then a 300 ms tail) or a
// frame has been requested; otherwise it holds the last frame. Input is polled elsewhere.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import type { QualityProfile } from './quality';
import { SampleRing, type FrameSample } from '../perf/samples';
import { GpuTimer } from '../perf/gpuTimer';
import { estimateRefresh } from '../perf/refresh';
import { renderPixelRatio } from './resolution';
import { RenderSchedule } from './renderSchedule';

/** Graphics options outside the Quality preset (owner request, 2026-11-18). */
export interface GraphicsOptions {
  /** Ambient occlusion (GTAO) at low strength for contact shading. */
  ao: boolean;
  /** Tone-mapping exposure (brightness), 0.7–1.3. */
  exposure: number;
  toneMapping: 'aces' | 'agx' | 'neutral';
}

const TONE_MAPPING: Record<GraphicsOptions['toneMapping'], THREE.ToneMapping> = {
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
};

/** Called every loop iteration; return true while still animating. Tickers stay registered. */
export type Ticker = (dt: number, now: number) => boolean;

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private fxaa?: FXAAPass;
  private gtao?: GTAOPass;
  private quality?: QualityProfile;
  private graphics: GraphicsOptions = { ao: false, exposure: 1, toneMapping: 'aces' };
  private tickers = new Set<Ticker>();
  private dirty = true;
  private running = false;
  private last = 0;
  private frameTimes: number[] = [];
  onFrame?: () => void;
  lastRenderInfo = { calls: 0, triangles: 0 };

  // Frame timing (Batch 4, SPEC-benchmark §2.2). Recorded only while a capture runs or the
  // performance overlay is on; otherwise the loop does exactly what it did before.
  private ring = new SampleRing(4096);
  private captures = 0;
  private overlayOn = false;
  private continuous = false;
  private multiplier = 1;
  private timer?: GpuTimer;
  private lastRenderAt = 0;
  private schedule = new RenderSchedule();
  /** Dev toggle (?render=always): draw every frame. Independent of `continuous`. */
  private always = false;

  /** Selected internal render height (SPEC_render_resolution); clamped to the canvas's pixels. */
  private renderHeight: number = 2160;

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = true;
    // r18x removed PCFSoftShadowMap; PCF with a shadow radius gives the soft look.
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.info.autoReset = false;
    this.gl.domElement.className = 'scene-canvas';
    container.appendChild(this.gl.domElement);
    this.gl.setPixelRatio(this.getRenderPixelRatio());
    this.scene.background = new THREE.Color(0x120a06);
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('fullscreenchange', () => this.resize());
    this.watchDpr();
  }

  /** Recompute when the window moves to a monitor with a different devicePixelRatio. */
  private watchDpr(): void {
    try {
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener('change', () => {
        this.resize();
        this.watchDpr();
      }, { once: true });
    } catch {
      /* no matchMedia */
    }
  }

  /**
   * The one place the main canvas's pixel ratio comes from: the selected render height,
   * clamped to the canvas's physical pixels (exactly the device pixel ratio at native).
   */
  getRenderPixelRatio(): number {
    const el = this.gl.domElement;
    const clientH = el.clientHeight || window.innerHeight;
    return renderPixelRatio(this.renderHeight, clientH, window.devicePixelRatio || 1);
  }

  /** The selected render height (the drawing buffer may be smaller in a small window). */
  get selectedRenderHeight(): number {
    return this.renderHeight;
  }

  /** Change the internal render resolution live (no reload). */
  setRenderHeight(h: number): void {
    if (h === this.renderHeight) return;
    this.renderHeight = h;
    this.resize();
  }

  get maxAnisotropy(): number {
    return this.gl.capabilities.getMaxAnisotropy();
  }

  /** Brightness and tone mapping apply at once; turning AO on or off rebuilds the post chain. */
  setGraphics(g: GraphicsOptions): void {
    const aoChanged = g.ao !== this.graphics.ao;
    this.graphics = { ...g };
    this.gl.toneMapping = TONE_MAPPING[g.toneMapping] ?? THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = THREE.MathUtils.clamp(g.exposure, 0.5, 1.5);
    if (aoChanged && this.quality) this.applyQuality(this.quality);
    this.requestRender();
  }

  applyQuality(q: QualityProfile): void {
    this.quality = q;
    this.composer?.dispose();
    this.gtao?.dispose();
    this.gtao = undefined;
    this.gl.setPixelRatio(this.getRenderPixelRatio());
    const size = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: q.msaa,
    });
    this.composer = new EffectComposer(this.gl, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.graphics.ao) {
      // Radius in board units (a tile is ≈0.08): contact shading where houses, hotels and tokens
      // meet the board. Subtle by nature here: the board is flat and soft shadows already darken
      // most contacts.
      this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.gtao.blendIntensity = 1;
      this.gtao.updateGtaoMaterial({ radius: 0.1, distanceExponent: 1, thickness: 0.05, scale: 1, samples: 16 });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, samples: 16 });
      this.composer.addPass(this.gtao);
    }
    this.composer.addPass(new OutputPass());
    this.fxaa = undefined;
    if (q.fxaa) {
      this.fxaa = new FXAAPass();
      this.composer.addPass(this.fxaa);
    }
    this.resize();
  }

  resize(): void {
    // CSS size comes from the stylesheet (the canvas fills the window); three only sizes the
    // drawing buffer (updateStyle=false), and the browser upscales it to the CSS size.
    const el = this.gl.domElement;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    const pr = this.getRenderPixelRatio();
    this.gl.setPixelRatio(pr);
    this.gl.setSize(w, h, false);
    // Composer, its render targets, GTAO's targets and FXAA's resolution uniform all follow.
    this.composer?.setPixelRatio(pr);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onResize?.(w, h);
    this.requestRender();
  }
  onResize?: (w: number, h: number) => void;

  addTicker(t: Ticker): void {
    this.tickers.add(t);
    this.wake();
  }

  removeTicker(t: Ticker): void {
    this.tickers.delete(t);
  }

  requestRender(): void {
    this.dirty = true;
    this.wake();
  }

  /** Start an ongoing animation that isn't a ticker; the scene draws until `endActivity`. */
  beginActivity(id: string): void {
    this.schedule.begin(id, performance.now());
    this.wake();
  }

  /** End an activity; drawing continues for the short tail, then stops. */
  endActivity(id: string): void {
    this.schedule.end(id, performance.now());
    this.wake();
  }

  /** Dev only: always render (A/B comparison with idle rendering). */
  setAlwaysRender(on: boolean): void {
    this.always = on;
    if (on) this.wake();
    else this.requestRender();
  }

  get alwaysRender(): boolean {
    return this.always;
  }

  /** ACTIVE while the loop is drawing frames; IDLE while the last frame is held. */
  get renderState(): 'ACTIVE' | 'IDLE' {
    return this.running ? 'ACTIVE' : 'IDLE';
  }

  /** Frames rendered in the last `ms` milliseconds (up to 10 s). */
  framesInLast(ms: number): number {
    return this.schedule.framesIn(ms, performance.now());
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Frames per second over the last second of rendered frames (0 when idle). */
  get fps(): number {
    return this.schedule.framesIn(1000, performance.now());
  }

  /** Resume the loop (tickers run again). */
  wake(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    const inst = this.captures > 0 || this.overlayOn;
    const t0 = inst ? performance.now() : 0;
    const interval = now - this.last;
    const dt = Math.min(0.1, interval / 1000);
    this.last = now;
    let active = false;
    for (const t of this.tickers) if (t(dt, now)) active = true;
    const render = this.schedule.shouldRender({ now, tickersActive: active, dirty: this.dirty, continuous: this.continuous, always: this.always });
    if (render) {
      this.dirty = false;
      this.gl.info.reset();
      const timer = inst ? this.gpuTimer : undefined;
      const id = this.ring.nextId;
      timer?.begin(id);
      const k = this.multiplier;
      for (let i = 0; i < k; i++) this.composer.render(dt);
      timer?.end();
      // Per displayed frame, one render's worth (the headroom phase renders k times).
      const calls = Math.round(this.gl.info.render.calls / k);
      const triangles = Math.round(this.gl.info.render.triangles / k);
      this.lastRenderInfo = { calls, triangles };
      // Kept (last 1200 frames) for the review plans that read it directly.
      this.frameTimes.push(now);
      if (this.frameTimes.length > 1200) this.frameTimes.splice(0, this.frameTimes.length - 1200);
      this.schedule.recordFrame(now);
      this.lastRenderAt = now;
      if (inst) this.ring.push(now, interval, performance.now() - t0, calls, triangles);
      this.onFrame?.();
    }
    if (inst) this.timer?.poll((fid, ms) => this.ring.setGpu(fid, ms));
    if (render) requestAnimationFrame(this.loop);
    else this.running = false;
  };

  // --- instrumentation ------------------------------------------------------------------------

  /** The GPU timer (created on first use). */
  get gpuTimer(): GpuTimer {
    this.timer ??= new GpuTimer(this.gl.getContext());
    return this.timer;
  }

  /** Is GPU time measurable in this browser? */
  get gpuTimerAvailable(): boolean {
    return this.gpuTimer.available;
  }

  /** Overlay on/off: records samples for `recent()`. */
  setOverlay(on: boolean): void {
    this.overlayOn = on;
  }

  /** Render every animation frame (benchmark, test board in Detailed). Off restores render-on-demand. */
  setContinuous(on: boolean): void {
    this.continuous = on;
    if (on) this.wake();
    else this.requestRender();
  }

  get isContinuous(): boolean {
    return this.continuous;
  }

  /** Headroom phase only: render the frame k times per displayed frame. */
  setRenderMultiplier(k: number): void {
    this.multiplier = Math.max(1, Math.floor(k));
  }

  /** rAF time of the last rendered frame (0 before the first). */
  get lastFrameAt(): number {
    return this.lastRenderAt;
  }

  get drawingBufferSize(): { width: number; height: number } {
    const v = this.gl.getDrawingBufferSize(new THREE.Vector2());
    return { width: v.x, height: v.y };
  }

  /** Samples from the last `ms` milliseconds (overlay). */
  recent(ms: number): FrameSample[] {
    return this.ring.since(performance.now() - ms);
  }

  private captureFrom = 0;
  captureLabel = '';

  beginCapture(label: string): void {
    this.captureLabel = label;
    this.captureFrom = this.ring.nextId;
    this.captures++;
  }

  /**
   * End the capture and return its samples. Waits up to `settleFrames` animation frames for
   * late GPU timer results (the loop keeps polling while the capture is open).
   */
  async endCapture(settleFrames = 8): Promise<FrameSample[]> {
    const from = this.captureFrom;
    const to = this.ring.nextId;
    if (this.timer?.available) {
      for (let i = 0; i < settleFrames && this.timer.pendingCount > 0; i++) {
        this.requestRender();
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
    this.captures = Math.max(0, this.captures - 1);
    return this.ring.range(from, to);
  }

  /** Drop any open captures (a cancelled benchmark); instrumentation stops unless the overlay is on. */
  resetCaptures(): void {
    this.captures = 0;
  }

  /** Measure the display refresh rate from rAF intervals (no rendering needed). */
  measureRefresh(frames = 60): Promise<{ hz: number; raw: number }> {
    return new Promise((resolve) => {
      const ints: number[] = [];
      let prev = 0;
      const step = (t: number) => {
        if (prev) ints.push(t - prev);
        prev = t;
        if (ints.length >= frames) resolve(estimateRefresh(ints));
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}
