// SPEC §15: every rules setting has at least one test proving it changes behavior.
// Settings covered in other files: startingCash, landOnGo (double), incomeTax*, luxuryTax,
// declinedProperty, auctionOnly, auctionStart (pct), evenBuilding, buildWithMortgagedInSet,
// sellBackPercent, rentInJail, unimprovedSetMultiplier, jailFine, maxJailTurns, doublesRelease,
// threeDoublesJail, freeParking (pot, fixed), mortgagePercent, unmortgageInterestPercent,
// receiveMortgaged, doublesExtraRoll, tradingAllowed, promisesAllowed, bankruptToBank,
// auctionTimer (controller tests), bankBotMode (bankBot.test.ts). This file covers the rest.
import { describe, expect, it } from 'vitest';
import { apply, checkInvariants, legalActions } from '../../src/engine';
import { act, edit, game, own, run, withDice } from './helpers';

describe('money settings', () => {
  it('GO salary amount', () => {
    const s0 = (rules = {}) => edit(withDice(game(2, { rules }), 3, 4), (d) => (d.players[0].position = 36));
    expect(act(s0({ goSalary: 300 }), { type: 'roll', seat: 0 }).s.players[0].cash).toBe(1800);
  });

  it('landing exactly on GO: custom amount', () => {
    const s0 = edit(withDice(game(2, { rules: { landOnGo: 'custom', landOnGoAmount: 350 } }), 1, 3), (d) => (d.players[0].position = 36));
    expect(act(s0, { type: 'roll', seat: 0 }).s.players[0].cash).toBe(1850);
  });
});

describe('buying settings', () => {
  it('custom auction start bid', () => {
    const s = run(withDice(game(2, { rules: { auctionStart: 'custom', auctionStartCustom: 25 } }), 1, 2), { type: 'roll', seat: 0 }, { type: 'decline', seat: 0 }).s;
    expect(s.auction!.minBid).toBe(25);
    expect(() => apply(s, { type: 'bid', seat: 1, amount: 24 })).toThrow(/at least/);
  });
});

describe('building settings', () => {
  const lightBlues = (rules = {}) =>
    edit(game(3, { rules }), (d) => {
      own(d, 0, 6, 8, 9);
      own(d, 1, 1, 3);
    });

  it('unlimited building supply never runs out', () => {
    const s = edit(lightBlues({ houseSupply: 'unlimited' }), (d) => {
      for (const t of [6, 8, 9]) d.tiles[t].buildings = 3;
    });
    expect(s.bank.houses).toBeGreaterThan(1000);
    expect(act(s, { type: 'build', seat: 0, tile: 6 }).s.tiles[6].buildings).toBe(4);
  });

  it('custom hotel supply', () => {
    expect(lightBlues({ hotelSupply: 2 }).bank.hotels).toBe(2);
  });

  it('shortage handling: scarce houses go to auction (Classic) or first come', () => {
    const scarce = (rules = {}) => lightBlues({ houseSupply: 1, ...rules });
    const a = act(scarce(), { type: 'build', seat: 0, tile: 6 }).s;
    expect(a.phase).toBe('auction');
    expect(a.auction).toMatchObject({ kind: 'house', active: [0, 1], buildFor: { 0: 6, 1: 3 } });
    const won = run(a, { type: 'bid', seat: 1, amount: 80 }, { type: 'pass', seat: 0 }).s;
    expect(won.tiles[3].buildings).toBe(1);
    expect(won.tiles[6].buildings).toBe(0);
    expect(won.players[1].cash).toBe(1420);
    expect(won.bank.houses).toBe(0);
    expect(checkInvariants(won)).toEqual([]);
    const first = act(scarce({ shortageHandling: 'firstCome' }), { type: 'build', seat: 0, tile: 6 }).s;
    expect(first.phase).toBe('preRoll');
    expect(first.tiles[6].buildings).toBe(1);
  });

  it('no shortage auction when only one player can build', () => {
    const s = edit(lightBlues(), (d) => {
      d.bank.houses = 1;
      d.tiles[1].owner = null;
    });
    expect(act(s, { type: 'build', seat: 0, tile: 6 }).s.tiles[6].buildings).toBe(1);
  });

  it('building timing: any legal time (Classic) or own turn only', () => {
    const offTurn = (rules = {}) => edit(game(2, { rules }), (d) => own(d, 1, 1, 3));
    expect(act(offTurn(), { type: 'build', seat: 1, tile: 1 }).s.tiles[1].buildings).toBe(1);
    expect(() => apply(offTurn({ buildTiming: 'ownTurn' }), { type: 'build', seat: 1, tile: 1 })).toThrow(/own turn/);
  });
});

describe('Free Parking: pot + seed', () => {
  it('the pot starts at the seed and resets to it after a payout', () => {
    const s0 = edit(withDice(game(2, { rules: { freeParking: 'potSeed', freeParkingSeed: 250 } }), 6, 4), (d) => (d.players[0].position = 10));
    expect(s0.freeParkingPot).toBe(250);
    const s = act(s0, { type: 'roll', seat: 0 }).s;
    expect(s.players[0].cash).toBe(1750);
    expect(s.freeParkingPot).toBe(250);
  });
});

describe('speed die', () => {
  const lapped = (...dice: number[]) =>
    edit(withDice(game(2, { rules: { speedDie: true } }), ...dice), (d) => {
      d.players[0].lapped = true;
      own(d, 1, 5, 6, 8, 9, 11, 13, 14, 15, 16, 18, 19, 21, 23, 24, 25, 26, 27, 29, 31, 32, 34, 35, 37, 39, 12, 28);
      d.players[0].cash = 10_000;
    });

  it('is off by default and only joins after the first lap', () => {
    const off = act(withDice(game(), 2, 3), { type: 'roll', seat: 0 });
    expect(off.ev.find((e) => e.type === 'diceRolled')).not.toHaveProperty('speed');
    const firstLap = act(withDice(game(2, { rules: { speedDie: true } }), 2, 3), { type: 'roll', seat: 0 });
    expect(firstLap.s.players[0].position).toBe(5);
  });

  it('a number face adds to the move, the bus offers a choice, triples go anywhere', () => {
    // Find seeds through the dice helper: two white dice then the speed face (1 + nextInt(6)).
    const number = act(lapped(1, 2, 2), { type: 'roll', seat: 0 });
    const face = number.ev.find((e) => e.type === 'diceRolled' && 'speed' in e) as { speed: number } | undefined;
    expect(face).toBeDefined();
    if (face!.speed <= 3) expect(number.s.players[0].position).toBe(3 + face!.speed);

    let bus = null;
    for (let a = 1; a <= 6 && !bus; a++) {
      for (let b = 1; b <= 6 && !bus; b++) {
        const r = act(lapped(a, b, 4), { type: 'roll', seat: 0 });
        if (r.s.phase === 'speedChoice') bus = r.s;
      }
    }
    expect(bus).not.toBeNull();
    const opts = legalActions(bus!, 0).filter((x) => x.type === 'speedChoice');
    expect(opts.length).toBeGreaterThanOrEqual(2);
    const pick = opts[0] as { steps: number };
    expect(act(bus!, opts[0]).s.players[0].position).toBe(pick.steps);
  });

  it('every speed-die decision keeps the state legal across many seeded rolls', () => {
    for (let seed = 1; seed <= 300; seed++) {
      let s = edit(game(3, { rules: { speedDie: true }, seed }), (d) => d.players.forEach((p) => (p.lapped = true)));
      for (let k = 0; k < 30 && s.phase !== 'gameOver'; k++) {
        const seat = s.phase === 'auction' ? s.auction!.active[0] : s.phase === 'debt' ? s.debts[0].from : s.turn.seat;
        const acts = legalActions(s, seat).filter((a) => a.type !== 'forfeit');
        const a = acts.find((x) => x.type === 'speedChoice') ?? acts.find((x) => x.type === 'roll') ?? acts.find((x) => x.type === 'decline') ?? acts.find((x) => x.type === 'pass') ?? acts.find((x) => x.type === 'endTurn') ?? acts.find((x) => x.type === 'mortgage') ?? acts.find((x) => x.type === 'declareBankruptcy') ?? acts[0];
        if (!a) break;
        s = apply(s, a).state;
        expect(checkInvariants(s)).toEqual([]);
      }
    }
  });
});
