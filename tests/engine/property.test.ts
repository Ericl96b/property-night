import { describe, expect, it } from 'vitest';
import { apply, legalActions, liquidationValue, unmortgageCost } from '../../src/engine';
import { act, edit, game, own, run, withDice } from './helpers';

// Tile ids used below: 1 Hazel (brown $60), 3 Briar (brown $60), 5 North Line, 6/8/9 light blue,
// 12 Power Works, 15 East Line, 25 South Line, 28 Water Works, 37/39 dark blue.

describe('buying', () => {
  it('buy takes the money and the deed', () => {
    const { s, ev } = run(withDice(game(), 1, 2), { type: 'roll', seat: 0 }, { type: 'buy', seat: 0 });
    expect(s.tiles[3].owner).toBe(0);
    expect(s.players[0].cash).toBe(1440);
    expect(ev.some((e) => e.type === 'bought')).toBe(true);
    expect(s.phase).toBe('postRoll');
  });

  it('cannot buy without the cash', () => {
    const s = edit(withDice(game(), 1, 2), (d) => (d.players[0].cash = 10));
    const r = act(s, { type: 'roll', seat: 0 });
    expect(legalActions(r.s, 0).some((a) => a.type === 'buy')).toBe(false);
    expect(() => apply(r.s, { type: 'buy', seat: 0 })).toThrow(/cash/);
  });

  it('declined property goes to auction (Classic) or stays unowned (setting)', () => {
    const a = run(withDice(game(), 1, 2), { type: 'roll', seat: 0 }, { type: 'decline', seat: 0 }).s;
    expect(a.phase).toBe('auction');
    expect(a.auction).toMatchObject({ tile: 3, highBid: 0, minBid: 1 });
    const u = run(withDice(game(2, { rules: { declinedProperty: 'unowned' } }), 1, 2), { type: 'roll', seat: 0 }, { type: 'decline', seat: 0 }).s;
    expect(u.phase).toBe('postRoll');
    expect(u.tiles[3].owner).toBeNull();
  });

  it('auction-only mode auctions every unowned property landed on', () => {
    const s = act(withDice(game(2, { rules: { auctionOnly: true } }), 1, 2), { type: 'roll', seat: 0 }).s;
    expect(s.phase).toBe('auction');
  });
});

describe('auctions', () => {
  const auction = (rules = {}) => run(withDice(game(3, { rules }), 1, 2), { type: 'roll', seat: 0 }, { type: 'decline', seat: 0 }).s;

  it('everyone may bid, including the decliner; ends when all others pass', () => {
    const s0 = auction();
    expect(s0.auction!.active).toEqual([0, 1, 2]);
    const { s } = run(s0, { type: 'bid', seat: 1, amount: 10 }, { type: 'bid', seat: 2, amount: 20 }, { type: 'pass', seat: 0 }, { type: 'pass', seat: 1 });
    expect(s.tiles[3].owner).toBe(2);
    expect(s.players[2].cash).toBe(1480);
    expect(s.players[2].stats.auctionBuys).toBe(1);
    expect(s.phase).toBe('postRoll');
  });

  it('bids must beat the high bid and are capped at cash', () => {
    const s0 = edit(auction(), (d) => (d.players[1].cash = 30));
    const s1 = act(s0, { type: 'bid', seat: 2, amount: 20 }).s;
    expect(() => apply(s1, { type: 'bid', seat: 1, amount: 20 })).toThrow(/at least/);
    expect(() => apply(s1, { type: 'bid', seat: 1, amount: 31 })).toThrow(/capped/);
    expect(legalActions(s1, 1).filter((a) => a.type === 'bid').map((a) => (a as { amount: number }).amount)).toEqual([21, 30]);
    expect(() => apply(s1, { type: 'pass', seat: 2 })).toThrow(/high bidder/);
  });

  it('timer timeout sells to the high bidder; no bids leaves it unowned', () => {
    const sold = run(auction(), { type: 'bid', seat: 1, amount: 5 }, { type: 'auctionTimeout', seat: -1 }).s;
    expect(sold.tiles[3].owner).toBe(1);
    const none = run(auction(), { type: 'pass', seat: 0 }, { type: 'pass', seat: 1 }, { type: 'pass', seat: 2 }).s;
    expect(none.tiles[3].owner).toBeNull();
    expect(none.phase).toBe('postRoll');
  });

  it('start bid follows the setting', () => {
    expect(auction({ auctionStart: 'pct50' }).auction!.minBid).toBe(30);
    expect(auction({ auctionStart: 'pct10' }).auction!.minBid).toBe(6);
  });
});

describe('rent', () => {
  const landOn = (tile: number, setup: Parameters<typeof edit>[1], dice: [number, number] = [1, 1], rules = {}) => {
    const from = (tile - dice[0] - dice[1] + 40) % 40;
    const s = edit(withDice(game(2, { rules }), ...dice), (d) => {
      d.players[0].position = from;
      setup(d);
    });
    return act(s, { type: 'roll', seat: 0 });
  };

  it('base rent, doubled for an unimproved full set (multiplier is a setting)', () => {
    expect(landOn(3, (d) => own(d, 1, 3), [1, 2]).s.players[1].cash).toBe(1504);
    expect(landOn(3, (d) => own(d, 1, 1, 3), [1, 2]).s.players[1].cash).toBe(1508);
    expect(landOn(3, (d) => own(d, 1, 1, 3), [1, 2], { unimprovedSetMultiplier: 1 }).s.players[1].cash).toBe(1504);
  });

  it('rent with houses and a hotel', () => {
    const r = landOn(39, (d) => {
      own(d, 1, 37, 39);
      d.tiles[37].buildings = 5;
      d.tiles[39].buildings = 5;
      d.bank.hotels -= 2;
      d.players[0].cash = 5000;
    }, [2, 3]);
    expect(r.s.players[1].cash).toBe(3500);
    expect(r.ev.find((e) => e.type === 'payment')).toMatchObject({ amount: 2000, tile: 39 });
  });

  it('no rent on a mortgaged property', () => {
    expect(landOn(3, (d) => { own(d, 1, 3); d.tiles[3].mortgaged = true; }, [1, 2]).s.players[1].cash).toBe(1500);
  });

  it('railroads: 25/50/100/200 by the number owned', () => {
    expect(landOn(5, (d) => own(d, 1, 5), [2, 3]).s.players[1].cash).toBe(1525);
    expect(landOn(5, (d) => own(d, 1, 5, 15, 25, 35), [2, 3]).s.players[1].cash).toBe(1700);
  });

  it('utilities: 4× dice with one, 10× with both', () => {
    expect(landOn(12, (d) => own(d, 1, 12), [3, 4]).s.players[1].cash).toBe(1528);
    expect(landOn(12, (d) => own(d, 1, 12, 28), [3, 4]).s.players[1].cash).toBe(1570);
  });

  it('owner in jail still collects (Classic); the setting turns it off', () => {
    const jailed = (d: Parameters<Parameters<typeof edit>[1]>[0]) => {
      own(d, 1, 3);
      d.players[1].position = 10;
      d.players[1].jail = { attempts: 0 };
    };
    expect(landOn(3, jailed, [1, 2]).s.players[1].cash).toBe(1504);
    expect(landOn(3, jailed, [1, 2], { rentInJail: false }).s.players[1].cash).toBe(1500);
  });
});

describe('building', () => {
  const withSet = (rules = {}) => edit(game(2, { rules }), (d) => own(d, 0, 6, 8, 9));

  it('needs the full set, builds evenly, and draws houses from the bank', () => {
    const noSet = edit(game(), (d) => own(d, 0, 6, 8));
    expect(() => apply(noSet, { type: 'build', seat: 0, tile: 6 })).toThrow(/full color set/);
    let s = act(withSet(), { type: 'build', seat: 0, tile: 6 }).s;
    expect(s.tiles[6].buildings).toBe(1);
    expect(s.players[0].cash).toBe(1450);
    expect(s.bank.houses).toBe(31);
    expect(() => apply(s, { type: 'build', seat: 0, tile: 6 })).toThrow(/evenly/);
    s = run(s, { type: 'build', seat: 0, tile: 8 }, { type: 'build', seat: 0, tile: 9 }, { type: 'build', seat: 0, tile: 6 }).s;
    expect(s.tiles[6].buildings).toBe(2);
  });

  it('even building can be turned off', () => {
    const s = run(withSet({ evenBuilding: false }), { type: 'build', seat: 0, tile: 6 }, { type: 'build', seat: 0, tile: 6 }).s;
    expect(s.tiles[6].buildings).toBe(2);
  });

  it('a hotel replaces 4 houses, which go back to the bank', () => {
    const s0 = edit(withSet(), (d) => {
      for (const t of [6, 8, 9]) d.tiles[t].buildings = 4;
      d.bank.houses = 32 - 12;
    });
    const s = act(s0, { type: 'build', seat: 0, tile: 6 }).s;
    expect(s.tiles[6].buildings).toBe(5);
    expect(s.bank.houses).toBe(24);
    expect(s.bank.hotels).toBe(11);
  });

  it('cannot build with a mortgaged lot in the set (Classic) and respects the building supply', () => {
    const m = edit(withSet(), (d) => (d.tiles[9].mortgaged = true));
    expect(() => apply(m, { type: 'build', seat: 0, tile: 6 })).toThrow(/mortgaged/);
    const allowed = edit(withSet({ buildWithMortgagedInSet: true }), (d) => (d.tiles[9].mortgaged = true));
    expect(act(allowed, { type: 'build', seat: 0, tile: 6 }).s.tiles[6].buildings).toBe(1);
    const empty = edit(withSet(), (d) => (d.bank.houses = 0));
    expect(() => apply(empty, { type: 'build', seat: 0, tile: 6 })).toThrow(/no houses/);
  });

  it('sells evenly at the sell-back value; a hotel breaks into 4 houses', () => {
    const s0 = edit(withSet(), (d) => {
      d.tiles[6].buildings = 5;
      d.tiles[8].buildings = 4;
      d.tiles[9].buildings = 4;
      d.bank.houses = 24;
      d.bank.hotels = 11;
    });
    expect(() => apply(s0, { type: 'sell', seat: 0, tile: 8 })).toThrow(/evenly/);
    const s = act(s0, { type: 'sell', seat: 0, tile: 6 }).s;
    expect(s.tiles[6].buildings).toBe(4);
    expect(s.players[0].cash).toBe(1525);
    expect(s.bank.houses).toBe(20);
    const half = act(edit(s0, (d) => (d.rules = { ...d.rules, sellBackPercent: 100 })), { type: 'sell', seat: 0, tile: 6 }).s;
    expect(half.players[0].cash).toBe(1550);
  });

  it('during a house shortage, selling a hotel clears the set', () => {
    const s0 = edit(withSet(), (d) => {
      d.tiles[6].buildings = 5;
      d.tiles[8].buildings = 4;
      d.tiles[9].buildings = 4;
      d.bank.houses = 2;
      d.bank.hotels = 11;
    });
    const s = act(s0, { type: 'sell', seat: 0, tile: 6 }).s;
    expect([6, 8, 9].map((t) => s.tiles[t].buildings)).toEqual([0, 0, 0]);
    expect(s.bank.houses).toBe(10);
    expect(s.bank.hotels).toBe(12);
    expect(s.players[0].cash).toBe(1500 + 13 * 25);
  });
});

describe('mortgages', () => {
  it('mortgage pays half the price; lifting it costs +10%', () => {
    const s0 = edit(game(), (d) => own(d, 0, 39));
    const m = act(s0, { type: 'mortgage', seat: 0, tile: 39 }).s;
    expect(m.players[0].cash).toBe(1700);
    expect(unmortgageCost(m, 39)).toBe(220);
    const u = act(m, { type: 'unmortgage', seat: 0, tile: 39 }).s;
    expect(u.players[0].cash).toBe(1480);
    expect(u.tiles[39].mortgaged).toBe(false);
  });

  it('mortgage value and interest are settings', () => {
    const s0 = edit(game(2, { rules: { mortgagePercent: 40, unmortgageInterestPercent: 0 } }), (d) => own(d, 0, 39));
    const m = act(s0, { type: 'mortgage', seat: 0, tile: 39 }).s;
    expect(m.players[0].cash).toBe(1660);
    expect(unmortgageCost(m, 39)).toBe(160);
  });

  it('buildings in the set must be sold first', () => {
    const s0 = edit(game(), (d) => {
      own(d, 0, 1, 3);
      d.tiles[1].buildings = 1;
      d.bank.houses = 31;
    });
    expect(() => apply(s0, { type: 'mortgage', seat: 0, tile: 3 })).toThrow(/buildings/);
  });
});

describe('raise money', () => {
  it('a debt larger than cash blocks until money is raised, then settles automatically', () => {
    const s0 = edit(withDice(game(), 2, 3), (d) => {
      d.players[0].position = 34; // → 39
      own(d, 1, 37, 39);
      d.tiles[39].buildings = 1;
      d.tiles[37].buildings = 1;
      d.bank.houses = 30;
      d.players[0].cash = 100;
      own(d, 0, 5, 15);
    });
    const r = act(s0, { type: 'roll', seat: 0 });
    expect(r.s.phase).toBe('debt');
    expect(r.s.debts[0]).toMatchObject({ from: 0, to: 1, amount: 200 });
    expect(r.ev.some((e) => e.type === 'debtPending')).toBe(true);
    expect(legalActions(r.s, 0).some((a) => a.type === 'declareBankruptcy')).toBe(false);
    expect(() => apply(r.s, { type: 'declareBankruptcy', seat: 0 })).toThrow(/still raise/);
    const s = act(r.s, { type: 'mortgage', seat: 0, tile: 5 }).s;
    expect(s.phase).toBe('postRoll');
    expect(s.players[0].cash).toBe(0);
    expect(s.players[1].cash).toBe(1700);
    expect(liquidationValue(s, 0)).toBe(100);
  });
});
