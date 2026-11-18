// Save and resume (SPEC §9, §12): autosave after every action, up to 10 named slots,
// export/import JSON. Format: { version, createdAt, rulesPreset (copy), boardPreset (copy),
// seats, seed, actions, snapshot, view: { cameraSide } }.
import { checkInvariants, type Action, type Card, type DeckId, type Rules, type Seat, type State } from '../engine';
import type { BoardData } from '../data/classicBoard';
import type { KV } from '../storage/db';

export const SAVE_VERSION = 1;
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

/** Validate a save (imported JSON or from storage). Returns an error message or null. */
export function saveProblem(f: unknown): string | null {
  const s = f as Partial<SaveFile>;
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
    const all = await this.kv.list<SaveFile>('saves');
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async slots(): Promise<SaveFile[]> {
    return (await this.list()).filter((s) => s.id !== AUTOSAVE_ID);
  }

  async get(id: string): Promise<SaveFile | undefined> {
    return this.kv.get<SaveFile>('saves', id);
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
