import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { AUTOSAVE_ID, SAVE_VERSION, Saves, makeSave, saveProblem } from '../../src/app/saves';
import { apply, newGame, type Action, type State } from '../../src/engine';
import { chooseAction } from '../../src/bots';
import { seatsToAct } from '../../src/engine';
import { memoryKV } from '../../src/storage/db';
import { edit, own } from '../engine/helpers';

const noTimers = { now: () => 0, setTimeout: () => 0, clearTimeout: () => {} };
const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'bot' as const, name: `B${i}` }));

/** Drive a state with bots until `stop` holds (or the cap). Returns the actions taken. */
function driveUntil(s0: State, stop: (s: State) => boolean, cap = 20000): { s: State; actions: Action[] } {
  let s = s0;
  const actions: Action[] = [];
  for (let k = 0; k < cap && s.phase !== 'gameOver' && !stop(s); k++) {
    let a: Action | null = null;
    for (const seat of seatsToAct(s)) if ((a = chooseAction(s, seat))) break;
    a ??= s.phase === 'auction' ? { type: 'auctionTimeout', seat: -1 } : null;
    if (!a) break;
    s = apply(s, a).state;
    actions.push(a);
  }
  return { s, actions };
}

describe('save and resume (SPEC §9, §15)', () => {
  for (const phase of ['auction', 'trade'] as const) {
    it(`saved mid-${phase}, reloaded, continues identically (including camera side)`, async () => {
      const kv = new Saves(memoryKV());
      const start = newGame({ seats: seats(4), seed: phase === 'auction' ? 3 : 11, turnOrder: 'fixed' });
      const { s: mid, actions } = driveUntil(start, (s) => s.phase === phase);
      expect(mid.phase).toBe(phase);
      await kv.saveSlot(1, makeSave('slot-1', 'Test', mid, actions, 3, 2));
      const loaded = JSON.parse(JSON.stringify(await kv.get('slot-1')));
      expect(saveProblem(loaded)).toBeNull();
      expect(loaded.view.cameraSide).toBe(2);
      // The original keeps going; the reloaded copy continues with the same decisions.
      const a = driveUntil(mid, () => false, 3000);
      let b = loaded.snapshot as State;
      for (const act of a.actions) b = apply(b, act).state;
      expect(JSON.stringify(b)).toBe(JSON.stringify(a.s));
      // The action log replays from the seed to the saved snapshot.
      let r = start;
      for (const act of loaded.actions) r = apply(r, act).state;
      expect(JSON.stringify(r)).toBe(JSON.stringify(mid));
    });
  }

  it('autosave is the Continue game; finished games are not offered', async () => {
    const kv = new Saves(memoryKV());
    const s = newGame({ seats: seats(2), seed: 1 });
    await kv.autosave(makeSave(AUTOSAVE_ID, 'Autosave', s, [], 1, 0));
    expect(await kv.continueGame()).toBeDefined();
    await kv.autosave(makeSave(AUTOSAVE_ID, 'Autosave', { ...s, phase: 'gameOver' }, [], 1, 0));
    expect(await kv.continueGame()).toBeUndefined();
    expect(await kv.slots()).toEqual([]);
  });

  it('up to 10 slots; export/import round trip; bad files are rejected', async () => {
    const kv = new Saves(memoryKV());
    const f = makeSave('x', 'Mine', newGame({ seats: seats(2), seed: 5 }), [], 5, 1);
    await expect(kv.saveSlot(11, f)).rejects.toThrow(/1–10/);
    const saved = await kv.saveSlot(10, f);
    expect(saved.id).toBe('slot-10');
    expect(kv.parseImport(kv.exportJSON(saved)).name).toBe('Mine');
    expect(() => kv.parseImport('{"format":"property-night/save","version":99}')).toThrow(/version/);
    expect(() => kv.parseImport('{oops')).toThrow(/valid JSON/);
  });

  it('controller records every action and the seed', () => {
    const c = new GameController(null, noTimers);
    c.start({ seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], seed: 42, turnOrder: 'fixed' });
    c.dispatch({ type: 'roll', seat: 0 });
    expect(c.seed).toBe(42);
    expect(c.actions).toEqual([{ type: 'roll', seat: 0 }]);
  });
});

describe('undo (SPEC §9)', () => {
  const ctl = () => {
    const c = new GameController(null, noTimers);
    c.start({ seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], seed: 1, turnOrder: 'fixed' });
    c.load(edit(c.state, (d) => own(d, 0, 6, 8, 9)));
    return c;
  };

  it('undoes the last decision (build) and the action log', () => {
    const c = ctl();
    c.dispatch({ type: 'build', seat: 0, tile: 6 });
    expect(c.view.undo).toBe('building on Lilac Row');
    expect(c.undo()).toBe(true);
    expect(c.state.tiles[6].buildings).toBe(0);
    expect(c.actions).toEqual([]);
    expect(c.view.undo).toBeNull();
  });

  it('the next roll ends the undo window', () => {
    const c = ctl();
    c.dispatch({ type: 'mortgage', seat: 0, tile: 6 });
    c.dispatch({ type: 'roll', seat: 0 });
    expect(c.view.undo).toBeNull();
    expect(c.undo()).toBe(false);
  });

  it('another player acting ends the undo window; a trade offer can be undone until answered', () => {
    const c = ctl();
    const offer = { from: 0, to: 1, give: { tiles: [6], cash: 0, gojf: 0 }, get: { tiles: [], cash: 50, gojf: 0 }, promises: [] };
    c.dispatch({ type: 'proposeTrade', seat: 0, offer });
    expect(c.view.undo).toBe('the trade offer');
    c.dispatch({ type: 'rejectTrade', seat: 1 });
    expect(c.view.undo).toBeNull();
  });

  it('the setting turns undo off', () => {
    const c = ctl();
    c.undoEnabled = false;
    c.dispatch({ type: 'build', seat: 0, tile: 6 });
    expect(c.view.undo).toBeNull();
    expect(c.undo()).toBe(false);
  });

  it('v2 saves with tile promises load as group promises (Stage 3 §5.3), merging duplicates', async () => {
    const humans = [{ kind: 'human' as const, name: 'A' }, { kind: 'human' as const, name: 'B' }];
    const s = edit(newGame({ seats: humans, seed: 7, turnOrder: 'fixed' }), (d) => own(d, 1, 1, 3, 5));
    const v2 = JSON.parse(JSON.stringify(makeSave('slot-2', 'Old', s, [], 7, 0)));
    v2.version = 2;
    v2.snapshot.promises = [
      { id: 1, kind: 'rentFree', from: 1, to: 0, tileId: 1, turnsLeft: 2 },
      { id: 2, kind: 'rentFree', from: 1, to: 0, tileId: 3, turnsLeft: 3 },
      { id: 3, kind: 'rentFree', from: 1, to: 0, tileId: 5, turnsLeft: 4 },
    ];
    v2.snapshot.nextPromiseId = 4;
    const kv = new Saves(memoryKV());
    expect(() => kv.parseImport(JSON.stringify({ format: 'property-night/save', ...v2 }))).not.toThrow();
    const raw = memoryKV();
    await raw.put('saves', JSON.parse(JSON.stringify(v2)));
    const f = (await new Saves(raw).get('slot-2'))!;
    expect(f.version).toBe(SAVE_VERSION);
    expect(f.snapshot.promises).toEqual([
      { id: 1, kind: 'rentFree', from: 1, to: 0, group: 'brown', total: 5, left: 5 },
      { id: 3, kind: 'rentFree', from: 1, to: 0, group: 'railroad', total: 4, left: 4 },
    ]);
    expect(saveProblem(f)).toBeNull();
  });
});
