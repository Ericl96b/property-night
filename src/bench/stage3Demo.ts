// The Stage 3 mock-up table (docs/stage3/…/source/lib.js): Lawrence, Riley and Sam, the same
// deeds, buildings and mortgages. Used by the ?cards sheet and the stage3 screenshot plan.
import { newGame, type SeatKind, type State } from '../engine';

const OWN: Record<number, number> = {
  // Lawrence (0)
  6: 0, 8: 0, 9: 0, 16: 0, 18: 0, 37: 0, 5: 0, 15: 0,
  // Riley (1)
  11: 1, 19: 1, 26: 1, 27: 1, 31: 1, 25: 1, 35: 1, 28: 1,
  // Sam (2)
  1: 2, 3: 2, 21: 2, 23: 2, 13: 2, 39: 2, 12: 2, 32: 2,
};
const BLD: Record<number, number> = { 6: 3, 8: 3, 9: 3, 21: 1, 23: 1 };
const MORT = [37];

export function stage3Demo(samKind: SeatKind = 'human'): State {
  const s = newGame({
    seats: [
      { kind: 'human', name: 'Lawrence', token: 'rocket', color: '#7B3FE4' },
      { kind: 'human', name: 'Riley', token: 'cat', color: '#0F9C84' },
      { kind: samKind, name: 'Sam', token: 'teacup', color: '#C0582B' },
    ],
    seed: 3,
    turnOrder: 'fixed',
  });
  for (const [t, seat] of Object.entries(OWN)) s.tiles[Number(t)].owner = seat;
  for (const [t, b] of Object.entries(BLD)) {
    s.tiles[Number(t)].buildings = b;
    s.bank.houses -= b;
  }
  for (const t of MORT) s.tiles[t].mortgaged = true;
  s.players[0].cash = 820;
  s.players[1].cash = 1140;
  s.players[2].cash = 655;
  s.players[0].gojf = ['chance'];
  s.deckOrder.chance = s.deckOrder.chance.filter((i) => s.decks.chance[i].effect.kind !== 'getOutOfJail');
  return s;
}
