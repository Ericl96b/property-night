// Trade validation (SPEC §6): properties, cash, Get Out of Jail Free cards and promises on
// each side. Properties in a color set that has buildings cannot be traded. Cash is allowed;
// player-to-player loans are not.
import { groupHasBuildings, isBankBot, isOwnable } from './queries';
import { isColorGroup, isPromiseGroup, PROMISE_LIMITS, promisesLock, samePromise, tilesInPromiseGroup } from './promises';
import type { State, TradeOffer, TradeSide } from './types';

/** Why a tile cannot be traded by its owner, or null. */
export function tradeTileBlocker(s: State, tile: number): string | null {
  if (!isOwnable(s.board.tiles[tile])) return 'not a property';
  if (groupHasBuildings(s, tile)) return 'sell the buildings in this set first';
  if (s.players.some((p) => p.loans.some((l) => l.collateral.includes(tile)))) return 'pledged to a loan';
  return null;
}

function checkSide(s: State, seat: number, side: TradeSide, label: string): string | null {
  if (!Number.isInteger(side.cash) || side.cash < 0) return `${label}: bad cash amount`;
  if (side.cash > s.players[seat].cash) return `${label}: not enough cash`;
  if (!Number.isInteger(side.gojf) || side.gojf < 0 || side.gojf > s.players[seat].gojf.length) return `${label}: not enough jail cards`;
  if (new Set(side.tiles).size !== side.tiles.length) return `${label}: duplicate property`;
  for (const t of side.tiles) {
    if (t < 0 || t >= s.tiles.length || s.tiles[t].owner !== seat) return `${label}: property not owned`;
    const why = tradeTileBlocker(s, t);
    if (why) return `${s.board.tiles[t].name}: ${why}`;
  }
  return null;
}

export function validateOffer(s: State, o: TradeOffer): string | null {
  if (!s.rules.tradingAllowed) return 'trading is off';
  if (o.from === o.to) return 'cannot trade with yourself';
  for (const seat of [o.from, o.to]) {
    if (seat < 0 || seat >= s.players.length || s.players[seat].bankrupt) return 'that player is out of the game';
    if (isBankBot(s, seat)) return 'bank-backed bots never trade';
  }
  const empty = (x: TradeSide) => !x.tiles.length && !x.cash && !x.gojf;
  if (empty(o.give) && empty(o.get) && !o.promises.length) return 'the trade is empty';
  const a = checkSide(s, o.from, o.give, 'your side');
  if (a) return a;
  const b = checkSide(s, o.to, o.get, 'their side');
  if (b) return b;
  if (o.promises.length) {
    // Bot lock / rules (Stage 3 §6): "no promises or loan terms in trades".
    if (promisesLock(s)) return 'promises are off';
    const pair = [o.from, o.to];
    for (let i = 0; i < o.promises.length; i++) {
      const p = o.promises[i];
      if (p.kind !== 'rentFree' && p.kind !== 'noBuild') return 'unknown promise';
      if (!pair.includes(p.from) || !pair.includes(p.to) || p.from === p.to) return 'promises are between the two traders';
      if (!isPromiseGroup(p.group)) return 'unknown group';
      if (p.kind === 'noBuild' && !isColorGroup(p.group)) return 'No Building covers color sets only';
      const max = PROMISE_LIMITS[p.kind];
      const unit = p.kind === 'rentFree' ? 'landings' : 'rounds';
      if (!Number.isInteger(p.left) || p.left < 1 || p.left > max) return `promise length must be 1–${max} ${unit}`;
      if (p.total !== p.left) return 'bad promise count';
      if (o.promises.findIndex((q) => samePromise(q, p)) !== i) return 'the same promise is in the offer twice';
      if (p.kind === 'rentFree') {
        // After the trade, the promiser must own at least one tile in the group.
        const ownerAfter = (t: number) => (o.give.tiles.includes(t) ? o.to : o.get.tiles.includes(t) ? o.from : s.tiles[t].owner);
        if (!tilesInPromiseGroup(s.board, p.group).some((t) => ownerAfter(t) === p.from)) {
          return 'a rent-free promise needs the promiser to own a property in that group';
        }
      }
    }
  }
  return null;
}
