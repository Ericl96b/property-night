// Benchmark phase scripts (Batch 4, SPEC-benchmark §3.3). Each phase is a fixed timeline driven
// by elapsed time, using the game's own render classes and animations (no stand-ins). The test
// board's Animate loop reuses phases 2 and 4.
import * as THREE from 'three';
import type { GameScene } from '../render/scene';
import type { Director } from '../director/director';
import type { GameEvent, State } from '../engine';
import { groupTiles } from '../engine/queries';
import { BOARD_TOP, SIDE_YAW, sideOfTile, tileFrame, tileLocalToWorld, type Side } from '../render/layout';
import { CLOSEUP } from '../render/cameraDirector';
import { SPEED_FACTOR } from '../director/queue';
import { GROUP_ORDER } from './scenes';

export interface PhaseCtx {
  scene: GameScene;
  director: Director;
  /** The sandbox state being drawn (never dispatched). */
  state: State;
  /** Payment threshold so phase 5's payment gets the full moment. */
  bigPayment: number;
}

export interface PhaseScript {
  id: string;
  name: string;
  /** Seconds. */
  duration: number;
  setup?(c: PhaseCtx): void;
  /** t = seconds since the phase started (wall time), dt = seconds since the last frame. */
  tick(c: PhaseCtx, t: number, dt: number): void;
  teardown?(c: PhaseCtx): void;
}

/** Animations run here in parallel (the scene's queue runs one at a time). */
export class ParallelTicks {
  private list: ((dt: number) => boolean)[] = [];
  add(t: ((dt: number) => boolean) | undefined): void {
    if (t) this.list.push(t);
  }
  step(dt: number): void {
    this.list = this.list.filter((t) => t(dt));
  }
  /** Run everything to its end. */
  finish(): void {
    for (let i = 0; i < 200 && this.list.length; i++) this.step(1);
    this.list = [];
  }
  get count(): number {
    return this.list.length;
  }
}

/** Fires each callback once when the timeline passes its time. */
class Schedule {
  private items: { at: number; fn: () => void }[] = [];
  private i = 0;
  add(at: number, fn: () => void): void {
    this.items.push({ at, fn });
    this.items.sort((a, b) => a.at - b.at);
  }
  run(t: number): void {
    while (this.i < this.items.length && this.items[this.i].at <= t) this.items[this.i++].fn();
  }
  reset(): void {
    this.items = [];
    this.i = 0;
  }
}

/** The speed the benchmark runs at (forced to Normal). */
const NORMAL = SPEED_FACTOR.normal;

export function tileCenter(tile: number): THREE.Vector3 {
  const [x, z] = tileLocalToWorld(tileFrame(tile), 0, 0);
  return new THREE.Vector3(x, BOARD_TOP, z);
}

/**
 * The whole-board view on a side. Table: the side turn. Close-up (Stage 2): the same rest view as
 * a shot (what Peek shows), so the table-wide phases keep measuring the whole board.
 */
export function sideView(scene: GameScene, side: Side, instant: boolean): void {
  const cam = scene.camera;
  cam.toSide(side, instant);
  if (cam.closeup) cam.shot(cam.restPose(SIDE_YAW[side], 1), CLOSEUP.handoffSmooth, instant);
}

/** Middle street of a color group (its close-up target). */
export function groupCenterTile(s: State, i: number): number {
  const tiles = groupTiles(s.board, GROUP_ORDER[i]);
  return tiles[Math.floor(tiles.length / 2)] ?? 1;
}

// --- 1. Table at rest ---------------------------------------------------------------------------

export function restPhase(len = 8): PhaseScript {
  return {
    id: 'rest',
    name: 'Table at rest',
    duration: len,
    setup: ({ scene }) => {
      scene.camera.setFollow(null);
      sideView(scene, 0, true);
    },
    // Light ambient motion: a slow camera sway (the scene itself has no idle animation).
    tick: ({ scene }, t) => scene.camera.setNudge(0.15 * Math.sin(t * 0.9), 0.1 * Math.sin(t * 0.6)),
    teardown: ({ scene }) => scene.camera.setNudge(0, 0),
  };
}

// --- 2. Board turns -----------------------------------------------------------------------------

export function turnsPhase(len = 8): PhaseScript {
  let next = 0;
  return {
    id: 'turns',
    name: 'Board turns',
    duration: len,
    setup: ({ scene }) => {
      next = 0;
      scene.camera.setFollow(null);
      scene.camera.setNudge(0, 0);
    },
    tick: ({ scene }, t) => {
      // Four turns, evenly spaced: to each side in turn and back to the start.
      const step = len / 4;
      while (next < 4 && t >= next * step) {
        next++;
        sideView(scene, (next % 4) as Side, false);
      }
    },
  };
}

// --- 3. Street close-ups --------------------------------------------------------------------------

export function closeupsPhase(len = 12): PhaseScript & { slotAt(t: number): number } {
  let shown = -1;
  const slot = len / GROUP_ORDER.length;
  return {
    id: 'closeups',
    name: 'Street close-ups',
    duration: len,
    slotAt: (t: number) => Math.min(GROUP_ORDER.length - 1, Math.max(0, Math.floor(t / slot))),
    setup: () => {
      shown = -1;
    },
    tick: (c, t) => {
      const i = Math.min(GROUP_ORDER.length - 1, Math.floor(t / slot));
      if (i !== shown) {
        shown = i;
        poseCloseup(c, i, false);
      }
      // Slight parallax nudge while each group is framed.
      c.scene.camera.setNudge(0.2 * Math.sin(t * 1.7), 0.12 * Math.cos(t * 1.3));
    },
    teardown: ({ scene }) => {
      scene.camera.setNudge(0, 0);
      scene.camera.setFollow(null);
    },
  };
}

/**
 * Frame color group `i` from the side it lies on. Close-up style (Stage 2 §7): the Landed shot
 * players actually see; Table: the old follow zoom.
 */
export function poseCloseup(c: PhaseCtx, i: number, instant: boolean): void {
  const cam = c.scene.camera;
  const tile = groupCenterTile(c.state, i);
  const side = sideOfTile(tile);
  if (side !== cam.side || instant) cam.toSide(side, instant);
  if (cam.closeup) cam.shot(cam.homePose(tile), CLOSEUP.shotSmooth, instant);
  else cam.setFollow(tileCenter(tile));
}

// --- 4. Construction wave -----------------------------------------------------------------------

export function wavePhase(len = 12, ticks = new ParallelTicks()): PhaseScript {
  const sched = new Schedule();
  return {
    id: 'wave',
    name: 'Construction wave',
    duration: len,
    setup: (c) => {
      sched.reset();
      c.scene.camera.setFollow(null);
      const slot = len / GROUP_ORDER.length;
      const scale = 1 / NORMAL;
      GROUP_ORDER.forEach((g, gi) => {
        const t0 = gi * slot;
        const tiles = groupTiles(c.state.board, g).filter((i) => c.state.tiles[i].buildings > 0);
        sched.add(t0, () => sideView(c.scene, sideOfTile(tiles[0] ?? 0), false));
        // Street by street: sell everything on the street (lift + fade), then drop it back in with
        // the build bounce (houses one by one; a hotel replaces four houses). Streets follow each
        // other so only about one street's sell meshes are on screen at a time, as in play.
        const per = slot / Math.max(1, tiles.length);
        tiles.forEach((tile, si) => {
          const s0 = t0 + si * per;
          const n = c.state.tiles[tile].buildings === 5 ? 1 : c.state.tiles[tile].buildings;
          for (let k = 0; k < n; k++) sched.add(s0 + k * Math.min(0.06, per * 0.1), () => ticks.add(c.scene.buildings.remove(tile, scale)));
          const b = c.state.tiles[tile].buildings;
          const at = s0 + per * 0.5;
          if (b === 5) {
            sched.add(at, () => {
              c.scene.buildings.set(tile, 4, false);
              ticks.add(c.scene.buildings.add(tile, scale));
            });
          } else for (let k = 0; k < b; k++) sched.add(at + k * 0.08, () => ticks.add(c.scene.buildings.add(tile, scale)));
        });
      });
    },
    tick: (_c, t, dt) => {
      sched.run(t);
      ticks.step(dt);
    },
    teardown: (c) => {
      ticks.finish();
      c.director.sync(c.state);
    },
  };
}

// --- 5. Turn moment -------------------------------------------------------------------------------

/**
 * Dice roll with physics, a 7-tile hop with camera follow, a payment moment and the handoff to
 * the next seat. Close-up runs the Stage 2 choreography: Home → Dice → Chase → Landed → handoff.
 */
export function turnMomentPhase(len = 14): PhaseScript {
  return {
    id: 'turn',
    name: 'Turn moment',
    duration: len,
    setup: (c) => {
      const s = c.state;
      const seat = s.players.findIndex((p) => !p.bankrupt && !p.jail);
      const from = s.players[seat].position;
      const to = (from + 7) % 40;
      const owner = s.tiles[to].owner !== null && s.tiles[to].owner !== seat ? s.tiles[to].owner! : (seat + 1) % s.seats.length;
      const amount = Math.max(1500, c.bigPayment);
      const cash = s.players.map((p) => p.cash);
      cash[seat] -= amount;
      cash[owner] += amount;
      // The events' end state: the token stands on the destination.
      const after: State = { ...s, players: s.players.map((p, i) => (i === seat ? { ...p, position: to, cash: cash[i] } : { ...p, cash: cash[i] })) };
      const next = s.players.findIndex((p, i) => i !== seat && !p.bankrupt);
      const events: GameEvent[] = [
        { type: 'turnStarted', seat },
        { type: 'diceRolled', seat, dice: [3, 4], doubles: false },
        { type: 'moved', seat, from, to, steps: 7, direct: false },
        { type: 'payment', from: seat, to: owner, amount, reason: 'rent', tile: to, cash },
        // Turn handoff (Stage 2 §2.5).
        ...(next >= 0 ? [{ type: 'turnStarted', seat: next } as GameEvent] : []),
      ];
      c.scene.camera.setFollow(null);
      c.director.reseed(0x5eed);
      c.director.play(events, after);
    },
    tick: () => {},
    teardown: (c) => {
      c.scene.queue.flush();
      c.director.sync(c.state);
      c.scene.camera.setFollow(null);
    },
  };
}
