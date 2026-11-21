// Test board sandbox (Batch 4, SPEC-benchmark §4). Places houses, hotels, owners, mortgages and
// pledges on any property instantly, with no game rules. It owns a data-only State applied with
// director.sync(); it never touches the game controller, so nothing dispatches, no bot timers
// start, and autosave/Continue are never written.
import type { GameScene } from '../render/scene';
import type { Director } from '../director/director';
import type { BoardData, GroupId } from '../data/classicBoard';
import type { State } from '../engine';
import type { CameraSettings } from '../render/cameraDirector';
import type { Side } from '../render/layout';
import {
  GROUP_ORDER,
  addBuilding,
  applyPreset,
  cycleOwner,
  isPriced,
  placeTokens,
  removeBuilding,
  sandboxState,
  toggleMortgage,
  togglePledge,
  type PresetId,
  type TokenCount,
} from './scenes';
import { tileCenter, turnsPhase, wavePhase, type PhaseCtx, type PhaseScript } from './phases';

export interface TestBoardEnv {
  scene: GameScene;
  director: Director;
  sound: { tock(sell?: boolean): void };
  /** Re-generate the board face when the printed board changes (as on game start). */
  ensureBoard(board: BoardData): Promise<void>;
  /** The UI re-reads the test board's fields. */
  onChange(): void;
}

export class TestBoard {
  state: State;
  preset: PresetId = 'empty';
  group: GroupId = 'brown';
  tokens: TokenCount = 2;
  /** Selected tile (properties only). */
  tile = 1;
  closeUp = false;
  animating = false;
  private savedCamera?: CameraSettings;
  private anim?: { scripts: PhaseScript[]; i: number; t: number; ticker: (dt: number, now: number) => boolean };

  constructor(private env: TestBoardEnv, board: BoardData) {
    this.state = sandboxState(board, this.tokens);
  }

  private get scene(): GameScene {
    return this.env.scene;
  }

  private changed(): void {
    this.scene.renderer.requestRender();
    this.env.onChange();
  }

  /** Enter: draw the starting layout and select a tile. Camera options are forced on while here. */
  enter(): void {
    const cam = this.scene.camera;
    this.savedCamera = { ...cam.settings };
    cam.settings = { rotation: true, follow: true, reduceMotion: false };
    cam.setFollow(null);
    cam.toSide(0, true);
    applyPreset(this.state, this.preset, this.group);
    this.env.director.sync(this.state);
    this.select(this.tile);
  }

  /** Leave: stop animations and give the camera options back (the caller clears the scene). */
  exit(): void {
    this.setAnimate(false);
    this.scene.queue.flush();
    this.scene.decals.setHighlight(null);
    const cam = this.scene.camera;
    cam.setFollow(null);
    cam.setNudge(0, 0);
    if (this.savedCamera) cam.settings = this.savedCamera;
    cam.toSide(0, true);
    cam.apply();
  }

  private sync(): void {
    this.env.director.sync(this.state);
    this.changed();
  }

  applyPreset(p: PresetId): void {
    this.setAnimate(false);
    this.scene.queue.flush();
    this.preset = p;
    applyPreset(this.state, p, this.group);
    this.sync();
  }

  /** One group: next/previous color group, applied at once. */
  cycleGroup(dir: 1 | -1): void {
    const i = GROUP_ORDER.indexOf(this.group);
    this.group = GROUP_ORDER[(i + dir + GROUP_ORDER.length) % GROUP_ORDER.length];
    this.applyPreset('oneGroup');
  }

  // --- selection --------------------------------------------------------------------------------

  select(tile: number): void {
    if (!isPriced(this.state, tile)) return;
    this.tile = tile;
    this.scene.decals.setHighlight(tile);
    if (this.closeUp) this.frameSelected();
    this.changed();
  }

  /** Move around the board in order, properties only. */
  step(dir: 1 | -1): void {
    let t = this.tile;
    for (let k = 0; k < 40; k++) {
      t = (t + dir + 40) % 40;
      if (isPriced(this.state, t)) break;
    }
    this.select(t);
  }

  get tileName(): string {
    return this.state.board.tiles[this.tile]?.name ?? '';
  }

  // --- edits (no rules) ---------------------------------------------------------------------------

  /** Add a building with the normal drop-in animation and sound (0 → 4 houses → hotel). */
  addBuilding(): void {
    const tile = this.tile;
    if (!addBuilding(this.state, tile)) return;
    const q = this.scene.queue;
    q.push({
      label: 'build',
      start: () => {
        this.env.sound.tock();
        return this.scene.buildings.add(tile, q.factor === Infinity ? 0 : 1 / q.factor);
      },
    });
    q.push({ label: 'sync', start: () => this.env.director.sync(this.state) });
    this.changed();
  }

  /** Remove a building with the sell animation (hotel → 4 houses → 0). */
  removeBuilding(): void {
    const tile = this.tile;
    if (!removeBuilding(this.state, tile)) return;
    const q = this.scene.queue;
    q.push({
      label: 'sell',
      start: () => {
        this.env.sound.tock(true);
        return this.scene.buildings.remove(tile, q.factor === Infinity ? 0 : 1 / q.factor);
      },
    });
    q.push({ label: 'sync', start: () => this.env.director.sync(this.state) });
    this.changed();
  }

  cycleOwner(): void {
    cycleOwner(this.state, this.tile);
    this.sync();
  }

  toggleMortgage(): void {
    toggleMortgage(this.state, this.tile);
    this.sync();
  }

  togglePledge(): void {
    togglePledge(this.state, this.tile);
    this.sync();
  }

  get selected(): { buildings: number; owner: number | null; mortgaged: boolean; pledged: boolean; street: boolean } {
    const ts = this.state.tiles[this.tile];
    return {
      buildings: ts.buildings,
      owner: ts.owner,
      mortgaged: ts.mortgaged,
      pledged: this.state.players.some((p) => p.loans.some((l) => l.collateral.includes(this.tile))),
      street: this.state.board.tiles[this.tile].type === 'street',
    };
  }

  // --- board, tokens, camera, animation -----------------------------------------------------------

  async setBoard(board: BoardData): Promise<void> {
    this.setAnimate(false);
    this.scene.queue.flush();
    await this.env.ensureBoard(board);
    this.state = sandboxState(board, this.tokens);
    applyPreset(this.state, this.preset, this.group);
    this.sync();
    this.select(this.tile);
  }

  setTokens(n: TokenCount): void {
    this.tokens = n;
    placeTokens(this.state, n);
    this.sync();
  }

  cycleTokens(): void {
    this.setTokens(this.tokens === 0 ? 2 : this.tokens === 2 ? 6 : 0);
  }

  /** LB / RB: rotate to the previous / next side. */
  rotate(dir: 1 | -1): void {
    const cam = this.scene.camera;
    cam.toSide((((cam.side + dir) % 4) + 4) % 4 as Side);
    this.changed();
  }

  setCloseUp(on: boolean): void {
    this.closeUp = on;
    if (on) this.frameSelected();
    else this.scene.camera.setFollow(null);
    this.changed();
  }

  private frameSelected(): void {
    this.scene.camera.setFollow(tileCenter(this.tile));
  }

  /** Loop the benchmark's construction wave and board turns, for watching the motion. */
  setAnimate(on: boolean): void {
    if (on === this.animating) return;
    this.animating = on;
    const r = this.scene.renderer;
    const ctx = (): PhaseCtx => ({ scene: this.scene, director: this.env.director, state: this.state, bigPayment: 0 });
    if (on) {
      this.scene.queue.flush();
      const scripts = [wavePhase(12), turnsPhase(8)];
      let last = -1;
      const anim = {
        scripts,
        i: 0,
        t: 0,
        ticker: (_dt: number, now: number) => {
          if (last < 0) {
            last = now;
            scripts[0].setup?.(ctx());
          }
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          anim.t += dt;
          const s = scripts[anim.i];
          s.tick(ctx(), anim.t, dt);
          if (anim.t >= s.duration) {
            s.teardown?.(ctx());
            anim.i = (anim.i + 1) % scripts.length;
            anim.t = 0;
            scripts[anim.i].setup?.(ctx());
          }
          return true;
        },
      };
      this.anim = anim;
      r.addTicker(anim.ticker);
    } else if (this.anim) {
      r.removeTicker(this.anim.ticker);
      this.anim.scripts[this.anim.i].teardown?.(ctx());
      this.anim = undefined;
      this.scene.camera.setFollow(null);
      this.sync();
    }
    this.changed();
  }
}
