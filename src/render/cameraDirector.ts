// Camera (SPEC §10.7). Two styles:
// - Table (the pre-Stage-2 camera, unchanged): vertical FOV 30°, pitch 58°, board fills ≈88% of
//   screen height at rest; rotates per active player's side (1.4 s ease-in-out, shortest
//   direction) together with the light rig; gentle follow while a token moves; push-ins.
// - Close-up (Stage 2, default): the camera eases between *shots* (focus, yaw, pitch, distance,
//   FOV) with critically damped smoothing: Home / Landed frame the active token's color group,
//   Dice pulls back to a medium view, Chase trails the moving token along the row.
// Both styles write the camera through `writePose`. Right-stick nudge / orbit, hold-to-peek, and
// the reduce-motion overhead view (which overrides both styles).
import * as THREE from 'three';
import type { BoardData } from '../data/classicBoard';
import { FULL_SCREEN, type SafeArea, framingPoints, framingTiles, projectBounds, ringPoint, ringSideYaw, solveFraming, viewDir } from './framing';
import { BOARD_SIZE, BOARD_TOP, IN_JAIL, SIDE_YAW, type Side, sideOfTile, tokenSpots } from './layout';

// ---- tunables (Stage 2 close-up; tune on the TV via Test board → Camera) ----
/**
 * Close-up camera tunables. Angles in degrees, distances in board units (board = 1.0 wide),
 * smoothing as critically damped smooth times in seconds at speed factor 1 (divided by the speed
 * setting's factor, so Normal = 0.6 plays them 1/0.6 slower, like the Table side turn).
 */
export const CLOSEUP = {
  /** Vertical field of view for close-up shots. */
  fov: 30,
  /** Home / Landed: pitch, yaw offset toward the direction of travel, and framing margin. */
  homePitch: 40,
  homeYawOffset: 20,
  homeMargin: 0.06,
  /** Dice: Table rest view at the active side's yaw, scaled by this zoom (< 1 = closer). */
  diceZoom: 0.9,
  /** The throw starts once the camera has covered this fraction of the move to the Dice shot. */
  diceGate: 0.8,
  /** Chase: pitch, yaw offset toward travel, aim point tiles ahead of the token, distance. */
  chasePitch: 30,
  chaseYawOffset: 40,
  chaseLookAhead: 1.5,
  chaseDistance: 0.3,
  /** Smooth times: Home/Landed/Dice, turn handoff (≈ settles in 1.4 s at factor 1), chase trail, peek. */
  shotSmooth: 0.3,
  handoffSmooth: 0.42,
  chaseSmooth: 0.2,
  peekSmooth: 0.12,
  /** Lowest camera height above the board face (≈ a hotel). */
  minHeight: 0.04,
  /** Height of the tallest building, framed on the color band. */
  buildingTop: 0.04,
  /** Right-stick orbit around the shot's focus. */
  orbitYaw: 25,
  orbitPitchUp: 15,
  orbitPitchDown: 5,
};

export type CloseupTunables = typeof CLOSEUP;

const FOV = 30;
const PITCH = (58 * Math.PI) / 180;
const OVERHEAD_PITCH = (89 * Math.PI) / 180;
const FILL = 0.88;
const FOLLOW_MAX_OFFSET = 0.15 * BOARD_SIZE;
const FOLLOW_ZOOM = 0.88;
const NUDGE_YAW = (10 * Math.PI) / 180;
const NUDGE_PITCH = (7 * Math.PI) / 180;
const DEG = Math.PI / 180;
/** Token height (base + figure) kept inside the frame. */
const TOKEN_HEIGHT = 0.045;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));
const smoothstep = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

function shortestDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Solve camera distance and target offset so the board spans at most FILL of the screen height,
 * centered, and its widest (near) edge stays within ±maxX in normalized device coordinates (the
 * free space between the overlay's side panels). The board is square, so one solve holds for
 * every side the rig rotates to.
 */
export function solveRest(pitch: number, aspect = 16 / 9, maxX = 1): { distance: number; targetZ: number } {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.01, 50);
  const corners = [-0.5, 0.5].flatMap((x) => [-0.5, 0.5].map((z) => new THREE.Vector3(x * BOARD_SIZE, BOARD_TOP, z * BOARD_SIZE)));
  const extent = (d: number, tz: number) => {
    const target = new THREE.Vector3(0, BOARD_TOP, tz);
    cam.position.set(0, BOARD_TOP + Math.sin(pitch) * d, tz + Math.cos(pitch) * d);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    let lo = Infinity;
    let hi = -Infinity;
    let x = 0;
    for (const c of corners) {
      const p = c.clone().project(cam);
      lo = Math.min(lo, p.y);
      hi = Math.max(hi, p.y);
      x = Math.max(x, Math.abs(p.x));
    }
    return { lo, hi, x };
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
    const { lo, hi, x } = extent(d, tz);
    if (hi - lo > FILL * 2 || x > maxX) dLo = d;
    else dHi = d;
  }
  return { distance: (dLo + dHi) / 2, targetZ: tz };
}

export type CameraStyle = 'closeup' | 'table';

export interface CameraSettings {
  rotation: boolean;
  follow: boolean;
  reduceMotion: boolean;
  /** Stage 2. Board rotation and follow apply to Table only. */
  style: CameraStyle;
}

/** A camera target state: focus on the board face, yaw, pitch (radians), distance, FOV (degrees). */
export interface ShotPose {
  fx: number;
  fz: number;
  yaw: number;
  pitch: number;
  distance: number;
  fov: number;
}

const KEYS = ['fx', 'fz', 'yaw', 'pitch', 'distance', 'fov'] as const;
type Key = (typeof KEYS)[number];

/** Where the moving token is along the ring (tile k at s = k) and which way it travels. */
export interface ChaseInfo {
  s: number;
  dir: 1 | -1;
  /** Live token position (kept inside the safe area). */
  token?: THREE.Vector3;
}

/** Obstacles the camera must stay out of (buildings, tokens, decks, dice), world AABBs. */
export type ObstacleFn = () => THREE.Box3[];

export class CameraDirector {
  readonly camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 30);
  /** Rotates with the side yaw. The key light lives here. */
  readonly lightRig = new THREE.Group();
  settings: CameraSettings = { rotation: true, follow: true, reduceMotion: false, style: 'closeup' };
  speed = 1;
  /** Board data for group framing (set by the scene; null frames a tile and its neighbours). */
  board: BoardData | null = null;
  /** Obstacle boxes for the clipping guard (set by the scene). */
  obstacles: ObstacleFn | null = null;

  private rest = solveRest(PITCH);
  private overhead = solveRest(OVERHEAD_PITCH);
  private viewport = { aspect: 16 / 9, maxX: 1 };
  private safe: SafeArea = { ...FULL_SCREEN };
  side: Side = 0;
  /** Side yaw: the Table rig yaw, and in Close-up the light rig's yaw (eased per side turn). */
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

  // Close-up state: current pose, its velocity, the goal, and the move's start (for progress).
  private cur: ShotPose = { fx: 0, fz: 0, yaw: 0, pitch: PITCH, distance: 2, fov: FOV };
  private vel: Record<Key, number> = { fx: 0, fz: 0, yaw: 0, pitch: 0, distance: 0, fov: 0 };
  private goal: ShotPose = { ...this.cur };
  private start: ShotPose = { ...this.cur };
  private smooth = CLOSEUP.shotSmooth;
  private chasing = false;
  /** Live position of the chased token (the leash keeps it inside the safe area). */
  private chaseToken: THREE.Vector3 | null = null;
  private peekOn = false;
  private peekW = 0;
  private lastViewYaw = 0;
  /** True once a close-up shot has been placed (before that the first shot snaps). */
  private placed = false;

  constructor() {
    this.lightRig.name = 'light-rig';
    this.cur = this.restPose(0, 1);
    this.goal = { ...this.cur };
    this.start = { ...this.cur };
    this.apply();
  }

  /** Close-up shots are in effect (Close-up style and not Reduce motion). */
  get closeup(): boolean {
    return this.settings.style === 'closeup' && !this.settings.reduceMotion;
  }

  /**
   * Window resized: re-fit the rest and overhead views to the real aspect ratio and to the free
   * width between the side panels (`maxX`, normalized device coordinates). `safe` is the free
   * region close-up shots keep their subject in (defaults to ±maxX, full height).
   */
  setViewport(w: number, h: number, maxX: number, safe?: SafeArea): void {
    const aspect = w / h;
    const nextSafe = safe ?? { xMin: -maxX, xMax: maxX, yMin: -1, yMax: 1 };
    this.safe = { ...nextSafe };
    if (Math.abs(aspect - this.viewport.aspect) < 1e-6 && Math.abs(maxX - this.viewport.maxX) < 1e-6) return;
    this.viewport = { aspect, maxX };
    this.rest = solveRest(PITCH, aspect, maxX);
    this.overhead = solveRest(OVERHEAD_PITCH, aspect, maxX);
    this.apply();
  }

  get aspect(): number {
    return this.viewport.aspect;
  }

  get safeArea(): SafeArea {
    return { ...this.safe };
  }

  /** Current view yaw including nudge / orbit (tokens face this). */
  get viewYaw(): number {
    if (this.closeup) return this.lastViewYaw;
    return this.yaw + this.nudge.x * NUDGE_YAW;
  }

  /** The side yaw the light rig follows. */
  get sideYaw(): number {
    return this.yaw;
  }

  get rotating(): boolean {
    return this.rotT < 1;
  }

  /** Rotate the rig so `side` is nearest the viewer (shortest direction). */
  toSide(side: Side, instant = false): void {
    this.side = side;
    // Close-up has rotation built in; the Board rotation toggle applies to Table only.
    if (this.settings.reduceMotion || (!this.settings.rotation && this.settings.style !== 'closeup')) {
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

  /**
   * Payment moment: push in slightly on a board point (null returns to rest). SPEC §10.9.
   * Close-up is already close, so the push-in does nothing to the camera there.
   */
  pushIn(point: THREE.Vector3 | null): void {
    if (!point || this.settings.reduceMotion || this.closeup) {
      this.followTarget.set(0, 0);
      this.zoomTarget = 1;
      this.returning = true;
      return;
    }
    const f = new THREE.Vector2(point.x, point.z).multiplyScalar(0.35);
    if (f.length() > FOLLOW_MAX_OFFSET) f.setLength(FOLLOW_MAX_OFFSET);
    this.followTarget.copy(f);
    this.zoomTarget = 0.86;
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

  /** Right-stick nudge in [−1, 1]² (x = yaw, y = pitch). Zero returns to rest / to the shot. */
  setNudge(x: number, y: number): void {
    if (this.settings.reduceMotion) {
      this.nudgeTarget.set(0, 0);
      return;
    }
    this.nudgeTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  }

  /** Hold-to-peek: ease to the Table rest view on the current side; release returns to the shot. */
  setPeek(on: boolean): void {
    this.peekOn = on && !this.settings.reduceMotion;
    if (this.speed === Infinity) this.peekW = this.peekOn ? 1 : 0;
  }

  get peeking(): boolean {
    return this.peekOn;
  }

  // ---------------------------------------------------------------- close-up shots

  /** Table rest view at a yaw (focus offset rotates with it), scaled by `zoom`. */
  restPose(yaw: number, zoom: number): ShotPose {
    const tz = this.rest.targetZ;
    return { fx: Math.sin(yaw) * tz, fz: Math.cos(yaw) * tz, yaw, pitch: PITCH, distance: this.rest.distance * zoom, fov: FOV };
  }

  /**
   * Home / Landed shot for a token on `tile`: its color group (or the corner plus neighbours),
   * seen from the side it is on, turned `dir` × homeYawOffset toward the direction of travel.
   */
  homePose(tile: number, dir: 1 | -1 = 1): ShotPose {
    const t = tile === IN_JAIL ? 10 : tile;
    const tiles = framingTiles(this.board, t);
    const pts = framingPoints(tiles, CLOSEUP.buildingTop);
    const yaw = SIDE_YAW[sideOfTile(t)] + dir * CLOSEUP.homeYawOffset * DEG;
    const pitch = CLOSEUP.homePitch * DEG;
    const f = solveFraming(pts, yaw, pitch, CLOSEUP.fov, this.viewport.aspect, this.safe, CLOSEUP.homeMargin);
    return this.guard({ fx: f.fx, fz: f.fz, yaw, pitch, distance: f.distance, fov: CLOSEUP.fov });
  }

  /**
   * Dice shot: the Table rest view at the side's yaw, zoomed in by `diceZoom`. If the active
   * token on `tile` would leave the screen (corners), zoom back out until it fits.
   */
  dicePose(side: Side = this.side, tile?: number): ShotPose {
    let zoom = CLOSEUP.diceZoom;
    let p = this.restPose(SIDE_YAW[side], zoom);
    if (tile === undefined) return p;
    const spot = tokenSpots(tile, 1)[0];
    const pts = [new THREE.Vector3(spot[0], BOARD_TOP, spot[1]), new THREE.Vector3(spot[0], BOARD_TOP + TOKEN_HEIGHT, spot[1])];
    const maxX = this.viewport.maxX;
    for (let i = 0; i < 20 && zoom < 1.2; i++) {
      const b = projectBounds(pts, new THREE.Vector3(p.fx, BOARD_TOP, p.fz), p.yaw, p.pitch, p.distance, p.fov, this.viewport.aspect);
      if (b && b.xMin >= -maxX && b.xMax <= maxX && b.yMin >= -0.98 && b.yMax <= 0.98) break;
      zoom += 0.01;
      p = this.restPose(SIDE_YAW[side], zoom);
    }
    return p;
  }

  /**
   * Chase shot: outside the board edge, behind the token, looking along the row at a point
   * `chaseLookAhead` tiles ahead; the side yaw blends across corners (see `ringSideYaw`).
   */
  chasePose(info: ChaseInfo, near = this.goal.yaw): ShotPose {
    const off = info.dir * CLOSEUP.chaseYawOffset * DEG;
    const yaw = ringSideYaw(info.s, near - off) + off;
    const [ax, az] = ringPoint(info.s + info.dir * CLOSEUP.chaseLookAhead);
    const pose: ShotPose = { fx: ax, fz: az, yaw, pitch: CLOSEUP.chasePitch * DEG, distance: CLOSEUP.chaseDistance, fov: CLOSEUP.fov };
    const base = info.token ? info.token.clone().setY(BOARD_TOP) : tokenPoint(info.s);
    const token = [base, base.clone().setY(BOARD_TOP + TOKEN_HEIGHT)];
    const focus = new THREE.Vector3(ax, BOARD_TOP, az);
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const half = Math.tan((pose.fov * DEG) / 2) * this.viewport.aspect;
    const cx = (this.safe.xMin + this.safe.xMax) / 2;
    for (let i = 0; i < 24; i++) {
      // Slide the aim sideways so the token sits on the safe area's center line (the aim's depth
      // keeps the look-ahead), then back off until the whole token is inside the safe area.
      for (let j = 0; j < 4; j++) {
        const b = projectBounds(token, focus, pose.yaw, pose.pitch, pose.distance, pose.fov, this.viewport.aspect);
        if (!b) break;
        focus.addScaledVector(right, ((b.xMin + b.xMax) / 2 - cx) * pose.distance * half);
      }
      const b = projectBounds(token, focus, pose.yaw, pose.pitch, pose.distance, pose.fov, this.viewport.aspect);
      if (b && b.xMin >= this.safe.xMin && b.xMax <= this.safe.xMax && b.yMin >= this.safe.yMin && b.yMax <= this.safe.yMax) break;
      pose.distance *= 1.05;
    }
    pose.fx = focus.x;
    pose.fz = focus.z;
    return this.guard(pose);
  }

  /**
   * Ease (critically damped) to a shot. `smooth` is the smooth time at speed factor 1; Instant
   * speed, `instant`, or the very first shot snap.
   */
  shot(pose: ShotPose, smooth = CLOSEUP.shotSmooth, instant = false): void {
    this.chasing = false;
    this.setGoal(pose, smooth);
    if (instant || this.speed === Infinity || !this.placed) this.settle();
    this.placed = true;
  }

  /** Chase the moving token (driven by its hops). Null ends the chase (the next shot takes over). */
  chase(info: ChaseInfo | null): void {
    if (!info) {
      this.chasing = false;
      this.chaseToken = null;
      return;
    }
    this.chaseToken = info.token ? info.token.clone() : tokenPoint(info.s);
    const pose = this.chasePose(info);
    if (!this.chasing) {
      this.chasing = true;
      // Swing into the chase at the shot pace, then tighten to the chase trail over ≈ one hop.
      this.setGoal(pose, Math.max(CLOSEUP.shotSmooth, CLOSEUP.chaseSmooth));
    } else {
      this.goal = pose;
    }
    if (this.speed === Infinity || !this.placed) this.settle();
    this.placed = true;
  }

  /** Snap to the current goal (skip / Instant) and finish any side turn. */
  settle(): void {
    for (const k of KEYS) {
      this.cur[k] = this.goal[k];
      this.vel[k] = 0;
    }
    if (this.rotT < 1) {
      this.rotT = 1;
      this.yaw = this.yawTo;
    }
    this.peekW = this.peekOn ? 1 : 0;
    this.apply();
  }

  /** Fraction of the current close-up move covered (1 = arrived). */
  progress(): number {
    const total = poseDistance(this.start, this.goal);
    if (total < 1e-6) return 1;
    return Math.max(0, Math.min(1, 1 - poseDistance(this.cur, this.goal) / total));
  }

  /** The close-up goal pose (tests, test board). */
  get goalPose(): ShotPose {
    return { ...this.goal };
  }

  /** The close-up pose before orbit / peek / guards (tests). */
  get currentPose(): ShotPose {
    return { ...this.cur };
  }

  private setGoal(pose: ShotPose, smooth: number): void {
    // Unwrap the goal yaw next to the current yaw so the move takes the shortest direction.
    const g = { ...pose, yaw: this.cur.yaw + shortestDelta(this.cur.yaw, pose.yaw) };
    this.goal = g;
    this.start = { ...this.cur };
    this.smooth = smooth;
  }

  /**
   * Keep a pose clear of the board and of obstacles: at least `minHeight` above the face and
   * never inside a building, token, deck or die box. Raises the pitch until clear.
   */
  guard(pose: ShotPose): ShotPose {
    const p = { ...pose };
    const boxes = this.obstacles?.() ?? [];
    const focus = new THREE.Vector3(p.fx, BOARD_TOP, p.fz);
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    for (let i = 0; i < 90; i++) {
      pos.copy(focus).addScaledVector(viewDir(p.yaw, p.pitch, dir), p.distance);
      const low = pos.y < BOARD_TOP + CLOSEUP.minHeight;
      const inside = boxes.some((b) => b.containsPoint(pos));
      if (!low && !inside) break;
      p.pitch = Math.min(88 * DEG, p.pitch + DEG);
    }
    return p;
  }

  /** The close-up pose actually shown: spring state + orbit, blended toward the peek view. */
  private composed(): ShotPose {
    const p = { ...this.cur };
    p.yaw += this.nudge.x * CLOSEUP.orbitYaw * DEG;
    p.pitch += this.nudge.y * (this.nudge.y >= 0 ? CLOSEUP.orbitPitchUp : CLOSEUP.orbitPitchDown) * DEG;
    const w = smoothstep(this.peekW);
    if (w > 0) {
      const r = this.restPose(this.yaw, 1);
      for (const k of KEYS) {
        if (k === 'yaw') p.yaw += shortestDelta(p.yaw, r.yaw) * w;
        else p[k] += (r[k] - p[k]) * w;
      }
    }
    return w > 0.999 ? p : this.guard(p);
  }

  // ---------------------------------------------------------------- frame update

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
    let closeMoving = false;
    if (this.closeup) {
      closeMoving = this.stepSpring(dt);
      if (this.chasing) this.leash();
      const pw = this.peekOn ? 1 : 0;
      if (this.speed === Infinity) this.peekW = pw;
      else {
        this.peekW = damp(this.peekW, pw, s / CLOSEUP.peekSmooth, dt);
        if (Math.abs(this.peekW - pw) < 1e-3) this.peekW = pw;
      }
      closeMoving = closeMoving || this.peekW !== pw || this.chasing;
    }
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
    return !settled || closeMoving;
  }

  /**
   * The chase trails the token, so on a fast hop or a corner the lagging camera could let it
   * slip out of frame. Slide the current focus (not the goal) just enough to keep the whole
   * token inside the safe area (Stage 2 §2.3: the token never leaves it).
   */
  private leash(): void {
    const tok = this.chaseToken;
    if (!tok) return;
    const pts = [tok.clone().setY(BOARD_TOP), tok.clone().setY(BOARD_TOP + TOKEN_HEIGHT)];
    const s = this.safe;
    const inset = 0.02;
    const half = Math.tan((this.cur.fov * DEG) / 2);
    const right = new THREE.Vector3(Math.cos(this.cur.yaw), 0, -Math.sin(this.cur.yaw));
    const forward = new THREE.Vector3(-Math.sin(this.cur.yaw), 0, -Math.cos(this.cur.yaw));
    for (let i = 0; i < 4; i++) {
      const b = projectBounds(pts, new THREE.Vector3(this.cur.fx, BOARD_TOP, this.cur.fz), this.cur.yaw, this.cur.pitch, this.cur.distance, this.cur.fov, this.viewport.aspect);
      if (!b) return;
      const ex = b.xMin < s.xMin + inset ? b.xMin - (s.xMin + inset) : b.xMax > s.xMax - inset ? b.xMax - (s.xMax - inset) : 0;
      const ey = b.yMin < s.yMin + inset ? b.yMin - (s.yMin + inset) : b.yMax > s.yMax - inset ? b.yMax - (s.yMax - inset) : 0;
      if (!ex && !ey) return;
      const d = this.cur.distance;
      const dx = right.clone().multiplyScalar(ex * d * half * this.viewport.aspect);
      const dz = forward.clone().multiplyScalar((ey * d * half) / Math.max(0.2, Math.sin(this.cur.pitch)));
      this.cur.fx += dx.x + dz.x;
      this.cur.fz += dx.z + dz.z;
    }
  }

  /** Critically damped step of every pose parameter (SmoothDamp). Returns true while moving. */
  private stepSpring(dt: number): boolean {
    if (this.speed === Infinity) {
      for (const k of KEYS) {
        this.cur[k] = this.goal[k];
        this.vel[k] = 0;
      }
      return false;
    }
    if (this.chasing && this.smooth > CLOSEUP.chaseSmooth) this.smooth = Math.max(CLOSEUP.chaseSmooth, this.smooth - dt * this.speed * 0.4);
    const tau = Math.max(1e-4, this.smooth / this.speed);
    const omega = 2 / tau;
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    let moving = false;
    for (const k of KEYS) {
      const target = k === 'yaw' ? this.cur.yaw + shortestDelta(this.cur.yaw, this.goal.yaw) : this.goal[k];
      const change = this.cur[k] - target;
      const temp = (this.vel[k] + omega * change) * dt;
      this.vel[k] = (this.vel[k] - omega * temp) * e;
      this.cur[k] = target + (change + temp) * e;
      const eps = k === 'fov' ? 1e-3 : 1e-5;
      if (Math.abs(this.cur[k] - target) > eps || Math.abs(this.vel[k]) > eps) moving = true;
      else {
        this.cur[k] = target;
        this.vel[k] = 0;
      }
    }
    if (!moving) this.goal.yaw = this.cur.yaw;
    return moving;
  }

  apply(): void {
    if (this.closeup) {
      const p = this.composed();
      this.writePose(p);
      this.lastViewYaw = p.yaw;
      this.lightRig.rotation.y = this.yaw;
      return;
    }
    this.applyTable();
  }

  /** The pre-Stage-2 camera, verbatim (Table style and the reduce-motion overhead). */
  private applyTable(): void {
    this.setFov(FOV);
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

  /** Write a shot pose to the camera (the shared path for close-up shots). */
  private writePose(p: ShotPose): void {
    this.setFov(p.fov);
    const target = this.tmpTarget.set(p.fx, BOARD_TOP, p.fz);
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
    const dir = new THREE.Vector3(0, Math.sin(p.pitch), Math.cos(p.pitch)).applyQuaternion(rot);
    this.camera.position.copy(target).addScaledVector(dir, p.distance);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
  }

  private setFov(fov: number): void {
    if (Math.abs(this.camera.fov - fov) < 1e-9) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
}


/** Where a lone token stands at ring position `s` (between tile spots). */
function tokenPoint(s: number): THREE.Vector3 {
  const a = Math.floor(s);
  const t = s - a;
  const [ax, az] = tokenSpots(((a % 40) + 40) % 40, 1)[0];
  const [bx, bz] = tokenSpots((((a + 1) % 40) + 40) % 40, 1)[0];
  return new THREE.Vector3(ax + (bx - ax) * t, BOARD_TOP, az + (bz - az) * t);
}

/** A rough combined size of the difference between two poses (for progress). */
function poseDistance(a: ShotPose, b: ShotPose): number {
  return (
    Math.hypot(a.fx - b.fx, a.fz - b.fz) +
    Math.abs(shortestDelta(a.yaw, b.yaw)) * 0.3 +
    Math.abs(a.pitch - b.pitch) * 0.3 +
    Math.abs(a.distance - b.distance) +
    Math.abs(a.fov - b.fov) * 0.01
  );
}
