// Batch 4: sandbox presets and test-board isolation (SPEC-benchmark §3.2, §4.1.3, §6.2).
// Never imports buildingModels.js: the scene is a fake.
import { describe, expect, it, vi } from 'vitest';
import { CLASSIC_BOARD } from '../../src/data/classicBoard';
import { groupTiles } from '../../src/engine/queries';
import { GROUP_ORDER, addBuilding, applyPreset, cycleOwner, isPledged, removeBuilding, sandboxState, streets, togglePledge } from '../../src/bench/scenes';
import { TestBoard } from '../../src/bench/testBoard';
import { AnimationQueue } from '../../src/director/queue';
import { GameController } from '../../src/app/controller';
import { AUTOSAVE_ID, Saves, makeSave } from '../../src/app/saves';
import { newGame, type State } from '../../src/engine';
import { memoryKV } from '../../src/storage/db';
import type { GameScene } from '../../src/render/scene';
import type { Director } from '../../src/director/director';

describe('sandbox presets', () => {
  it('worst case: everything owned and built, every decal type, one token in jail', () => {
    const s = sandboxState(CLASSIC_BOARD, 6);
    applyPreset(s, 'worstCase');
    const priced = CLASSIC_BOARD.tiles.filter((t) => t.price);
    expect(priced.every((t) => s.tiles[t.index].owner !== null)).toBe(true);
    expect(new Set(priced.map((t) => s.tiles[t.index].owner)).size).toBe(6);
    for (const g of GROUP_ORDER) {
      const b = groupTiles(CLASSIC_BOARD, g).map((i) => s.tiles[i].buildings);
      expect(b).toContain(5); // hotel design on screen
      expect(b).toContain(4); // house design on screen
    }
    expect(s.tiles.some((t) => t.mortgaged)).toBe(true);
    expect(priced.filter((t) => isPledged(s, t.index)).length).toBe(2);
    expect(s.promises).toHaveLength(1);
    expect(s.players.filter((p) => !p.bankrupt)).toHaveLength(6);
    expect(s.players.filter((p) => p.jail)).toHaveLength(1);
    expect(new Set(s.players.map((p) => Math.floor((p.jail ? 10 : p.position) / 10))).size).toBe(4); // all four sides
  });

  it('other presets', () => {
    const s = sandboxState(CLASSIC_BOARD, 2);
    expect(s.players.filter((p) => !p.bankrupt)).toHaveLength(2);
    applyPreset(s, 'allHouses');
    expect(streets(s).every((i) => s.tiles[i].buildings === 4 && s.tiles[i].owner === 0)).toBe(true);
    applyPreset(s, 'allHotels');
    expect(streets(s).every((i) => s.tiles[i].buildings === 5)).toBe(true);
    applyPreset(s, 'oneGroup', 'green');
    const [a, b, c] = groupTiles(CLASSIC_BOARD, 'green');
    expect([s.tiles[a].buildings, s.tiles[b].buildings, s.tiles[c].buildings]).toEqual([4, 5, 0]);
    expect(s.tiles.filter((t) => t.buildings > 0)).toHaveLength(2);
    applyPreset(s, 'empty');
    expect(s.tiles.every((t) => t.owner === null && t.buildings === 0)).toBe(true);
    expect(s.promises).toEqual([]);
  });

  it('edits ignore the rules but stay in range', () => {
    const s = sandboxState();
    const tile = 1;
    for (let k = 0; k < 7; k++) addBuilding(s, tile);
    expect(s.tiles[tile].buildings).toBe(5); // no set ownership, even building or bank needed
    for (let k = 0; k < 7; k++) removeBuilding(s, tile);
    expect(s.tiles[tile].buildings).toBe(0);
    expect(addBuilding(s, 5)).toBe(false); // railroad
    const owners: (number | null)[] = [];
    for (let k = 0; k < 7; k++) {
      cycleOwner(s, tile);
      owners.push(s.tiles[tile].owner);
    }
    expect(owners).toEqual([0, 1, 2, 3, 4, 5, null]);
    togglePledge(s, tile);
    expect(isPledged(s, tile)).toBe(true);
    togglePledge(s, tile);
    expect(isPledged(s, tile)).toBe(false);
  });
});

/** Enough of GameScene for the test board, with no WebGL. */
function fakeScene() {
  const queue = new AnimationQueue();
  queue.speed = 'instant';
  return {
    queue,
    camera: { settings: { rotation: true, follow: true, reduceMotion: true }, side: 0, setFollow: vi.fn(), toSide: vi.fn(), setNudge: vi.fn(), apply: vi.fn() },
    buildings: { add: vi.fn(), remove: vi.fn(), set: vi.fn() },
    decals: { setHighlight: vi.fn() },
    renderer: { requestRender: vi.fn(), addTicker: vi.fn(), removeTicker: vi.fn() },
  };
}

describe('test board isolation (§4.1.3)', () => {
  it('entering, editing and leaving leaves the autosave, Continue and the controller untouched', async () => {
    const saves = new Saves(memoryKV());
    const game = newGame({ seats: [{ kind: 'bot', name: 'A' }, { kind: 'bot', name: 'B' }], seed: 5 });
    await saves.autosave(makeSave(AUTOSAVE_ID, 'Autosave', game, [], 5, 1));
    const before = JSON.stringify(await saves.continueGame());

    const controller = new GameController(null, { now: () => 0, setTimeout: () => 0, clearTimeout: () => {} });
    const onChange = vi.fn();
    controller.onChange = onChange;

    const scene = fakeScene();
    const synced: State[] = [];
    const director = { sync: (s: State) => synced.push(s) };
    const tb = new TestBoard({ scene: scene as unknown as GameScene, director: director as unknown as Director, sound: { tock: () => {} }, ensureBoard: async () => {}, onChange: () => {} }, CLASSIC_BOARD);
    tb.enter();
    expect(scene.camera.settings.reduceMotion).toBe(false); // forced while in the test board
    for (const p of ['allHouses', 'allHotels', 'worstCase', 'empty'] as const) tb.applyPreset(p);
    tb.cycleGroup(1);
    tb.step(1);
    tb.addBuilding();
    tb.removeBuilding();
    tb.cycleOwner();
    tb.toggleMortgage();
    tb.togglePledge();
    tb.setTokens(6);
    tb.rotate(1);
    tb.setCloseUp(true);
    tb.setAnimate(true);
    tb.setAnimate(false);
    scene.queue.update(0.1);
    await tb.setBoard(CLASSIC_BOARD);
    tb.exit();

    expect(scene.camera.settings.reduceMotion).toBe(true); // restored
    expect(synced.length).toBeGreaterThan(5);
    expect(synced.every((s) => s !== controller.state)).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(controller.state).toBeFalsy();
    expect(controller.actions).toEqual([]);
    expect(JSON.stringify(await saves.continueGame())).toBe(before);
    expect((await saves.list()).map((f) => f.id)).toEqual([AUTOSAVE_ID]);
  });
});

describe('board picking', () => {
  it('a tile center maps back to its tile; the board middle and outside map to none', async () => {
    const { tileAt, tileFrame, tileLocalToWorld } = await import('../../src/render/layout');
    for (let i = 0; i < 40; i++) {
      const [x, z] = tileLocalToWorld(tileFrame(i), 0, 0);
      expect(tileAt(x, z)).toBe(i);
    }
    expect(tileAt(0, 0)).toBeNull();
    expect(tileAt(2, 2)).toBeNull();
  });
});
