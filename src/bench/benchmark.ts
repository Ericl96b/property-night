// Benchmark runner (Batch 4, SPEC-benchmark §3). Builds its own fixed scene (never an engine game,
// never a save), runs the phase timelines with continuous rendering, captures frame samples per
// phase and turns them into a BenchSummary. Same seed, timeline and camera path every run.
import type { GameScene } from '../render/scene';
import type { Director } from '../director/director';
import type { Settings } from '../app/settings';
import type { BoardData } from '../data/classicBoard';
import { CLASSIC_BOARD } from '../data/classicBoard';
import type { State } from '../engine';
import type { FrameSample } from '../perf/samples';
import { gpuName } from '../render/quality';
import type { RenderHeight } from '../render/resolution';
import { renderPortraits } from '../render/portraits';
import { computeStats } from '../perf/stats';
import { targets } from '../perf/verdict';
import { buildSummary, type CapturedPhase, type CapturedRun } from '../perf/report';
import { COMPARE_CONFIGS, type BenchMode, type BenchSummary, type HeadroomResult, type PlayerConfig, type RunConfig, type SystemInfo } from '../perf/summary';
import { applyPreset, sandboxState } from './scenes';
import { ParallelTicks, closeupsPhase, poseCloseup, restPhase, sideView, turnMomentPhase, turnsPhase, wavePhase, type PhaseCtx, type PhaseScript } from './phases';
import { groupTiles } from '../engine/queries';
import { GROUP_ORDER } from './scenes';

export interface BenchEnv {
  scene: GameScene;
  director: Director;
  /** Live settings (read only here; restored values come from it). */
  settings: Settings;
  ensureBoard(board: BoardData): Promise<void>;
  /** The overlay shows moments for this state (null when the run ends). */
  setBenchState(s: State | null): void;
  /** Muted for the whole run (audio Phase 0 §8.1); levels come back afterwards. */
  sound?: { mute(key: string, on: boolean): void };
}

export interface BenchProgress {
  phase: string;
  /** 0..1 over the whole run. */
  fraction: number;
  run: number;
  runs: number;
}

/** Static frames rendered before each phase (shader warm-up after a settings switch). */
const SETTLE = 0.5;
const HEADROOM_STEP = 2;
const HEADROOM_MAX_K = 8;

function phasesFor(mode: BenchMode): { scripts: PhaseScript[]; headroom: boolean; closeups: ReturnType<typeof closeupsPhase> } {
  if (mode === 'quick') {
    const closeups = closeupsPhase(4);
    return { scripts: [restPhase(8 / 3), closeups, wavePhase(4)], headroom: false, closeups };
  }
  const closeups = closeupsPhase(12);
  // Stage 2: the turn sequence runs 14 s so the close-up handoff plays before the phase ends.
  return { scripts: [restPhase(8), turnsPhase(8), closeups, wavePhase(12), turnMomentPhase(14)], headroom: true, closeups };
}

/** Rough run length in seconds (for the progress bar and the mode picker). */
export function estimatedSeconds(mode: BenchMode): number {
  const { scripts, headroom } = phasesFor(mode);
  const one = scripts.reduce((a, s) => a + s.duration + SETTLE, 0) + (headroom ? 12 + 1 : 0);
  return Math.round((mode === 'compare' ? 3 : 1) * one + 1);
}

class Cancelled extends Error {}

/** Run `tick` every frame for `seconds` (wall time). */
function timeline(scene: GameScene, seconds: number, signal: AbortSignal, tick: (t: number, dt: number) => void = () => {}): Promise<void> {
  const r = scene.renderer;
  return new Promise((resolve, reject) => {
    let start = -1;
    let last = 0;
    const tk = (_dt: number, now: number): boolean => {
      if (signal.aborted) {
        r.removeTicker(tk);
        reject(new Cancelled());
        return false;
      }
      if (start < 0) start = last = now;
      const t = (now - start) / 1000;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tick(t, dt);
      if (t >= seconds) {
        r.removeTicker(tk);
        resolve();
        return false;
      }
      return true;
    };
    r.addTicker(tk);
  });
}

export function systemInfo(scene: GameScene, hz: number, hzRaw: number): SystemInfo {
  const r = scene.renderer;
  const buf = r.drawingBufferSize;
  return {
    gpu: gpuName(r.gl),
    bufferW: buf.width,
    bufferH: buf.height,
    cssW: window.innerWidth,
    cssH: window.innerHeight,
    dpr: window.devicePixelRatio,
    screenW: screen.width,
    screenH: screen.height,
    hz,
    hzRaw,
    threads: navigator.hardwareConcurrency ?? 0,
    maxTexture: r.gl.capabilities.maxTextureSize,
    gpuTimer: r.gpuTimerAvailable,
    renderHeight: r.selectedRenderHeight,
  };
}

/**
 * Run the benchmark. Resolves with the summary, or null when cancelled (Back / Escape).
 * Continuous rendering, speed, camera options and graphics settings are always restored.
 */
export async function runBenchmark(env: BenchEnv, mode: BenchMode, onProgress: (p: BenchProgress) => void, signal: AbortSignal, renderHeight?: RenderHeight): Promise<BenchSummary | null> {
  env.sound?.mute('bench', true);
  try {
    return await runMeasured(env, mode, onProgress, signal, renderHeight);
  } finally {
    env.sound?.mute('bench', false);
  }
}

async function runMeasured(env: BenchEnv, mode: BenchMode, onProgress: (p: BenchProgress) => void, signal: AbortSignal, renderHeight?: RenderHeight): Promise<BenchSummary | null> {
  const { scene, director, settings } = env;
  const r = scene.renderer;
  // Resolution override for this run only (restored below, never saved).
  if (renderHeight) r.setRenderHeight(renderHeight);
  const cam = scene.camera;
  const savedCamera = { ...cam.settings };
  const player: PlayerConfig = { quality: scene.quality.level, ao: settings.ambientOcclusion, toneMapping: settings.toneMapping, exposure: settings.brightness };
  const graphics = () => ({ exposure: settings.brightness, toneMapping: settings.toneMapping });
  const configs: RunConfig[] = mode === 'compare' ? COMPARE_CONFIGS : [{ quality: player.quality, ao: player.ao }];
  const total = estimatedSeconds(mode);
  let elapsed = 0;

  // The display rate, measured before any load is on the GPU.
  r.setContinuous(false);
  const { hz, raw } = await r.measureRefresh(60);

  scene.setSpeed('normal');
  cam.settings = { rotation: true, follow: true, reduceMotion: false, style: 'closeup' };
  await env.ensureBoard(CLASSIC_BOARD);
  const state = sandboxState(CLASSIC_BOARD, 6);
  applyPreset(state, 'worstCase');
  renderPortraits(state.seats.map((s) => ({ token: s.token, color: s.color })));
  env.setBenchState(state);
  scene.queue.flush();
  cam.setFollow(null);
  cam.setNudge(0, 0);
  cam.setPeek(false);
  sideView(scene, 0, true);
  director.sync(state);
  const ctx: PhaseCtx = { scene, director, state, bigPayment: settings.bigPaymentAmount };

  const runs: CapturedRun[] = [];
  try {
    r.setContinuous(true);
    await warmUp(ctx, signal);
    for (let ri = 0; ri < configs.length; ri++) {
      const config = configs[ri];
      if (mode === 'compare') {
        // Texture regeneration happens here, between runs, never mid-capture.
        await scene.setQuality(config.quality);
        r.setGraphics({ ao: config.ao, ...graphics() });
      }
      const progress = (phase: string, extra = 0) => onProgress({ phase, fraction: Math.min(1, (elapsed + extra) / total), run: ri + 1, runs: configs.length });
      const { scripts, headroom, closeups } = phasesFor(mode);
      const phases: CapturedPhase[] = [];
      let worstSlot = 0;
      for (const script of scripts) {
        progress(script.name);
        await timeline(scene, SETTLE, signal);
        elapsed += SETTLE;
        script.setup?.(ctx);
        r.beginCapture(script.id);
        const base = elapsed;
        await timeline(scene, script.duration, signal, (t, dt) => {
          script.tick(ctx, t, dt);
          progress(script.name, t);
          elapsed = base + Math.min(t, script.duration);
        });
        const samples = await r.endCapture();
        script.teardown?.(ctx);
        if (script === closeups) worstSlot = worstCloseup(samples, closeups);
        phases.push({ id: script.id, name: script.name, samples });
      }
      let head: HeadroomResult | null = null;
      if (headroom) head = await headroomPhase(env, ctx, worstSlot, hz, signal, (t) => progress('Headroom', t));
      elapsed += headroom ? 13 : 0;
      runs.push({ config, phases, headroom: head });
    }
  } catch (e) {
    if (e instanceof Cancelled) return null;
    throw e;
  } finally {
    r.setRenderMultiplier(1);
    r.resetCaptures();
    r.setContinuous(false);
    scene.queue.flush();
    cam.setNudge(0, 0);
    cam.setFollow(null);
    cam.settings = savedCamera;
    cam.toSide(0, true);
    scene.setSpeed(settings.speed);
    if (mode === 'compare') {
      await scene.setQuality(settings.quality);
      r.setGraphics({ ao: settings.ambientOcclusion, ...graphics() });
    }
    r.setRenderHeight(settings.renderHeight);
    env.setBenchState(null);
    r.requestRender();
  }
  return buildSummary(mode, systemInfo(scene, hz, raw), player, runs);
}

/**
 * Uncaptured warm-up: one sell fade per group, so the first-time shader compile for the
 * transparent sell materials happens before any capture (every run then does identical work).
 */
async function warmUp(ctx: PhaseCtx, signal: AbortSignal): Promise<void> {
  const ticks = new ParallelTicks();
  for (const g of GROUP_ORDER) {
    for (const tile of groupTiles(ctx.state.board, g).filter((i) => ctx.state.tiles[i].buildings > 0).slice(0, 2)) ticks.add(ctx.scene.buildings.remove(tile, 1));
  }
  await timeline(ctx.scene, 0.4, signal, (_t, dt) => ticks.step(dt));
  ticks.finish();
  ctx.director.sync(ctx.state);
  await timeline(ctx.scene, 0.2, signal);
}

/** Which close-up held the costliest frame (phase 6 holds it still). */
function worstCloseup(samples: FrameSample[], closeups: ReturnType<typeof closeupsPhase>): number {
  if (!samples.length) return 0;
  const t0 = samples[0].t;
  let worst = samples[0];
  const cost = (s: FrameSample) => s.gpuMs ?? s.cpuMs;
  for (const s of samples) if (cost(s) > cost(worst)) worst = s;
  return closeups.slotAt((worst.t - t0) / 1000);
}

/**
 * Phase 6: the worst close-up held still, rendered k times per displayed frame (k = 1..8, 2 s
 * each), stopping when the display rate is no longer held.
 */
async function headroomPhase(env: BenchEnv, ctx: PhaseCtx, slot: number, hz: number, signal: AbortSignal, progress: (t: number) => void): Promise<HeadroomResult> {
  const { scene } = env;
  const r = scene.renderer;
  poseCloseup(ctx, slot, true);
  scene.camera.setNudge(0, 0);
  await timeline(scene, 1, signal); // let the follow zoom / Landed shot settle
  let k = 0;
  let tried = 0;
  try {
    for (let n = 1; n <= HEADROOM_MAX_K; n++) {
      tried = n;
      r.setRenderMultiplier(n);
      await timeline(scene, 0.25, signal);
      r.beginCapture(`headroom-${n}`);
      await timeline(scene, HEADROOM_STEP, signal, (t) => progress(Math.min(12, (n - 1) * 1.5 + t * 0.75)));
      const samples = await r.endCapture();
      if (!targets(computeStats(samples, hz), hz).display) break;
      k = n;
    }
  } finally {
    r.setRenderMultiplier(1);
    scene.camera.setFollow(null);
  }
  return { k, tried, equivalentFps: k * hz };
}
