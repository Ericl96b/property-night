// Dice visuals (SPEC §10.6): RoundedBoxGeometry (radius ≈ 18%), ivory polished resin,
// recessed pips via a normal map + dark pip albedo in a per-face texture atlas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DIE_SIZE, FACE_VALUES, type DiceThrow, samplePose, throwDuration } from './diceSim';
import { makeCanvas } from './noise';

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.27, 0.24], [0.73, 0.24], [0.27, 0.5], [0.73, 0.5], [0.27, 0.76], [0.73, 0.76]],
};

/** Atlas: 3 × 2 cells, cell index = BoxGeometry group index (face axis). */
function atlas(cell: number): { albedo: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const W = cell * 3;
  const H = cell * 2;
  const albedo = makeCanvas(W, H);
  const a = albedo.getContext('2d')!;
  a.fillStyle = '#F6EEDD';
  a.fillRect(0, 0, W, H);
  const height = new Float32Array(W * H);
  const pipR = cell * 0.085;
  FACE_VALUES.forEach((value, face) => {
    const ox = (face % 3) * cell;
    const oy = Math.floor(face / 3) * cell;
    for (const [u, v] of PIPS[value]) {
      const cx = ox + u * cell;
      const cy = oy + v * cell;
      const g = a.createRadialGradient(cx - pipR * 0.25, cy - pipR * 0.25, pipR * 0.1, cx, cy, pipR);
      g.addColorStop(0, '#120C08');
      g.addColorStop(0.75, '#2B2119');
      g.addColorStop(1, '#4A3B2C');
      a.fillStyle = g;
      a.beginPath();
      a.arc(cx, cy, pipR, 0, Math.PI * 2);
      a.fill();
      // Spherical dimple in the height field (slightly larger than the paint for a rim).
      const R = pipR * 1.12;
      for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
        for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
          const d = Math.hypot(x - cx, y - cy) / R;
          if (d < 1) height[y * W + x] = Math.min(height[y * W + x], -Math.sqrt(1 - d * d));
        }
      }
    }
  });
  const normal = makeCanvas(W, H);
  const n = normal.getContext('2d')!;
  const img = n.createImageData(W, H);
  const strength = cell * 0.02;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hx = height[y * W + Math.min(W - 1, x + 1)] - height[y * W + Math.max(0, x - 1)];
      const hy = height[Math.min(H - 1, y + 1) * W + x] - height[Math.max(0, y - 1) * W + x];
      let nx = -hx * strength;
      let ny = hy * strength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * W + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  n.putImageData(img, 0, 0);
  return { albedo, normal };
}

function dieGeometry(): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 5, DIE_SIZE * 0.18);
  // Remap each face's 0–1 UVs into its atlas cell (group index = face axis).
  const uv = g.attributes.uv;
  for (const grp of g.groups) {
    const face = grp.materialIndex ?? 0;
    const ox = (face % 3) / 3;
    const oy = 1 - (Math.floor(face / 3) + 1) / 2;
    // RoundedBoxGeometry is non-indexed: group ranges address vertices directly.
    for (let vi = grp.start; vi < grp.start + grp.count; vi++) {
      const u = THREE.MathUtils.clamp(uv.getX(vi), 0, 1);
      const v = THREE.MathUtils.clamp(uv.getY(vi), 0, 1);
      uv.setXY(vi, ox + (u * 0.96 + 0.02) / 3, oy + (v * 0.96 + 0.02) / 2);
    }
  }
  g.clearGroups();
  return g;
}

export class Dice {
  readonly group = new THREE.Group();
  /** Body transforms (physics); each holds a visual child carrying the re-label rotation. */
  readonly bodies: [THREE.Object3D, THREE.Object3D];
  private visuals: [THREE.Mesh, THREE.Mesh];
  private material: THREE.MeshPhysicalMaterial;

  constructor(cellSize: number) {
    const { albedo, normal } = atlas(cellSize);
    const map = new THREE.CanvasTexture(albedo);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const normalMap = new THREE.CanvasTexture(normal);
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map,
      normalMap,
      normalScale: new THREE.Vector2(1, 1),
      roughness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
    });
    const geo = dieGeometry();
    const make = () => {
      const body = new THREE.Object3D();
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      body.add(mesh);
      this.group.add(body);
      return { body, mesh };
    };
    const a = make();
    const b = make();
    this.bodies = [a.body, b.body];
    this.visuals = [a.mesh, b.mesh];
    this.group.visible = false;
    this.group.name = 'dice';
  }

  /** Apply a throw's re-label rotations and pose the dice at recording time t. */
  pose(th: DiceThrow, t: number): void {
    for (let i = 0; i < 2; i++) {
      samplePose(th, i, t, this.bodies[i].position, this.bodies[i].quaternion);
      this.visuals[i].quaternion.copy(th.relabel[i]);
    }
    this.group.visible = true;
  }

  /**
   * Animation for the queue: plays the pre-recorded throw back in real time × speed.
   * Returns a tick function (true while running) and the playback duration.
   */
  play(th: DiceThrow, speed: number, onContact?: () => void): (dt: number) => boolean {
    const dur = throwDuration(th);
    let t = 0;
    let nextContact = 0;
    this.pose(th, 0);
    return (dt) => {
      t = Math.min(dur, t + dt * speed);
      this.pose(th, t);
      while (nextContact < th.contacts.length && th.contacts[nextContact] * (1 / 120) <= t) {
        onContact?.();
        nextContact++;
      }
      return t < dur;
    };
  }
}
