// The game's original synthesized sounds (moved from sound.ts), now registry fallbacks.
// Each synth is normalized so its loudest partial peaks at 1.0; the old absolute peak lives in
// the registry `gain` and is applied by the voice gain node, so the output is unchanged.
import type { SynthName } from './registry';

export interface SynthEnv {
  ctx: BaseAudioContext;
  /** The voice's gain node (per-sound gain is applied there). */
  out: AudioNode;
  noise: AudioBuffer;
  rand: () => number;
  /** Frequency multiplier (pitch jitter). */
  pitch: number;
}

export interface SynthParams {
  intensity?: number;
  amount?: number;
}

/** Plays at `at`; returns how long the sound lasts (s). */
export type Synth = (env: SynthEnv, at: number, p: SynthParams) => number;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** How many coin clinks a payment of `amount` makes (1–6). */
export function coinCount(amount: number): number {
  if (!(amount > 0)) return 0;
  return Math.min(6, 1 + Math.floor(Math.log2(Math.max(1, amount / 25))));
}

function env(c: BaseAudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

export function noiseHit(e: SynthEnv, at: number, type: BiquadFilterType, freq: number, q: number, peak: number, decay: number): void {
  const c = e.ctx;
  const src = c.createBufferSource();
  src.buffer = e.noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq * e.pitch;
  f.Q.value = q;
  const g = env(c, at, peak, 0.002, decay);
  src.connect(f).connect(g).connect(e.out);
  src.start(at, e.rand() * 0.8);
  src.stop(at + decay + 0.05);
}

export function tone(e: SynthEnv, at: number, type: OscillatorType, freq: number, peak: number, attack: number, decay: number, glideTo?: number): void {
  const c = e.ctx;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq * e.pitch, at);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo * e.pitch, at + attack + decay);
  const g = env(c, at, peak, attack, decay);
  o.connect(g).connect(e.out);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}

/** One die contact: a woody knock with a little rattle. Level follows the impact (fix §8.3). */
const dice: Synth = (e, t, p) => {
  const v = 0.35 + 0.4 * Math.min(1, Math.max(0, p.intensity ?? 0.5));
  noiseHit(e, t, 'bandpass', 1800 + e.rand() * 1600, 3, 1 * v, 0.06);
  tone(e, t, 'triangle', 300 + e.rand() * 160, 0.5 * v, 0.002, 0.05);
  return 0.11;
};

/** A brass token setting down on a tile. */
const tap: Synth = (e, t) => {
  tone(e, t, 'sine', 1300 + e.rand() * 200, 1, 0.001, 0.07, 900);
  noiseHit(e, t, 'highpass', 3500, 0.7, 0.5, 0.025);
  return 0.12;
};

/** Coins changing hands; more clinks for bigger amounts. */
const coins: Synth = (e, t0, p) => {
  const n = coinCount(p.amount ?? 0);
  let t = t0;
  for (let k = 0; k < n; k++) {
    t = t0 + 0.005 + k * (0.055 + e.rand() * 0.03);
    const f = 2300 + e.rand() * 900;
    tone(e, t, 'sine', f, 1, 0.001, 0.32);
    tone(e, t, 'sine', f * 1.53, 0.05 / 0.09, 0.001, 0.22);
    noiseHit(e, t, 'highpass', 6000, 0.7, 0.05 / 0.09, 0.02);
  }
  return t - t0 + 0.37;
};

/** Card flip: a short papery swish. */
const card: Synth = (e, t) => {
  const c = e.ctx;
  const src = c.createBufferSource();
  src.buffer = e.noise;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(900 * e.pitch, t);
  f.frequency.exponentialRampToValueAtTime(4200 * e.pitch, t + 0.14);
  const g = env(c, t, 1, 0.03, 0.13);
  src.connect(f).connect(g).connect(e.out);
  src.start(t, e.rand() * 0.5);
  src.stop(t + 0.25);
  return 0.25;
};

/** Building placed (or removed): a wood-block tock. */
function tockAt(base: number): Synth {
  return (e, t) => {
    tone(e, t, 'sine', base, 1, 0.001, 0.11);
    tone(e, t, 'sine', base * 2.4, 0.12 / 0.35, 0.001, 0.05);
    noiseHit(e, t, 'bandpass', base * 3, 4, 0.12 / 0.35, 0.03);
    return 0.16;
  };
}

/** Good: a rising major arpeggio (F A C F). */
const stingGood: Synth = (e, t0) => {
  const t = t0 + 0.005;
  [65, 69, 72, 77].forEach((n, k) => {
    const at = t + k * 0.09;
    tone(e, at, 'triangle', midi(n), 1, 0.006, 0.5);
    tone(e, at, 'sine', midi(n + 12), 0.05 / 0.16, 0.006, 0.3);
  });
  return 3 * 0.09 + 0.56;
};

/** Bad: a falling minor third over a low note (normalized to the 0.22 drone). */
const stingBad: Synth = (e, t0) => {
  const t = t0 + 0.005;
  [60, 56, 53].forEach((n, k) => {
    const at = t + k * 0.14;
    tone(e, at, 'triangle', midi(n), 0.16 / 0.22, 0.006, 0.6);
    tone(e, at, 'sine', midi(n + 12), 0.05 / 0.22, 0.006, 0.3);
  });
  tone(e, t, 'sine', midi(41), 1, 0.02, 0.9);
  return 0.97;
};

export const SYNTHS: Record<Exclude<SynthName, 'generativeMusic'>, Synth> = {
  dice,
  tap,
  coins,
  card,
  tock: tockAt(560),
  tockLow: tockAt(380),
  stingGood,
  stingBad,
};
