// Variation pick (audio Phase 0 §1): random, never the same file twice in a row.

/** A random index in [0, n), different from `last` whenever n ≥ 2. Returns -1 when n is 0. */
export function pickVariation(n: number, last: number, rand: () => number): number {
  if (n <= 0) return -1;
  if (n === 1) return 0;
  if (last < 0 || last >= n) return Math.min(n - 1, Math.floor(rand() * n));
  // Pick among the other n-1 and skip over `last`.
  const k = Math.min(n - 2, Math.floor(rand() * (n - 1)));
  return k >= last ? k + 1 : k;
}
