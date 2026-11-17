// Read-only rule queries shared by the reducer, legalActions, bots and UI.
import type { BoardData, GroupId, Tile } from '../data/classicBoard';
import type { State } from './types';

const groupCache = new WeakMap<BoardData, Map<GroupId, number[]>>();

export function groupTiles(board: BoardData, group: GroupId): number[] {
  let m = groupCache.get(board);
  if (!m) {
    m = new Map();
    for (const t of board.tiles) if (t.group) m.set(t.group, [...(m.get(t.group) ?? []), t.index]);
    groupCache.set(board, m);
  }
  return m.get(group) ?? [];
}

export const isOwnable = (t: Tile) => t.type === 'street' || t.type === 'railroad' || t.type === 'utility';

export function ownsGroup(s: State, seat: number, group: GroupId): boolean {
  return groupTiles(s.board, group).every((i) => s.tiles[i].owner === seat);
}

export function groupHasBuildings(s: State, tile: number): boolean {
  const g = s.board.tiles[tile].group;
  return g ? groupTiles(s.board, g).some((i) => s.tiles[i].buildings > 0) : false;
}

export function mortgageValue(s: State, tile: number): number {
  const t = s.board.tiles[tile];
  if (s.rules.mortgagePercent === 50 && t.mortgage !== undefined) return t.mortgage;
  return Math.round(((t.price ?? 0) * s.rules.mortgagePercent) / 100);
}

export function unmortgageInterest(s: State, tile: number): number {
  return Math.ceil((mortgageValue(s, tile) * s.rules.unmortgageInterestPercent) / 100);
}

export function unmortgageCost(s: State, tile: number): number {
  return mortgageValue(s, tile) + unmortgageInterest(s, tile);
}

export function buildingSellValue(s: State, tile: number): number {
  return Math.floor(((s.board.tiles[tile].houseCost ?? 0) * s.rules.sellBackPercent) / 100);
}

export function countOwned(s: State, seat: number, type: Tile['type']): number {
  return s.board.tiles.filter((t) => t.type === type && s.tiles[t.index].owner === seat).length;
}

export interface RentMods {
  railroadMultiplier?: number;
  /** Card: pay 10× a fresh roll (the roll total is passed in). */
  utilityRollTotal?: number;
}

/** Rent owed on `tile` by someone other than the owner (0 when none is due). */
export function rentFor(s: State, tile: number, diceTotal: number, mods: RentMods = {}): number {
  const t = s.board.tiles[tile];
  const ts = s.tiles[tile];
  if (ts.owner === null || ts.mortgaged) return 0;
  const owner = ts.owner;
  if (t.type === 'street') {
    if (ts.buildings > 0) return t.rents![ts.buildings];
    const base = t.rents![0];
    return ownsGroup(s, owner, t.group!) ? Math.round(base * s.rules.unimprovedSetMultiplier) : base;
  }
  if (t.type === 'railroad') {
    const n = countOwned(s, owner, 'railroad');
    return t.rents![n - 1] * (mods.railroadMultiplier ?? 1);
  }
  if (t.type === 'utility') {
    if (mods.utilityRollTotal !== undefined) return 10 * mods.utilityRollTotal;
    const n = countOwned(s, owner, 'utility');
    return (n >= 2 ? 10 : 4) * diceTotal;
  }
  return 0;
}

/** Cash a player could raise by selling every building and mortgaging every lot. */
export function liquidationValue(s: State, seat: number): number {
  let v = s.players[seat].cash;
  for (const t of s.board.tiles) {
    const ts = s.tiles[t.index];
    if (ts.owner !== seat) continue;
    v += ts.buildings * buildingSellValue(s, t.index);
    if (!ts.mortgaged) v += mortgageValue(s, t.index);
  }
  return v;
}

/** Cash + property prices + building costs (used for "% of net worth" taxes and stats). */
export function netWorth(s: State, seat: number): number {
  let v = s.players[seat].cash;
  for (const t of s.board.tiles) {
    const ts = s.tiles[t.index];
    if (ts.owner !== seat) continue;
    v += ts.mortgaged ? (t.price ?? 0) - mortgageValue(s, t.index) : (t.price ?? 0);
    v += ts.buildings * (t.houseCost ?? 0);
  }
  return v;
}

export function isBankBot(s: State, seat: number): boolean {
  return s.seats[seat].kind === 'bankBot';
}

export function alive(s: State, seat: number): boolean {
  return !s.players[seat].bankrupt;
}

/** Houses and hotels currently owned by a player (for repair cards). */
export function buildingCounts(s: State, seat: number): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const ts of s.tiles) {
    if (ts.owner !== seat) continue;
    if (ts.buildings === 5) hotels++;
    else houses += ts.buildings;
  }
  return { houses, hotels };
}

// ---- building legality ---------------------------------------------------------------

const MANAGE_PHASES = new Set(['preRoll', 'buy', 'postRoll', 'debt']);

function managePhaseOk(s: State, seat: number): boolean {
  if (!MANAGE_PHASES.has(s.phase)) return false;
  if (s.phase === 'debt') return s.debts[0]?.from === seat;
  return true;
}

/** Why `seat` cannot build one level on `tile`, or null if it can. */
export function buildBlocker(s: State, seat: number, tile: number): string | null {
  const t = s.board.tiles[tile];
  const ts = s.tiles[tile];
  if (!managePhaseOk(s, seat) || s.phase === 'debt') return 'not now';
  if (s.rules.buildTiming === 'ownTurn' && s.turn.seat !== seat) return 'only on your own turn';
  if (t.type !== 'street' || !t.group) return 'not a street';
  if (ts.owner !== seat) return 'not yours';
  if (!ownsGroup(s, seat, t.group)) return 'needs the full color set';
  const group = groupTiles(s.board, t.group);
  if (!s.rules.buildWithMortgagedInSet && group.some((i) => s.tiles[i].mortgaged)) return 'a lot in the set is mortgaged';
  if (ts.mortgaged) return 'mortgaged';
  if (ts.buildings >= 5) return 'already has a hotel';
  if (s.rules.evenBuilding) {
    const min = Math.min(...group.map((i) => s.tiles[i].buildings));
    if (ts.buildings > min) return 'build evenly across the set';
  }
  if (ts.buildings === 4) {
    if (s.bank.hotels <= 0) return 'no hotels left in the bank';
  } else if (s.bank.houses <= 0) return 'no houses left in the bank';
  if (s.players[seat].cash < (t.houseCost ?? 0)) return 'not enough cash';
  return null;
}

export function sellBlocker(s: State, seat: number, tile: number): string | null {
  const ts = s.tiles[tile];
  if (!managePhaseOk(s, seat)) return 'not now';
  if (ts.owner !== seat) return 'not yours';
  if (ts.buildings <= 0) return 'no buildings';
  const g = s.board.tiles[tile].group;
  if (s.rules.evenBuilding && g) {
    const max = Math.max(...groupTiles(s.board, g).map((i) => s.tiles[i].buildings));
    if (ts.buildings < max) return 'sell evenly across the set';
  }
  return null;
}

export function mortgageBlocker(s: State, seat: number, tile: number): string | null {
  const ts = s.tiles[tile];
  if (!managePhaseOk(s, seat)) return 'not now';
  if (ts.owner !== seat) return 'not yours';
  if (ts.mortgaged) return 'already mortgaged';
  if (groupHasBuildings(s, tile)) return 'sell the buildings in this set first';
  return null;
}

export function unmortgageBlocker(s: State, seat: number, tile: number): string | null {
  const ts = s.tiles[tile];
  if (!managePhaseOk(s, seat) || s.phase === 'debt') return 'not now';
  if (ts.owner !== seat) return 'not yours';
  if (!ts.mortgaged) return 'not mortgaged';
  if (s.players[seat].cash < unmortgageCost(s, tile)) return 'not enough cash';
  return null;
}
