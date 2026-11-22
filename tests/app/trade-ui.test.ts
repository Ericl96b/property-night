import { describe, expect, it } from 'vitest';
import { counterOf, dealSentences, emptyOffer, partners, promisesOffReason, sideTotals, tradeTiles } from '../../src/ui/trade';
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
    expect(tiles.find((t) => t.tile === 1)!.blocked).toBe('Has houses');
    expect(tiles.find((t) => t.tile === 3)!.blocked).toBe('Has houses');
    expect(tiles.find((t) => t.tile === 8)!.blocked).toBeNull();
  });

  it('counter swaps the sides', () => {
    const o = { ...emptyOffer(0, 1), give: { tiles: [3], cash: 50, gojf: 0 }, get: { tiles: [39], cash: 0, gojf: 0 } };
    expect(counterOf(o)).toEqual({ from: 1, to: 0, give: { tiles: [39], cash: 0, gojf: 0 }, get: { tiles: [3], cash: 50, gojf: 0 }, promises: [] });
  });

  it('deal strip: names from the proposer side, "you" for the receiver, never pronouns', () => {
    const o = {
      ...emptyOffer(0, 1),
      give: { tiles: [3], cash: 50, gojf: 0 },
      get: { tiles: [39], cash: 0, gojf: 0 },
      promises: [
        { kind: 'noBuild' as const, from: 0, to: 1, group: 'orange' as const, total: 2, left: 2 },
        { kind: 'rentFree' as const, from: 1, to: 0, group: 'railroad' as const, total: 3, left: 3 },
      ],
    };
    expect(dealSentences(s, o, 0)).toEqual([
      'P0 gives Briar Street and $50.',
      'P1 gives Midnight Park (mortgaged).',
      'P0 promises not to build on Orange for 2 rounds.',
      "P1 promises P0 no rent on Railroads for 3 of P0's landings.",
    ]);
    expect(dealSentences(s, o, 1)).toEqual([
      'You get Briar Street and $50.',
      'You give Midnight Park (mortgaged).',
      'P0 promises not to build on Orange for 2 rounds.',
      "You promise P0 no rent on Railroads for 3 of P0's landings.",
    ]);
    const j = { ...emptyOffer(0, 1), give: { tiles: [3, 8], cash: 150, gojf: 1 } };
    expect(dealSentences(s, j)[0]).toBe('P0 gives Briar Street, Bluebell Way, $150 and a Get Out of Jail Free card.');
    expect(dealSentences(s, j)[1]).toBe('P1 gives nothing.');
  });

  it('side totals: list value is deed prices plus cash', () => {
    const o = { ...emptyOffer(0, 1), give: { tiles: [3], cash: 50, gojf: 0 } };
    expect(sideTotals(s, o, 0)).toEqual({ listValue: 110, cash: 50, cards: 1 });
  });

  it('locked games end the strip with a note and name the bot', () => {
    const b = game(3, { kinds: ['human', 'human', 'bot'] });
    expect(promisesOffReason(b)).toBe('Promises are off: P2 is a normal bot.');
    expect(dealSentences(b, emptyOffer(0, 1)).at(-1)).toBe('Promises are off in this game.');
    expect(promisesOffReason(game(2, { rules: { promisesAllowed: false } }))).toBe("Promises are off in this game's rules.");
    expect(promisesOffReason(s)).toBeNull();
  });
});
