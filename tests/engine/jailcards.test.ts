import { describe, expect, it } from 'vitest';
import { apply, checkInvariants, legalActions } from '../../src/engine';
import { act, edit, game, own, run, topCard, withDice } from './helpers';

const jailed = (rules = {}, ...dice: number[]) =>
  edit(withDice(game(2, { rules }), ...dice), (d) => {
    d.players[0].position = 10;
    d.players[0].jail = { attempts: 0 };
  });

describe('jail', () => {
  it('Go to Jail sends you to jail without passing GO and ends the turn', () => {
    const s0 = edit(withDice(game(), 3, 4), (d) => (d.players[0].position = 23));
    const r = act(s0, { type: 'roll', seat: 0 });
    expect(r.s.players[0]).toMatchObject({ position: 10, jail: { attempts: 0 }, cash: 1500 });
    expect(r.s.phase).toBe('postRoll');
  });

  it('pay the fine before rolling (fine is a setting)', () => {
    const s = act(jailed({ jailFine: 75 }, 1, 2), { type: 'payJailFine', seat: 0 }).s;
    expect(s.players[0].jail).toBeNull();
    expect(s.players[0].cash).toBe(1425);
    expect(s.phase).toBe('preRoll');
    expect(act(s, { type: 'roll', seat: 0 }).s.players[0].position).toBe(13);
  });

  it('use a Get Out of Jail Free card; it returns to the bottom of its deck', () => {
    const s0 = edit(jailed({}, 1, 2), (d) => {
      const idx = d.decks.chance.findIndex((c) => c.effect.kind === 'getOutOfJail');
      d.deckOrder.chance = d.deckOrder.chance.filter((i) => i !== idx);
      d.players[0].gojf = ['chance'];
    });
    expect(checkInvariants(s0)).toEqual([]);
    const s = act(s0, { type: 'useJailCard', seat: 0 }).s;
    expect(s.players[0].jail).toBeNull();
    expect(s.players[0].gojf).toEqual([]);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('doubles release you but give no extra roll', () => {
    const r = act(jailed({}, 3, 3), { type: 'roll', seat: 0 });
    expect(r.s.players[0].jail).toBeNull();
    expect(r.s.players[0].position).toBe(16);
    expect(['buy', 'postRoll']).toContain(r.s.phase);
    expect(r.s.turn.extraRoll).toBe(false);
  });

  it('doubles do not release when the setting is off', () => {
    const r = act(jailed({ doublesRelease: false }, 3, 3), { type: 'roll', seat: 0 });
    expect(r.s.players[0].jail).toMatchObject({ attempts: 1 });
    expect(r.s.players[0].position).toBe(10);
  });

  it('after the last failed attempt you pay the fine and move (max turns is a setting)', () => {
    const s0 = edit(jailed({}, 1, 2), (d) => (d.players[0].jail = { attempts: 2 }));
    const r = act(s0, { type: 'roll', seat: 0 });
    expect(r.s.players[0].jail).toBeNull();
    expect(r.s.players[0].position).toBe(13);
    expect(r.s.players[0].cash).toBe(1450);
    const one = act(jailed({ maxJailTurns: 1 }, 1, 2), { type: 'roll', seat: 0 }).s;
    expect(one.players[0].jail).toBeNull();
  });

  it('a failed attempt keeps you in jail and ends the turn', () => {
    const r = act(jailed({}, 1, 2), { type: 'roll', seat: 0 });
    expect(r.s.players[0].jail).toMatchObject({ attempts: 1 });
    expect(r.s.phase).toBe('postRoll');
    expect(legalActions(r.s, 0).map((a) => a.type)).toContain('endTurn');
  });
});

describe('cards', () => {
  // Land on Chance at 7 from 4 (roll 1+2), on Community Chest at 2 from 39 (roll 1+2).
  const chance = (text: RegExp, setup: (d: ReturnType<typeof game>) => void = () => {}, ...extra: number[]) =>
    act(
      edit(withDice(game(3), 1, 2, ...extra), (d) => {
        d.players[0].position = 4;
        topCard(d, 'chance', text);
        setup(d);
      }),
      { type: 'roll', seat: 0 },
    );
  const chest = (text: RegExp, setup: (d: ReturnType<typeof game>) => void = () => {}) =>
    act(
      edit(withDice(game(3), 1, 2), (d) => {
        d.players[0].position = 39;
        topCard(d, 'chest', text);
        setup(d);
      }),
      { type: 'roll', seat: 0 },
    );

  it('collect and pay', () => {
    expect(chance(/savings account/).s.players[0].cash).toBe(1550);
    expect(chance(/Parking ticket/).s.players[0].cash).toBe(1485);
  });

  it('advance to a tile collects GO only when passing it', () => {
    const go = chance(/express to GO/);
    expect(go.s.players[0].position).toBe(0);
    expect(go.s.players[0].cash).toBe(1700);
    const rose = chance(/Rose Court/);
    expect(rose.s.players[0].position).toBe(11);
    expect(rose.s.players[0].cash).toBe(1500);
    expect(rose.s.phase).toBe('buy');
    const north = chance(/North Line/);
    expect(north.s.players[0].position).toBe(5);
    expect(north.s.players[0].cash).toBe(1700); // 7 → 5 wraps past GO
  });

  it('nearest railroad pays double rent', () => {
    const r = chance(/nearest train/, (d) => own(d, 1, 15));
    expect(r.s.players[0].position).toBe(15);
    expect(r.s.players[1].cash).toBe(1550);
  });

  it('nearest utility pays 10× a fresh roll', () => {
    const r = chance(/nearest utility/, (d) => own(d, 1, 12), 4, 5);
    expect(r.s.players[0].position).toBe(12);
    expect(r.s.players[1].cash).toBe(1590);
  });

  it('go back three spaces lands and resolves', () => {
    const r = chance(/Go back three/);
    expect(r.s.players[0].position).toBe(4);
    expect(r.s.players[0].cash).toBe(1300); // Income Tax
  });

  it('go to jail card', () => {
    expect(chance(/Caught red-handed/).s.players[0]).toMatchObject({ position: 10, jail: { attempts: 0 } });
  });

  it('get out of jail free is held and removed from the deck', () => {
    const r = chance(/pardon/);
    expect(r.s.players[0].gojf).toEqual(['chance']);
    expect(r.s.deckOrder.chance).toHaveLength(15);
    expect(checkInvariants(r.s)).toEqual([]);
  });

  it('repairs: per house and per hotel', () => {
    const r = chance(/Upkeep/, (d) => {
      own(d, 0, 6, 8, 9);
      d.tiles[6].buildings = 2;
      d.tiles[8].buildings = 2;
      d.tiles[9].buildings = 2;
      d.bank.houses = 26;
    });
    expect(r.s.players[0].cash).toBe(1500 - 6 * 25);
  });

  it('pay each player and collect from each player', () => {
    const pay = chance(/chaired/);
    expect(pay.s.players.map((p) => p.cash)).toEqual([1400, 1550, 1550]);
    const bday = chest(/birthday/);
    expect(bday.s.players.map((p) => p.cash)).toEqual([1720, 1490, 1490]); // includes GO salary
  });

  it('drawn cards go to the bottom of the deck', () => {
    const r = chance(/savings account/);
    const idx = r.s.decks.chance.findIndex((c) => /savings/.test(c.text));
    expect(r.s.deckOrder.chance.at(-1)).toBe(idx);
  });

  it('every default deck has 16 cards with original wording', () => {
    const s = game();
    expect(s.decks.chance).toHaveLength(16);
    expect(s.decks.chest).toHaveLength(16);
    for (const c of [...s.decks.chance, ...s.decks.chest]) {
      expect(c.text).not.toMatch(/Boardwalk|Illinois|St\. Charles|Reading|Monopoly/i);
    }
  });

  it('a collect-from-each debt can put another player into raise-money', () => {
    const r = chest(/birthday/, (d) => {
      d.players[1].cash = 5;
      own(d, 1, 39);
    });
    expect(r.s.phase).toBe('debt');
    expect(r.s.debts[0].from).toBe(1);
    expect(legalActions(r.s, 1).map((a) => a.type)).toContain('mortgage');
    const done = run(r.s, { type: 'mortgage', seat: 1, tile: 39 }).s;
    expect(done.players[0].cash).toBe(1720);
    expect(() => apply(r.s, { type: 'endTurn', seat: 0 })).toThrow();
  });
});
