// Trade screen helpers (SPEC §6): what each side can offer, offer summaries, counters.
import { tradeTileBlocker, validateOffer, type PromiseTerm, type State, type TradeOffer } from '../engine';
import { money } from './present';

export interface TradeTile {
  tile: number;
  name: string;
  color: string;
  mortgaged: boolean;
  blocked: string | null;
}

export function tradeTiles(gs: State, seat: number): TradeTile[] {
  return gs.board.tiles
    .filter((t) => gs.tiles[t.index].owner === seat)
    .map((t) => ({
      tile: t.index,
      name: t.name,
      color: t.group ? gs.board.groups[t.group].color : t.type === 'railroad' ? '#2B2119' : '#5E4C3B',
      mortgaged: gs.tiles[t.index].mortgaged,
      blocked: tradeTileBlocker(gs, t.index),
    }));
}

export function partners(gs: State, seat: number): number[] {
  return gs.seats.map((_, i) => i).filter((i) => i !== seat && !gs.players[i].bankrupt && gs.seats[i].kind !== 'bankBot');
}

export function emptyOffer(from: number, to: number): TradeOffer {
  return { from, to, give: { tiles: [], cash: 0, gojf: 0 }, get: { tiles: [], cash: 0, gojf: 0 }, promises: [] };
}

/** Counter: same screen with sides swapped (SPEC §6). */
export function counterOf(o: TradeOffer): TradeOffer {
  return {
    from: o.to,
    to: o.from,
    give: { ...o.get, tiles: [...o.get.tiles] },
    get: { ...o.give, tiles: [...o.give.tiles] },
    promises: o.promises.map((p) => ({ ...p })),
  };
}

export function promiseText(gs: State, p: PromiseTerm): string {
  return `${gs.seats[p.to].name} pays no rent to ${gs.seats[p.from].name} on ${gs.board.tiles[p.tileId].name} for ${p.turnsLeft} turn${p.turnsLeft === 1 ? '' : 's'}`;
}

/** Lines describing what `viewer` gets and gives. */
export function summarize(gs: State, o: TradeOffer, viewer: number): { gets: string[]; gives: string[]; promises: string[] } {
  const mineIsGive = o.from === viewer;
  const theirs = mineIsGive ? o.get : o.give;
  const mine = mineIsGive ? o.give : o.get;
  const side = (x: TradeOffer['give']) => [
    ...x.tiles.map((t) => gs.board.tiles[t].name + (gs.tiles[t].mortgaged ? ' (mortgaged)' : '')),
    ...(x.cash ? [money(x.cash)] : []),
    ...(x.gojf ? [`${x.gojf} Get Out of Jail Free card${x.gojf === 1 ? '' : 's'}`] : []),
  ];
  return { gets: side(theirs), gives: side(mine), promises: o.promises.map((p) => promiseText(gs, p)) };
}

export function offerProblem(gs: State, o: TradeOffer): string | null {
  return validateOffer(gs, o);
}

/** Tiles a rent-free promise can cover: the promiser must own it after the trade. */
export function promiseTiles(gs: State, o: TradeOffer, promiser: number): number[] {
  const owned = gs.board.tiles.filter((t) => gs.tiles[t.index].owner === promiser && t.price !== undefined).map((t) => t.index);
  const leaving = promiser === o.from ? o.give.tiles : o.get.tiles;
  const arriving = promiser === o.from ? o.get.tiles : o.give.tiles;
  return [...owned.filter((t) => !leaving.includes(t)), ...arriving];
}
