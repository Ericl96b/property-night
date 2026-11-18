import { describe, expect, it } from 'vitest';
import { Throttle, coinCount, mixGains } from '../src/audio/sound';

describe('sound mixing (SPEC §9, §13)', () => {
  it('master scales both buses; zero mutes; values are clamped', () => {
    const full = mixGains({ volumeMaster: 1, volumeMusic: 1, volumeEffects: 1 });
    expect(full.effects).toBe(1);
    expect(full.music).toBeGreaterThan(0);
    expect(full.music).toBeLessThan(full.effects); // music sits under the effects
    expect(mixGains({ volumeMaster: 0, volumeMusic: 1, volumeEffects: 1 })).toEqual({ music: 0, effects: 0 });
    expect(mixGains({ volumeMaster: 1, volumeMusic: 0, volumeEffects: 0.5 }).music).toBe(0);
    const half = mixGains({ volumeMaster: 0.5, volumeMusic: 1, volumeEffects: 1 });
    expect(half.effects).toBeCloseTo(0.25);
    expect(mixGains({ volumeMaster: 3, volumeMusic: -1, volumeEffects: NaN })).toEqual({ music: 0, effects: 0 });
  });

  it('bigger payments clink more coins (1–6)', () => {
    expect(coinCount(0)).toBe(0);
    expect(coinCount(10)).toBe(1);
    expect(coinCount(50)).toBe(2);
    expect(coinCount(200)).toBe(4);
    expect(coinCount(100_000)).toBe(6);
  });

  it('throttles rapid taps', () => {
    const t = new Throttle(0.05);
    expect(t.ok(0)).toBe(true);
    expect(t.ok(0.02)).toBe(false);
    expect(t.ok(0.06)).toBe(true);
  });
});
