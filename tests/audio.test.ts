import { describe, expect, it } from 'vitest';
import { coinCount, mixGains } from '../src/audio/sound';

const vol = (volumeMaster: number, volumeMusic: number, volumeEffects: number, volumeUi = 1) => ({ volumeMaster, volumeMusic, volumeEffects, volumeUi });

describe('sound mixing (SPEC §9, §13)', () => {
  it('master scales every bus; zero mutes; values are clamped', () => {
    const full = mixGains(vol(1, 1, 1));
    expect(full.effects).toBe(1);
    expect(full.ui).toBe(1);
    expect(full.music).toBeGreaterThan(0);
    expect(full.music).toBeLessThan(full.effects); // music sits under the effects
    expect(mixGains(vol(0, 1, 1))).toEqual({ music: 0, effects: 0, ui: 0 });
    expect(mixGains(vol(1, 0, 0.5)).music).toBe(0);
    const half = mixGains(vol(0.5, 1, 1));
    expect(half.effects).toBeCloseTo(0.25);
    expect(half.ui).toBeCloseTo(0.25);
    expect(mixGains({ volumeMaster: 3, volumeMusic: -1, volumeEffects: NaN, volumeUi: NaN })).toEqual({ music: 0, effects: 0, ui: 0 });
  });

  it('the UI bus has its own level (audio Phase 0 §5)', () => {
    expect(mixGains(vol(1, 1, 1, 0)).ui).toBe(0);
    expect(mixGains(vol(1, 1, 1, 0)).effects).toBe(1);
    expect(mixGains(vol(1, 1, 0, 0.5)).ui).toBeCloseTo(0.25);
    expect(mixGains(vol(0.5, 1, 1, 0.5)).ui).toBeCloseTo(0.0625);
  });

  it('bigger payments clink more coins (1–6)', () => {
    expect(coinCount(0)).toBe(0);
    expect(coinCount(10)).toBe(1);
    expect(coinCount(50)).toBe(2);
    expect(coinCount(200)).toBe(4);
    expect(coinCount(100_000)).toBe(6);
  });
});
