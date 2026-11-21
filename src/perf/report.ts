// Turns captured samples into a BenchSummary (pure; the benchmark runner feeds it).
import type { FrameSample } from './samples';
import { computeStats } from './stats';
import { classify, targets, verdictText } from './verdict';
import { headroomLine, pickConfig, recommend } from './recommend';
import { mainRun, type BenchMode, type BenchSummary, type HeadroomResult, type PhaseResult, type PlayerConfig, type RunConfig, type RunResult, type SystemInfo } from './summary';

export interface CapturedPhase {
  id: string;
  name: string;
  samples: FrameSample[];
}

export interface CapturedRun {
  config: RunConfig;
  phases: CapturedPhase[];
  headroom: HeadroomResult | null;
}

export function phaseResult(p: CapturedPhase, hz: number): PhaseResult {
  const stats = computeStats(p.samples, hz);
  return { id: p.id, name: p.name, stats, cls: classify(stats, hz), target: targets(stats, hz) };
}

export function buildSummary(mode: BenchMode, system: SystemInfo, player: PlayerConfig, captured: CapturedRun[], date = new Date()): BenchSummary {
  const hz = system.hz;
  const runs: RunResult[] = captured.map((c) => ({ config: c.config, headroom: c.headroom, phases: c.phases.map((p) => phaseResult(p, hz)) }));
  const main = mainRun({ runs, player });
  const spares = main.phases.map((p) => p.cls.headroom);
  const spare = spares.length && spares.every((x) => x !== null) ? Math.min(...(spares as number[])) : main.headroom && main.headroom.k >= 2 ? main.headroom.k : null;
  return {
    version: 1,
    id: date.toISOString(),
    date: date.toISOString(),
    mode,
    system,
    player,
    runs,
    verdict: verdictText(main.phases, hz, spare),
    headroomLine: headroomLine(main, hz),
    recommendations: recommend({ system, player: main.config, main, runs }),
    pick: mode === 'compare' ? pickConfig(runs, hz) : null,
  };
}
