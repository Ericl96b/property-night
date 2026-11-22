// Gummy Bear token (fixed neon pink, not a player color). The bear is one smooth signed-distance
// shape (a smooth union of ellipsoids and capsules) meshed ONCE with surface nets the first time
// it is built; tokens.ts caches the result in figureCache like every other token. Nothing here
// runs per frame. Like the other tokens it stands on the shared brass base with the player ring;
// only the bear body is pink, as an `extras` mesh with its own cheap candy material.
import * as THREE from 'three';
import { BASE_HEIGHT } from './base';

// ---- tunables ------------------------------------------------------------------------------

export const GUMMY = {
  color: 0xff2e9f,
  /** Lighter edge tint (fake light passing through the edges of the candy). */
  rimColor: 0xff9bd2,
  rimStrength: 0.55,
  rimPower: 2.4,
  /** Slight self-glow so it reads as candy, not plastic. No bloom involved. */
  emissive: 0.1,
  roughness: 0.34,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  /** Bear height (world units). Base 0.006 + bear ≈ 0.045, the set's token height. */
  height: 0.0395,
  /** Surface-net cells across the bear's height (36 → ≈5.6k triangles; the whole token ≈8.2k, same as the teacup). */
  resolution: 36,
};

// ---- shape (bear units: feet at y=0, ear tops ≈ 1, face toward +Z) --------------------------

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

function ell(x: number, y: number, z: number, c: readonly number[], r: readonly number[]): number {
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = Math.hypot(px, py, pz);
  const k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

function cap(x: number, y: number, z: number, a: readonly number[], b: readonly number[], r: number): number {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const px = x - a[0], py = y - a[1], pz = z - a[2];
  const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)));
  return Math.hypot(px - bx * t, py - by * t, pz - bz * t) - r;
}

/** Signed distance to the bear (negative inside). Mirror-symmetric in x. */
export function bearSDF(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  // Pear-shaped body: wider low belly, narrower chest.
  let d = ell(ax, y, z, [0, 0.33, 0], [0.24, 0.25, 0.2]);
  d = smin(d, ell(ax, y, z, [0, 0.5, -0.01], [0.19, 0.16, 0.16]), 0.1);
  // Big round head (gummy bears are head-heavy).
  d = smin(d, ell(ax, y, z, [0, 0.725, 0.01], [0.245, 0.205, 0.2]), 0.09);
  // Ears: chunky, slightly flattened front-to-back.
  d = smin(d, ell(ax, y, z, [0.175, 0.895, -0.015], [0.085, 0.085, 0.06]), 0.05);
  // Muzzle + nose bump.
  d = smin(d, ell(ax, y, z, [0, 0.665, 0.175], [0.11, 0.08, 0.075]), 0.05);
  d = smin(d, ell(ax, y, z, [0, 0.695, 0.245], [0.04, 0.03, 0.025]), 0.025);
  // Stubby arms, angled forward and down.
  d = smin(d, cap(ax, y, z, [0.17, 0.52, 0.02], [0.275, 0.375, 0.085], 0.07), 0.07);
  // Stubby legs with rounded feet pointing forward.
  d = smin(d, cap(ax, y, z, [0.115, 0.2, 0.01], [0.13, 0.075, 0.05], 0.092), 0.08);
  d = smin(d, ell(ax, y, z, [0.13, 0.055, 0.075], [0.088, 0.06, 0.1]), 0.05);
  // Molded eye dimples (catch highlights; no second material needed).
  d = smax(d, -(Math.hypot(ax - 0.088, y - 0.77, z - 0.205) - 0.03), 0.02);
  // Flat soles so the bear stands on the base.
  d = smax(d, -y, 0.02);
  return d;
}

const BOUNDS = { min: [-0.4, -0.05, -0.3], max: [0.4, 1.04, 0.38] } as const;

// ---- surface nets ----------------------------------------------------------------------------

/** Mesh an SDF once with naive surface nets + one projection step. Returns an indexed geometry. */
export function meshSDF(
  sdf: (x: number, y: number, z: number) => number,
  min: readonly number[],
  max: readonly number[],
  cell: number,
): THREE.BufferGeometry {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const field = new Float32Array(nx * ny * nz);
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) field[at(i, j, k)] = sdf(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);

  const vIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cIdx = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          v[c] = field[at(i + corner[c][0], j + corner[c][1], k + corner[c][2])];
          if (v[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of edges) {
          if (v[a] < 0 === v[b] < 0) continue;
          const t = v[a] / (v[a] - v[b]);
          sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
          sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
          sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
          n++;
        }
        vIndex[cIdx(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
      }

  // Project vertices onto the true surface and take normals from the SDF gradient (smooth shading).
  const e = cell * 0.25;
  const nor = new Float32Array(pos.length);
  for (let p = 0; p < pos.length; p += 3) {
    for (let it = 0; it < 2; it++) {
      const [x, y, z] = [pos[p], pos[p + 1], pos[p + 2]];
      const d = sdf(x, y, z);
      const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
      const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
      const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      const step = Math.max(-cell * 0.5, Math.min(cell * 0.5, d));
      pos[p] -= (gx / gl) * step;
      pos[p + 1] -= (gy / gl) * step;
      pos[p + 2] -= (gz / gl) * step;
      nor[p] = gx / gl;
      nor[p + 1] = gy / gl;
      nor[p + 2] = gz / gl;
    }
  }

  // One quad per sign-changing grid edge, joining the four cells around it.
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) [b, d] = [d, b];
    idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const s0 = field[at(i, j, k)] < 0, s1 = field[at(i + 1, j, k)] < 0;
        if (s0 !== s1) quad(vIndex[cIdx(i, j - 1, k - 1)], vIndex[cIdx(i, j, k - 1)], vIndex[cIdx(i, j, k)], vIndex[cIdx(i, j - 1, k)], s1);
      }
  for (let k = 1; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const s0 = field[at(i, j, k)] < 0, s1 = field[at(i, j + 1, k)] < 0;
        if (s0 !== s1) quad(vIndex[cIdx(i - 1, j, k - 1)], vIndex[cIdx(i - 1, j, k)], vIndex[cIdx(i, j, k)], vIndex[cIdx(i, j, k - 1)], s1);
      }
  for (let k = 0; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const s0 = field[at(i, j, k)] < 0, s1 = field[at(i, j, k + 1)] < 0;
        if (s0 !== s1) quad(vIndex[cIdx(i - 1, j - 1, k)], vIndex[cIdx(i, j - 1, k)], vIndex[cIdx(i, j, k)], vIndex[cIdx(i - 1, j, k)], s1);
      }

  // Make winding agree with the outward SDF normal, whatever the convention above produced.
  const P = (n: number) => new THREE.Vector3(pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2]);
  for (let t = 0; t < idx.length; t += 3) {
    const a = P(idx[t]), b = P(idx[t + 1]), c = P(idx[t + 2]);
    const fn = b.sub(a).cross(c.sub(a));
    const i0 = idx[t] * 3;
    if (fn.x * nor[i0] + fn.y * nor[i0 + 1] + fn.z * nor[i0 + 2] < 0) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

let bearGeo: THREE.BufferGeometry | undefined;
/** The bear body in token-local space (standing on the base, facing +Z). Built once. */
export function gummyBearGeometry(): THREE.BufferGeometry {
  if (bearGeo) return bearGeo;
  const g = meshSDF(bearSDF, BOUNDS.min, BOUNDS.max, 1 / GUMMY.resolution);
  g.scale(GUMMY.height, GUMMY.height, GUMMY.height);
  g.translate(0, BASE_HEIGHT - 0.0003, 0); // soles sink a hair into the base: no floating gap
  g.computeBoundingSphere();
  bearGeo = g;
  return g;
}

// ---- material ------------------------------------------------------------------------------

let gummyMat: THREE.MeshPhysicalMaterial | undefined;
/**
 * Opaque glossy candy: clearcoat (same feature the brass already uses, so no extra cost class),
 * a slight emissive lift, and a view-angle rim tint added to the emissive term. No transmission,
 * no transparency, no extra passes.
 */
export function gummyMaterial(): THREE.MeshPhysicalMaterial {
  if (gummyMat) return gummyMat;
  const m = new THREE.MeshPhysicalMaterial({
    color: GUMMY.color,
    metalness: 0,
    roughness: GUMMY.roughness,
    clearcoat: GUMMY.clearcoat,
    clearcoatRoughness: GUMMY.clearcoatRoughness,
    emissive: GUMMY.color,
    emissiveIntensity: GUMMY.emissive,
  });
  const rim = {
    rimColor: { value: new THREE.Color(GUMMY.rimColor) },
    rimStrength: { value: GUMMY.rimStrength },
    rimPower: { value: GUMMY.rimPower },
  };
  m.userData.rim = rim; // live-tunable uniforms
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, rim);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          totalEmissiveRadiance += rimColor * (pow(1.0 - ndv, rimPower) * rimStrength);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'gummy-rim-v1';
  gummyMat = m;
  return m;
}

/** Token builder: same shape as the other builders in tokens.ts (no brass above the base). */
export function gummy(): { brass: THREE.BufferGeometry[]; extras: { geometry: THREE.BufferGeometry; material: THREE.Material }[] } {
  return { brass: [], extras: [{ geometry: gummyBearGeometry(), material: gummyMaterial() }] };
}
