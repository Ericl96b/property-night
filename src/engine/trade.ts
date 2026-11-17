// Trade validation (SPEC §6): properties, cash, Get Out of Jail Free cards and promises on
// each side. Properties in a color set that has buildings cannot be traded. Cash is allowed;
// player-to-player loans are not.
import { groupHasBuildings, isBankBot, isOwnable } from './queries';
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
    if (!s.rules.promisesAllowed) return 'promises are off';
    for (const p of o.promises) {
      if (p.kind !== 'rentFree') return 'unknown promise';
      if (!Number.isInteger(p.turnsLeft) || p.turnsLeft < 1 || p.turnsLeft > 99) return 'promise length must be 1–99 turns';
      const pair = [o.from, o.to];
      if (!pair.includes(p.from) || !pair.includes(p.to) || p.from === p.to) return 'promises are between the two traders';
      // After the trade, the promiser must own the tile.
      const ownerAfter = o.give.tiles.includes(p.tileId) ? o.to : o.get.tiles.includes(p.tileId) ? o.from : s.tiles[p.tileId].owner;
      if (ownerAfter !== p.from) return 'a rent-free promise must be on a property the promiser will own';
    }
  }
  return null;
}
