import { describe, expect, it } from 'vitest';
import { apply, legalActions, newGame } from '../../src/engine';
import { act, edit, game, own, run, withDice } from './helpers';

describe('setup', () => {
  it('starts everyone with the starting cash on GO, seat 0 to roll', () => {
    const s = game(4);
    expect(s.players.map((p) => p.cash)).toEqual([1500, 1500, 1500, 1500]);
    expect(s.players.every((p) => p.position === 0)).toBe(true);
    expect(s.phase).toBe('preRoll');
    expect(legalActions(s, 0).map((a) => a.type)).toContain('roll');
    expect(legalActions(s, 1).some((a) => a.type === 'roll')).toBe(false);
    expect(s.seats.map((x) => x.boardSide)).toEqual([0, 1, 2, 3]);
    expect(game(2).seats.map((x) => x.boardSide)).toEqual([0, 2]);
  });

  it('random turn order is seeded and reproducible', () => {
    const cfg = { seats: ['A', 'B', 'C', 'D'].map((n) => ({ kind: 'human' as const, name: n })), seed: 77 };
    expect(newGame(cfg).seats.map((x) => x.name)).toEqual(newGame(cfg).seats.map((x) => x.name));
  });

  it('starting cash is a setting', () => {
    expect(game(2, { rules: { startingCash: 2500 } }).players[0].cash).toBe(2500);
  });
});

describe('rolling and moving', () => {
  it('moves by the dice and ends in postRoll', () => {
    const { s, ev } = act(withDice(game(), 2, 3), { type: 'roll', seat: 0 });
    expect(s.players[0].position).toBe(5);
    expect(ev.find((e) => e.type === 'diceRolled')).toMatchObject({ dice: [2, 3], doubles: false });
    expect(s.phase).toBe('buy'); // North Line is unowned
  });

  it('pays the GO salary when passing GO', () => {
    const s0 = edit(withDice(game(), 3, 4), (d) => (d.players[0].position = 36));
    const { s } = act(s0, { type: 'roll', seat: 0 });
    expect(s.players[0].position).toBe(3);
    expect(s.players[0].cash).toBe(1700);
  });

  it('landing exactly on GO pays the normal salary (Classic) or double when set', () => {
    const base = (rules = {}) => edit(withDice(game(2, { rules }), 1, 3), (d) => (d.players[0].position = 36));
    expect(act(base(), { type: 'roll', seat: 0 }).s.players[0].cash).toBe(1700);
    expect(act(base({ landOnGo: 'double' }), { type: 'roll', seat: 0 }).s.players[0].cash).toBe(1900);
  });

  it('doubles grant another roll; the setting turns that off', () => {
    const s0 = edit(withDice(game(), 2, 2), (d) => own(d, 1, 4));
    const r = act(edit(s0, (d) => own(d, 1, 4)), { type: 'roll', seat: 0 });
    // Tile 4 is Income Tax: paid automatically, then the extra roll.
    expect(r.s.phase).toBe('preRoll');
    expect(r.s.turn.seat).toBe(0);
    const off = act(edit(withDice(game(2, { rules: { doublesExtraRoll: false } }), 2, 2), () => {}), { type: 'roll', seat: 0 });
    expect(off.s.phase).toBe('postRoll');
  });

  it('three doubles in a row send you to jail (setting)', () => {
    // 1+1 → Community Chest… avoid cards: use 3+3 (6 Lilac), 4+4 (14), 5+5 (24)
    let s = edit(withDice(game(), 3, 3, 4, 4, 5, 5), (d) => own(d, 1, 6, 14));
    s = act(s, { type: 'roll', seat: 0 }).s; // → 6 (owned by P1, rent paid)
    s = act(s, { type: 'roll', seat: 0 }).s; // → 14
    const r = act(s, { type: 'roll', seat: 0 });
    expect(r.s.players[0].position).toBe(10);
    expect(r.s.players[0].jail).not.toBeNull();
    expect(r.ev.some((e) => e.type === 'jailed' && e.reason === 'doubles')).toBe(true);
    expect(r.s.phase).toBe('postRoll');

    let t = edit(withDice(game(2, { rules: { threeDoublesJail: false } }), 3, 3, 4, 4, 5, 5), (d) => own(d, 1, 6, 14));
    t = run(t, { type: 'roll', seat: 0 }, { type: 'roll', seat: 0 }, { type: 'roll', seat: 0 }).s;
    expect(t.players[0].jail).toBeNull();
    expect(t.players[0].position).toBe(24);
  });

  it('end turn passes to the next seat', () => {
    const s0 = edit(withDice(game(3), 1, 3), (d) => own(d, 2, 4));
    const { s } = run(s0, { type: 'roll', seat: 0 }, { type: 'endTurn', seat: 0 });
    expect(s.turn.seat).toBe(1);
    expect(s.phase).toBe('preRoll');
    expect(s.turnNumber).toBe(2);
  });

  it('rejects out-of-turn and out-of-phase actions without changing state', () => {
    const s = game();
    expect(() => apply(s, { type: 'roll', seat: 1 })).toThrow(/not your turn/);
    expect(() => apply(s, { type: 'endTurn', seat: 0 })).toThrow();
    expect(() => apply(s, { type: 'buy', seat: 0 })).toThrow();
  });

  it('apply is pure: the input state is never mutated', () => {
    const s = withDice(game(), 2, 3);
    const before = JSON.stringify(s);
    apply(s, { type: 'roll', seat: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('taxes and Free Parking', () => {
  it('Income Tax is $200 flat by default; percent and lower-of modes use net worth', () => {
    const at4 = (rules = {}) => act(withDice(game(2, { rules }), 1, 3), { type: 'roll', seat: 0 }).s.players[0].cash;
    expect(at4()).toBe(1300);
    expect(at4({ incomeTaxMode: 'percent', incomeTaxPercent: 10 })).toBe(1350);
    expect(at4({ incomeTaxMode: 'lower' })).toBe(1350);
  });

  it('Luxury Tax amount is a setting', () => {
    const s0 = (rules = {}) => edit(withDice(game(2, { rules }), 1, 2), (d) => (d.players[0].position = 35));
    expect(act(s0(), { type: 'roll', seat: 0 }).s.players[0].cash).toBe(1400);
    expect(act(s0({ luxuryTax: 75 }), { type: 'roll', seat: 0 }).s.players[0].cash).toBe(1425);
  });

  it('Free Parking does nothing by default; the pot rule collects taxes and pays out', () => {
    const toFp = (rules = {}) => edit(withDice(game(2, { rules }), 1, 3, 6, 4), (d) => (d.players[1].position = 10));
    // P0 pays income tax, then P1 lands on Free Parking.
    const plain = run(toFp(), { type: 'roll', seat: 0 }, { type: 'endTurn', seat: 0 }, { type: 'roll', seat: 1 }).s;
    expect(plain.players[1].cash).toBe(1500);
    const pot = run(toFp({ freeParking: 'pot' }), { type: 'roll', seat: 0 }, { type: 'endTurn', seat: 0 }, { type: 'roll', seat: 1 }).s;
    expect(pot.players[1].cash).toBe(1700);
    expect(pot.freeParkingPot).toBe(0);
    const fixed = run(toFp({ freeParking: 'fixed', freeParkingBonus: 300 }), { type: 'roll', seat: 0 }, { type: 'endTurn', seat: 0 }, { type: 'roll', seat: 1 }).s;
    expect(fixed.players[1].cash).toBe(1800);
  });
});
