// Benchmark result types, copy text, export and history (SPEC-benchmark §3.5, §3.6). Pure.
import type { FrameStats } from './stats';
import type { Classification, TargetResult } from './verdict';
import { BOTTLENECK_LABEL } from './verdict';

export type BenchMode = 'quick' | 'standard' | 'compare';
export type QualityLevel = 'high' | 'low';

export interface PhaseResult {
  id: string;
  name: string;
  stats: FrameStats;
  cls: Classification;
  target: TargetResult;
}

/** Phase 6: how many renders per displayed frame still held the display rate. */
export interface HeadroomResult {
  /** Largest k that held the display rate (0 when even k = 1 dropped). */
  k: number;
  /** Largest k tried. */
  tried: number;
  /** k × refresh rate. */
  equivalentFps: number;
}

export interface RunConfig {
  quality: QualityLevel;
  ao: boolean;
}

export interface RunResult {
  config: RunConfig;
  phases: PhaseResult[];
  headroom: HeadroomResult | null;
}

export interface SystemInfo {
  gpu: string;
  bufferW: number;
  bufferH: number;
  cssW: number;
  cssH: number;
  dpr: number;
  screenW: number;
  screenH: number;
  /** Snapped refresh estimate, Hz. */
  hz: number;
  /** Raw refresh estimate before snapping, Hz. */
  hzRaw: number;
  threads: number;
  maxTexture: number;
  gpuTimer: boolean;
}

export interface Recommendation {
  id: string;
  text: string;
}

export interface PlayerConfig {
  quality: QualityLevel;
  ao: boolean;
  toneMapping: string;
  exposure: number;
}

export interface BenchSummary {
  version: 1;
  id: string;
  date: string;
  mode: BenchMode;
  system: SystemInfo;
  player: PlayerConfig;
  runs: RunResult[];
  verdict: string;
  headroomLine: string;
  recommendations: Recommendation[];
  /** Compare only: the configuration to use, in words. */
  pick: string | null;
}

export const HISTORY_MAX = 10;

export function configLabel(c: RunConfig): string {
  return `${c.quality === 'high' ? 'High' : 'Low'} + AO ${c.ao ? 'on' : 'off'}`;
}

/** Runs compared in Compare settings, best-looking first. */
export const COMPARE_CONFIGS: RunConfig[] = [
  { quality: 'high', ao: true },
  { quality: 'high', ao: false },
  { quality: 'low', ao: false },
];

/** The run the verdict and recommendations describe: the one matching the player's settings, else the first. */
export function mainRun(s: Pick<BenchSummary, 'runs' | 'player'>): RunResult {
  return s.runs.find((r) => r.config.quality === s.player.quality && r.config.ao === s.player.ao) ?? s.runs[0];
}

/** The phase with the lowest 1% low (null when there are none). */
export function worstPhase(run: RunResult): PhaseResult | null {
  let worst: PhaseResult | null = null;
  for (const p of run.phases) if (!worst || p.stats.low1Fps < worst.stats.low1Fps) worst = p;
  return worst;
}

/** Results with the same configuration are comparable (history "last run"). */
export function configKey(s: Pick<BenchSummary, 'mode' | 'player' | 'system'>): string {
  return [s.mode, s.player.quality, s.player.ao ? 'ao' : 'noao', s.player.toneMapping, `${s.system.bufferW}x${s.system.bufferH}`].join('|');
}

/** Newest first, at most HISTORY_MAX. */
export function pushHistory(list: BenchSummary[], s: BenchSummary): BenchSummary[] {
  return [s, ...list.filter((x) => x.id !== s.id)].slice(0, HISTORY_MAX);
}

/** The most recent earlier result with the same configuration. */
export function findPrevious(list: BenchSummary[], s: BenchSummary): BenchSummary | null {
  const key = configKey(s);
  return list.find((x) => x.id !== s.id && configKey(x) === key) ?? null;
}

const f0 = (n: number) => Math.round(n).toString();
const f1 = (n: number | null) => (n === null ? 'n/a' : n.toFixed(1));
const mark = (ok: boolean | null) => (ok === null ? '?' : ok ? 'ok' : 'low');

/** Plain-text summary for Copy results, ready to paste into a chat. */
export function formatCopy(s: BenchSummary): string {
  const sys = s.system;
  const lines = [
    `Property Night benchmark (${s.mode}), ${s.date.slice(0, 16).replace('T', ' ')}`,
    s.verdict,
    '',
    `GPU: ${sys.gpu}`,
    `Rendered: ${sys.bufferW} x ${sys.bufferH} (CSS ${sys.cssW} x ${sys.cssH} x DPR ${sys.dpr.toFixed(2)}; screen ${sys.screenW} x ${sys.screenH})`,
    `Display: ${sys.hz} Hz (measured ${sys.hzRaw.toFixed(1)})`,
    `Settings: ${s.player.quality === 'high' ? 'High' : 'Low'}, AO ${s.player.ao ? 'on' : 'off'}, tone mapping ${s.player.toneMapping}`,
    `CPU threads: ${sys.threads}; GPU timer: ${sys.gpuTimer ? 'yes' : 'not available in this browser'}`,
  ];
  for (const run of s.runs) {
    lines.push('', s.runs.length > 1 ? `${configLabel(run.config)}:` : 'Phases:');
    lines.push(`  phase | avg fps | 1% low | p99 ms | GPU ms | CPU ms | calls | ${sys.hz} fps / 60 fps | limit`);
    for (const p of run.phases) {
      const st = p.stats;
      lines.push(
        `  ${p.name} | ${f0(st.avgFps)} | ${f0(st.low1Fps)} | ${f1(st.p99Interval)} | ${f1(st.avgGpu)} | ${f1(st.avgCpu)} | ${st.maxCalls} | ${mark(p.target.display)} / ${mark(p.target.at60)} | ${BOTTLENECK_LABEL[p.cls.kind]}`,
      );
    }
  }
  if (s.headroomLine) lines.push('', s.headroomLine);
  if (s.pick) lines.push(`Use: ${s.pick}`);
  lines.push('', 'Suggestions:', ...s.recommendations.map((r) => `- ${r.text}`));
  return lines.join('\n');
}

/** Export JSON: the summary (per-phase statistics, not raw frames). */
export function toExportJSON(s: BenchSummary): string {
  return JSON.stringify(s, null, 2);
}
