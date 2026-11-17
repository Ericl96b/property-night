import { describe, expect, it } from 'vitest';
import { counterOf, emptyOffer, partners, promiseTiles, summarize, tradeTiles } from '../../src/ui/trade';
import { edit, game, own } from '../engine/helpers';

describe('trade screen helpers', () => {
  const s = edit(game(3, { kinds: ['human', 'human', 'bankBot'] }), (d) => {
    own(d, 0, 1, 3);
    own(d, 1, 6, 39);
    d.tiles[39].mortgaged = true;
    own(d, 0, 8, 9);
  });

  it('partners exclude yourself, bankrupt seats and bank-backed bots', () => {
    expect(partners(s, 0)).toEqual([1]);
  });

  it('lists tradeable deeds with blockers for sets with buildings', () => {
    const built = edit(s, (d) => {
      d.tiles[1].buildings = 1;
      d.bank.houses = 31;
    });
    const tiles = tradeTiles(built, 0);
    expect(tiles.find((t) => t.tile === 1)!.blocked).toMatch(/buildings/);
    expect(tiles.find((t) => t.tile === 3)!.blocked).toMatch(/buildings/);
    expect(tiles.find((t) => t.tile === 8)!.blocked).toBeNull();
  });

  it('counter swaps the sides', () => {
    const o = { ...emptyOffer(0, 1), give: { tiles: [3], cash: 50, gojf: 0 }, get: { tiles: [39], cash: 0, gojf: 0 } };
    expect(counterOf(o)).toEqual({ from: 1, to: 0, give: { tiles: [39], cash: 0, gojf: 0 }, get: { tiles: [3], cash: 50, gojf: 0 }, promises: [] });
  });

  it('promise tiles are what the promiser will own after the trade', () => {
    const o = { ...emptyOffer(0, 1), give: { tiles: [3], cash: 0, gojf: 0 }, get: { tiles: [39], cash: 0, gojf: 0 } };
    expect(promiseTiles(s, o, 0).sort((a, b) => a - b)).toEqual([1, 8, 9, 39]);
    expect(promiseTiles(s, o, 1).sort((a, b) => a - b)).toEqual([3, 6]);
  });

  it('summaries read from the viewer’s side and flag mortgaged deeds', () => {
    const o = { ...emptyOffer(0, 1), give: { tiles: [3], cash: 50, gojf: 0 }, get: { tiles: [39], cash: 0, gojf: 0 } };
    expect(summarize(s, o, 1)).toEqual({ gets: ['Briar Street', '$50'], gives: ['Midnight Park (mortgaged)'], promises: [] });
  });
});
