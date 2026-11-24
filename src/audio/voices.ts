// Voice management (audio Phase 0 §6): per-ID cooldown and voice count, plus a global cap.
// Pure and clock-driven (times in ms) so it is testable without WebAudio.

export interface VoiceInfo {
  id: string;
  priority: number;
  startedAt: number;
  endsAt: number;
  /** Stops the sound (a short fade). */
  stop(): void;
}

export interface Admission {
  ok: boolean;
  /** Voices the caller must stop to make room (already removed from the manager). */
  evict: VoiceInfo[];
}

export const GLOBAL_VOICE_CAP = 24;

export class VoiceManager {
  private voices: VoiceInfo[] = [];
  private lastPlay = new Map<string, number>();

  constructor(private cap = GLOBAL_VOICE_CAP) {}

  get active(): readonly VoiceInfo[] {
    return this.voices;
  }

  private prune(now: number): void {
    if (this.voices.some((v) => v.endsAt <= now)) this.voices = this.voices.filter((v) => v.endsAt > now);
  }

  /**
   * May `id` start now? Checks the cooldown, the ID's own voice count (the oldest is evicted)
   * and the global cap: a sound below every playing priority is dropped; otherwise the oldest
   * of the lowest-priority voices makes room.
   */
  admit(id: string, opts: { priority: number; cooldownMs: number; maxVoices: number }, now: number): Admission {
    this.prune(now);
    const last = this.lastPlay.get(id);
    if (last !== undefined && now - last < opts.cooldownMs) return { ok: false, evict: [] };
    const evict: VoiceInfo[] = [];
    const mine = this.voices.filter((v) => v.id === id);
    if (opts.maxVoices <= 0) return { ok: false, evict: [] };
    if (mine.length >= opts.maxVoices) {
      const oldest = mine.reduce((a, b) => (b.startedAt < a.startedAt ? b : a));
      evict.push(oldest);
      this.voices = this.voices.filter((v) => v !== oldest);
    }
    if (this.voices.length >= this.cap) {
      const minPrio = Math.min(...this.voices.map((v) => v.priority));
      if (opts.priority < minPrio) {
        // Put back anything we took out for the per-ID limit: the new sound is not playing.
        this.voices.push(...evict);
        return { ok: false, evict: [] };
      }
      const victim = this.voices.filter((v) => v.priority === minPrio).reduce((a, b) => (b.startedAt < a.startedAt ? b : a));
      evict.push(victim);
      this.voices = this.voices.filter((v) => v !== victim);
    }
    this.lastPlay.set(id, now);
    return { ok: true, evict };
  }

  add(v: VoiceInfo): void {
    this.voices.push(v);
  }

  stopAll(): void {
    for (const v of this.voices) v.stop();
    this.voices = [];
  }
}
