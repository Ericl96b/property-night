// Save and resume (SPEC §9, §12): autosave after every action, up to 10 named slots,
// export/import JSON. Format: { version, createdAt, rulesPreset (copy), boardPreset (copy),
// seats, seed, actions, snapshot, view: { cameraSide } }.
import { checkInvariants, promiseGroupOf, samePromise, type Action, type Card, type DeckId, type Rules, type Seat, type State } from '../engine';
import type { BoardData } from '../data/classicBoard';
import type { KV } from '../storage/db';

/** v3 (Stage 3): group promises replace tile promises. v2 saves are migrated on load. */
export const SAVE_VERSION = 3;
export const MAX_SLOTS = 10;
export const AUTOSAVE_ID = 'autosave';

export interface SaveFile {
  id: string;
  name: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  rulesPreset: { name: string; rules: Rules };
  boardPreset: { name: string; board: BoardData; decks: Record<DeckId, Card[]> };
  seats: Seat[];
  seed: number;
  actions: Action[];
  snapshot: State;
  view: { cameraSide: number };
  /** Short summary for the load screen. */
  summary: string;
}

export function summarize(s: State): string {
  const alive = s.seats.filter((_, i) => !s.players[i].bankrupt).map((x) => x.name);
  return `Turn ${s.turnNumber} · ${alive.join(', ')}`;
}

export function makeSave(
  id: string,
  name: string,
  state: State,
  actions: Action[],
  seed: number,
  cameraSide: number,
  meta: { rulesName?: string; boardName?: string; createdAt?: number } = {},
): SaveFile {
  const now = Date.now();
  return {
    id,
    name,
    version: SAVE_VERSION,
    createdAt: meta.createdAt ?? now,
    updatedAt: now,
    rulesPreset: { name: meta.rulesName ?? 'Game rules', rules: state.rules },
    boardPreset: { name: meta.boardName ?? 'Game board', board: state.board, decks: state.decks },
    seats: state.seats,
    seed,
    actions: [...actions],
    snapshot: state,
    view: { cameraSide },
    summary: summarize(state),
  };
}

interface OldPromise {
  id?: number;
  kind: string;
  from: number;
  to: number;
  tileId?: number;
  turnsLeft?: number;
}

/** v2 tile promise → v3 group promise (the tile's group, left = total = turnsLeft). Null if unusable. */
function migratePromise(board: BoardData, p: OldPromise) {
  if ((p as { group?: string }).group !== undefined) return p as unknown as State['promises'][number];
  const group = p.tileId !== undefined ? promiseGroupOf(board, p.tileId) : null;
  const n = Math.max(1, Math.min(99, Math.floor(p.turnsLeft ?? 1)));
  if (!group) return null;
  return { id: p.id ?? 0, kind: 'rentFree' as const, from: p.from, to: p.to, group, total: n, left: n };
}

/**
 * Bring an older save up to SAVE_VERSION in place (Stage 3 §5.3): tile-based rent-free promises
 * become group promises, duplicates are merged. Safe to call on any object; returns it.
 */
export function migrateSave<T>(f: T): T {
  const s = f as Partial<SaveFile> | null;
  if (!s || typeof s !== 'object' || s.version !== 2) return f;
  const snap = s.snapshot as State | undefined;
  if (snap && Array.isArray(snap.promises) && snap.board) {
    const merged: State['promises'] = [];
    for (const old of snap.promises as unknown as OldPromise[]) {
      const p = migratePromise(snap.board, old);
      if (!p) continue;
      const same = merged.find((q) => samePromise(q, p));
      if (same) {
        same.left += p.left;
        same.total += p.total;
      } else merged.push(p);
    }
    snap.promises = merged;
    if (snap.trade?.promises) {
      const terms = (snap.trade.promises as unknown as OldPromise[]).map((p) => migratePromise(snap.board, p)).filter((p) => p !== null);
      snap.trade.promises = terms.filter((p, i) => terms.findIndex((q) => samePromise(q, p)) === i).map(({ kind, from, to, group, total, left }) => ({ kind, from, to, group, total, left }));
    }
  }
  s.version = SAVE_VERSION;
  return f;
}

/** Validate a save (imported JSON or from storage). Returns an error message or null. Migrates older versions first. */
export function saveProblem(f: unknown): string | null {
  const s = migrateSave(f as Partial<SaveFile>);
  if (!s || typeof s !== 'object') return 'That file is not a Property Night save.';
  if (s.version !== SAVE_VERSION) return `Unsupported save version ${String(s.version)}.`;
  if (!s.snapshot || typeof s.snapshot !== 'object' || !Array.isArray(s.snapshot.players) || !Array.isArray(s.snapshot.tiles)) return 'The save has no game state.';
  if (!Array.isArray(s.actions)) return 'The save has no action list.';
  try {
    const errors = checkInvariants(s.snapshot as State);
    if (errors.length) return `The saved game is inconsistent: ${errors[0]}`;
  } catch {
    return 'The saved game could not be read.';
  }
  return null;
}

export class Saves {
  constructor(private kv: KV) {}

  async list(): Promise<SaveFile[]> {
    const all = (await this.kv.list<SaveFile>('saves')).map((f) => migrateSave(f));
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async slots(): Promise<SaveFile[]> {
    return (await this.list()).filter((s) => s.id !== AUTOSAVE_ID);
  }

  async get(id: string): Promise<SaveFile | undefined> {
    return migrateSave(await this.kv.get<SaveFile>('saves', id));
  }

  async autosave(f: SaveFile): Promise<void> {
    await this.kv.put('saves', { ...f, id: AUTOSAVE_ID, name: 'Autosave' });
  }

  async continueGame(): Promise<SaveFile | undefined> {
    const a = await this.get(AUTOSAVE_ID);
    return a && !saveProblem(a) && a.snapshot.phase !== 'gameOver' ? a : undefined;
  }

  /** Save into slot 1–10 (overwrites that slot). */
  async saveSlot(slot: number, f: SaveFile): Promise<SaveFile> {
    if (slot < 1 || slot > MAX_SLOTS) throw new Error(`Slots are 1–${MAX_SLOTS}.`);
    const id = `slot-${slot}`;
    const existing = await this.get(id);
    const out = { ...f, id, createdAt: existing?.createdAt ?? f.createdAt };
    await this.kv.put('saves', out);
    return out;
  }

  async remove(id: string): Promise<void> {
    await this.kv.delete('saves', id);
  }

  exportJSON(f: SaveFile): string {
    return JSON.stringify({ format: 'property-night/save', ...f });
  }

  parseImport(text: string): SaveFile {
    let data: SaveFile & { format?: string };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    if (data.format !== 'property-night/save') throw new Error('That file is not a Property Night save.');
    const why = saveProblem(data);
    if (why) throw new Error(why);
    delete data.format;
    return data;
  }
}
