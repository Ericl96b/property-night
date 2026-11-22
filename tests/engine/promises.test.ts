// Stage 3 §5–§6: group promises (Rent-Free, No Building), merging, and the bot lock.
import { describe, expect, it } from 'vitest';
import { apply, buildBlocker, checkInvariants, legalActions, type PromiseTerm, type State, type TradeOffer } from '../../src/engine';
import { act, edit, game, own, run, topCard, withDice } from './helpers';

const offer = (o: Partial<TradeOffer>): TradeOffer => ({
  from: 0,
  to: 1,
  give: { tiles: [], cash: 0, gojf: 0 },
  get: { tiles: [], cash: 0, gojf: 0 },
  promises: [],
  ...o,
});

const term = (kind: PromiseTerm['kind'], from: number, to: number, group: PromiseTerm['group'], n: number): PromiseTerm => ({ kind, from, to, group, total: n, left: n });

/** Propose and accept on seat `from`'s turn. */
function trade(s: State, o: TradeOffer): State {
  return run(s, { type: 'proposeTrade', seat: o.from, offer: o }, { type: 'acceptTrade', seat: o.to }).s;
}

/** Make it `seat`'s fresh turn at `pos` (scenario shortcut; no turn counting happens). */
function turnAt(s: State, seat: number, pos: number): State {
  return edit(s, (d) => {
    d.turn = { seat, doubles: 0, rolled: false, extraRoll: false, dice: null, trades: 0, speed: null, speedChoice: null, mrMonopoly: false };
    d.phase = 'preRoll';
    d.players[seat].position = pos;
  });
}

/** End the active seat's turn (marks it rolled first), so the next seat starts a turn. */
function pass(s: State): State {
  const seat = s.turn.seat;
  const d = edit(s, (x) => {
    x.turn.rolled = true;
    x.turn.extraRoll = false;
    x.phase = 'postRoll';
  });
  return act(d, { type: 'endTurn', seat }).s;
}

describe('Rent-Free promises', () => {
  const base = () =>
    trade(
      edit(game(3), (d) => {
        own(d, 1, 3);
        own(d, 0, 39);
      }),
      offer({ give: { tiles: [39], cash: 0, gojf: 0 }, promises: [term('rentFree', 1, 0, 'brown', 3)] }),
    );

  it('waives rent on every promiser-owned tile in the group, including one acquired after the trade', () => {
    let s = base();
    s = run(withDice(turnAt(s, 0, 0), 1, 2), { type: 'roll', seat: 0 }).s; // Briar Street (3)
    expect(s.players[0].cash).toBe(1500);
    expect(s.promises[0].left).toBe(2);
    s = edit(s, (d) => own(d, 1, 1)); // seat 1 gets Hazel Lane later
    s = run(withDice(turnAt(s, 0, 38), 1, 2), { type: 'roll', seat: 0 }).s; // passes GO to Hazel Lane (1)
    expect(s.players[0].position).toBe(1);
    expect(s.players[0].cash).toBe(1700);
    expect(s.promises[0].left).toBe(1);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('only landings that owe rent use it up: mortgaged and $0 landings do not', () => {
    const mort = edit(base(), (d) => (d.tiles[3].mortgaged = true));
    const a = run(withDice(turnAt(mort, 0, 0), 1, 2), { type: 'roll', seat: 0 }).s;
    expect(a.promises[0].left).toBe(3);
    // The board is shared with CLASSIC_BOARD: copy it before editing a rent.
    const free = edit(base(), (d) => (d.board = { ...d.board, tiles: d.board.tiles.map((t) => (t.index === 3 ? { ...t, rents: [0, 0, 0, 0, 0, 0] } : t)) }));
    const b = run(withDice(turnAt(free, 0, 0), 1, 2), { type: 'roll', seat: 0 });
    expect(b.s.promises[0].left).toBe(3);
    expect(b.ev.some((e) => e.type === 'rentWaived')).toBe(false);
  });

  it('a double-rent railroad card counts as one landing and is fully waived', () => {
    const s0 = trade(
      edit(game(2), (d) => {
        own(d, 1, 15);
        own(d, 0, 39);
      }),
      offer({ give: { tiles: [39], cash: 0, gojf: 0 }, promises: [term('rentFree', 1, 0, 'railroad', 2)] }),
    );
    const s1 = edit(turnAt(s0, 0, 4), (d) => topCard(d, 'chance', /nearest train/));
    const r = run(withDice(s1, 1, 2), { type: 'roll', seat: 0 }); // 7 = Chance → South Line (15)
    expect(r.s.players[0].position).toBe(15);
    expect(r.s.players[0].cash).toBe(1500);
    expect(r.s.promises[0].left).toBe(1);
    expect(r.ev.filter((e) => e.type === 'rentWaived')).toHaveLength(1);
  });

  it('ends at 0', () => {
    let s = edit(base(), (d) => (d.promises[0].left = 1));
    s = run(withDice(turnAt(s, 0, 0), 1, 2), { type: 'roll', seat: 0 }).s;
    expect(s.promises).toHaveLength(0);
  });

  it('survives the promiser losing the tiles and applies again when one comes back', () => {
    let s = edit(base(), (d) => own(d, 2, 3)); // seat 1 no longer owns any brown
    s = pass(turnAt(s, 2, 10)); // run the engine past an owner change
    expect(s.promises).toHaveLength(1);
    const paid = run(withDice(turnAt(s, 0, 0), 1, 2), { type: 'roll', seat: 0 }).s;
    expect(paid.players[0].cash).toBe(1496); // rent to seat 2, promise untouched
    expect(paid.promises[0].left).toBe(3);
    s = edit(s, (d) => own(d, 1, 3));
    const back = run(withDice(turnAt(s, 0, 0), 1, 2), { type: 'roll', seat: 0 }).s;
    expect(back.players[0].cash).toBe(1500);
    expect(back.promises[0].left).toBe(2);
  });

  it('is voided by bankruptcy', () => {
    const r = act(base(), { type: 'forfeit', seat: 1 });
    expect(r.s.promises).toHaveLength(0);
  });

  it('needs the promiser to own a tile in the group after the trade', () => {
    const s0 = edit(game(2), (d) => {
      own(d, 1, 3);
      own(d, 0, 39);
    });
    const givesAway = offer({ get: { tiles: [3], cash: 0, gojf: 0 }, give: { tiles: [], cash: 10, gojf: 0 }, promises: [term('rentFree', 1, 0, 'brown', 2)] });
    expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: givesAway })).toThrow(/own a property in that group/);
    const none = offer({ give: { tiles: [], cash: 10, gojf: 0 }, promises: [term('rentFree', 1, 0, 'railroad', 2)] });
    expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: none })).toThrow(/own a property in that group/);
    // Acquired in the same trade is fine.
    const gets = offer({ give: { tiles: [39], cash: 0, gojf: 0 }, promises: [term('rentFree', 1, 0, 'darkBlue', 2)] });
    expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: gets })).not.toThrow();
  });

  it('limits: 1–99 landings', () => {
    const s0 = edit(game(2), (d) => own(d, 1, 3));
    for (const n of [0, 100]) {
      expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: offer({ promises: [term('rentFree', 1, 0, 'brown', n)] }) })).toThrow(/1–99/);
    }
  });
});

describe('No Building promises', () => {
  const base = (n = 3) =>
    trade(
      edit(game(n), (d) => own(d, 0, 1, 3)),
      offer({ promises: [term('noBuild', 0, 1, 'brown', 2)] }),
    );

  it('blocks houses and hotels on the set, with the reason', () => {
    const s = base();
    expect(s.promises[0].anchor).toBe(0);
    expect(buildBlocker(s, 0, 1)).toBe('blocked by your promise to P1 (2 rounds left)');
    expect(legalActions(s, 0).some((a) => a.type === 'build')).toBe(false);
    expect(() => apply(s, { type: 'build', seat: 0, tile: 1 })).toThrow(/blocked by your promise/);
    const hotel = edit(s, (d) => {
      d.tiles[1].buildings = 4;
      d.tiles[3].buildings = 4;
      d.bank.houses = 24;
    });
    expect(buildBlocker(hotel, 0, 3)).toMatch(/blocked by your promise/);
  });

  it('allows selling, mortgaging is unaffected', () => {
    const s = edit(base(), (d) => {
      d.tiles[1].buildings = 1;
      d.tiles[3].buildings = 1;
      d.bank.houses = 30;
    });
    const sold = act(s, { type: 'sell', seat: 0, tile: 1 }).s;
    expect(sold.tiles[1].buildings).toBe(0);
    const m = act(base(), { type: 'mortgage', seat: 0, tile: 1 }).s;
    expect(m.tiles[1].mortgaged).toBe(true);
  });

  it('keeps the promiser out of shortage auctions for the set', () => {
    const setup = (promise: boolean) => {
      let s = edit(game(3, { rules: { shortageHandling: 'auction' } }), (d) => own(d, 0, 1, 3));
      if (promise) s = trade(s, offer({ promises: [term('noBuild', 0, 1, 'brown', 2)] }));
      s = edit(s, (d) => {
        own(d, 1, 6, 8, 9);
        d.bank.houses = 1;
      });
      return act(turnAt(s, 1, 10), { type: 'build', seat: 1, tile: 6 }).s;
    };
    expect(setup(false).auction?.kind).toBe('house'); // control: seat 0 would bid
    const s = setup(true);
    expect(s.auction).toBeNull();
    expect(s.tiles[6].buildings).toBe(1);
  });

  it('counts down at the anchor seat’s turn starts and ends at 0', () => {
    let s = base();
    s = pass(s); // seat 1 starts
    s = pass(s); // seat 2 starts
    expect(s.promises[0].left).toBe(2);
    s = pass(s); // seat 0 starts: one round
    expect(s.promises[0].left).toBe(1);
    s = pass(pass(s));
    const r = act(edit(s, (d) => ((d.turn.rolled = true), (d.phase = 'postRoll'))), { type: 'endTurn', seat: 2 });
    expect(r.s.promises).toHaveLength(0);
    expect(r.ev.some((e) => e.type === 'promiseEnded' && e.reason === 'expired')).toBe(true);
  });

  it('extra rolls from doubles are part of the same turn', () => {
    const s = run(withDice(base(), 3, 3), { type: 'roll', seat: 0 }).s; // 6: Lilac Row, unowned
    const after = s.phase === 'buy' ? act(s, { type: 'decline', seat: 0 }).s : s;
    expect(after.turn.seat).toBe(0);
    expect(after.promises[0].left).toBe(2);
  });

  it('the anchor moves to the next seat when that seat goes bankrupt', () => {
    let s = edit(game(3), (d) => {
      d.promises.push({ id: 9, ...term('noBuild', 0, 1, 'orange', 3), anchor: 2 });
    });
    s = act(turnAt(s, 2, 10), { type: 'forfeit', seat: 2 }).s;
    expect(s.promises[0].anchor).toBe(0);
  });

  it('No Building covers color sets only, 1–20 rounds, no ownership needed', () => {
    const s0 = game(2);
    expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: offer({ promises: [term('noBuild', 0, 1, 'railroad', 2)] }) })).toThrow(/color sets only/);
    expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: offer({ promises: [term('noBuild', 0, 1, 'red', 21)] }) })).toThrow(/1–20/);
    expect(() => apply(s0, { type: 'proposeTrade', seat: 0, offer: offer({ promises: [term('noBuild', 1, 0, 'red', 20)] }) })).not.toThrow();
  });
});

describe('merging and duplicates', () => {
  it('a matching promise adds its count to the existing voucher', () => {
    let s = edit(game(2), (d) => own(d, 1, 3));
    s = trade(s, offer({ promises: [term('rentFree', 1, 0, 'brown', 2)] }));
    s = trade(s, offer({ promises: [term('rentFree', 1, 0, 'brown', 3)] }));
    expect(s.promises).toHaveLength(1);
    expect(s.promises[0]).toMatchObject({ left: 5, total: 5 });
    expect(checkInvariants(s)).toEqual([]);
  });

  it('duplicates within one offer are rejected', () => {
    const s = edit(game(2), (d) => own(d, 1, 3));
    const o = offer({ promises: [term('rentFree', 1, 0, 'brown', 2), term('rentFree', 1, 0, 'brown', 1)] });
    expect(() => apply(s, { type: 'proposeTrade', seat: 0, offer: o })).toThrow(/twice/);
  });
});

describe('the bot lock', () => {
  const o = offer({ promises: [term('noBuild', 0, 1, 'red', 2)] });

  it('a normal bot at the table turns promises off for the game', () => {
    const s = game(3, { kinds: ['human', 'human', 'bot'] });
    expect(s.rules.promisesAllowed).toBe(false);
    expect(s.promisesLock).toBe('bot');
    expect(() => apply(s, { type: 'proposeTrade', seat: 0, offer: o })).toThrow(/promises are off/);
    // Properties and cash still trade.
    expect(() => apply(s, { type: 'proposeTrade', seat: 0, offer: offer({ give: { tiles: [], cash: 10, gojf: 0 } }) })).not.toThrow();
  });

  it('a bank-backed bot alone does not', () => {
    const s = game(3, { kinds: ['human', 'human', 'bankBot'] });
    expect(s.promisesLock).toBeUndefined();
    expect(() => apply(s, { type: 'proposeTrade', seat: 0, offer: o })).not.toThrow();
  });

  it('stays after the bot goes bankrupt', () => {
    let s = game(3, { kinds: ['human', 'human', 'bot'] });
    s = act(turnAt(s, 2, 10), { type: 'forfeit', seat: 2 }).s;
    s = turnAt(s, 0, 0);
    expect(() => apply(s, { type: 'proposeTrade', seat: 0, offer: o })).toThrow(/promises are off/);
  });
});
