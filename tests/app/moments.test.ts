import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, isBigPayment } from '../../src/app/settings';
import { breakdown } from '../../src/ui/money';
import { manageGroups, debtInfo, primaryButtons } from '../../src/ui/present';
import { legalActions } from '../../src/engine';
import { edit, game, own, act, withDice } from '../engine/helpers';

describe('big-payment moment thresholds (SPEC §10.9)', () => {
  it('triggers at $200 or 25% of the payer’s cash, both settings', () => {
    expect(isBigPayment(DEFAULT_SETTINGS, 200, 5000)).toBe(true);
    expect(isBigPayment(DEFAULT_SETTINGS, 199, 5000)).toBe(false);
    expect(isBigPayment(DEFAULT_SETTINGS, 50, 200)).toBe(true);
    expect(isBigPayment(DEFAULT_SETTINGS, 49, 200)).toBe(false);
    expect(isBigPayment({ ...DEFAULT_SETTINGS, bigPaymentAmount: 500 }, 400, 5000)).toBe(false);
    expect(isBigPayment({ ...DEFAULT_SETTINGS, bigPaymentPercent: 10 }, 40, 300)).toBe(true);
    expect(isBigPayment(DEFAULT_SETTINGS, 150, null)).toBe(false);
  });

  it('banknotes: largest first, at most 12, remainder as a chip', () => {
    expect(breakdown(2000)).toEqual({ notes: [500, 500, 500, 500], rest: 0 });
    expect(breakdown(276)).toEqual({ notes: [100, 100, 50, 20, 5, 1], rest: 0 });
    const big = breakdown(9999);
    expect(big.notes).toHaveLength(12);
    expect(big.notes.reduce((a, b) => a + b, 0) + big.rest).toBe(9999);
  });
});

describe('manage and raise-money presentation', () => {
  it('lists owned properties by set with blockers explained', () => {
    const s = edit(game(), (d) => {
      own(d, 0, 6, 8, 9, 5);
      d.tiles[6].buildings = 1;
      d.bank.houses = 31;
    });
    const groups = manageGroups(s, 0);
    const lb = groups.find((g) => g.key === 'lightBlue')!;
    expect(lb.full).toBe(true);
    const lilac = lb.rows.find((r) => r.tile === 6)!;
    expect(lilac.ops.find((o) => o.action.type === 'build')!.reason).toMatch(/evenly/);
    expect(lilac.ops.find((o) => o.action.type === 'mortgage')!.reason).toMatch(/buildings/);
    expect(lb.rows.find((r) => r.tile === 8)!.ops.find((o) => o.action.type === 'build')!.ok).toBe(true);
    expect(groups.find((g) => g.key === 'railroad')!.rows).toHaveLength(1);
  });

  it('debt info states the shortfall and whether it can be covered', () => {
    const s0 = edit(withDice(game(), 2, 3), (d) => {
      d.players[0].position = 34;
      own(d, 1, 37, 39);
      d.tiles[37].buildings = 5;
      d.tiles[39].buildings = 5;
      d.bank.hotels = 10;
      d.players[0].cash = 100;
    });
    const s = act(s0, { type: 'roll', seat: 0 }).s;
    expect(debtInfo(s)).toMatchObject({ debtor: 0, amount: 2000, to: 'P1', cash: 100, canCover: false });
    expect(primaryButtons(s, legalActions(s, 0)).map((b) => b.label)).toContain('Declare bankruptcy');
  });
});
