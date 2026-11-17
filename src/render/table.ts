// Walnut table (SPEC §10.2): procedural albedo generated once at startup — fractal noise
// stretched along the grain, mapped to a walnut ramp, plank seams on top — plus a matching
// low-contrast roughness map. The lamp pool is baked into vertex colors so the table edges
// fall into shadow (rotation-invariant, so it works with the rotating light rig).
import * as THREE from 'three';
import { Rng } from '../engine/rng';
import { fbm, makeCanvas } from './noise';

/** World size covered by one repeat of the table texture. */
const REPEAT_WORLD = 1.2;
const PLANKS_PER_REPEAT = 8;
const TABLE_SIZE = 9;

// Walnut ramp (from the approved reference filter), dark → light.
const RAMP: [number, number, number][] = [
  [0.17, 0.09, 0.05],
  [0.27, 0.15, 0.08],
  [0.36, 0.21, 0.11],
  [0.44, 0.27, 0.15],
  [0.52, 0.32, 0.18],
  [0.6, 0.37, 0.21],
];

function ramp(t: number): [number, number, number] {
  const x = Math.min(0.9999, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export interface TableTextures {
  albedo: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
  ms: number;
}

export function generateTableTextures(size: number, seed = 11): TableTextures {
  const t0 = performance.now();
  const rng = new Rng(seed);
  const lowW = Math.max(64, size / 8);
  const plankH = size / PLANKS_PER_REPEAT;
  const grain = fbm(seed, 5, 4, 48);
  const figure = fbm(seed + 17, 2, 2, 6);

  const plankTone: number[] = [];
  const plankShift: number[] = [];
  for (let p = 0; p < PLANKS_PER_REPEAT; p++) {
    plankTone.push(rng.range(-0.07, 0.07));
    plankShift.push(rng.range(0, 1000));
  }

  // Low horizontal resolution: the grain is stretched along x, so upscaling is free detail-wise.
  const low = makeCanvas(lowW, size);
  const lctx = low.getContext('2d')!;
  const img = lctx.createImageData(lowW, size);
  const rough = makeCanvas(lowW, size);
  const rctx = rough.getContext('2d')!;
  const rimg = rctx.createImageData(lowW, size);
  for (let y = 0; y < size; y++) {
    const p = Math.min(PLANKS_PER_REPEAT - 1, Math.floor(y / plankH));
    const v = (y / size) * 48 + plankShift[p];
    for (let x = 0; x < lowW; x++) {
      const u = (x / lowW) * 4;
      const g = grain(u, v);
      const fig = figure(u * 0.5, v * 0.12);
      // Sharpen grain into streaks, darken by the large figure.
      let t = 0.44 + (g - 0.5) * 1.25 + plankTone[p] - Math.max(0, fig - 0.55) * 0.8;
      t = Math.min(1, Math.max(0, t));
      const [r, gg, b] = ramp(t * 0.85 + 0.12);
      const i = (y * lowW + x) * 4;
      img.data[i] = r * 255;
      img.data[i + 1] = gg * 255;
      img.data[i + 2] = b * 255;
      img.data[i + 3] = 255;
      const rv = 232 + (g - 0.5) * 30;
      rimg.data[i] = rv;
      rimg.data[i + 1] = rv;
      rimg.data[i + 2] = rv;
      rimg.data[i + 3] = 255;
    }
  }
  lctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);

  const albedo = makeCanvas(size, size);
  const ctx = albedo.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(low, 0, 0, size, size);

  // Fine pores: short, faint dark streaks along the grain.
  const pores = Math.round((size * size) / 2600);
  for (let i = 0; i < pores; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const len = rng.range(size / 120, size / 25);
    ctx.fillStyle = `rgba(28,14,6,${rng.range(0.05, 0.16).toFixed(3)})`;
    ctx.fillRect(x, y, len, Math.max(1, size / 2048));
    if (x + len > size) ctx.fillRect(x - size, y, len, Math.max(1, size / 2048));
  }

  // Plank seams.
  const seam = Math.max(1, size / 1024);
  for (let p = 0; p < PLANKS_PER_REPEAT; p++) {
    const y = p * plankH;
    ctx.fillStyle = 'rgba(18,9,4,.85)';
    ctx.fillRect(0, y, size, seam * 1.5);
    ctx.fillStyle = 'rgba(255,220,180,.07)';
    ctx.fillRect(0, y + seam * 1.5, size, seam);
  }

  const roughness = makeCanvas(size / 4, size / 4);
  const r2 = roughness.getContext('2d')!;
  r2.drawImage(rough, 0, 0, size / 4, size / 4);
  r2.fillStyle = 'rgb(255,255,255)';
  for (let p = 0; p < PLANKS_PER_REPEAT; p++) r2.fillRect(0, (p * plankH) / 4, size / 4, Math.max(1, seam / 2));

  return { albedo, roughness, ms: performance.now() - t0 };
}

export function createTable(tex: TableTextures, maxAnisotropy: number): THREE.Mesh {
  const map = new THREE.CanvasTexture(tex.albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(TABLE_SIZE / REPEAT_WORLD, TABLE_SIZE / REPEAT_WORLD);
  map.anisotropy = maxAnisotropy;
  const roughnessMap = new THREE.CanvasTexture(tex.roughness);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.copy(map.repeat);

  const geo = new THREE.PlaneGeometry(TABLE_SIZE, TABLE_SIZE, 48, 48);
  geo.rotateX(-Math.PI / 2);
  // Lamp pool: bright under the board, falling into shadow toward the table edges.
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    const t = THREE.MathUtils.smoothstep(r, 0.75, 3.4);
    const v = THREE.MathUtils.lerp(1, 0.16, t);
    colors[i * 3] = v;
    colors[i * 3 + 1] = v * 0.97;
    colors[i * 3 + 2] = v * 0.94;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    roughness: 0.45,
    metalness: 0,
    vertexColors: true,
    envMapIntensity: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'table';
  return mesh;
}
