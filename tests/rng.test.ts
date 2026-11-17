// SPEC §11 fairness: 1,000,000 engine rolls pass a chi-square test for uniform 1–6,
// and the two dice are independent.
import { describe, expect, it } from 'vitest';
import { nextUint32, rollDie, seedRng } from '../src/engine/rng';

// Critical values at p = 0.001.
const CHI2_DF5 = 20.515;
const CHI2_DF25 = 52.62;

describe('engine RNG', () => {
  it('is deterministic and serializable', () => {
    const a = seedRng(42);
    const b = seedRng(42);
    const seqA = Array.from({ length: 50 }, () => rollDie(a));
    const copy = [...a] as typeof a;
    const seqB = Array.from({ length: 50 }, () => rollDie(b));
    expect(seqA).toEqual(seqB);
    // Resuming from a saved state reproduces the same continuation.
    expect(Array.from({ length: 20 }, () => nextUint32(a))).toEqual(Array.from({ length: 20 }, () => nextUint32(copy)));
  });

  for (const seed of [1, 2026, 987654321]) {
    it(`1,000,000 rolls are uniform over 1–6 (seed ${seed})`, () => {
      const st = seedRng(seed);
      const counts = [0, 0, 0, 0, 0, 0];
      const N = 1_000_000;
      for (let i = 0; i < N; i++) counts[rollDie(st) - 1]++;
      const e = N / 6;
      const chi2 = counts.reduce((s, c) => s + (c - e) ** 2 / e, 0);
      expect(chi2).toBeLessThan(CHI2_DF5);
    });
  }

  it('the two dice of a roll are independent (6×6 contingency)', () => {
    const st = seedRng(7);
    const N = 500_000; // pairs → 1,000,000 dice
    const table = Array.from({ length: 6 }, () => [0, 0, 0, 0, 0, 0]);
    for (let i = 0; i < N; i++) table[rollDie(st) - 1][rollDie(st) - 1]++;
    const rows = table.map((r) => r.reduce((x, y) => x + y, 0));
    const cols = [0, 1, 2, 3, 4, 5].map((j) => table.reduce((s, r) => s + r[j], 0));
    let chi2 = 0;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const e = (rows[i] * cols[j]) / N;
        chi2 += (table[i][j] - e) ** 2 / e;
      }
    }
    expect(chi2).toBeLessThan(CHI2_DF25);
  });
});
