// Batch 2 (owner requests, 2026-11-18): camera side follows the token, slower speed presets,
// deck stacks inside the dice arena.
import { describe, expect, it } from 'vitest';
import { SPEED_FACTOR, SPEED_LABEL } from '../src/director/queue';
import { DECK_STACK, IN_JAIL, deckFrames, sideOfTile, tileFrame } from '../src/render/layout';
import { breakdown } from '../src/ui/money';

describe('camera side of a tile', () => {
  it('maps 0–9 bottom, 10–19 left, 20–29 top, 30–39 right (jail counts as left)', () => {
    expect([0, 1, 9].map(sideOfTile)).toEqual([0, 0, 0]);
    expect([10, 11, 19].map(sideOfTile)).toEqual([1, 1, 1]);
    expect([20, 25, 29].map(sideOfTile)).toEqual([2, 2, 2]);
    expect([30, 39].map(sideOfTile)).toEqual([3, 3]);
    expect(sideOfTile(IN_JAIL)).toBe(1);
    for (let t = 0; t < 40; t++) expect(sideOfTile(t)).toBe(tileFrame(t).side);
  });
});

describe('speed presets', () => {
  it('Relaxed < Normal (old Slow) < Fast (old Normal) < Instant', () => {
    expect(SPEED_FACTOR.slow).toBeLessThan(SPEED_FACTOR.normal);
    expect(SPEED_FACTOR.normal).toBe(0.6);
    expect(SPEED_FACTOR.fast).toBe(1);
    expect(SPEED_FACTOR.instant).toBe(Infinity);
    expect(SPEED_LABEL.slow).toBe('Relaxed');
  });
});

describe('every payment shows bills', () => {
  it('a $2 rent is two $1 bills', () => {
    expect(breakdown(2)).toEqual({ notes: [1, 1], rest: 0 });
  });
});

describe('card stacks', () => {
  it('lie on the printed outlines, inside the center area, clear of the board middle', () => {
    for (const f of deckFrames()) {
      expect(Math.abs(f.x)).toBeLessThan(0.368 - DECK_STACK.d / 2);
      expect(Math.abs(f.z)).toBeLessThan(0.368 - DECK_STACK.d / 2);
      expect(Math.hypot(f.x, f.z)).toBeGreaterThan(0.25);
    }
  });
});
