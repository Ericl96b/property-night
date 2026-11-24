// Sound engine (SPEC §9, audio Phase 0). Every sound is played by registry ID
// (`sound.play('dice.bounce.wood', { intensity })`), resolved as loaded files → synth fallback
// → silence. The engine owns the audio context lifecycle (first-gesture unlock, hidden-tab
// suspend), the ui / sfx / music buses, voice limits, batching and music ducking.
import { REGISTRY, filePoolOf, isSoundId, type Bus, type SoundId } from './registry';
import { SYNTHS, coinCount } from './synths';
import { GenerativeMusic } from './music';
import { AudioLoader } from './loader';
import { VoiceManager } from './voices';
import { Batcher, type BatchItem } from './batch';
import { pickVariation } from './variation';

export { coinCount };
export type { SoundId };

export interface PlayCtx {
  /** 0–1: scales the level; synth fallbacks may use it (dice: impact speed). */
  intensity?: number;
  /** Money: passed to the coins synth (1–6 clinks). */
  amount?: number;
  /** Bot actions use the entry's botGain. */
  isBot?: boolean;
  /** The acting seat. */
  seat?: number;
  payer?: number | 'bank';
  payee?: number | 'bank';
  /** Play on another bus than the registry's (only the volume preview needs this). */
  bus?: Bus;
}

/** What callers need (the director, UI, tests). */
export interface SoundApi {
  play(id: SoundId, ctx?: PlayCtx): void;
  beginBatch(): void;
  endBatch(): void;
  /** Lower the music by `amountDb` for `ms` (Infinity holds until `duck(0, 0)`). */
  duck(amountDb: number, ms: number): void;
}

/** No-op sound for tests and before the app wires audio. */
export const SILENT: SoundApi = { play() {}, beginBatch() {}, endBatch() {}, duck() {} };

export interface Volumes {
  volumeMaster: number;
  volumeMusic: number;
  volumeEffects: number;
  volumeUi: number;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Final bus gains: master scales every bus; a perceptual (squared) curve on each slider. */
export function mixGains(v: Volumes): { music: number; effects: number; ui: number } {
  const m = clamp01(v.volumeMaster) ** 2;
  return {
    music: m * clamp01(v.volumeMusic) ** 2 * 0.35,
    effects: m * clamp01(v.volumeEffects) ** 2,
    ui: m * clamp01(v.volumeUi) ** 2,
  };
}

export type SoundStatus = { kind: 'file'; count: number } | { kind: 'synth' } | { kind: 'silent' };

const PAUSE_HOLD = 'hold';

export class Sound implements SoundApi {
  private ctx: AudioContext | null = null;
  private buses!: Record<Bus, GainNode>;
  private musicOut!: GainNode;
  private duckGain!: GainNode;
  private noise!: AudioBuffer;
  private volumes: Volumes = { volumeMaster: 0.8, volumeMusic: 0.4, volumeEffects: 0.8, volumeUi: 0.7 };
  private mutes = new Set<string>();
  private voices = new VoiceManager();
  private batcher = new Batcher<PlayCtx>((items) => this.flushBatch(items));
  private lastVariation = new Map<string, number>();
  private music: GenerativeMusic | null = null;
  private musicLoop: AudioBufferSourceNode | null = null;
  private ducks = new Map<string, { db: number; until: number }>();
  private duckSeq = 0;
  private seed = 12345;
  private attached = false;
  private preload: Promise<void> | null = null;
  readonly loader: AudioLoader;
  /** Dev counters (`__pn.sound.stats`): what played and how. */
  readonly stats = { started: 0, log: [] as { id: string; via: 'file' | 'synth'; at: number }[] };

  constructor(
    private manifest: Record<string, readonly string[]> = {},
    opts: { loader?: AudioLoader; now?: () => number } = {},
  ) {
    this.loader = opts.loader ?? new AudioLoader();
    if (opts.now) this.now = opts.now;
  }

  private now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ---- lifecycle -------------------------------------------------------------------------------

  /**
   * Start preloading and listen for the first gesture (browsers only allow audio after one) and
   * for the tab being hidden. Safe to call once at startup; a no-op outside a browser.
   */
  attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true });
    document.addEventListener('visibilitychange', () => this.setHidden(document.hidden));
    this.preloadFiles();
  }

  /** Fetch and decode every registered file (can run before the unlock). */
  preloadFiles(): Promise<void> {
    this.preload ??= this.loader.load(this.manifestWithExtras(), isSoundId).then(() => this.updateMusic(true));
    return this.preload;
  }

  private manifestWithExtras(): Record<string, readonly string[]> {
    const m: Record<string, readonly string[]> = { ...this.manifest };
    for (const [id, d] of Object.entries(REGISTRY)) if (d.files.length) m[id] = [...(m[id] ?? []), ...d.files];
    return m;
  }

  /** Dev (Sound Test): re-read the file list and decode again, so dropped-in files play. */
  async reloadFiles(): Promise<void> {
    if (import.meta.env?.DEV) {
      try {
        const res = await fetch('/__audio-manifest', { cache: 'no-store' });
        if (res.ok) this.manifest = await res.json();
      } catch {
        /* keep the old list */
      }
    }
    this.loader.clear();
    this.lastVariation.clear();
    this.preload = null;
    await this.preloadFiles();
  }

  /** Create/resume the audio context. Browsers allow this only after a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        comp.connect(ctx.destination);
        const bus = () => {
          const g = ctx.createGain();
          g.connect(comp);
          return g;
        };
        this.buses = { ui: bus(), sfx: bus(), music: bus() };
        this.duckGain = ctx.createGain();
        this.duckGain.connect(this.buses.music);
        this.musicOut = ctx.createGain();
        this.musicOut.connect(this.duckGain);
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = this.rand() * 2 - 1;
        this.applyVolumes();
        this.recomputeDuck();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* audio unavailable */
    }
  }

  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  // ---- levels ----------------------------------------------------------------------------------

  setVolumes(v: Volumes): void {
    this.volumes = { volumeMaster: v.volumeMaster, volumeMusic: v.volumeMusic, volumeEffects: v.volumeEffects, volumeUi: v.volumeUi };
    this.applyVolumes();
  }

  /** Silence effects and music under a named layer (the benchmark), without touching settings. */
  mute(key: string, on: boolean): void {
    if (on) this.mutes.add(key);
    else this.mutes.delete(key);
    this.applyVolumes();
  }

  /** Effective bus gains (settings × mutes). */
  busGains(): Record<Bus, number> {
    const g = mixGains(this.volumes);
    const muted = this.mutes.size > 0;
    return { ui: g.ui, sfx: muted ? 0 : g.effects, music: muted ? 0 : g.music };
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const g = this.busGains();
    const t = this.ctx.currentTime;
    this.buses.music.gain.setTargetAtTime(g.music, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(g.sfx, t, 0.02);
    this.buses.ui.gain.setTargetAtTime(g.ui, t, 0.02);
    this.updateMusic();
  }

  // ---- music -----------------------------------------------------------------------------------

  /** Music runs only while it can be heard: the scheduler stops at an effective level of 0. */
  private updateMusic(restart = false): void {
    const c = this.ctx;
    if (!c) return;
    const on = this.busGains().music > 0;
    const files = this.filesFor('music.main');
    if (restart || !on) this.stopMusic();
    if (!on || this.music?.playing || this.musicLoop) return;
    const def = REGISTRY['music.main'];
    this.musicOut.gain.value = files.length ? def.fileGain : def.synthGain;
    if (files.length) {
      const src = c.createBufferSource();
      src.buffer = files[0];
      src.loop = true;
      src.connect(this.musicOut);
      src.start(c.currentTime + 0.05);
      this.musicLoop = src;
      return;
    }
    this.music ??= new GenerativeMusic({ ctx: c, out: this.musicOut, noise: this.noise, rand: () => this.rand(), pitch: 1 });
    this.music.start();
  }

  private stopMusic(): void {
    this.music?.stop();
    if (this.musicLoop) {
      try {
        this.musicLoop.stop();
      } catch {
        /* not started */
      }
      this.musicLoop.disconnect();
      this.musicLoop = null;
    }
  }

  get musicPlaying(): boolean {
    return !!(this.music?.playing || this.musicLoop);
  }

  duck(amountDb: number, ms: number): void {
    if (ms === Infinity) this.ducks.set(PAUSE_HOLD, { db: amountDb, until: Infinity });
    else if (amountDb === 0 && ms === 0) this.ducks.delete(PAUSE_HOLD);
    else {
      const key = `d${this.duckSeq++}`;
      this.ducks.set(key, { db: amountDb, until: this.now() + ms });
      setTimeout(() => {
        this.ducks.delete(key);
        this.recomputeDuck();
      }, ms);
    }
    this.recomputeDuck();
  }

  /** The current duck depth in dB (the deepest active one). */
  get duckDb(): number {
    let db = 0;
    for (const d of this.ducks.values()) db = Math.min(db, d.db);
    return db;
  }

  private recomputeDuck(): void {
    if (!this.ctx) return;
    this.duckGain.gain.setTargetAtTime(10 ** (this.duckDb / 20), this.ctx.currentTime, 0.08);
  }

  // ---- playback --------------------------------------------------------------------------------

  /** The ID whose loaded files this ID plays (itself, or its `shareFilesWith` pool). */
  filePool(id: SoundId): string {
    return filePoolOf(id, (k) => this.loader.get(k).length > 0);
  }

  private filesFor(id: SoundId): readonly AudioBuffer[] {
    return this.loader.get(this.filePool(id));
  }

  /** What an ID would play now: files (its own or shared), the synth fallback, or nothing. */
  status(id: SoundId): SoundStatus {
    const n = this.filesFor(id).length;
    if (n) return { kind: 'file', count: n };
    const synth = REGISTRY[id]?.synth;
    return synth ? { kind: 'synth' } : { kind: 'silent' };
  }

  beginBatch(): void {
    this.batcher.begin();
  }

  endBatch(): void {
    this.batcher.end();
  }

  private flushBatch(items: BatchItem<PlayCtx>[]): void {
    for (const it of items) this.playNow(it.id as SoundId, it.ctx);
  }

  play(id: SoundId, ctx: PlayCtx = {}): void {
    const def = REGISTRY[id];
    if (!def) return;
    if (this.batcher.add({ id, priority: def.priority, ctx })) return;
    this.playNow(id, ctx);
  }

  private live(bus: Bus): AudioContext | null {
    const c = this.ctx;
    return c && c.state === 'running' && this.busGains()[bus] > 0 ? c : null;
  }

  private rand(): number {
    // Small LCG: cosmetic variation only.
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 2 ** 32;
  }

  private playNow(id: SoundId, ctx: PlayCtx): void {
    const def = REGISTRY[id];
    if (def.loop) return; // music is started by the engine, not by callers
    const st = this.status(id);
    if (st.kind === 'silent') return;
    const c = this.live(ctx.bus ?? def.bus);
    if (!c) return;
    const now = this.now();
    const adm = this.voices.admit(id, def, now);
    for (const v of adm.evict) v.stop();
    if (!adm.ok) return;

    const intensity = ctx.intensity === undefined ? 1 : Math.min(1, Math.max(0, ctx.intensity));
    const jitterDb = def.gainJitter ? (this.rand() * 2 - 1) * def.gainJitter : 0;
    const semis = def.pitchJitter ? (this.rand() * 2 - 1) * def.pitchJitter : 0;
    let level = (st.kind === 'file' ? def.fileGain : def.synthGain) * 10 ** (jitterDb / 20) * (ctx.isBot ? def.botGain : 1);
    // Files have no notion of intensity: scale them (softly, so quiet hits stay audible).
    // Synths get the intensity as a parameter instead (dice uses it for its level).
    if (st.kind === 'file' && ctx.intensity !== undefined) level *= 0.35 + 0.65 * intensity;

    const voice = c.createGain();
    voice.gain.value = level;
    voice.connect(this.buses[ctx.bus ?? def.bus]);
    const at = c.currentTime + 0.005;
    let dur: number;
    let src: AudioBufferSourceNode | null = null;
    if (st.kind === 'file') {
      // Variation memory is per pool, so IDs sharing files don't repeat each other back to back.
      const pool = this.filePool(id);
      const bufs = this.loader.get(pool);
      const k = pickVariation(bufs.length, this.lastVariation.get(pool) ?? -1, () => this.rand());
      this.lastVariation.set(pool, k);
      src = c.createBufferSource();
      src.buffer = bufs[k];
      src.playbackRate.value = 2 ** (semis / 12);
      src.connect(voice);
      src.start(at);
      dur = bufs[k].duration / src.playbackRate.value;
    } else {
      const synth = SYNTHS[def.synth as keyof typeof SYNTHS];
      dur = synth({ ctx: c, out: voice, noise: this.noise, rand: () => this.rand(), pitch: 2 ** (semis / 12) }, at, { intensity: ctx.intensity, amount: ctx.amount });
    }
    const end = () => voice.disconnect();
    const timer = setTimeout(end, (dur + 0.3) * 1000);
    this.voices.add({
      id,
      priority: def.priority,
      startedAt: now,
      endsAt: now + (dur + 0.05) * 1000,
      stop: () => {
        // A short fade, then cut.
        const t = c.currentTime;
        voice.gain.cancelScheduledValues(t);
        voice.gain.setValueAtTime(voice.gain.value, t);
        voice.gain.linearRampToValueAtTime(0, t + 0.01);
        try {
          src?.stop(t + 0.02);
        } catch {
          /* already stopped */
        }
        clearTimeout(timer);
        setTimeout(end, 50);
      },
    });
    if (def.duck) this.duck(def.duck.db, def.duck.ms);
    this.stats.started++;
    this.stats.log.push({ id, via: st.kind, at: now });
    if (this.stats.log.length > 50) this.stats.log.shift();
  }
}
