// Dice: physics for the look, RNG for the result (SPEC §11).
// Pure module (cannon-es + three math, no WebGL) so it runs in tests.
//  1. The engine supplies the values.
//  2. A separate cosmetic RNG makes the throw.
//  3. cannon-es simulates both dice off-screen at 1/120 s until they sleep (cap 4 s),
//     recording every step. Colliders: the board plane + invisible walls around the center.
//  4. A die resting cocked (> 10° off flat) → discard and re-throw (max 5, then place flat).
//  5. Read each die's top face and pick a fixed re-labeling rotation for the visual mesh so the
//     top face shows the engine's value (a rigid cube rotation, so opposite faces still sum to 7).
//  6. Playback is the recording, scaled by the speed setting.
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Rng } from '../engine/rng';

export const DIE_SIZE = 0.055;
export const STEP = 1 / 120;
export const MAX_STEPS = 480; // 4 s
const COCKED_COS = Math.cos((10 * Math.PI) / 180);
/** Half-width of the dice arena (walls). The center area is ±0.368; dice never reach tiles. */
export const ARENA_HALF = 0.3;
/** One board unit ≈ 45 cm, so gravity is scaled up accordingly. */
const GRAVITY = -9.82 / 0.45;

/** Mesh-local face axes in BoxGeometry group order (+X, −X, +Y, −Y, +Z, −Z). */
export const FACE_AXES: THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];
/** Pip value printed on each face of the visual die (opposites sum to 7). */
export const FACE_VALUES = [3, 4, 1, 6, 2, 5];

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

/** Index of the face axis pointing most nearly up, and how close to vertical it is (cos). */
export function topFace(q: THREE.Quaternion): { axis: number; cos: number } {
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < 6; i++) {
    const d = _v.copy(FACE_AXES[i]).applyQuaternion(q).dot(UP);
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  }
  return { axis: best, cos: bestDot };
}

/** Value shown on top for a visual die with body orientation q and re-label rotation r. */
export function shownValue(q: THREE.Quaternion, relabel: THREE.Quaternion): number {
  const world = q.clone().multiply(relabel);
  return FACE_VALUES[topFace(world).axis];
}

/**
 * Re-label rotation R (a cube rotation) so that, for a die whose body-local top axis is
 * `topAxis`, the visual face carrying `value` ends up on top: R · F_value = A_top.
 */
export function relabelRotation(topAxis: number, value: number): THREE.Quaternion {
  const from = FACE_AXES[FACE_VALUES.indexOf(value)];
  const to = FACE_AXES[topAxis];
  return new THREE.Quaternion().setFromUnitVectors(from, to);
}

export interface DiceThrow {
  /** Per die: 7 floats per recorded step (px, py, pz, qx, qy, qz, qw). Board-centered world space. */
  frames: [Float32Array, Float32Array];
  steps: number;
  relabel: [THREE.Quaternion, THREE.Quaternion];
  values: [number, number];
  attempts: number;
  /** True when every attempt rested cocked and the result was placed flat. */
  placedFlat: boolean;
  /** Step indices of notable impacts (for clatter sounds). */
  contacts: number[];
}

export interface ThrowOptions {
  /** Yaw of the thrower's side (camera rig yaw); the throw starts from that side. */
  sideYaw: number;
  /** Height of the board face (dice rest on it). */
  floorY: number;
}

function makeWorld(floorY: number): CANNON.World {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0), allowSleep: true });
  world.broadphase = new CANNON.NaiveBroadphase();
  (world.solver as CANNON.GSSolver).iterations = 12;
  const floorMat = new CANNON.Material('floor');
  const wallMat = new CANNON.Material('wall');
  const dieMat = new CANNON.Material('die');
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, { friction: 0.32, restitution: 0.32 }));
  world.addContactMaterial(new CANNON.ContactMaterial(wallMat, dieMat, { friction: 0.1, restitution: 0.55 }));
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.2, restitution: 0.4 }));

  const floor = new CANNON.Body({ mass: 0, material: floorMat, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  floor.position.set(0, floorY, 0);
  world.addBody(floor);
  // Four invisible walls: plane normals point into the arena.
  const walls: [number, number, number, number][] = [
    [ARENA_HALF, 0, 0, -Math.PI / 2],
    [-ARENA_HALF, 0, 0, Math.PI / 2],
    [0, ARENA_HALF, Math.PI, 0],
    [0, -ARENA_HALF, 0, 0],
  ];
  for (const [x, z, ry, ry2] of walls) {
    const b = new CANNON.Body({ mass: 0, material: wallMat, shape: new CANNON.Plane() });
    b.position.set(x, floorY, z);
    b.quaternion.setFromEuler(0, x !== 0 ? ry2 : ry, 0);
    world.addBody(b);
  }
  (world as unknown as { dieMat: CANNON.Material }).dieMat = dieMat;
  return world;
}

function simulateOnce(rng: Rng, opts: ThrowOptions) {
  const world = makeWorld(opts.floorY);
  const dieMat = (world as unknown as { dieMat: CANNON.Material }).dieMat;
  const half = DIE_SIZE / 2;
  const bodies: CANNON.Body[] = [];
  const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, opts.sideYaw);
  const lateral = rng.range(-0.1, 0.1);
  for (let i = 0; i < 2; i++) {
    const body = new CANNON.Body({
      mass: 1,
      material: dieMat,
      shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
      linearDamping: 0.12,
      angularDamping: 0.14,
      allowSleep: true,
      sleepSpeedLimit: 0.035,
      sleepTimeLimit: 0.18,
    });
    // Start near the thrower's edge of the arena (side frame: +z toward the thrower).
    const start = new THREE.Vector3(lateral + (i === 0 ? -0.045 : 0.045) + rng.range(-0.01, 0.01), opts.floorY + rng.range(0.07, 0.11), 0.24 + rng.range(-0.02, 0.02));
    const vel = new THREE.Vector3(rng.range(-0.35, 0.35) - lateral * 1.5, rng.range(0.0, 0.25), -rng.range(1.0, 1.45));
    start.applyQuaternion(yawQ);
    vel.applyQuaternion(yawQ);
    body.position.set(start.x, start.y, start.z);
    body.velocity.set(vel.x, vel.y, vel.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)));
    body.quaternion.set(q.x, q.y, q.z, q.w);
    body.angularVelocity.set(rng.range(-28, 28), rng.range(-12, 12), rng.range(-28, 28));
    world.addBody(body);
    bodies.push(body);
  }
  const contacts: number[] = [];
  let step = 0;
  world.addEventListener('beginContact', () => {
    if (!contacts.length || step - contacts[contacts.length - 1] > 4) contacts.push(step);
  });
  const frames: [number[], number[]] = [[], []];
  const record = () => {
    bodies.forEach((b, i) => {
      frames[i].push(b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    });
  };
  record();
  for (step = 1; step <= MAX_STEPS; step++) {
    world.step(STEP);
    record();
    if (bodies.every((b) => b.sleepState === CANNON.Body.SLEEPING)) break;
  }
  const steps = frames[0].length / 7;
  const finals = bodies.map((b) => new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w));
  return { frames, steps, finals, contacts };
}

/** Snap a resting orientation to the nearest flat one (rotation about the tilt axis). */
function flatten(q: THREE.Quaternion): THREE.Quaternion {
  const { axis } = topFace(q);
  const worldAxis = FACE_AXES[axis].clone().applyQuaternion(q);
  return new THREE.Quaternion().setFromUnitVectors(worldAxis, UP).multiply(q);
}

export function simulateThrow(values: [number, number], cosmeticRng: Rng, opts: ThrowOptions): DiceThrow {
  let result: ReturnType<typeof simulateOnce> | undefined;
  let attempts = 0;
  let placedFlat = false;
  for (attempts = 1; attempts <= 5; attempts++) {
    result = simulateOnce(cosmeticRng, opts);
    if (result.finals.every((q) => topFace(q).cos >= COCKED_COS)) break;
  }
  if (attempts > 5) {
    attempts = 5;
    placedFlat = true;
    // Ease the last 12 recorded steps into the nearest flat pose and set it on the floor.
    const r = result!;
    r.finals = r.finals.map((q, i) => {
      const flat = flatten(q);
      const f = r.frames[i];
      const last = (r.steps - 1) * 7;
      const from = new THREE.Quaternion(f[last + 3], f[last + 4], f[last + 5], f[last + 6]);
      const y0 = f[last + 1];
      for (let k = 1; k <= 12; k++) {
        const t = k / 12;
        const qq = from.clone().slerp(flat, t);
        f.push(f[last], y0 + (opts.floorY + DIE_SIZE / 2 - y0) * t, f[last + 2], qq.x, qq.y, qq.z, qq.w);
      }
      return flat;
    });
    r.steps += 12;
  }
  const r = result!;
  const relabel = r.finals.map((q, i) => relabelRotation(topFace(q).axis, values[i])) as [THREE.Quaternion, THREE.Quaternion];
  return {
    frames: [Float32Array.from(r.frames[0]), Float32Array.from(r.frames[1])],
    steps: r.steps,
    relabel,
    values,
    attempts,
    placedFlat,
    contacts: r.contacts,
  };
}

/** Instant speed: no throw, dice placed flat in the arena showing the values. */
export function placeFlat(values: [number, number], cosmeticRng: Rng, opts: ThrowOptions): DiceThrow {
  const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, opts.sideYaw);
  const frames: [Float32Array, Float32Array] = [new Float32Array(7), new Float32Array(7)];
  const relabel: THREE.Quaternion[] = [];
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Vector3(i === 0 ? -0.05 : 0.05, opts.floorY + DIE_SIZE / 2, 0.02).applyQuaternion(yawQ);
    const q = new THREE.Quaternion().setFromAxisAngle(UP, opts.sideYaw + cosmeticRng.range(-0.35, 0.35));
    frames[i].set([p.x, p.y, p.z, q.x, q.y, q.z, q.w]);
    relabel.push(relabelRotation(topFace(q).axis, values[i]));
  }
  return { frames, steps: 1, relabel: relabel as [THREE.Quaternion, THREE.Quaternion], values, attempts: 0, placedFlat: true, contacts: [] };
}

/** Interpolated pose of die `i` at playback time `t` seconds (recording time). */
export function samplePose(th: DiceThrow, i: number, t: number, pos: THREE.Vector3, quat: THREE.Quaternion): void {
  const f = th.frames[i];
  const x = Math.min(th.steps - 1, Math.max(0, t / STEP));
  const a = Math.floor(x);
  const b = Math.min(th.steps - 1, a + 1);
  const k = x - a;
  const ia = a * 7;
  const ib = b * 7;
  pos.set(f[ia] + (f[ib] - f[ia]) * k, f[ia + 1] + (f[ib + 1] - f[ia + 1]) * k, f[ia + 2] + (f[ib + 2] - f[ia + 2]) * k);
  const qa = new THREE.Quaternion(f[ia + 3], f[ia + 4], f[ia + 5], f[ia + 6]);
  const qb = new THREE.Quaternion(f[ib + 3], f[ib + 4], f[ib + 5], f[ib + 6]);
  quat.copy(qa).slerp(qb, k);
}

export function throwDuration(th: DiceThrow): number {
  return (th.steps - 1) * STEP;
}
