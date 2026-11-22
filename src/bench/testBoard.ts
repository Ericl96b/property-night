// Test board sandbox (Batch 4, SPEC-benchmark §4). Places houses, hotels, owners, mortgages and
// pledges on any property instantly, with no game rules. It owns a data-only State applied with
// director.sync(); it never touches the game controller, so nothing dispatches, no bot timers
// start, and autosave/Continue are never written.
import type { GameScene } from '../render/scene';
import type { Director } from '../director/director';
import type { BoardData, GroupId } from '../data/classicBoard';
import type { State } from '../engine';
import { CLOSEUP, type CameraSettings, type CloseupTunables } from '../render/cameraDirector';
import { type Side, sideOfTile } from '../render/layout';
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

/** Stage 2 camera tuning: the shots the Camera panel can show. */
export type TuneShot = 'home' | 'dice' | 'chase' | 'landed';

/** Slider ranges for every close-up tunable (Test board → Camera). */
export const TUNABLE_RANGES: { key: keyof CloseupTunables; label: string; min: number; max: number; step: number }[] = [
  { key: 'fov', label: 'FOV (°)', min: 20, max: 50, step: 1 },
  { key: 'homePitch', label: 'Home pitch (°)', min: 20, max: 70, step: 1 },
  { key: 'homeYawOffset', label: 'Home yaw offset (°)', min: 0, max: 45, step: 1 },
  { key: 'homeMargin', label: 'Home margin', min: 0, max: 0.2, step: 0.01 },
  { key: 'diceZoom', label: 'Dice zoom', min: 0.7, max: 1.1, step: 0.01 },
  { key: 'diceGate', label: 'Dice throw gate', min: 0.5, max: 1, step: 0.05 },
  { key: 'chasePitch', label: 'Chase pitch (°)', min: 15, max: 60, step: 1 },
  { key: 'chaseYawOffset', label: 'Chase yaw offset (°)', min: 0, max: 70, step: 1 },
  { key: 'chaseLookAhead', label: 'Chase look-ahead (tiles)', min: 0, max: 4, step: 0.1 },
  { key: 'chaseDistance', label: 'Chase distance', min: 0.15, max: 0.8, step: 0.01 },
  { key: 'shotSmooth', label: 'Shot smoothing (s)', min: 0.05, max: 1, step: 0.01 },
  { key: 'handoffSmooth', label: 'Handoff smoothing (s)', min: 0.05, max: 1, step: 0.01 },
  { key: 'chaseSmooth', label: 'Chase smoothing (s)', min: 0.05, max: 1, step: 0.01 },
  { key: 'peekSmooth', label: 'Peek smoothing (s)', min: 0.05, max: 1, step: 0.01 },
  { key: 'minHeight', label: 'Minimum height', min: 0.01, max: 0.12, step: 0.005 },
  { key: 'buildingTop', label: 'Building top', min: 0.02, max: 0.08, step: 0.002 },
  { key: 'orbitYaw', label: 'Orbit yaw (°)', min: 0, max: 45, step: 1 },
  { key: 'orbitPitchUp', label: 'Orbit pitch up (°)', min: 0, max: 30, step: 1 },
  { key: 'orbitPitchDown', label: 'Orbit pitch down (°)', min: 0, max: 20, step: 1 },
];

/** The current tunables as a TS object literal, ready to paste over `CLOSEUP` in cameraDirector.ts. */
export function closeupLiteral(t: CloseupTunables = CLOSEUP): string {
  const round = (v: number) => Number(v.toFixed(4));
  const body = (Object.keys(t) as (keyof CloseupTunables)[]).map((k) => `  ${k}: ${round(t[k])},`).join('\n');
  return `export const CLOSEUP = {\n${body}\n};\n`;
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
  /** Stage 2: Camera tuning panel (switches the camera to Close-up while open). */
  tuning = false;
  tuneShot: TuneShot = 'home';
  /** Tiles a "Play a move" hops (1–12). */
  moveLen = 7;
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
    cam.settings = { rotation: true, follow: true, reduceMotion: false, style: 'table' };
    cam.setFollow(null);
    cam.toSide(0, true);
    applyPreset(this.state, this.preset, this.group);
    this.env.director.sync(this.state);
    this.select(this.tile);
  }

  /** Leave: stop animations and give the camera options back (the caller clears the scene). */
  exit(): void {
    this.setAnimate(false);
    this.tuning = false;
    this.scene.camera.setPeek(false);
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
    if (this.tuning) this.showShot(true);
    else if (this.closeUp) this.frameSelected();
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

  // --- camera tuning (Stage 2 §6) -----------------------------------------------------------------

  /** Open / close the Camera panel. Open: Close-up style, the picked shot on the selected tile. */
  setTuning(on: boolean): void {
    if (on === this.tuning) return;
    this.setAnimate(false);
    this.scene.queue.flush();
    this.tuning = on;
    const cam = this.scene.camera;
    cam.settings = { ...cam.settings, style: on ? 'closeup' : 'table' };
    cam.setFollow(null);
    if (on) this.showShot(true);
    else {
      cam.setPeek(false);
      cam.toSide(cam.side, true);
      cam.apply();
    }
    this.changed();
  }

  setTuneShot(s: TuneShot): void {
    this.tuneShot = s;
    this.showShot(false);
    this.changed();
  }

  /** A slider moved: write the tunable and re-show the shot at once. */
  setTunable(key: keyof CloseupTunables, value: number): void {
    CLOSEUP[key] = value;
    this.showShot(true);
    this.changed();
  }

  setMoveLen(n: number): void {
    this.moveLen = Math.max(1, Math.min(12, Math.round(n)));
    this.changed();
  }

  /** Put the picked shot on the selected tile (the token of seat 0 stands there). */
  showShot(instant: boolean): void {
    if (!this.tuning) return;
    const cam = this.scene.camera;
    const tile = this.tile;
    this.placeMover(tile);
    const side = sideOfTile(tile);
    cam.toSide(side, instant);
    const pose =
      this.tuneShot === 'dice'
        ? cam.dicePose(side, tile)
        : this.tuneShot === 'chase'
          ? cam.chasePose({ s: tile, dir: 1 })
          : cam.homePose(tile);
    cam.shot(pose, CLOSEUP.shotSmooth, instant);
    cam.apply();
    this.scene.renderer.requestRender();
  }

  /**
   * Play a move: seat 0's token hops `moveLen` tiles from the selected tile through the real
   * director choreography (chase, corner blends, Landed shot). The selection follows it.
   */
  playMove(): void {
    if (!this.tuning) this.setTuning(true);
    this.scene.queue.flush();
    const from = this.tile;
    this.placeMover(from);
    const to = (from + this.moveLen) % 40;
    this.state.players[0].position = to;
    this.env.director.play([{ type: 'moved', seat: 0, from, to, steps: this.moveLen, direct: false }], this.state);
    this.tile = to;
    this.scene.decals.setHighlight(isPriced(this.state, to) ? to : null);
    this.changed();
  }

  /** Copy the tunables as a TS literal; returns the text (shown when the clipboard is blocked). */
  async copyTunables(): Promise<string> {
    const text = closeupLiteral();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* the panel shows the text to copy by hand */
    }
    return text;
  }

  /** Seat 0's token stands on `tile` (it is the one the shots and moves use). */
  private placeMover(tile: number): void {
    const p = this.state.players[0];
    if (!p || p.position === tile) return;
    p.position = tile;
    p.bankrupt = false;
    this.env.director.sync(this.state);
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
