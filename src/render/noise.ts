// Small seeded value-noise helpers for procedural textures (table grain, roughness maps).
import { Rng } from '../engine/rng';

export interface Noise2 {
  (x: number, y: number): number;
}

/**
 * Value noise in [0, 1]. When `period` is given the lattice wraps every `period` cells
 * on each axis, so the result tiles.
 */
export function valueNoise(seed: number, periodX = 256, periodY = 256): Noise2 {
  const rng = new Rng(seed);
  const size = 256;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i++) table[i] = rng.float();
  const at = (ix: number, iy: number) => {
    const x = ((ix % periodX) + periodX) % periodX;
    const y = ((iy % periodY) + periodY) % periodY;
    return table[(y & (size - 1)) * size + (x & (size - 1))];
  };
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/** Fractal (fBm) sum of value noise, normalized to [0, 1]. Lattice periods double per octave. */
export function fbm(
  seed: number,
  octaves: number,
  periodX: number,
  periodY: number,
): (x: number, y: number) => number {
  const layers: Noise2[] = [];
  for (let o = 0; o < octaves; o++) layers.push(valueNoise(seed + o * 101, periodX << o, periodY << o));
  let norm = 0;
  for (let o = 0; o < octaves; o++) norm += 0.5 ** o;
  return (x, y) => {
    let sum = 0;
    let amp = 1;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * layers[o](x * f, y * f);
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Very low-contrast, large-scale roughness variation (one map for a whole surface). */
export function largeScaleRoughnessCanvas(seed: number, size = 256, contrast = 0.08): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const n = fbm(seed, 3, 4, 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = 1 - contrast + contrast * n((x / size) * 4, (y / size) * 4);
      const g = Math.round(v * 255);
      const i = (y * size + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
