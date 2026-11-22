// Sandbox board layouts for the benchmark and the test board (Batch 4, SPEC-benchmark §3.2, §4.2).
// Pure data: a State from newGame used only as a description of what to draw. It is never
// dispatched, never given to the game controller and never saved.
import { CLASSIC_BOARD, type BoardData, type GroupId } from '../data/classicBoard';
import { newGame, type State } from '../engine';
import { groupTiles } from '../engine/queries';
import { PLAYER_COLORS } from '../ui/theme';
import { COLOR_GROUP_ORDER } from '../engine/promises';

export type PresetId = 'empty' | 'allHouses' | 'allHotels' | 'worstCase' | 'oneGroup';
export type TokenCount = 0 | 2 | 6;

export const GROUP_ORDER: GroupId[] = COLOR_GROUP_ORDER;
// Seat 2 is the Gummy Bear so the 2-token view compares it directly with the teacup (Stage 1 §5).
export const SANDBOX_TOKENS = ['teacup', 'gummy', 'bicycle', 'cat', 'rocket', 'crown'];
/** Where tokens stand: one per side, two more, the sixth in jail. */
const TOKEN_SPOTS = [1, 16, 21, 26, 37, 10];
const JAILED = 5;

/** Six seats (all six owner colors available); tokens beyond `tokens` are hidden. */
export function sandboxState(board: BoardData = CLASSIC_BOARD, tokens: TokenCount = 6): State {
  const s = newGame({
    seed: 1,
    turnOrder: 'fixed',
    board,
    seats: SANDBOX_TOKENS.map((token, i) => ({ kind: 'human' as const, name: `Player ${i + 1}`, token, color: PLAYER_COLORS[i] })),
  });
  placeTokens(s, tokens);
  return s;
}

/** Show 0, 2 or 6 tokens spread over the sides (the sixth in jail). Hidden seats are marked out. */
export function placeTokens(s: State, n: TokenCount): void {
  s.players.forEach((p, i) => {
    p.bankrupt = i >= n;
    p.position = TOKEN_SPOTS[i];
    p.jail = i === JAILED && n > JAILED ? { attempts: 0 } : null;
  });
}

export const streets = (s: State) => s.board.tiles.filter((t) => t.type === 'street').map((t) => t.index);
const priced = (s: State) => s.board.tiles.filter((t) => t.price).map((t) => t.index);

function clearTiles(s: State): void {
  for (const t of s.tiles) {
    t.owner = null;
    t.buildings = 0;
    t.mortgaged = false;
  }
  for (const p of s.players) p.loans = [];
  s.promises = [];
}

/** Apply a preset to the tiles (tokens are left as they are). `group` is for One group. */
export function applyPreset(s: State, preset: PresetId, group: GroupId = 'brown'): void {
  clearTiles(s);
  switch (preset) {
    case 'empty':
      return;
    case 'allHouses':
    case 'allHotels':
      for (const i of streets(s)) {
        s.tiles[i].owner = 0;
        s.tiles[i].buildings = preset === 'allHouses' ? 4 : 5;
      }
      return;
    case 'oneGroup': {
      const [a, b] = groupTiles(s.board, group);
      for (const i of groupTiles(s.board, group)) s.tiles[i].owner = 0;
      if (a !== undefined) s.tiles[a].buildings = 4;
      if (b !== undefined) s.tiles[b].buildings = 5;
      return;
    }
    case 'worstCase':
      worstCase(s);
      return;
  }
}

/**
 * The benchmark scene (§3.2): every property owned by six colors, every street built with hotels
 * and 4 houses alternating street by street (so each group shows its house and hotel designs),
 * some railroads/utilities mortgaged, two pledged to a loan and one promise ribbon.
 */
function worstCase(s: State): void {
  priced(s).forEach((i, k) => (s.tiles[i].owner = k % 6));
  for (const g of GROUP_ORDER) groupTiles(s.board, g).forEach((i, k) => (s.tiles[i].buildings = k % 2 === 0 ? 5 : 4));
  const rails = s.board.tiles.filter((t) => t.type === 'railroad').map((t) => t.index);
  const utils = s.board.tiles.filter((t) => t.type === 'utility').map((t) => t.index);
  const mortgaged = [rails[0], rails[2], utils[0]].filter((x) => x !== undefined);
  for (const i of mortgaged) s.tiles[i].mortgaged = true;
  const pledged = [rails[1], utils[1]].filter((x) => x !== undefined);
  for (const i of pledged) {
    const owner = s.tiles[i].owner!;
    s.players[owner].loans.push({ id: s.nextLoanId++, principal: 100, rate: 10, passesLeft: 3, collateral: [i], secured: true });
  }
  const promiseTile = rails[3] ?? priced(s)[0];
  const from = s.tiles[promiseTile].owner!;
  s.promises.push({ id: s.nextPromiseId++, kind: 'rentFree', from, to: (from + 1) % 6, group: 'railroad', total: 3, left: 3 });
}

// --- test-board edits (no rules: even building, sets and bank supply are ignored) -------------

export const isStreet = (s: State, tile: number) => s.board.tiles[tile]?.type === 'street';
export const isPriced = (s: State, tile: number) => !!s.board.tiles[tile]?.price;
export const isPledged = (s: State, tile: number) => s.players.some((p) => p.loans.some((l) => l.collateral.includes(tile)));

/** 0 → 4 houses → hotel. Returns false when there is nothing to change. */
export function addBuilding(s: State, tile: number): boolean {
  if (!isStreet(s, tile) || s.tiles[tile].buildings >= 5) return false;
  s.tiles[tile].buildings++;
  return true;
}

export function removeBuilding(s: State, tile: number): boolean {
  if (!isStreet(s, tile) || s.tiles[tile].buildings <= 0) return false;
  s.tiles[tile].buildings--;
  return true;
}

/** None → seat 0 … seat 5 → none. */
export function cycleOwner(s: State, tile: number): void {
  if (!isPriced(s, tile)) return;
  const o = s.tiles[tile].owner;
  s.tiles[tile].owner = o === null ? 0 : o >= 5 ? null : o + 1;
}

export function toggleMortgage(s: State, tile: number): void {
  if (isPriced(s, tile)) s.tiles[tile].mortgaged = !s.tiles[tile].mortgaged;
}

export function togglePledge(s: State, tile: number): void {
  if (!isPriced(s, tile)) return;
  if (isPledged(s, tile)) {
    for (const p of s.players) p.loans = p.loans.filter((l) => !l.collateral.includes(tile));
  } else {
    s.players[s.tiles[tile].owner ?? 0].loans.push({ id: s.nextLoanId++, principal: 100, rate: 10, passesLeft: 3, collateral: [tile], secured: true });
  }
}
