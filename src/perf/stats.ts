// Frame statistics (SPEC-benchmark §2.3). Pure functions.
import type { FrameSample } from './samples';
import { budgetMs } from './refresh';

/** A frame is late (dropped) when it took longer than 1.5 refresh periods: it missed a vsync. */
export const LATE_FACTOR = 1.5;

export interface FrameStats {
  frames: number;
  avgFps: number;
  /** FPS at the 99th-percentile frame interval. */
  low1Fps: number;
  avgInterval: number;
  medianInterval: number;
  p99Interval: number;
  avgCpu: number;
  p99Cpu: number;
  /** Null when no frame has a GPU time. */
  avgGpu: number | null;
  p99Gpu: number | null;
  gpuFrames: number;
  maxCalls: number;
  maxTriangles: number;
  /** Frames over the display budget (missed a refresh). */
  lateDisplay: number;
  /** Frames over the 60 fps budget. */
  late60: number;
}

/** Nearest-rank percentile of an ascending array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const asc = (xs: number[]) => [...xs].sort((a, b) => a - b);

export function computeStats(samples: FrameSample[], displayHz: number): FrameStats {
  const intervals = samples.map((s) => s.interval);
  const cpu = samples.map((s) => s.cpuMs);
  const gpu = samples.map((s) => s.gpuMs).filter((g): g is number => g !== null);
  const si = asc(intervals);
  const avgInterval = mean(intervals);
  const p99Interval = percentile(si, 99);
  const lateD = budgetMs(displayHz) * LATE_FACTOR;
  const late60 = budgetMs(60) * LATE_FACTOR;
  return {
    frames: samples.length,
    avgFps: avgInterval > 0 ? 1000 / avgInterval : 0,
    low1Fps: p99Interval > 0 ? 1000 / p99Interval : 0,
    avgInterval,
    medianInterval: percentile(si, 50),
    p99Interval,
    avgCpu: mean(cpu),
    p99Cpu: percentile(asc(cpu), 99),
    avgGpu: gpu.length ? mean(gpu) : null,
    p99Gpu: gpu.length ? percentile(asc(gpu), 99) : null,
    gpuFrames: gpu.length,
    maxCalls: samples.reduce((m, s) => Math.max(m, s.calls), 0),
    maxTriangles: samples.reduce((m, s) => Math.max(m, s.triangles), 0),
    lateDisplay: intervals.filter((x) => x > lateD).length,
    late60: intervals.filter((x) => x > late60).length,
  };
}
