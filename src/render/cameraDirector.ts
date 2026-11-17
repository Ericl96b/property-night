// Camera (SPEC §10.7): vertical FOV 30°, pitch 58°, board fills ≈88% of screen height at rest.
// Rotates per active player's side (1.4 s ease-in-out, shortest direction) together with the
// light rig; gentle follow while a token moves; right-stick nudge; reduce-motion overhead view.
import * as THREE from 'three';
import { BOARD_SIZE, BOARD_TOP, SIDE_YAW, type Side } from './layout';

const FOV = 30;
const PITCH = (58 * Math.PI) / 180;
const FILL = 0.88;
const FOLLOW_MAX_OFFSET = 0.15 * BOARD_SIZE;
const FOLLOW_ZOOM = 0.88;
const NUDGE_YAW = (10 * Math.PI) / 180;
const NUDGE_PITCH = (7 * Math.PI) / 180;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

function shortestDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Solve camera distance and target offset so the board spans FILL of the screen height, centered. */
function solveRest(pitch: number): { distance: number; targetZ: number } {
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 50);
  const corners = [-0.5, 0.5].flatMap((x) => [-0.5, 0.5].map((z) => new THREE.Vector3(x * BOARD_SIZE, BOARD_TOP, z * BOARD_SIZE)));
  const extent = (d: number, tz: number) => {
    const target = new THREE.Vector3(0, BOARD_TOP, tz);
    cam.position.set(0, BOARD_TOP + Math.sin(pitch) * d, tz + Math.cos(pitch) * d);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of corners) {
      const p = c.clone().project(cam);
      lo = Math.min(lo, p.y);
      hi = Math.max(hi, p.y);
    }
    return { lo, hi };
  };
  let dLo = 0.5;
  let dHi = 8;
  let tz = 0;
  for (let i = 0; i < 40; i++) {
    const d = (dLo + dHi) / 2;
    // Center vertically: shift the target until the projected extents are symmetric.
    let zLo = -0.4;
    let zHi = 0.4;
    for (let j = 0; j < 30; j++) {
      tz = (zLo + zHi) / 2;
      const { lo, hi } = extent(d, tz);
      // Board sitting high on screen → its center is beyond the target → move the target farther (−z).
      if (hi + lo > 0) zHi = tz;
      else zLo = tz;
    }
    const { lo, hi } = extent(d, tz);
    if (hi - lo > FILL * 2) dLo = d;
    else dHi = d;
  }
  return { distance: (dLo + dHi) / 2, targetZ: tz };
}

export interface CameraSettings {
  rotation: boolean;
  follow: boolean;
  reduceMotion: boolean;
}

export class CameraDirector {
  readonly camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 30);
  /** Rotates with the camera (yaw only). The key light lives here. */
  readonly lightRig = new THREE.Group();
  settings: CameraSettings = { rotation: true, follow: true, reduceMotion: false };
  speed = 1;

  private rest = solveRest(PITCH);
  private overhead = solveRest((89 * Math.PI) / 180);
  side: Side = 0;
  private yaw = 0;
  private yawFrom = 0;
  private yawTo = 0;
  private rotT = 1;
  private rotDur = 1.4;
  private follow = new THREE.Vector2();
  private followTarget = new THREE.Vector2();
  private zoom = 1;
  private zoomTarget = 1;
  private returning = false;
  private nudge = new THREE.Vector2();
  private nudgeTarget = new THREE.Vector2();
  private tmpTarget = new THREE.Vector3();

  constructor() {
    this.lightRig.name = 'light-rig';
    this.apply();
  }

  /** Current view yaw including nudge (tokens face this). */
  get viewYaw(): number {
    return this.yaw + this.nudge.x * NUDGE_YAW;
  }

  get rotating(): boolean {
    return this.rotT < 1;
  }

  /** Rotate the rig so `side` is nearest the viewer (shortest direction). */
  toSide(side: Side, instant = false): void {
    this.side = side;
    if (!this.settings.rotation || this.settings.reduceMotion) {
      this.yaw = this.yawFrom = this.yawTo = 0;
      this.rotT = 1;
      return;
    }
    const target = SIDE_YAW[side];
    this.yawFrom = this.yaw;
    this.yawTo = this.yaw + shortestDelta(this.yaw, target);
    this.rotT = instant || this.speed === Infinity ? 1 : 0;
    if (this.rotT === 1) this.yaw = this.yawTo;
    this.rotDur = 1.4;
  }

  /** Ease toward a moving token while keeping its destination in frame. Null = return to rest. */
  setFollow(token: THREE.Vector3 | null, destination?: THREE.Vector3): void {
    if (!token || !this.settings.follow || this.settings.reduceMotion) {
      this.followTarget.set(0, 0);
      this.zoomTarget = 1;
      this.returning = true;
      return;
    }
    const focus = new THREE.Vector2(token.x, token.z);
    if (destination) focus.lerp(new THREE.Vector2(destination.x, destination.z), 0.5);
    focus.multiplyScalar(0.32);
    if (focus.length() > FOLLOW_MAX_OFFSET) focus.setLength(FOLLOW_MAX_OFFSET);
    this.followTarget.copy(focus);
    this.zoomTarget = FOLLOW_ZOOM;
    this.returning = false;
  }

  /** Review helper: hold the view centered on a board point at a zoom factor (< 1 = closer). */
  frame(x: number, z: number, zoom: number): void {
    this.followTarget.set(x, z);
    this.follow.set(x, z);
    this.zoom = this.zoomTarget = zoom;
    this.returning = false;
    this.apply();
  }

  /** Right-stick nudge in [−1, 1]² (x = yaw, y = pitch). Zero returns to rest. */
  setNudge(x: number, y: number): void {
    if (this.settings.reduceMotion) {
      this.nudgeTarget.set(0, 0);
      return;
    }
    this.nudgeTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  }

  /** Advance; returns true while anything is still moving. */
  update(dt: number): boolean {
    const s = this.speed === Infinity ? 1000 : this.speed;
    if (this.rotT < 1) {
      this.rotT = Math.min(1, this.rotT + (dt * s) / this.rotDur);
      this.yaw = this.yawFrom + (this.yawTo - this.yawFrom) * easeInOut(this.rotT);
    }
    // Follow eases in quickly; the return to rest takes ≈0.8 s.
    const rate = (this.returning ? 4.2 : 5) * s;
    this.follow.x = damp(this.follow.x, this.followTarget.x, rate, dt);
    this.follow.y = damp(this.follow.y, this.followTarget.y, rate, dt);
    this.zoom = damp(this.zoom, this.zoomTarget, rate, dt);
    this.nudge.x = damp(this.nudge.x, this.nudgeTarget.x, 8, dt);
    this.nudge.y = damp(this.nudge.y, this.nudgeTarget.y, 8, dt);
    this.apply();
    const settled =
      this.rotT >= 1 &&
      this.follow.distanceTo(this.followTarget) < 1e-4 &&
      Math.abs(this.zoom - this.zoomTarget) < 1e-4 &&
      this.nudge.distanceTo(this.nudgeTarget) < 1e-3;
    if (settled) {
      this.follow.copy(this.followTarget);
      this.zoom = this.zoomTarget;
      this.nudge.copy(this.nudgeTarget);
      this.apply();
    }
    return !settled;
  }

  apply(): void {
    const overhead = this.settings.reduceMotion;
    const rest = overhead ? this.overhead : this.rest;
    const pitch = overhead ? (89 * Math.PI) / 180 : PITCH + this.nudge.y * NUDGE_PITCH;
    const yaw = overhead ? 0 : this.viewYaw;
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const restOffset = new THREE.Vector3(0, 0, rest.targetZ).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), overhead ? 0 : this.yaw));
    const target = this.tmpTarget.set(this.follow.x + restOffset.x, BOARD_TOP, this.follow.y + restOffset.z);
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)).applyQuaternion(rot);
    this.camera.position.copy(target).addScaledVector(dir, rest.distance * this.zoom);
    this.camera.up.set(0, 1, 0);
    if (overhead) this.camera.up.set(0, 0, -1);
    this.camera.lookAt(target);
    this.lightRig.rotation.y = overhead ? 0 : this.yaw;
  }
}
