// Seeded, serializable RNG (sfc32). The state is four uint32 words so it can live in
// game state, be saved, and be replayed exactly (SPEC §11.1, §12).

export type RngState = [number, number, number, number];

/** Mix a 32-bit seed into a well-distributed starting state (splitmix32). */
export function seedRng(seed: number): RngState {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const state: RngState = [next(), next(), next(), next()];
  // Discard a few outputs so nearby seeds diverge.
  for (let i = 0; i < 12; i++) nextUint32(state);
  return state;
}

/** Advance the state in place and return the next uint32. */
export function nextUint32(st: RngState): number {
  let [a, b, c, d] = st;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  st[0] = a >>> 0;
  st[1] = b >>> 0;
  st[2] = c;
  st[3] = d;
  return t;
}

/** Uniform float in [0, 1). */
export function nextFloat(st: RngState): number {
  return nextUint32(st) / 4294967296;
}

/** Unbiased integer in [0, n) by rejection sampling. */
export function nextInt(st: RngState, n: number): number {
  const limit = Math.floor(4294967296 / n) * n;
  let x: number;
  do x = nextUint32(st);
  while (x >= limit);
  return x % n;
}

export function rollDie(st: RngState): number {
  return 1 + nextInt(st, 6);
}

/** Convenience wrapper for non-engine (cosmetic) randomness. */
export class Rng {
  readonly state: RngState;
  constructor(seed: number | RngState) {
    this.state = typeof seed === 'number' ? seedRng(seed) : ([...seed] as RngState);
  }
  float(): number {
    return nextFloat(this.state);
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }
  int(n: number): number {
    return nextInt(this.state, n);
  }
  die(): number {
    return rollDie(this.state);
  }
}
