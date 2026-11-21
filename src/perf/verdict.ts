// Bottleneck classification, targets and verdict text (SPEC-benchmark §2.4, §2.5, §3.5).
// Pure functions; the budget always comes from the measured refresh rate.
import { budgetMs } from './refresh';
import { LATE_FACTOR, type FrameStats } from './stats';

export type Bottleneck = 'gpu' | 'cpu' | 'display' | 'unknown';

export interface Classification {
  kind: Bottleneck;
  /** Display-capped only: budget ÷ p99 frame cost (GPU, or CPU when GPU time is unavailable). */
  headroom: number | null;
}

/** Share of the budget above which a side counts as the bottleneck. */
export const BOUND_SHARE = 0.85;

export function classify(s: FrameStats, hz: number): Classification {
  const budget = budgetMs(hz);
  if (s.p99Gpu !== null && s.p99Gpu > BOUND_SHARE * budget) return { kind: 'gpu', headroom: null };
  if (s.p99Cpu > BOUND_SHARE * budget) return { kind: 'cpu', headroom: null };
  if (s.p99Gpu === null && s.p99Interval > budget * LATE_FACTOR) return { kind: 'unknown', headroom: null };
  const cost = s.p99Gpu ?? s.p99Cpu;
  return { kind: 'display', headroom: cost > 0 ? budget / cost : null };
}

export const BOTTLENECK_LABEL: Record<Bottleneck, string> = {
  gpu: 'Graphics card',
  cpu: 'Processor',
  display: 'Display-capped',
  unknown: "Can't tell",
};

export interface TargetResult {
  /** Holds the display rate (at most 1% of frames miss a refresh). */
  display: boolean;
  /** Holds 60 fps; null when it can't be judged (display below 60 Hz and no GPU time). */
  at60: boolean | null;
  label: 'pass' | 'smooth60' | 'fail';
}

/** Does a phase hold `rate` fps? At most 1% of frames may be over 1.5 periods. */
function holds(s: FrameStats, rate: number): boolean {
  return s.frames > 0 && s.p99Interval <= budgetMs(rate) * LATE_FACTOR;
}

export function targets(s: FrameStats, hz: number): TargetResult {
  const display = holds(s, hz);
  let at60: boolean | null;
  if (hz >= 60) at60 = holds(s, 60);
  else at60 = s.p99Gpu === null ? null : Math.max(s.p99Gpu, s.p99Cpu) <= budgetMs(60);
  const label = display ? 'pass' : hz > 60 && at60 ? 'smooth60' : 'fail';
  return { display, at60, label };
}

export interface PhaseVerdictInput {
  name: string;
  stats: FrameStats;
  target: TargetResult;
}

const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** One plain line for the results header. `spare` is the overall headroom factor, if known. */
export function verdictText(phases: PhaseVerdictInput[], hz: number, spare: number | null): string {
  if (phases.length === 0) return 'No frames were measured.';
  const missDisplay = phases.filter((p) => !p.target.display);
  if (missDisplay.length === 0) {
    const sp = spare !== null && spare >= 1.5 ? ` with headroom to spare (≈ ${spare.toFixed(1)}× spare).` : '.';
    return `Runs smoothly at ${hz} fps${sp}`;
  }
  const miss60 = phases.filter((p) => p.target.at60 === false);
  if (hz > 60 && miss60.length === 0) return `Smooth at 60 fps, but drops below ${hz} in ${list(missDisplay.map((p) => p.name))}.`;
  const below = hz > 60 ? miss60 : missDisplay;
  const floor = Math.min(hz, 60);
  if (below.length * 2 >= phases.length) return `Below ${floor} fps in most phases: try the suggestions below.`;
  return `Drops below ${floor} fps in ${list(below.map((p) => p.name))}: try the suggestions below.`;
}
