// Renderer + post chain (SPEC §10.3, §10.10): ACES Filmic tone mapping, sRGB output,
// MSAA 4× render target on High, FXAA on Low. Renders on demand: the loop only runs while
// something animates or a frame has been requested.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import type { QualityProfile } from './quality';

/** Called every loop iteration; return true while still animating. Tickers stay registered. */
export type Ticker = (dt: number, now: number) => boolean;

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private fxaa?: FXAAPass;
  private tickers = new Set<Ticker>();
  private dirty = true;
  private running = false;
  private last = 0;
  private frameTimes: number[] = [];
  onFrame?: () => void;
  lastRenderInfo = { calls: 0, triangles: 0 };

  constructor(container: HTMLElement, camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.gl.setPixelRatio(window.devicePixelRatio);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.info.autoReset = false;
    this.gl.domElement.className = 'scene-canvas';
    container.appendChild(this.gl.domElement);
    this.scene.background = new THREE.Color(0x120a06);
    window.addEventListener('resize', () => this.resize());
  }

  get maxAnisotropy(): number {
    return this.gl.capabilities.getMaxAnisotropy();
  }

  applyQuality(q: QualityProfile): void {
    this.composer?.dispose();
    const size = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: q.msaa,
    });
    this.composer = new EffectComposer(this.gl, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());
    this.fxaa = undefined;
    if (q.fxaa) {
      this.fxaa = new FXAAPass();
      this.composer.addPass(this.fxaa);
    }
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setPixelRatio(window.devicePixelRatio);
    this.gl.setSize(w, h);
    this.composer?.setPixelRatio(window.devicePixelRatio);
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

  get isRunning(): boolean {
    return this.running;
  }

  /** Frames per second over the last second of rendered frames (0 when idle). */
  get fps(): number {
    const now = performance.now();
    this.frameTimes = this.frameTimes.filter((t) => now - t < 1000);
    return this.frameTimes.length;
  }

  /** Resume the loop (tickers run again). */
  wake(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    let active = false;
    for (const t of this.tickers) if (t(dt, now)) active = true;
    if (active || this.dirty) {
      this.dirty = false;
      this.gl.info.reset();
      this.composer.render(dt);
      this.lastRenderInfo = { calls: this.gl.info.render.calls, triangles: this.gl.info.render.triangles };
      this.frameTimes.push(now);
      this.onFrame?.();
    }
    if (active || this.dirty) requestAnimationFrame(this.loop);
    else this.running = false;
  };
}
