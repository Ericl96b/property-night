// Audio Phase 0 §10: variation choice, cooldowns, voice limits, fallback order, batching.
import { describe, expect, it, vi } from 'vitest';
import { pickVariation } from '../../src/audio/variation';
import { VoiceManager, type VoiceInfo } from '../../src/audio/voices';
import { BATCH_CAP, Batcher, selectBatch } from '../../src/audio/batch';
import { Sound } from '../../src/audio/sound';
import { AudioLoader } from '../../src/audio/loader';
import { PRIORITY } from '../../src/audio/registry';

function lcg(seed = 1) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('variations', () => {
  it('never repeats the same file twice in a row (n ≥ 2), and uses every file', () => {
    for (const n of [2, 3, 5]) {
      const rand = lcg(n);
      let last = -1;
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const k = pickVariation(n, last, rand);
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(n);
        expect(k).not.toBe(last);
        seen.add(k);
        last = k;
      }
      expect(seen.size).toBe(n);
    }
  });

  it('one file always plays; none plays nothing', () => {
    expect(pickVariation(1, 0, Math.random)).toBe(0);
    expect(pickVariation(0, -1, Math.random)).toBe(-1);
  });
});

const voice = (id: string, priority: number, startedAt: number, stop = () => {}): VoiceInfo => ({ id, priority, startedAt, endsAt: startedAt + 1000, stop });
const opts = (o: Partial<{ priority: number; cooldownMs: number; maxVoices: number }> = {}) => ({ priority: 10, cooldownMs: 0, maxVoices: 4, ...o });

describe('voice manager', () => {
  it('enforces the per-ID cooldown', () => {
    const vm = new VoiceManager();
    expect(vm.admit('a', opts({ cooldownMs: 30 }), 0).ok).toBe(true);
    expect(vm.admit('a', opts({ cooldownMs: 30 }), 20).ok).toBe(false);
    expect(vm.admit('b', opts({ cooldownMs: 30 }), 20).ok).toBe(true); // other IDs are independent
    expect(vm.admit('a', opts({ cooldownMs: 30 }), 31).ok).toBe(true);
  });

  it('maxVoices evicts the oldest voice of that ID', () => {
    const vm = new VoiceManager();
    for (let t = 0; t < 2; t++) {
      expect(vm.admit('a', opts({ maxVoices: 2 }), t).ok).toBe(true);
      vm.add(voice('a', 10, t));
    }
    const r = vm.admit('a', opts({ maxVoices: 2 }), 5);
    expect(r.ok).toBe(true);
    expect(r.evict.map((v) => v.startedAt)).toEqual([0]);
  });

  it('expired voices free their slots', () => {
    const vm = new VoiceManager(1);
    vm.admit('a', opts(), 0);
    vm.add(voice('a', 10, 0));
    expect(vm.admit('b', opts({ priority: 5 }), 500).ok).toBe(false);
    expect(vm.admit('b', opts({ priority: 5 }), 1001).ok).toBe(true);
  });

  it('global cap: a lower priority is dropped; otherwise the oldest lowest-priority voice goes', () => {
    const vm = new VoiceManager(3);
    vm.add(voice('x', 20, 0));
    vm.add(voice('y', 10, 1));
    vm.add(voice('z', 10, 2));
    expect(vm.admit('low', opts({ priority: 5 }), 3)).toEqual({ ok: false, evict: [] });
    const r = vm.admit('mid', opts({ priority: 10 }), 3);
    expect(r.ok).toBe(true);
    expect(r.evict.map((v) => v.id)).toEqual(['y']);
    expect(vm.active.length).toBe(2);
  });
});

describe('batching (audio Phase 0 §6)', () => {
  const run = (plays: { id: string; priority: number; amount?: number }[]) => {
    const out: { id: string; amount?: number }[] = [];
    const b = new Batcher<{ amount?: number }>((items) => out.push(...items.map((i) => ({ id: i.id, amount: i.ctx.amount }))));
    b.begin();
    for (const p of plays) b.add({ id: p.id, priority: p.priority, ctx: p.amount === undefined ? {} : { amount: p.amount } });
    expect(out).toEqual([]); // nothing plays while the batch is open
    b.end();
    return out;
  };

  it('plays each ID once; money keeps the largest amount', () => {
    const out = run([
      { id: 'money.rent', priority: PRIORITY.money, amount: 50 },
      { id: 'money.rent', priority: PRIORITY.money, amount: 300 },
      { id: 'money.rent', priority: PRIORITY.money, amount: 20 },
    ]);
    expect(out).toEqual([{ id: 'money.rent', amount: 300 }]);
  });

  it('caps the total and keeps priority order', () => {
    const out = run([
      { id: 'token.step', priority: PRIORITY.other },
      { id: 'card.chance.draw', priority: PRIORITY.card },
      { id: 'property.transfer', priority: PRIORITY.building },
      { id: 'money.purchase', priority: PRIORITY.money, amount: 60 },
      { id: 'banner.auctionWon', priority: PRIORITY.banner },
      { id: 'building.house', priority: PRIORITY.building },
    ]);
    expect(out.length).toBe(BATCH_CAP);
    expect(out.map((o) => o.id)).toEqual(['banner.auctionWon', 'money.purchase', 'property.transfer', 'building.house']);
  });

  it('nested batches flush once, at the outermost end', () => {
    const flushed = vi.fn();
    const b = new Batcher(flushed);
    b.begin();
    b.begin();
    b.add({ id: 'a', priority: 1, ctx: {} });
    b.end();
    expect(flushed).not.toHaveBeenCalled();
    b.end();
    expect(flushed).toHaveBeenCalledTimes(1);
    expect(b.add({ id: 'a', priority: 1, ctx: {} })).toBe(false); // closed: play now
  });

  it('selectBatch is stable within a priority', () => {
    const items = [1, 2, 3, 4, 5].map((n) => ({ n, priority: 1 }));
    expect(selectBatch(items, 3).map((i) => i.n)).toEqual([1, 2, 3]);
  });
});

describe('fallback order: file → synth → silent', () => {
  it('resolves by what is loaded', () => {
    const loader = new AudioLoader(null);
    const s = new Sound({}, { loader });
    expect(s.status('dice.bounce.wood')).toEqual({ kind: 'synth' });
    expect(s.status('ui.confirm')).toEqual({ kind: 'silent' });
    loader.set('dice.bounce.wood', [{ duration: 0.1 } as AudioBuffer, { duration: 0.1 } as AudioBuffer]);
    loader.set('ui.confirm', [{ duration: 0.1 } as AudioBuffer]);
    expect(s.status('dice.bounce.wood')).toEqual({ kind: 'file', count: 2 });
    expect(s.status('ui.confirm')).toEqual({ kind: 'file', count: 1 });
  });

  it('a failed file warns once per ID and falls back, never throws', async () => {
    const warn = vi.fn();
    const decode = vi.fn(async () => {
      throw new Error('bad data');
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(new ArrayBuffer(8)));
    try {
      const loader = new AudioLoader(decode, '/', warn);
      await loader.load({ 'dice.bounce.wood': ['audio/dice/dice_bounce_wood_01.ogg', 'audio/dice/dice_bounce_wood_02.ogg'] });
      expect(loader.get('dice.bounce.wood')).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      const s = new Sound({}, { loader });
      expect(s.status('dice.bounce.wood')).toEqual({ kind: 'synth' });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('an .ogg that fails falls back to the .wav of the same stem', async () => {
    const good = { duration: 0.2 } as AudioBuffer;
    const decode = vi.fn(async (d: ArrayBuffer) => {
      if (new Uint8Array(d)[0] === 1) throw new Error('no ogg');
      return good;
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) => new Response(new Uint8Array([String(u).endsWith('.ogg') ? 1 : 2])));
    try {
      const loader = new AudioLoader(decode, '/', () => {});
      await loader.load({ 'dice.bounce.wood': ['audio/dice/dice_bounce_wood_01.ogg', 'audio/dice/dice_bounce_wood_01.wav'] });
      expect(loader.get('dice.bounce.wood')).toEqual([good]);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('shareFilesWith: money.* borrow money.generic files until they have their own', () => {
    const loader = new AudioLoader(null);
    const s = new Sound({}, { loader });
    expect(s.status('money.rent')).toEqual({ kind: 'synth' });
    loader.set('money.generic', [{ duration: 0.1 } as AudioBuffer, { duration: 0.1 } as AudioBuffer]);
    expect(s.status('money.rent')).toEqual({ kind: 'file', count: 2 });
    expect(s.filePool('money.rent')).toBe('money.generic');
    loader.set('money.rent', [{ duration: 0.1 } as AudioBuffer]);
    expect(s.status('money.rent')).toEqual({ kind: 'file', count: 1 });
    expect(s.filePool('money.rent')).toBe('money.rent');
    expect(s.filePool('money.tax')).toBe('money.generic');
    expect(s.status('dice.bounce.wood')).toEqual({ kind: 'synth' }); // no share: unaffected
  });

  it('play() outside a browser is a silent no-op', () => {
    const s = new Sound();
    expect(() => s.play('money.rent', { amount: 100 })).not.toThrow();
    expect(s.stats.started).toBe(0);
  });
});
