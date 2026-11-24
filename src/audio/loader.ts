// Sound file loading (audio Phase 0 §2): fetch + decodeAudioData, decoded buffers cached per ID.
// Decoding runs on an OfflineAudioContext so it can start before the first user gesture
// (AudioBuffers can be played by any context). Failures warn once per ID (dev) and never throw.

export type Decoder = (data: ArrayBuffer) => Promise<AudioBuffer>;

function defaultDecoder(): Decoder | null {
  const OAC = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!OAC || typeof fetch !== 'function') return null;
  let ctx: OfflineAudioContext | null = null;
  return (data) => {
    ctx ??= new OAC(1, 1, 48000);
    return ctx.decodeAudioData(data);
  };
}

const stemOf = (url: string) => url.replace(/\?.*$/, '').replace(/\.(ogg|wav)$/i, '');

export class AudioLoader {
  private buffers = new Map<string, AudioBuffer[]>();
  private warned = new Set<string>();
  private generation = 0;

  constructor(
    private decode: Decoder | null = defaultDecoder(),
    private base = (import.meta.env?.BASE_URL as string | undefined) ?? '/',
    private warn: (msg: string) => void = (m) => {
      if (import.meta.env?.DEV) console.warn(m);
    },
  ) {}

  get(id: string): readonly AudioBuffer[] {
    return this.buffers.get(id) ?? [];
  }

  /** Test hook / dev: set an ID's buffers directly. */
  set(id: string, bufs: AudioBuffer[]): void {
    if (bufs.length) this.buffers.set(id, bufs);
    else this.buffers.delete(id);
  }

  clear(): void {
    this.buffers.clear();
    this.warned.clear();
    this.generation++;
  }

  private warnOnce(id: string, msg: string): void {
    if (this.warned.has(id)) return;
    this.warned.add(id);
    this.warn(`[audio] ${id}: ${msg}`);
  }

  /** Load every file of every ID in `manifest`. Resolves when all are done (never rejects). */
  async load(manifest: Record<string, readonly string[]>, known: (id: string) => boolean = () => true): Promise<void> {
    const gen = this.generation;
    await Promise.all(
      Object.entries(manifest).map(async ([id, urls]) => {
        if (!known(id)) {
          this.warnOnce(id, `files found for an unknown sound ID (${urls.join(', ')})`);
          return;
        }
        const bufs = await this.loadId(id, urls);
        if (gen !== this.generation) return;
        if (bufs.length) this.buffers.set(id, bufs);
      }),
    );
  }

  private async loadId(id: string, urls: readonly string[]): Promise<AudioBuffer[]> {
    if (!this.decode) return [];
    // One variation per stem: .ogg first, falling back to a .wav of the same stem.
    const stems = new Map<string, string[]>();
    for (const u of urls) {
      const k = stemOf(u);
      const list = stems.get(k) ?? [];
      list.push(u);
      stems.set(k, list);
    }
    const out: AudioBuffer[] = [];
    for (const [, candidates] of stems) {
      let buf: AudioBuffer | null = null;
      for (const url of candidates) {
        try {
          const full = /^(https?:)?\//.test(url) ? url : this.base + url;
          const res = await fetch(full);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          buf = await this.decode(await res.arrayBuffer());
          break;
        } catch (e) {
          this.warnOnce(id, `could not load ${url} (${(e as Error)?.message ?? e}); falling back`);
        }
      }
      if (buf) out.push(buf);
    }
    return out;
  }
}
