// Rules-based recommendations (SPEC-benchmark §3.5). Pure: each rule is an independent predicate;
// only rules that fire are shown. Wording: plain, specific, no exclamation marks, no blame.
import { isIntegratedGpu } from '../render/quality';
import { budgetMs } from './refresh';
import { COMPARE_CONFIGS, configLabel, type PhaseResult, type Recommendation, type RunResult, type SystemInfo, type RunConfig } from './summary';

export const DRAW_CALL_BUDGET = 150;
/** A frame cost under this (ms) would sustain 120 fps with a little margin. */
export const COST_FOR_120 = 7.5;

export interface RecInput {
  system: SystemInfo;
  player: RunConfig;
  /** The run matching the player's settings. */
  main: RunResult;
  /** Every run (Compare has three). */
  runs: RunResult[];
}

const SOFTWARE = /swiftshader|llvmpipe|microsoft basic render/i;

export function isSoftwareRenderer(gpu: string): boolean {
  return SOFTWARE.test(gpu);
}

/** Frame cost of a phase: p99 GPU ms when measured, else p99 CPU ms or the frame interval. */
function cost(p: PhaseResult): number {
  return p.stats.p99Gpu ?? Math.max(p.stats.p99Cpu, p.stats.p99Interval);
}

const same = (a: RunConfig, b: RunConfig) => a.quality === b.quality && a.ao === b.ao;

/** Measured gain of `to` over `from` in one phase, as a fraction (0.38 = 38% faster). */
export function gain(from: RunResult, to: RunResult, phaseId: string): number | null {
  const a = from.phases.find((p) => p.id === phaseId);
  const b = to.phases.find((p) => p.id === phaseId);
  if (!a || !b || cost(b) <= 0) return null;
  return cost(a) / cost(b) - 1;
}

const pct = (g: number) => `${g >= 0 ? '+' : ''}${Math.round(g * 100)}%`;

/** The settings steps that cost the least look first: AO off, then Low. */
function cheaperSteps(player: RunConfig): RunConfig[] {
  const steps: RunConfig[] = [];
  if (player.ao) steps.push({ quality: player.quality, ao: false });
  if (player.quality === 'high') steps.push({ quality: 'low', ao: false });
  return steps;
}

/** "Ambient occlusion off (+12% in Street close-ups), then Low quality (+38%)". */
function stepsText(inp: RecInput, phase: PhaseResult | null): string {
  const parts = cheaperSteps(inp.player).map((c) => {
    const name = c.quality !== inp.player.quality ? 'Low quality' : 'ambient occlusion off';
    const run = inp.runs.find((r) => same(r.config, c));
    const g = run && phase ? gain(inp.main, run, phase.id) : null;
    return g === null ? name : `${name} (${pct(g)} in ${phase!.name})`;
  });
  return parts.join(', then ');
}

function worstBy(run: RunResult, pred: (p: PhaseResult) => boolean): PhaseResult | null {
  let w: PhaseResult | null = null;
  for (const p of run.phases) if (pred(p) && (!w || cost(p) > cost(w))) w = p;
  return w;
}

export function recommend(inp: RecInput): Recommendation[] {
  const { system: sys, main } = inp;
  const out: Recommendation[] = [];
  const hz = sys.hz;
  const phases = main.phases;

  // 1. Software rendering: nothing else means anything.
  if (isSoftwareRenderer(sys.gpu)) {
    return [{ id: 'software', text: "The browser isn't using your graphics card. Turn on hardware acceleration in the browser settings and restart it." }];
  }

  const missDisplay = phases.filter((p) => !p.target.display);

  // 2. Integrated graphics while performance falls short.
  if (isIntegratedGpu(sys.gpu) && missDisplay.length > 0) {
    out.push({
      id: 'integrated',
      text: 'The browser is running on integrated graphics. If this PC has a separate graphics card, set the browser to High performance in Windows Settings → Display → Graphics.',
    });
  }

  // 3. Not drawing at the expected resolution: the screen's native size, or the chosen Render
  // resolution when that is lower (a deliberate choice, not a problem).
  const nativeW = Math.round(sys.screenW * sys.dpr);
  const nativeH = Math.round(sys.screenH * sys.dpr);
  const targetH = Math.min(nativeH, sys.renderHeight ?? nativeH);
  const targetW = Math.round((nativeW * targetH) / nativeH);
  const short = sys.bufferW < targetW * 0.98 || sys.bufferH < targetH * 0.98;
  const screen4k = nativeW >= 3840 && nativeH >= 2160 && targetH >= 2160;
  if (short || (screen4k && (sys.bufferW < 3840 * 0.98 || sys.bufferH < 2160 * 0.98))) {
    out.push({
      id: 'resolution',
      text: `The game is drawing ${sys.bufferW} × ${sys.bufferH}, but the screen is ${nativeW} × ${nativeH}. Usually the window isn't fullscreen (press F), the browser zoom isn't 100% (Ctrl+0), or Windows display scaling and browser zoom don't match.`,
    });
  }

  // 4. Display at 30 Hz.
  if (hz <= 31) {
    out.push({ id: 'refresh30', text: `The display is running at ${hz} Hz. Check the TV's input mode / Windows display refresh rate.` });
  }

  // 4a. At 60 Hz with headroom for 120.
  const fastEnough = phases.length > 0 && phases.every((p) => p.stats.p99Gpu !== null && p.stats.p99Gpu < COST_FOR_120 && p.stats.p99Cpu < COST_FOR_120);
  if (hz >= 55 && hz <= 65 && (fastEnough || (main.headroom !== null && main.headroom.k >= 2))) {
    out.push({
      id: 'could120',
      text: 'Your PC could run this at 120 fps. If your TV supports 120 Hz: set the refresh rate to 120 Hz in Windows Settings → Display → Advanced display, use an HDMI 2.1 port on the TV and an Ultra High Speed HDMI cable, and turn on the TV\'s Game/PC mode for that input. Restart the browser afterwards.',
    });
  }

  // 4b. High refresh, but only holding 60.
  const holds60Only = hz > 60 && missDisplay.length > 0 && phases.every((p) => p.target.at60 !== false);
  const gpuDrop = worstBy(main, (p) => p.cls.kind === 'gpu' && !p.target.display);
  if (holds60Only) {
    const steps = stepsText(inp, gpuDrop ?? worstBy(main, (p) => !p.target.display));
    out.push({
      id: 'only60',
      text: steps
        ? `Smooth at 60 but not ${hz}. To get closer to ${hz} fps, try ${steps}.`
        : `Smooth at 60 but not ${hz}, already on the lightest settings.`,
    });
  }

  // 5. GPU-bound with drops (folded into 4b when that fired).
  if (gpuDrop && !holds60Only) {
    const steps = stepsText(inp, gpuDrop);
    if (steps) out.push({ id: 'gpuBound', text: `The graphics card is the limit in ${gpuDrop.name}. Try ${steps}.` });
  }

  // 6. Plenty of headroom on lighter settings.
  const spare = Math.min(...phases.map((p) => p.cls.headroom ?? 0));
  if ((inp.player.quality === 'low' || !inp.player.ao) && missDisplay.length === 0 && phases.length > 0 && (spare >= 2 || (main.headroom?.k ?? 0) >= 3)) {
    const what = inp.player.quality === 'low' ? 'High quality with ambient occlusion' : 'ambient occlusion';
    out.push({ id: 'roomForMore', text: `Your PC has room for ${what}.` });
  }

  // 7. CPU-bound.
  const cpu = phases.find((p) => p.cls.kind === 'cpu');
  if (cpu) {
    out.push({
      id: 'cpuBound',
      text: `The slowdown in ${cpu.name} is on the processor side, so graphics settings will help little. Closing other apps and browser tabs may help.`,
    });
  }

  // 8. Draw calls over budget: a game problem.
  if (inp.runs.some((r) => r.phases.some((p) => p.stats.maxCalls >= DRAW_CALL_BUDGET))) {
    out.push({ id: 'drawCalls', text: "This is a problem in the game, not your PC; copy the results for the developer." });
  }

  return out.length ? out : [{ id: 'none', text: 'No changes needed.' }];
}

/** Does a run hold `rate` fps in every phase? 60 uses the 60 fps reference. */
function runHolds(run: RunResult, display: boolean): boolean {
  return run.phases.length > 0 && run.phases.every((p) => (display ? p.target.display : p.target.at60 !== false));
}

/**
 * Compare settings: the best-looking configuration that holds the display rate; if none, the
 * best-looking one that holds 60, saying which holds the display rate if any.
 */
export function pickConfig(runs: RunResult[], hz: number): string | null {
  const ordered = COMPARE_CONFIGS.map((c) => runs.find((r) => same(r.config, c))).filter((r): r is RunResult => !!r);
  if (ordered.length === 0) return null;
  const atDisplay = ordered.find((r) => runHolds(r, true));
  if (atDisplay) return `${configLabel(atDisplay.config)}: holds ${hz} fps.`;
  const at60 = ordered.find((r) => runHolds(r, false));
  if (at60) return `${configLabel(at60.config)}: holds 60 fps; none of the three holds ${hz}.`;
  return `None of the three holds 60 fps; ${configLabel(ordered[ordered.length - 1].config)} is the lightest.`;
}

/** Headroom line from phase 6 and/or the classification. */
export function headroomLine(run: RunResult, hz: number): string {
  const h = run.headroom;
  const spare = run.phases.map((p) => p.cls.headroom).filter((x): x is number => x !== null);
  const parts: string[] = [];
  if (h) {
    parts.push(
      h.k === 0
        ? `Headroom: even one render per frame dropped below ${hz} fps in the held close-up.`
        : `Headroom: k = ${h.k} renders per frame before dropping below ${hz} fps (≈ ${Math.round(h.equivalentFps)} fps equivalent)${h.k === h.tried ? `, the most tried` : ''}.`,
    );
  }
  if (spare.length === run.phases.length && spare.length > 0) {
    const min = Math.min(...spare);
    parts.push(`Lowest spare in a phase: ≈ ${min.toFixed(1)}× of the ${budgetMs(hz).toFixed(1)} ms budget.`);
  }
  return parts.join(' ');
}
