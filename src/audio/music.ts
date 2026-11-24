// Generative background music (score unchanged from the original sound.ts): F major, four
// chords, soft pad + sparse pentatonic plucks, scheduled ahead on a 120 ms timer.
import { tone, type SynthEnv } from './synths';

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
const CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [50, 53, 57, 60], // Dm7
  [46, 50, 53, 57], // Bbmaj7
  [48, 52, 55, 60], // C
];
const PENTA = [65, 67, 69, 72, 74, 77, 79, 81];
const BPM = 80;

export class GenerativeMusic {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;

  constructor(private env: SynthEnv & { ctx: AudioContext }) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.nextBeat = this.env.ctx.currentTime + 0.3;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  /** Stop scheduling (already-scheduled notes ring out). */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const e = this.env;
    const c = e.ctx;
    if (c.state !== 'running') return;
    const eighth = 60 / BPM / 2;
    if (this.nextBeat < c.currentTime - 1) this.nextBeat = c.currentTime + 0.05;
    while (this.nextBeat < c.currentTime + 0.4) {
      const t = this.nextBeat;
      const bar = Math.floor(this.beat / 8);
      const chord = CHORDS[bar % CHORDS.length];
      if (this.beat % 8 === 0) {
        // Pad: the chord, softly, for the whole bar.
        for (const n of chord) tone(e, t, 'triangle', midi(n), 0.05, 0.6, eighth * 8);
        tone(e, t, 'sine', midi(chord[0] - 12), 0.1, 0.05, eighth * 7);
      }
      if (this.beat % 2 === 0 || e.rand() < 0.3) {
        if (e.rand() < 0.42) {
          const n = PENTA[Math.floor(e.rand() * PENTA.length)];
          tone(e, t, 'triangle', midi(n), 0.07, 0.004, 0.5);
        }
      }
      this.beat++;
      this.nextBeat += eighth;
    }
  }
}
