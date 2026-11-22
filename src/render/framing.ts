// Stage 2 close-up camera geometry: what a shot frames, where the token is along the ring of
// tiles, and the solver that fits a set of board points into the safe screen area.
import * as THREE from 'three';
import type { BoardData } from '../data/classicBoard';
import { groupTiles } from '../engine/queries';
import { BAND_CENTER_LY, BOARD_TOP, CORNER_PX, IN_JAIL, SIDE_YAW, TILE_H_PX, TILE_W_PX, type Side, tileFrame, tileLocalToWorld } from './layout';

/** Free screen region in normalized device coordinates (between the panels, below the banner). */
export interface SafeArea {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const FULL_SCREEN: SafeArea = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };

const mod40 = (t: number) => ((t % 40) + 40) % 40;

/** World (x, z) of a tile's center. */
export function tileCenter(tile: number): [number, number] {
  return tileLocalToWorld(tileFrame(mod40(tile)), 0, 0);
}

/**
 * A point on the ring of tile centers at continuous position `s` (tile k at s = k, any real s,
 * wrapping around the board). Straight lines between neighbouring centers.
 */
export function ringPoint(s: number): [number, number] {
  const a = Math.floor(s);
  const t = s - a;
  const [ax, az] = tileCenter(a);
  if (t === 0) return [ax, az];
  const [bx, bz] = tileCenter(a + 1);
  return [ax + (bx - ax) * t, az + (bz - az) * t];
}

const smoothstep = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

function shortest(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Side yaw at ring position `s`, blended across corners: the turn spans the hop onto the corner
 * and the hop after it (s from 10k − 1 to 10k + 1), so it depends only on where the token is and
 * plays the same forwards and backwards. Returned near `near` (no 2π jumps).
 */
export function ringSideYaw(s: number, near = 0): number {
  const u = mod40(s);
  const k = Math.round(u / 10);
  const local = u - 10 * k;
  let yaw: number;
  if (Math.abs(local) >= 1) {
    yaw = SIDE_YAW[(Math.floor(u / 10) % 4) as Side];
  } else {
    const a = SIDE_YAW[(((k - 1) % 4) + 4) % 4 as Side];
    const b = SIDE_YAW[(k % 4) as Side];
    yaw = a + shortest(a, b) * smoothstep((local + 1) / 2);
  }
  return near + shortest(near, yaw);
}

/**
 * Tiles a Home / Landed shot frames for a token on `tile` (SPEC Stage 2 §2.1):
 * a street frames its whole color group; a corner (and jail) frames the corner plus the first
 * tile of each adjoining side; any other tile frames itself and its two neighbours.
 */
export function framingTiles(board: BoardData | null, tile: number): number[] {
  const t = tile === IN_JAIL ? 10 : mod40(tile);
  const g = board?.tiles[t]?.group;
  if (board && g && board.tiles[t].type === 'street') return groupTiles(board, g);
  return [mod40(t - 1), t, mod40(t + 1)];
}

/**
 * Board points to keep in frame for a set of tiles: each tile's four corners on the board face,
 * plus its color band raised to `buildingTop` (houses and hotels stand on the band).
 */
export function framingPoints(tiles: number[], buildingTop: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const i of tiles) {
    const f = tileFrame(i);
    const hw = (f.corner ? CORNER_PX : TILE_W_PX) / 2;
    const hh = (f.corner ? CORNER_PX : TILE_H_PX) / 2;
    for (const [lx, ly] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]) {
      const [x, z] = tileLocalToWorld(f, lx, ly);
      out.push(new THREE.Vector3(x, BOARD_TOP, z));
    }
    if (!f.corner && buildingTop > 0) {
      for (const lx of [-hw * 0.8, hw * 0.8]) {
        const [x, z] = tileLocalToWorld(f, lx, BAND_CENTER_LY);
        out.push(new THREE.Vector3(x, BOARD_TOP + buildingTop, z));
      }
    }
  }
  return out;
}

/** Unit vector from the focus toward the camera for a yaw and pitch (same convention as Table). */
export function viewDir(yaw: number, pitch: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(0, Math.sin(pitch), Math.cos(pitch)).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

const tmpCam = new THREE.PerspectiveCamera();
const tmpV = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

/** Projected NDC bounds of `points` from a camera at focus + dir × distance. Null if any is behind. */
export function projectBounds(
  points: THREE.Vector3[],
  focus: THREE.Vector3,
  yaw: number,
  pitch: number,
  distance: number,
  fov: number,
  aspect: number,
): { xMin: number; xMax: number; yMin: number; yMax: number } | null {
  tmpCam.fov = fov;
  tmpCam.aspect = aspect;
  tmpCam.near = 0.001;
  tmpCam.far = 100;
  tmpCam.updateProjectionMatrix();
  tmpCam.position.copy(focus).addScaledVector(viewDir(yaw, pitch, tmpDir), distance);
  tmpCam.up.set(0, 1, 0);
  tmpCam.lookAt(focus);
  tmpCam.updateMatrixWorld();
  const b = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
  for (const p of points) {
    tmpV.copy(p).applyMatrix4(tmpCam.matrixWorldInverse);
    if (tmpV.z > -0.002) return null;
    tmpV.applyMatrix4(tmpCam.projectionMatrix);
    b.xMin = Math.min(b.xMin, tmpV.x);
    b.xMax = Math.max(b.xMax, tmpV.x);
    b.yMin = Math.min(b.yMin, tmpV.y);
    b.yMax = Math.max(b.yMax, tmpV.y);
  }
  return b;
}

/**
 * Fit `points` inside `safe` (shrunk by `margin` of its size on every edge) for a fixed yaw,
 * pitch and FOV: binary-search the distance, and at each distance slide the focus over the board
 * until the projected bounds are centered in the safe area (not the middle of the screen).
 */
export function solveFraming(
  points: THREE.Vector3[],
  yaw: number,
  pitch: number,
  fov: number,
  aspect: number,
  safe: SafeArea,
  margin = 0.06,
): { fx: number; fz: number; distance: number } {
  const mx = (safe.xMax - safe.xMin) * margin;
  const my = (safe.yMax - safe.yMin) * margin;
  const box = { xMin: safe.xMin + mx, xMax: safe.xMax - mx, yMin: safe.yMin + my, yMax: safe.yMax - my };
  const cx = (box.xMin + box.xMax) / 2;
  const cy = (box.yMin + box.yMax) / 2;
  const centroid = new THREE.Vector3();
  for (const p of points) centroid.add(p);
  centroid.divideScalar(points.length);
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const half = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const focus = new THREE.Vector3();
  const centerAt = (d: number) => {
    focus.set(centroid.x, BOARD_TOP, centroid.z);
    let b = projectBounds(points, focus, yaw, pitch, d, fov, aspect);
    for (let i = 0; i < 12 && b; i++) {
      const ex = (b.xMin + b.xMax) / 2 - cx;
      const ey = (b.yMin + b.yMax) / 2 - cy;
      if (Math.abs(ex) < 1e-5 && Math.abs(ey) < 1e-5) break;
      // NDC → world near the focus: x spans d·tan(fov/2)·aspect, y is foreshortened by sin(pitch).
      focus.addScaledVector(right, ex * d * half * aspect);
      focus.addScaledVector(forward, (ey * d * half) / Math.max(0.2, Math.sin(pitch)));
      b = projectBounds(points, focus, yaw, pitch, d, fov, aspect);
    }
    return b;
  };
  const fits = (d: number) => {
    const b = centerAt(d);
    return !!b && b.xMin >= box.xMin && b.xMax <= box.xMax && b.yMin >= box.yMin && b.yMax <= box.yMax;
  };
  let lo = 0.05;
  let hi = 8;
  for (let i = 0; i < 32; i++) {
    const d = (lo + hi) / 2;
    if (fits(d)) hi = d;
    else lo = d;
  }
  centerAt(hi);
  return { fx: focus.x, fz: focus.z, distance: hi };
}

/**
 * World AABB of a building standing on a tile's color band: `width` along the tile, `depth`
 * across it, `height` up, centered at local x = `lx` on the band.
 */
export function bandBox(tile: number, width: number, depth: number, height: number, lx = 0): THREE.Box3 {
  const f = tileFrame(tile);
  const [x, z] = tileLocalToWorld(f, lx, BAND_CENTER_LY);
  const alongX = f.side === 0 || f.side === 2;
  const hx = (alongX ? width : depth) / 2;
  const hz = (alongX ? depth : width) / 2;
  return new THREE.Box3(new THREE.Vector3(x - hx, BOARD_TOP, z - hz), new THREE.Vector3(x + hx, BOARD_TOP + height, z + hz));
}

/**
 * Fraction (0–1) of a token (a vertical segment from its base to `height`) hidden behind any of
 * `boxes` as seen from `eye`, by ray samples.
 */
export function occludedFraction(eye: THREE.Vector3, token: THREE.Vector3, height: number, boxes: THREE.Box3[], samples = 9): number {
  if (!boxes.length) return 0;
  const ray = new THREE.Ray();
  const p = new THREE.Vector3();
  const hit = new THREE.Vector3();
  let hidden = 0;
  for (let i = 0; i < samples; i++) {
    p.set(token.x, token.y + (height * (i + 0.5)) / samples, token.z);
    const len = eye.distanceTo(p);
    ray.origin.copy(eye);
    ray.direction.copy(p).sub(eye).normalize();
    if (boxes.some((b) => !b.containsPoint(p) && ray.intersectBox(b, hit) && eye.distanceTo(hit) < len - 1e-4)) hidden++;
  }
  return hidden / samples;
}
