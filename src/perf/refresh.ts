// Display refresh rate (SPEC-benchmark §2.1, §2.4). The browser only sees the rate the display
// is running at now, measured from rAF intervals. Nothing here assumes 60 Hz.

export const COMMON_RATES = [30, 50, 60, 75, 100, 120, 144, 165, 240] as const;

/** Snap to the nearest common rate when within 3%; otherwise round to a whole Hz. */
export function snapRefresh(hz: number): number {
  if (!Number.isFinite(hz) || hz <= 0) return 60;
  let best: number = COMMON_RATES[0];
  for (const r of COMMON_RATES) if (Math.abs(r - hz) < Math.abs(best - hz)) best = r;
  return Math.abs(best - hz) / best <= 0.03 ? best : Math.round(hz);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Refresh estimate from rAF intervals (ms): the median interval, snapped. */
export function estimateRefresh(intervals: number[]): { hz: number; raw: number } {
  const med = median(intervals.filter((x) => x > 0));
  const raw = med > 0 ? 1000 / med : 60;
  return { hz: snapRefresh(raw), raw };
}

/** Frame budget in ms at a refresh rate. */
export function budgetMs(hz: number): number {
  return 1000 / hz;
}
