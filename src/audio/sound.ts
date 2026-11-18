// Sound (SPEC §9): every sound is synthesized with WebAudio at run time, nothing is shipped.
// Dice clatter, token tap, coins, card flip, building "tock", and light generative background
// music, with master / music / effects volumes (SPEC §13 settings).

export interface SoundFx {
  dice(): void;
  tap(): void;
  coins(amount: number): void;
  card(): void;
  tock(remove?: boolean): void;
  /** Short sting for a moment banner (SPEC §10.9): bright for wins and sets, low for bad news. */
  sting(mood: 'good' | 'bad'): void;
}

export const SILENT: SoundFx = { dice() {}, tap() {}, coins() {}, card() {}, tock() {}, sting() {} };

export interface Volumes {
  volumeMaster: number;
  volumeMusic: number;
  volumeEffects: number;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Final bus gains: master scales both buses; a perceptual (squared) curve on each slider. */
export function mixGains(v: Volumes): { music: number; effects: number } {
  const m = clamp01(v.volumeMaster) ** 2;
  return { music: m * clamp01(v.volumeMusic) ** 2 * 0.35, effects: m * clamp01(v.volumeEffects) ** 2 };
}

/** How many coin clinks a payment of `amount` makes (1–6). */
export function coinCount(amount: number): number {
  if (!(amount > 0)) return 0;
  return Math.min(6, 1 + Math.floor(Math.log2(Math.max(1, amount / 25))));
}

/** Drops events closer together than `minGap` seconds (taps and dice contacts at high speed). */
export class Throttle {
  private last = -Infinity;
  constructor(private minGap: number) {}
  ok(now: number): boolean {
    if (now - this.last < this.minGap) return false;
    this.last = now;
    return true;
  }
}

// Music: F major, four chords, soft pad + sparse pentatonic plucks.
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
const CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [50, 53, 57, 60], // Dm7
  [46, 50, 53, 57], // Bbmaj7
  [48, 52, 55, 60], // C
];
const PENTA = [65, 67, 69, 72, 74, 77, 79, 81];
const BPM = 80;

export class Sound implements SoundFx {
  private ctx: AudioContext | null = null;
  private musicBus!: GainNode;
  private fxBus!: GainNode;
  private noise!: AudioBuffer;
  private volumes: Volumes = { volumeMaster: 0.8, volumeMusic: 0.4, volumeEffects: 0.8 };
  private taps = new Throttle(0.045);
  private contacts = new Throttle(0.03);
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private seed = 12345;

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
        this.musicBus = ctx.createGain();
        this.fxBus = ctx.createGain();
        this.musicBus.connect(comp);
        this.fxBus.connect(comp);
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = this.rand() * 2 - 1;
        this.setVolumes(this.volumes);
        this.startMusic();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* audio unavailable */
    }
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  setVolumes(v: Volumes): void {
    this.volumes = { volumeMaster: v.volumeMaster, volumeMusic: v.volumeMusic, volumeEffects: v.volumeEffects };
    if (!this.ctx) return;
    const g = mixGains(v);
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(g.music, t, 0.05);
    this.fxBus.gain.setTargetAtTime(g.effects, t, 0.02);
  }

  /** Pause the music scheduler while the page is hidden. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  // ---- effects ---------------------------------------------------------------------------------

  private live(): AudioContext | null {
    const c = this.ctx;
    return c && c.state === 'running' && mixGains(this.volumes).effects > 0 ? c : null;
  }

  private rand(): number {
    // Small LCG: cosmetic variation only.
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 2 ** 32;
  }

  private env(c: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  }

  private noiseHit(c: AudioContext, at: number, type: BiquadFilterType, freq: number, q: number, peak: number, decay: number, out: AudioNode = this.fxBus): void {
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.env(c, at, peak, 0.002, decay);
    src.connect(f).connect(g).connect(out);
    src.start(at, this.rand() * 0.8);
    src.stop(at + decay + 0.05);
  }

  private tone(c: AudioContext, at: number, type: OscillatorType, freq: number, peak: number, attack: number, decay: number, out: AudioNode = this.fxBus, glideTo?: number): void {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + attack + decay);
    const g = this.env(c, at, peak, attack, decay);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + attack + decay + 0.05);
  }

  /** One die contact: a woody knock with a little rattle. */
  dice(): void {
    const c = this.live();
    if (!c || !this.contacts.ok(c.currentTime)) return;
    const t = c.currentTime + 0.005;
    const v = 0.35 + this.rand() * 0.4;
    this.noiseHit(c, t, 'bandpass', 1800 + this.rand() * 1600, 3, 0.5 * v, 0.06);
    this.tone(c, t, 'triangle', 300 + this.rand() * 160, 0.25 * v, 0.002, 0.05);
  }

  /** A brass token setting down on a tile. */
  tap(): void {
    const c = this.live();
    if (!c || !this.taps.ok(c.currentTime)) return;
    const t = c.currentTime + 0.005;
    this.tone(c, t, 'sine', 1300 + this.rand() * 200, 0.12, 0.001, 0.07, this.fxBus, 900);
    this.noiseHit(c, t, 'highpass', 3500, 0.7, 0.06, 0.025);
  }

  /** Coins changing hands; more clinks for bigger amounts. */
  coins(amount: number): void {
    const c = this.live();
    if (!c) return;
    const n = coinCount(amount);
    for (let k = 0; k < n; k++) {
      const t = c.currentTime + 0.01 + k * (0.055 + this.rand() * 0.03);
      const f = 2300 + this.rand() * 900;
      this.tone(c, t, 'sine', f, 0.09, 0.001, 0.32);
      this.tone(c, t, 'sine', f * 1.53, 0.05, 0.001, 0.22);
      this.noiseHit(c, t, 'highpass', 6000, 0.7, 0.05, 0.02);
    }
  }

  /** Card flip: a short papery swish. */
  card(): void {
    const c = this.live();
    if (!c) return;
    const t = c.currentTime + 0.005;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.14);
    const g = this.env(c, t, 0.35, 0.03, 0.13);
    src.connect(f).connect(g).connect(this.fxBus);
    src.start(t, this.rand() * 0.5);
    src.stop(t + 0.25);
  }

  /** Building placed (or removed): a wood-block tock. */
  tock(remove = false): void {
    const c = this.live();
    if (!c) return;
    const t = c.currentTime + 0.005;
    const base = remove ? 380 : 560;
    this.tone(c, t, 'sine', base, 0.35, 0.001, 0.11);
    this.tone(c, t, 'sine', base * 2.4, 0.12, 0.001, 0.05);
    this.noiseHit(c, t, 'bandpass', base * 3, 4, 0.12, 0.03);
  }

  sting(mood: 'good' | 'bad'): void {
    const c = this.live();
    if (!c) return;
    const t = c.currentTime + 0.01;
    // Good: a rising major arpeggio (F A C F). Bad: a falling minor third over a low note.
    const notes = mood === 'good' ? [65, 69, 72, 77] : [60, 56, 53];
    notes.forEach((n, k) => {
      const at = t + k * (mood === 'good' ? 0.09 : 0.14);
      this.tone(c, at, 'triangle', midi(n), 0.16, 0.006, mood === 'good' ? 0.5 : 0.6);
      this.tone(c, at, 'sine', midi(n + 12), 0.05, 0.006, 0.3);
    });
    if (mood === 'bad') this.tone(c, t, 'sine', midi(41), 0.22, 0.02, 0.9);
  }

  // ---- music -----------------------------------------------------------------------------------

  private startMusic(): void {
    if (this.musicTimer || !this.ctx) return;
    this.nextBeat = this.ctx.currentTime + 0.3;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 120);
  }

  private scheduleMusic(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const eighth = 60 / BPM / 2;
    if (this.nextBeat < c.currentTime - 1) this.nextBeat = c.currentTime + 0.05;
    const silent = mixGains(this.volumes).music <= 0;
    while (this.nextBeat < c.currentTime + 0.4) {
      const t = this.nextBeat;
      const bar = Math.floor(this.beat / 8);
      const chord = CHORDS[bar % CHORDS.length];
      if (!silent) {
        if (this.beat % 8 === 0) {
          // Pad: the chord, softly, for the whole bar.
          for (const n of chord) this.tone(c, t, 'triangle', midi(n), 0.05, 0.6, eighth * 8, this.musicBus);
          this.tone(c, t, 'sine', midi(chord[0] - 12), 0.1, 0.05, eighth * 7, this.musicBus);
        }
        if (this.beat % 2 === 0 || this.rand() < 0.3) {
          if (this.rand() < 0.42) {
            const n = PENTA[Math.floor(this.rand() * PENTA.length)];
            this.tone(c, t, 'triangle', midi(n), 0.07, 0.004, 0.5, this.musicBus);
          }
        }
      }
      this.beat++;
      this.nextBeat += eighth;
    }
  }
}
