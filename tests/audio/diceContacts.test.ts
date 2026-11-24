// Audio Phase 0 §4 / fix §8.3: dice contacts record what was hit and how hard.
import { describe, expect, it } from 'vitest';
import { simulateThrow } from '../../src/render/diceSim';
import { Rng } from '../../src/engine/rng';

describe('dice contacts', () => {
  const throws = Array.from({ length: 24 }, (_, i) => simulateThrow([3, 4], new Rng(100 + i), { sideYaw: (i % 4) * (Math.PI / 2), floorY: 0 }));
  const contacts = throws.flatMap((t) => t.contacts);

  it('each contact has a kind and an intensity in [0, 1], in step order', () => {
    expect(contacts.length).toBeGreaterThan(24);
    for (const c of contacts) {
      expect(['wood', 'die']).toContain(c.kind);
      expect(c.intensity).toBeGreaterThanOrEqual(0);
      expect(c.intensity).toBeLessThanOrEqual(1);
    }
    for (const t of throws) for (let i = 1; i < t.contacts.length; i++) expect(t.contacts[i].step).toBeGreaterThanOrEqual(t.contacts[i - 1].step);
  });

  it('die-on-die hits are told apart from board hits', () => {
    expect(contacts.some((c) => c.kind === 'die')).toBe(true);
    expect(contacts.filter((c) => c.kind === 'wood').length).toBeGreaterThan(contacts.filter((c) => c.kind === 'die').length);
  });

  it('first impacts are hard, late ones soft (the level follows impact speed)', () => {
    const firsts = throws.map((t) => t.contacts.find((c) => c.kind === 'wood')!.intensity);
    const lasts = throws.map((t) => t.contacts.filter((c) => c.kind === 'wood').at(-1)!.intensity);
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(firsts)).toBeGreaterThan(mean(lasts));
  });

  it('the same cosmetic seed gives the same contacts (deterministic)', () => {
    const a = simulateThrow([2, 5], new Rng(9), { sideYaw: 0, floorY: 0 });
    const b = simulateThrow([2, 5], new Rng(9), { sideYaw: 0, floorY: 0 });
    expect(a.contacts).toEqual(b.contacts);
  });
});
