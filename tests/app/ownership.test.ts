import { describe, expect, it } from 'vitest';
import { decide } from '../../src/app/ownership';
import { act, edit, game, own, run, withDice } from '../engine/helpers';

describe('controller ownership (SPEC §4)', () => {
  it('normal play: only the active player’s controller acts; keyboard is a fallback', () => {
    const s = game(3);
    expect(decide(s, 0, 'confirm')).toEqual({ allowed: true, seat: 0 });
    expect(decide(s, 1, 'confirm').allowed).toBe(false);
    expect(decide(s, 2, 'manage').allowed).toBe(false);
    expect(decide(s, null, 'confirm')).toEqual({ allowed: true, seat: 0 });
  });

  it('pause and the log work from any controller', () => {
    const s = game(3);
    expect(decide(s, 2, 'pause').allowed).toBe(true);
    expect(decide(s, 1, 'log').allowed).toBe(true);
  });

  it('auctions: every bidder’s controller is live for its own seat', () => {
    const s = run(withDice(game(3), 1, 2), { type: 'roll', seat: 0 }, { type: 'decline', seat: 0 }).s;
    expect(s.phase).toBe('auction');
    expect(decide(s, 1, 'confirm')).toEqual({ allowed: true, seat: 1 });
    expect(decide(s, 2, 'cycleRight')).toEqual({ allowed: true, seat: 2 });
    const passed = act(s, { type: 'pass', seat: 2 }).s;
    expect(decide(passed, 2, 'confirm').allowed).toBe(false);
  });

  it('raise money belongs to the debtor, wherever the turn is', () => {
    const s0 = edit(withDice(game(3), 1, 2), (d) => {
      d.players[0].position = 39;
      d.players[1].cash = 5;
      own(d, 1, 39);
      const idx = d.decks.chest.findIndex((c) => /birthday/.test(c.text));
      d.deckOrder.chest = [idx, ...d.deckOrder.chest.filter((i) => i !== idx)];
    });
    const s = act(s0, { type: 'roll', seat: 0 }).s;
    expect(s.phase).toBe('debt');
    expect(decide(s, 1, 'confirm')).toEqual({ allowed: true, seat: 1 });
    expect(decide(s, 0, 'confirm').allowed).toBe(false);
  });

  it('trades: the receiver answers, the proposer may cancel, others watch', () => {
    const s0 = edit(game(3), (d) => own(d, 1, 3));
    const offer = { from: 0, to: 1, give: { tiles: [], cash: 50, gojf: 0 }, get: { tiles: [3], cash: 0, gojf: 0 }, promises: [] };
    const s = act(s0, { type: 'proposeTrade', seat: 0, offer }).s;
    expect(decide(s, 1, 'confirm').allowed).toBe(true);
    expect(decide(s, 0, 'back').allowed).toBe(true);
    expect(decide(s, 2, 'confirm').allowed).toBe(false);
  });

  it('bankrupt seats’ controllers do nothing', () => {
    const s = edit(game(3), (d) => {
      d.players[2].bankrupt = true;
      d.players[2].cash = 0;
    });
    expect(decide(s, 2, 'confirm').allowed).toBe(false);
  });
});
