import { describe, expect, it } from 'vitest';
import { apply, checkInvariants, legalActions, newGame, type State, type TradeOffer } from '../../src/engine';
import { runHeadless, botSeats } from '../../src/bots/headless';
import { act, edit, game, own, run, withDice } from './helpers';

/** P0 lands on P1's Midnight Park hotel ($2000) holding little. */
function ruinous(n = 2, setup: (d: State) => void = () => {}, opts: Parameters<typeof game>[1] = {}): State {
  const s0 = edit(withDice(game(n, opts), 2, 3), (d) => {
    d.players[0].position = 34;
    own(d, 1, 37, 39);
    d.tiles[37].buildings = 5;
    d.tiles[39].buildings = 5;
    d.bank.hotels = 10;
    d.players[0].cash = 100;
    setup(d);
  });
  return act(s0, { type: 'roll', seat: 0 }).s;
}

describe('bankruptcy', () => {
  it('can only be declared when nothing can cover the debt', () => {
    const s = ruinous(3);
    expect(s.phase).toBe('debt');
    expect(legalActions(s, 0).map((a) => a.type)).toContain('declareBankruptcy');
  });

  it('to a player: cash, deeds (with the mortgaged-interest choice) and jail cards transfer', () => {
    const s0 = ruinous(3, (d) => {
      own(d, 0, 5, 15);
      d.tiles[15].mortgaged = true;
      d.players[0].gojf = ['chest'];
      const idx = d.decks.chest.findIndex((c) => c.effect.kind === 'getOutOfJail');
      d.deckOrder.chest = d.deckOrder.chest.filter((i) => i !== idx);
    });
    // Mortgage the railroad to raise what we can, then go bankrupt.
    const s1 = act(s0, { type: 'mortgage', seat: 0, tile: 5 }).s;
    const r = act(s1, { type: 'declareBankruptcy', seat: 0 });
    expect(r.s.players[0].bankrupt).toBe(true);
    expect(r.s.tiles[5].owner).toBe(1);
    expect(r.s.tiles[15].owner).toBe(1);
    expect(r.s.players[1].gojf).toEqual(['chest']);
    expect(r.s.players[1].cash).toBe(1500 + 200);
    expect(r.s.phase).toBe('mortgagedTransfer');
    expect(legalActions(r.s, 1).filter((a) => a.type === 'mortgagedChoice')).toHaveLength(4);
    // Keep both mortgaged: pay 10% interest on each.
    const t = run(r.s, { type: 'mortgagedChoice', seat: 1, tile: 5, unmortgage: false }, { type: 'mortgagedChoice', seat: 1, tile: 15, unmortgage: true }).s;
    expect(t.players[1].cash).toBe(1700 - 10 - 110);
    expect(t.tiles[15].mortgaged).toBe(false);
    expect(t.turn.seat).toBe(1);
    expect(t.phase).toBe('preRoll');
    expect(checkInvariants(t)).toEqual([]);
  });

  it('receiving mortgaged property can be free (setting)', () => {
    const s0 = ruinous(3, (d) => {
      own(d, 0, 15);
      d.tiles[15].mortgaged = true;
    }, { rules: { receiveMortgaged: 'free' } });
    const r = act(s0, { type: 'declareBankruptcy', seat: 0 });
    expect(r.s.phase).toBe('preRoll');
    expect(r.s.tiles[15]).toMatchObject({ owner: 1, mortgaged: true });
  });

  it('to the bank: properties are auctioned one by one (Classic) or returned unowned', () => {
    const toBank = (rules = {}) => {
      const s0 = edit(withDice(game(3, { rules }), 1, 3), (d) => {
        d.players[0].cash = 50;
        own(d, 0, 5, 15);
        d.tiles[5].mortgaged = true;
        d.tiles[15].mortgaged = true;
      });
      return act(s0, { type: 'roll', seat: 0 }).s; // Income Tax $200
    };
    const s = act(toBank(), { type: 'declareBankruptcy', seat: 0 }).s;
    expect(s.phase).toBe('auction');
    expect(s.auction!.tile).toBe(5);
    expect(s.tiles[5]).toMatchObject({ owner: null, mortgaged: false });
    expect(s.auctionQueue).toEqual([15]);
    const after = run(s, { type: 'pass', seat: 1 }, { type: 'pass', seat: 2 }, { type: 'pass', seat: 1 }, { type: 'pass', seat: 2 }).s;
    expect(after.turn.seat).toBe(1);
    expect(after.phase).toBe('preRoll');
    const unowned = act(toBank({ bankruptToBank: 'unowned' }), { type: 'declareBankruptcy', seat: 0 }).s;
    expect(unowned.phase).toBe('preRoll');
    expect(unowned.tiles[5].owner).toBeNull();
  });

  it('forfeit is bankruptcy to the bank at any time', () => {
    const s0 = edit(game(3), (d) => {
      own(d, 2, 1, 3);
      d.tiles[1].buildings = 1;
      d.bank.houses = 31;
    });
    const r = act(s0, { type: 'forfeit', seat: 2 });
    expect(r.s.players[2].bankrupt).toBe(true);
    expect(r.s.bank.houses).toBe(32);
    expect(r.s.phase).toBe('auction');
    expect(checkInvariants(r.s)).toEqual([]);
  });
});

describe('winning', () => {
  it('two humans: the last human standing wins', () => {
    const s = act(ruinous(2), { type: 'declareBankruptcy', seat: 0 }).s;
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(1);
    expect(() => apply(s, { type: 'roll', seat: 1 })).toThrow(/over/);
  });

  it('with 2+ humans the game ends when one human is left, even if bots remain', () => {
    const s = act(ruinous(3, () => {}, { kinds: ['human', 'human', 'bot'] }), { type: 'declareBankruptcy', seat: 0 }).s;
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(1);
  });

  it('one human (testing) loses on bankruptcy and wins as the last non-bank seat', () => {
    const lose = act(ruinous(3, () => {}, { kinds: ['human', 'bot', 'bot'] }), { type: 'declareBankruptcy', seat: 0 }).s;
    expect(lose.phase).toBe('gameOver');
    const win = act(edit(game(3, { kinds: ['human', 'bot', 'bankBot'] }), () => {}), { type: 'forfeit', seat: 0 }).s;
    expect(win.phase).toBe('gameOver');
    expect(win.winner).toBeNull();
  });
});

describe('bank-backed bot', () => {
  const bb = (dice: number[], setup: (d: State) => void = () => {}) =>
    edit(withDice(game(3, { kinds: ['bankBot', 'human', 'human'] }), ...dice), setup);

  it('never buys: what it lands on is auctioned among the others, and it does not bid', () => {
    const s = act(bb([1, 2]), { type: 'roll', seat: 0 }).s;
    expect(s.phase).toBe('auction');
    expect(s.auction!.active).toEqual([1, 2]);
  });

  it('pays rent from the bank and never goes bankrupt', () => {
    const s = act(bb([2, 3], (d) => {
      d.players[0].position = 34;
      own(d, 1, 37, 39);
      d.tiles[39].buildings = 5;
      d.tiles[37].buildings = 5;
      d.bank.hotels = 10;
    }), { type: 'roll', seat: 0 }).s;
    expect(s.players[1].cash).toBe(3500);
    expect(s.players[0].bankrupt).toBe(false);
    expect(s.phase).toBe('postRoll');
  });

  it('never draws cards, never goes to jail, collects nothing', () => {
    const card = act(bb([3, 4]), { type: 'roll', seat: 0 }).s;
    expect(card.players[0].position).toBe(7);
    expect(card.deckOrder.chance).toEqual(bb([3, 4]).deckOrder.chance);
    const gtj = act(bb([3, 4], (d) => (d.players[0].position = 23)), { type: 'roll', seat: 0 }).s;
    expect(gtj.players[0].position).toBe(30);
    expect(gtj.players[0].jail).toBeNull();
    const go = act(bb([3, 4], (d) => (d.players[0].position = 36)), { type: 'roll', seat: 0 }).s;
    expect(go.players[0].cash).toBe(1500);
  });
});

describe('trades and promises', () => {
  const offer = (o: Partial<TradeOffer>): TradeOffer => ({
    from: 0,
    to: 1,
    give: { tiles: [], cash: 0, gojf: 0 },
    get: { tiles: [], cash: 0, gojf: 0 },
    promises: [],
    ...o,
  });

  it('proposed on your own turn; the receiver accepts', () => {
    const s0 = edit(game(), (d) => own(d, 1, 3));
    const o = offer({ give: { tiles: [], cash: 150, gojf: 0 }, get: { tiles: [3], cash: 0, gojf: 0 } });
    const p = act(s0, { type: 'proposeTrade', seat: 0, offer: o }).s;
    expect(p.phase).toBe('trade');
    expect(legalActions(p, 1).map((a) => a.type)).toEqual(['acceptTrade', 'rejectTrade', 'forfeit']);
    const s = act(p, { type: 'acceptTrade', seat: 1 }).s;
    expect(s.tiles[3].owner).toBe(0);
    expect(s.players[0].cash).toBe(1350);
    expect(s.players[1].cash).toBe(1650);
    expect(s.phase).toBe('preRoll');
  });

  it('only on your own turn, never with buildings in the set, and only when trading is on', () => {
    const s0 = edit(game(), (d) => {
      own(d, 1, 1, 3);
      d.tiles[1].buildings = 1;
      d.bank.houses = 31;
    });
    expect(() => apply(s0, { type: 'proposeTrade', seat: 1, offer: offer({ from: 1, to: 0 }) })).toThrow(/turn/);
    expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: offer({ get: { tiles: [3], cash: 0, gojf: 0 } }) })).toThrow(/buildings/);
    const off = edit(game(2, { rules: { tradingAllowed: false } }), (d) => own(d, 1, 3));
    expect(() => apply(off, { type: 'proposeTrade', seat: 0, offer: offer({ get: { tiles: [3], cash: 0, gojf: 0 } }) })).toThrow(/trading is off/);
  });

  it('reject and counter (sides swapped)', () => {
    const s0 = edit(game(), (d) => own(d, 1, 3));
    const p = act(s0, { type: 'proposeTrade', seat: 0, offer: offer({ give: { tiles: [], cash: 50, gojf: 0 }, get: { tiles: [3], cash: 0, gojf: 0 } }) }).s;
    expect(act(p, { type: 'rejectTrade', seat: 1 }).s.trade).toBeNull();
    const counter = offer({ from: 1, to: 0, give: { tiles: [3], cash: 0, gojf: 0 }, get: { tiles: [], cash: 120, gojf: 0 } });
    const c = act(p, { type: 'counterTrade', seat: 1, offer: counter }).s;
    expect(c.trade).toEqual(counter);
    const done = act(c, { type: 'acceptTrade', seat: 0 }).s;
    expect(done.tiles[3].owner).toBe(0);
    expect(done.players[0].cash).toBe(1380);
  });

  it('a received mortgaged property triggers the 10% choice', () => {
    const s0 = edit(game(), (d) => {
      own(d, 1, 3);
      d.tiles[3].mortgaged = true;
    });
    const p = act(s0, { type: 'proposeTrade', seat: 0, offer: offer({ get: { tiles: [3], cash: 0, gojf: 0 }, give: { tiles: [], cash: 10, gojf: 0 } }) }).s;
    const s = act(p, { type: 'acceptTrade', seat: 1 }).s;
    expect(s.phase).toBe('mortgagedTransfer');
    expect(act(s, { type: 'mortgagedChoice', seat: 0, tile: 3, unmortgage: false }).s.players[0].cash).toBe(1487);
  });

  it('rent-free promise: no rent for N landings, then it expires', () => {
    const s0 = edit(game(), (d) => {
      own(d, 1, 3);
      own(d, 0, 39);
    });
    const o = offer({
      give: { tiles: [39], cash: 0, gojf: 0 },
      promises: [{ kind: 'rentFree', from: 1, to: 0, group: 'brown', total: 1, left: 1 }],
    });
    let s = run(s0, { type: 'proposeTrade', seat: 0, offer: o }, { type: 'acceptTrade', seat: 1 }).s;
    expect(s.promises).toHaveLength(1);
    const r = run(withDice(s, 1, 2), { type: 'roll', seat: 0 });
    s = r.s;
    expect(s.players[0].cash).toBe(1500);
    expect(r.ev.some((e) => e.type === 'rentWaived')).toBe(true);
    expect(s.promises).toHaveLength(0);
  });

  it('a promise is void once a party is out', () => {
    const s0 = edit(game(3), (d) => {
      own(d, 1, 3);
      own(d, 0, 39);
    });
    const o = offer({ give: { tiles: [39], cash: 0, gojf: 0 }, promises: [{ kind: 'rentFree', from: 1, to: 0, group: 'brown', total: 5, left: 5 }] });
    const s = run(s0, { type: 'proposeTrade', seat: 0, offer: o }, { type: 'acceptTrade', seat: 1 }).s;
    const r = act(s, { type: 'forfeit', seat: 1 });
    expect(r.s.promises).toHaveLength(0);
    expect(r.ev.some((e) => e.type === 'promiseEnded' && e.reason === 'void')).toBe(true);
  });

  it('promises can be turned off', () => {
    const s0 = edit(game(2, { rules: { promisesAllowed: false } }), (d) => own(d, 1, 3));
    const o = offer({ give: { tiles: [], cash: 1, gojf: 0 }, promises: [{ kind: 'rentFree', from: 1, to: 0, group: 'brown', total: 2, left: 2 }] });
    expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: o })).toThrow(/promises are off/);
  });
});

describe('determinism, save and replay', () => {
  it('the same seed and actions reproduce the same game exactly', () => {
    const a = runHeadless({ seats: botSeats(4), seed: 4242 }, { keepLog: true, maxTurns: 400 });
    let s = newGame({ seats: botSeats(4), seed: 4242 });
    for (const action of a.log) s = apply(s, action).state;
    expect(JSON.stringify(s)).toBe(JSON.stringify(a.state));
  });

  it('a JSON round trip (save/load) continues identically', () => {
    const a = runHeadless({ seats: botSeats(3), seed: 99 }, { keepLog: true, maxTurns: 150 });
    const half = Math.floor(a.log.length / 2);
    let s = newGame({ seats: botSeats(3), seed: 99 });
    for (const action of a.log.slice(0, half)) s = apply(s, action).state;
    s = JSON.parse(JSON.stringify(s));
    for (const action of a.log.slice(half)) s = apply(s, action).state;
    expect(JSON.stringify(s)).toBe(JSON.stringify(a.state));
  });
});

describe('headless bot games (SPEC §14 M1)', () => {
  it('300 bot-vs-bot games (2–6 seats) finish with no illegal state', () => {
    let finished = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = runHeadless({ seats: botSeats(2 + (seed % 5)), seed: seed * 7919 }, { maxTurns: 5000, checkEveryAction: true });
      expect(r.errors).toEqual([]);
      if (r.finished) finished++;
    }
    expect(finished).toBeGreaterThanOrEqual(297);
  }, 300_000);

  it('games with a bank-backed bot stay legal; it never owns, never goes bankrupt, never wins', () => {
    // Its rent comes from the bank's unlimited money, so these games can run long (see DECISIONS).
    let finished = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = runHeadless(
        { seats: [...botSeats(3), { kind: 'bankBot', name: 'Bank' }], seed },
        { maxTurns: 1500, checkEveryAction: true },
      );
      expect(r.errors).toEqual([]);
      const bank = r.state.seats.findIndex((x) => x.kind === 'bankBot');
      expect(r.state.players[bank].bankrupt).toBe(false);
      expect(r.state.tiles.some((t) => t.owner === bank)).toBe(false);
      if (r.finished) {
        finished++;
        expect(r.state.seats[r.winner!].kind).toBe('bot');
      }
    }
    expect(finished).toBeGreaterThan(20);
  }, 120_000);
});
