// Group promises (Stage 3 §5). A promise covers a whole group:
//  - rentFree: `to` pays `from` no rent on any tile of `group` that `from` owns, for `left` landings.
//  - noBuild:  `from` can't build on the color set `group` for `left` rounds, counted at the
//    anchor seat's turn starts.
import type { BoardData, GroupId } from '../data/classicBoard';
import type { GamePromise, PromiseGroup, PromiseKind, State } from './types';

/** Color sets in board order (Stage 3 §2). */
export const COLOR_GROUP_ORDER: GroupId[] = ['brown', 'lightBlue', 'yellow', 'orange', 'red', 'pink', 'green', 'darkBlue'];
/** Every promise group in board order: color sets, then railroads, then utilities. */
export const PROMISE_GROUP_ORDER: PromiseGroup[] = [...COLOR_GROUP_ORDER, 'railroad', 'utility'];

export const PROMISE_LIMITS: Record<PromiseKind, number> = { rentFree: 99, noBuild: 20 };

export function isColorGroup(g: string): g is GroupId {
  return (COLOR_GROUP_ORDER as string[]).includes(g);
}

export function isPromiseGroup(g: string): g is PromiseGroup {
  return (PROMISE_GROUP_ORDER as string[]).includes(g);
}

/** The promise group a tile belongs to, or null (not a property). */
export function promiseGroupOf(board: BoardData, tile: number): PromiseGroup | null {
  const t = board.tiles[tile];
  if (!t) return null;
  if (t.type === 'street' && t.group) return t.group;
  if (t.type === 'railroad') return 'railroad';
  if (t.type === 'utility') return 'utility';
  return null;
}

export function tilesInPromiseGroup(board: BoardData, group: PromiseGroup): number[] {
  return board.tiles.filter((t) => promiseGroupOf(board, t.index) === group).map((t) => t.index);
}

export function ownsInGroup(s: State, seat: number, group: PromiseGroup): boolean {
  return tilesInPromiseGroup(s.board, group).some((i) => s.tiles[i].owner === seat);
}

/** Active rent-free promise that waives rent for `payer` landing on `tile` owned by `owner`. */
export function rentFreePromise(s: State, payer: number, owner: number, tile: number): GamePromise | undefined {
  const g = promiseGroupOf(s.board, tile);
  return s.promises.find((p) => p.kind === 'rentFree' && p.to === payer && p.from === owner && p.group === g && p.left > 0);
}

/** Active no-building promise that stops `seat` building on the set of `tile`. */
export function noBuildPromise(s: State, seat: number, tile: number): GamePromise | undefined {
  const g = promiseGroupOf(s.board, tile);
  return s.promises.find((p) => p.kind === 'noBuild' && p.from === seat && p.group === g && p.left > 0);
}

export function noBuildReason(s: State, p: GamePromise): string {
  return `blocked by your promise to ${s.seats[p.to].name} (${p.left} ${p.left === 1 ? 'round' : 'rounds'} left)`;
}

/** Same promise for merging: kind, from, to and group match. */
export function samePromise(a: { kind: string; from: number; to: number; group: string }, b: typeof a): boolean {
  return a.kind === b.kind && a.from === b.from && a.to === b.to && a.group === b.group;
}

/**
 * Why promises are off for this game, or null. "bot": a normal bot was seated at the start
 * (Stage 3 §6, the lock covers promises and any future loan term in trades); "rules": the
 * rules turned them off.
 */
export function promisesLock(s: Pick<State, 'rules' | 'promisesLock'>): 'bot' | 'rules' | null {
  if (s.promisesLock === 'bot') return 'bot';
  return s.rules.promisesAllowed ? null : 'rules';
}

/** Setup-time check: does this seat line-up lock promises? Bank-backed bots don't. */
export function seatsLockPromises(kinds: readonly string[]): boolean {
  return kinds.includes('bot');
}
