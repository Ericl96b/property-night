// Card data for the shared GameCard (Stage 3 §2). Everything a player can own or trade is
// drawn as a card: deeds (or their mortgaged back), Get Out of Jail Free, cash, promise vouchers.
import {
  countOwned,
  mortgageValue,
  promiseGroupOf,
  unmortgageCost,
  type DeckId,
  type PromiseGroup,
  type PromiseTerm,
  type State,
} from '../../engine';
import { GROUP_LABEL, uiGroupColor, uiGroupLight } from '../groups';
import type { Glyph } from '../present';

/** One footer prompt: glyph coins (stacked) and a label. */
export type Prompt = { glyphs: Glyph[]; label: string; /** Mouse: clicking the prompt does the same thing. */ onclick?: () => void };

export type CardSize = 'thumb' | 'std' | 'detail';

export const CARD_SIZE: Record<CardSize, [number, number]> = { thumb: [92, 122], std: [200, 266], detail: [360, 480] };

export interface DeedCard {
  t: 'deed';
  tile: number;
  kind: 'street' | 'railroad' | 'utility';
  name: string;
  group: PromiseGroup;
  color: string;
  light: boolean;
  /** 0–4 houses, 5 = hotel. */
  buildings: number;
  mortgaged: boolean;
  price: number;
  /** Streets: [base, 1h…4h, hotel]. Railroads: [1…4 owned]. */
  rents: number[];
  houseCost: number;
  mortgage: number;
  unmortgage: number;
  /** Railroads the owner holds (highlights the live rent row). */
  ownedInGroup: number;
  /** Utility rent multipliers [one, both]. */
  multipliers: [number, number];
  utility?: 'power' | 'water';
  /** Owner has the full color set (live rent doubles on unimproved lots). */
  fullSet: boolean;
}

export interface JailCard {
  t: 'gojf';
  deck: DeckId;
}

export interface CashCard {
  t: 'cash';
  amount: number;
  sub?: string;
}

export interface VoucherCard {
  t: 'voucher';
  kind: PromiseTerm['kind'];
  group: PromiseGroup;
  groupLabel: string;
  color: string;
  light: boolean;
  total: number;
  left: number;
  by: { name: string; color: string };
  to: { name: string; color: string };
}

export type CardItem = DeedCard | JailCard | CashCard | VoucherCard;

export function deedCard(s: State, tile: number): DeedCard {
  const t = s.board.tiles[tile];
  const ts = s.tiles[tile];
  const group = promiseGroupOf(s.board, tile)!;
  const owner = ts.owner;
  const groupTiles = s.board.tiles.filter((x) => promiseGroupOf(s.board, x.index) === group);
  return {
    t: 'deed',
    tile,
    kind: t.type === 'railroad' ? 'railroad' : t.type === 'utility' ? 'utility' : 'street',
    name: t.name,
    group,
    color: uiGroupColor(s.board, group),
    light: uiGroupLight(s.board, group),
    buildings: ts.buildings,
    mortgaged: ts.mortgaged,
    price: t.price ?? 0,
    rents: t.rents ?? [],
    houseCost: t.houseCost ?? 0,
    mortgage: mortgageValue(s, tile),
    unmortgage: unmortgageCost(s, tile),
    ownedInGroup: owner === null ? 0 : t.type === 'railroad' || t.type === 'utility' ? countOwned(s, owner, t.type) : groupTiles.filter((x) => s.tiles[x.index].owner === owner).length,
    multipliers: s.board.utilityMultipliers ?? [4, 10],
    utility: t.utility,
    fullSet: owner !== null && t.type === 'street' && groupTiles.every((x) => s.tiles[x.index].owner === owner),
  };
}

export function voucherCard(s: State, p: PromiseTerm): VoucherCard {
  return {
    t: 'voucher',
    kind: p.kind,
    group: p.group,
    groupLabel: GROUP_LABEL[p.group],
    color: uiGroupColor(s.board, p.group),
    light: uiGroupLight(s.board, p.group),
    total: p.total,
    left: p.left,
    by: { name: s.seats[p.from].name, color: s.seats[p.from].color },
    to: { name: s.seats[p.to].name, color: s.seats[p.to].color },
  };
}

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Live rent for the deed in its owner's hands (detail pane, Stage 3 §3). */
export function liveRentIndex(d: DeedCard): number {
  if (d.kind === 'railroad') return Math.max(0, d.ownedInGroup - 1);
  if (d.kind === 'street') return d.buildings;
  return -1;
}

/** Up to 6 banknotes for a cash stack, largest first. */
export function notesFor(amount: number, max = 6): number[] {
  const out: number[] = [];
  let left = Math.round(amount);
  for (const d of [500, 100, 50, 20, 10, 5, 1]) while (left >= d && out.length < max) (out.push(d), (left -= d));
  return out;
}

/** A slot with no card: a property the viewer doesn't own (owner's dot and name, or "Unowned"). */
export interface EmptyInfo {
  name: string;
  /** Street band color, or null for railroads / utilities. */
  band: string | null;
  icon?: string;
  owner: { name: string; color: string } | null;
  /** Caption instead of "Unowned" (e.g. "In deck"). */
  note?: string;
}
