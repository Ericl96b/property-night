// Board presets (SPEC §8): board (names, prices, rents, house costs, mortgages, group colors,
// railroad and utility values) + Chance/Community Chest decks. The classic 40-tile layout and
// positions are fixed. Built-in "Classic" is read-only. Changing the board preset regenerates
// the board texture (at game start, never during play).
import { CLASSIC_BOARD, type BoardData, type GroupId, type Tile } from '../data/classicBoard';
import { CLASSIC_CHANCE, CLASSIC_CHEST, type Card, type CardEffect, type DeckId, type Rules } from '../engine';
import type { KV } from '../storage/db';
import { newId } from './presets';

export interface BoardPreset {
  id: string;
  kind: 'board';
  name: string;
  builtIn?: boolean;
  board: BoardData;
  decks: Record<DeckId, Card[]>;
  updatedAt: number;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export const CLASSIC_BOARD_PRESET: BoardPreset = {
  id: 'classic-board',
  kind: 'board',
  name: 'Classic board',
  builtIn: true,
  board: clone(CLASSIC_BOARD),
  decks: { chance: clone(CLASSIC_CHANCE), chest: clone(CLASSIC_CHEST) },
  updatedAt: 0,
};

const int = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
};
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Keep the classic layout; take only editable fields from `raw`, clamped. */
export function normalizeBoard(raw: Partial<BoardData> | undefined): BoardData {
  const base = clone(CLASSIC_BOARD);
  if (!raw) return base;
  base.title = String(raw.title ?? base.title).slice(0, 40);
  base.subtitle = String(raw.subtitle ?? base.subtitle).slice(0, 60);
  base.goSalary = int(raw.goSalary, 0, 100_000, base.goSalary);
  const um = raw.utilityMultipliers;
  base.utilityMultipliers = [int(um?.[0], 0, 100, 4), int(um?.[1], 0, 100, 10)];
  for (const g of Object.keys(base.groups) as GroupId[]) {
    const c = raw.groups?.[g]?.color;
    if (c && HEX.test(c)) base.groups[g].color = c.toUpperCase();
    if (raw.groups?.[g]?.lightText !== undefined) base.groups[g].lightText = !!raw.groups[g].lightText;
  }
  base.tiles = base.tiles.map((t, i) => {
    const r = raw.tiles?.[i] as Partial<Tile> | undefined;
    if (!r) return t;
    const out: Tile = { ...t, name: String(r.name ?? t.name).slice(0, 28) || t.name };
    if (t.price !== undefined) out.price = int(r.price, 0, 100_000, t.price);
    if (t.mortgage !== undefined) out.mortgage = int(r.mortgage, 0, 100_000, t.mortgage);
    if (t.houseCost !== undefined) out.houseCost = int(r.houseCost, 0, 100_000, t.houseCost);
    if (t.rents) out.rents = t.rents.map((v, k) => int(r.rents?.[k], 0, 1_000_000, v));
    if (t.taxAmount !== undefined) out.taxAmount = int(r.taxAmount, 0, 100_000, t.taxAmount);
    return out;
  });
  return base;
}

const EFFECT_KINDS: CardEffect['kind'][] = ['collect', 'pay', 'collectFromEach', 'payEach', 'moveTo', 'nearestRailroad', 'nearestUtility', 'back', 'goToJail', 'getOutOfJail', 'repairs'];

export function normalizeCard(c: Partial<Card> | undefined): Card | null {
  if (!c || typeof c.text !== 'string' || !c.effect || !EFFECT_KINDS.includes(c.effect.kind)) return null;
  const e = c.effect as CardEffect & Record<string, unknown>;
  const text = c.text.slice(0, 200);
  switch (e.kind) {
    case 'collect':
    case 'pay':
    case 'collectFromEach':
    case 'payEach':
      return { text, effect: { kind: e.kind, amount: int(e.amount, 0, 100_000, 50) } };
    case 'moveTo':
      return { text, effect: { kind: 'moveTo', tile: int(e.tile, 0, 39, 0) } };
    case 'back':
      return { text, effect: { kind: 'back', spaces: int(e.spaces, 1, 39, 3) } };
    case 'repairs':
      return { text, effect: { kind: 'repairs', perHouse: int(e.perHouse, 0, 10_000, 25), perHotel: int(e.perHotel, 0, 10_000, 100) } };
    default:
      return { text, effect: { kind: e.kind } as CardEffect };
  }
}

export function normalizeDeck(raw: Partial<Card>[] | undefined, fallback: Card[]): Card[] {
  const cards = (raw ?? []).map(normalizeCard).filter((c): c is Card => !!c).slice(0, 40);
  if (!cards.length) return clone(fallback);
  // At most one Get Out of Jail Free card per deck.
  let seen = false;
  return cards.filter((c) => {
    if (c.effect.kind !== 'getOutOfJail') return true;
    if (seen) return false;
    seen = true;
    return true;
  });
}

/** Warnings shown in the editor (the board is still usable). */
export function boardWarnings(b: BoardData): string[] {
  const w: string[] = [];
  for (const t of b.tiles) {
    if (t.rents) for (let k = 1; k < t.rents.length; k++) if (t.rents[k] < t.rents[k - 1]) {
      w.push(`${t.name}: rents do not increase (${t.rents.join(' / ')})`);
      break;
    }
    if (t.price !== undefined && t.mortgage !== undefined && t.mortgage > t.price) w.push(`${t.name}: mortgage value is above the price`);
  }
  const names = b.tiles.filter((t) => t.price !== undefined).map((t) => t.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) w.push('Two properties share a name');
  return w;
}

export function deckWarnings(cards: Card[]): string[] {
  const w: string[] = [];
  if (cards.filter((c) => c.effect.kind === 'getOutOfJail').length > 1) w.push('Only one Get Out of Jail Free card per deck is kept');
  if (cards.some((c) => c.effect.kind === 'moveTo' && !c.text.includes('{tile}'))) w.push('Tip: write {tile} in a "move to" card so it follows renamed properties');
  return w;
}

/** The board as printed for a game: GO salary and tax lines follow the game's rules. */
export function printView(board: BoardData, rules: Rules): BoardData {
  const b = clone(board);
  b.goSalary = rules.goSalary;
  for (const t of b.tiles) {
    if (t.tax === 'income') {
      t.taxAmount = rules.incomeTaxFlat;
      t.taxLabel =
        rules.incomeTaxMode === 'flat' ? `Pay $${rules.incomeTaxFlat}` : rules.incomeTaxMode === 'percent' ? `Pay ${rules.incomeTaxPercent}%` : `$${rules.incomeTaxFlat} or ${rules.incomeTaxPercent}%`;
    } else if (t.tax === 'luxury') {
      t.taxAmount = rules.luxuryTax;
      t.taxLabel = `Pay $${rules.luxuryTax}`;
    }
  }
  return b;
}

export class BoardPresets {
  constructor(private kv: KV) {}

  async list(): Promise<BoardPreset[]> {
    const all = (await this.kv.list<BoardPreset & { kind: string }>('presets')).filter((p) => p.kind === 'board');
    all.sort((a, b) => a.name.localeCompare(b.name));
    return [CLASSIC_BOARD_PRESET, ...all];
  }

  async get(id: string): Promise<BoardPreset> {
    if (id === CLASSIC_BOARD_PRESET.id) return CLASSIC_BOARD_PRESET;
    return (await this.kv.get<BoardPreset>('presets', id)) ?? CLASSIC_BOARD_PRESET;
  }

  async save(p: BoardPreset): Promise<BoardPreset> {
    if (p.builtIn) throw new Error('Built-in presets are read-only — duplicate to edit.');
    const clean: BoardPreset = {
      id: p.id,
      kind: 'board',
      name: p.name.trim() || 'Untitled board',
      board: normalizeBoard(p.board),
      decks: { chance: normalizeDeck(p.decks?.chance, CLASSIC_CHANCE), chest: normalizeDeck(p.decks?.chest, CLASSIC_CHEST) },
      updatedAt: Date.now(),
    };
    await this.kv.put('presets', clean);
    return clean;
  }

  async duplicate(p: BoardPreset, name?: string): Promise<BoardPreset> {
    return this.save({ ...clone(p), id: newId('board'), builtIn: undefined, name: name ?? `${p.name} copy` });
  }

  async rename(p: BoardPreset, name: string): Promise<BoardPreset> {
    return this.save({ ...p, name });
  }

  async remove(p: BoardPreset): Promise<void> {
    if (p.builtIn) throw new Error('Built-in presets cannot be deleted.');
    await this.kv.delete('presets', p.id);
  }

  exportJSON(p: BoardPreset): string {
    return JSON.stringify({ format: 'property-night/board', version: 1, name: p.name, board: p.board, decks: p.decks }, null, 2);
  }

  async importJSON(text: string): Promise<BoardPreset> {
    let data: { format?: string; name?: string; board?: Partial<BoardData>; decks?: Partial<Record<DeckId, Card[]>> };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    if (data.format !== 'property-night/board' || typeof data.board !== 'object') throw new Error('That file is not a Property Night board preset.');
    return this.save({
      id: newId('board'),
      kind: 'board',
      name: String(data.name ?? 'Imported board'),
      board: data.board as BoardData,
      decks: { chance: data.decks?.chance ?? CLASSIC_CHANCE, chest: data.decks?.chest ?? CLASSIC_CHEST },
      updatedAt: Date.now(),
    });
  }
}

/** Scale a color group's prices, rents, house costs and mortgages by `factor`. */
export function scaleGroup(board: BoardData, group: GroupId, factor: number): void {
  const r = (v: number) => Math.max(0, Math.round((v * factor) / 5) * 5 || Math.round(v * factor));
  for (const t of board.tiles) {
    if (t.group !== group) continue;
    if (t.price !== undefined) t.price = r(t.price);
    if (t.mortgage !== undefined) t.mortgage = r(t.mortgage);
    if (t.houseCost !== undefined) t.houseCost = r(t.houseCost);
    if (t.rents) t.rents = t.rents.map((v) => Math.max(1, Math.round(v * factor)));
  }
}
