// Batch 4: frame statistics, refresh snapping, targets, bottleneck classification, verdict text,
// recommendations, copy text and history (SPEC-benchmark §6.1). Pure logic only.
import { describe, expect, it } from 'vitest';
import { SampleRing, type FrameSample } from '../../src/perf/samples';
import { computeStats, percentile } from '../../src/perf/stats';
import { estimateRefresh, snapRefresh } from '../../src/perf/refresh';
import { classify, targets, verdictText } from '../../src/perf/verdict';
import { recommend, pickConfig, gain, type RecInput } from '../../src/perf/recommend';
import { buildSummary, type CapturedRun } from '../../src/perf/report';
import { findPrevious, formatCopy, HISTORY_MAX, pushHistory, type BenchSummary, type RunResult, type SystemInfo } from '../../src/perf/summary';

/** n frames at a fixed interval/cost; `spikes` frames get `spikeInterval`. */
function frames(n: number, o: { interval: number; cpu?: number; gpu?: number | null; calls?: number; spikes?: number; spikeInterval?: number }): FrameSample[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    t: i * o.interval,
    interval: i < (o.spikes ?? 0) ? (o.spikeInterval ?? o.interval) : o.interval,
    cpuMs: o.cpu ?? 1,
    gpuMs: o.gpu === undefined ? 2 : o.gpu,
    calls: o.calls ?? 100,
    triangles: 50_000,
  }));
}

const SYS: SystemInfo = {
  gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11)',
  bufferW: 3840,
  bufferH: 2160,
  cssW: 1920,
  cssH: 1080,
  dpr: 2,
  screenW: 1920,
  screenH: 1080,
  hz: 120,
  hzRaw: 119.9,
  threads: 16,
  maxTexture: 16384,
  gpuTimer: true,
};

describe('sample ring', () => {
  it('overwrites in place and fills GPU time late', () => {
    const r = new SampleRing(4);
    for (let i = 0; i < 6; i++) r.push(i * 10, 10, 1, 5, 6);
    expect(r.range(0).map((s) => s.id)).toEqual([2, 3, 4, 5]);
    r.setGpu(5, 3.5);
    r.setGpu(0, 9); // overwritten: ignored
    expect(r.range(5)[0].gpuMs).toBe(3.5);
    expect(r.since(35).map((s) => s.id)).toEqual([4, 5]);
  });
});

describe('statistics', () => {
  it('average, 1% low and percentiles', () => {
    const s = computeStats(frames(100, { interval: 10, spikes: 1, spikeInterval: 50, cpu: 2, gpu: 4 }), 60);
    expect(s.frames).toBe(100);
    expect(s.avgInterval).toBeCloseTo(10.4);
    expect(s.avgFps).toBeCloseTo(1000 / 10.4);
    expect(s.p99Interval).toBe(10); // one spike in 100 is the 100th percentile, not the 99th
    expect(s.medianInterval).toBe(10);
    expect(s.avgGpu).toBe(4);
    expect(s.maxCalls).toBe(100);
    const s2 = computeStats(frames(100, { interval: 10, spikes: 2, spikeInterval: 50 }), 60);
    expect(s2.p99Interval).toBe(50);
    expect(s2.low1Fps).toBe(20);
    expect(s2.lateDisplay).toBe(2);
    expect(s2.late60).toBe(2);
  });

  it('GPU time is null when no frame has it', () => {
    const s = computeStats(frames(10, { interval: 16.7, gpu: null }), 60);
    expect(s.avgGpu).toBeNull();
    expect(s.p99Gpu).toBeNull();
  });

  it('late frames are counted against both budgets', () => {
    // 14 ms frames miss a refresh at 120 Hz (late over 1.5 × 8.3 ms) but not at 60 (late over 25 ms).
    const s = computeStats(frames(50, { interval: 14 }), 120);
    expect(s.lateDisplay).toBe(50);
    expect(s.late60).toBe(0);
  });

  it('percentile is nearest-rank', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([], 99)).toBe(0);
  });
});

describe('refresh rate', () => {
  it('snaps to common rates within 3%', () => {
    expect(snapRefresh(59.94)).toBe(60);
    expect(snapRefresh(119.2)).toBe(120);
    expect(snapRefresh(143)).toBe(144);
    expect(snapRefresh(29.97)).toBe(30);
    expect(snapRefresh(90)).toBe(90);
    expect(estimateRefresh(Array(60).fill(8.33)).hz).toBe(120);
    expect(estimateRefresh(Array(60).fill(16.68)).hz).toBe(60);
  });
});

describe('targets', () => {
  it('60 Hz display: pass or fail', () => {
    expect(targets(computeStats(frames(100, { interval: 16.7 }), 60), 60)).toEqual({ display: true, at60: true, label: 'pass' });
    expect(targets(computeStats(frames(100, { interval: 33.4 }), 60), 60).label).toBe('fail');
  });
  it('120 Hz display: smooth at 60 but not 120', () => {
    expect(targets(computeStats(frames(100, { interval: 8.33 }), 120), 120).label).toBe('pass');
    const t = targets(computeStats(frames(100, { interval: 16.7 }), 120), 120);
    expect(t).toEqual({ display: false, at60: true, label: 'smooth60' });
    expect(targets(computeStats(frames(100, { interval: 33.4 }), 120), 120).label).toBe('fail');
  });
});

describe('bottleneck classification', () => {
  for (const hz of [60, 120]) {
    const budget = 1000 / hz;
    const at = (gpu: number | null, cpu: number, interval = budget) => classify(computeStats(frames(100, { interval, gpu, cpu }), hz), hz);
    it(`thresholds at ${hz} Hz`, () => {
      expect(at(budget * 0.86, 1).kind).toBe('gpu');
      expect(at(budget * 0.84, 1).kind).toBe('display');
      expect(at(1, budget * 0.86).kind).toBe('cpu');
      expect(at(budget * 0.9, budget * 0.9).kind).toBe('gpu'); // GPU wins when both
      expect(at(1, budget * 0.84).kind).toBe('display');
      expect(at(null, 1, budget * 2).kind).toBe('unknown');
      expect(at(null, 1).kind).toBe('display');
      const d = at(budget / 4, 1);
      expect(d.headroom).toBeCloseTo(4);
      expect(at(null, budget / 2).headroom).toBeCloseTo(2); // CPU when GPU is unavailable
    });
  }
});

describe('verdict text', () => {
  const ph = (name: string, interval: number, hz: number) => {
    const stats = computeStats(frames(100, { interval }), hz);
    return { name, stats, target: targets(stats, hz) };
  };
  it('smooth with spare', () => {
    expect(verdictText([ph('A', 8.33, 120), ph('B', 8.33, 120)], 120, 2.04)).toBe('Runs smoothly at 120 fps with headroom to spare (≈ 2.0× spare).');
    expect(verdictText([ph('A', 16.7, 60)], 60, 1.1)).toBe('Runs smoothly at 60 fps.');
  });
  it('smooth at 60, not at 120', () => {
    expect(verdictText([ph('Table at rest', 8.33, 120), ph('Street close-ups', 16.7, 120)], 120, null)).toBe('Smooth at 60 fps, but drops below 120 in Street close-ups.');
  });
  it('below 60', () => {
    expect(verdictText([ph('A', 40, 60), ph('B', 40, 60), ph('C', 16.7, 60)], 60, null)).toBe('Below 60 fps in most phases: try the suggestions below.');
    expect(verdictText([ph('A', 40, 120), ph('B', 8.33, 120), ph('C', 8.33, 120)], 120, null)).toBe('Drops below 60 fps in A: try the suggestions below.');
  });
});

// --- recommendations -------------------------------------------------------------------------

function run(config: RunResult['config'], o: { interval: number; gpu?: number | null; cpu?: number; calls?: number }, k: number | null = null, hz = SYS.hz): RunResult {
  const cap: CapturedRun = {
    config,
    headroom: k === null ? null : { k, tried: 8, equivalentFps: k * hz },
    phases: [
      { id: 'rest', name: 'Table at rest', samples: frames(100, o) },
      { id: 'closeups', name: 'Street close-ups', samples: frames(100, o) },
    ],
  };
  return buildSummary('standard', { ...SYS, hz }, { quality: config.quality, ao: config.ao, toneMapping: 'aces', exposure: 1 }, [cap]).runs[0];
}

function input(main: RunResult, sys: Partial<SystemInfo> = {}, runs: RunResult[] = [main]): RecInput {
  return { system: { ...SYS, ...sys }, player: main.config, main, runs };
}
const ids = (inp: RecInput) => recommend(inp).map((r) => r.id);
const HI = { quality: 'high' as const, ao: true };
const smooth120 = run(HI, { interval: 8.33, gpu: 3, cpu: 1 });

describe('recommendations', () => {
  it('none fire: no changes needed', () => {
    expect(recommend(input(smooth120))).toEqual([{ id: 'none', text: 'No changes needed.' }]);
  });

  it('1. software rendering short-circuits', () => {
    const r = recommend(input(run(HI, { interval: 50, gpu: 40 }), { gpu: 'Google SwiftShader', bufferW: 100 }));
    expect(r.map((x) => x.id)).toEqual(['software']);
    expect(ids(input(smooth120, { gpu: 'ANGLE (Microsoft Basic Render Driver)' }))).toEqual(['software']);
    expect(ids(input(smooth120, { gpu: 'llvmpipe (LLVM 15)' }))).toEqual(['software']);
  });

  it('2. integrated graphics only when short of the target', () => {
    const intel = 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)';
    expect(ids(input(run(HI, { interval: 16.7, gpu: 15 }), { gpu: intel }))).toContain('integrated');
    expect(ids(input(smooth120, { gpu: intel }))).not.toContain('integrated');
  });

  it('3. not native resolution', () => {
    expect(ids(input(smooth120, { bufferW: 1920, bufferH: 1080 }))).toContain('resolution');
    expect(ids(input(smooth120, { bufferW: 3838, bufferH: 2159 }))).not.toContain('resolution');
    // Screen reports 4K at DPR 1 but the buffer is 1080p.
    expect(ids(input(smooth120, { screenW: 3840, screenH: 2160, dpr: 1, bufferW: 1920, bufferH: 1080, cssW: 1920, cssH: 1080 }))).toContain('resolution');
  });

  it('3. a chosen lower render resolution is not a problem, but falling short of it is', () => {
    const tv = { screenW: 2560, screenH: 1440, dpr: 1.5, cssW: 2560, cssH: 1440 };
    expect(ids(input(smooth120, { ...tv, renderHeight: 1440, bufferW: 2560, bufferH: 1440 }))).not.toContain('resolution');
    expect(ids(input(smooth120, { ...tv, renderHeight: 2160, bufferW: 2560, bufferH: 1440 }))).toContain('resolution');
    expect(ids(input(smooth120, { ...tv, renderHeight: 1440, bufferW: 1920, bufferH: 1080 }))).toContain('resolution');
  });

  it('4. display at 30 Hz', () => {
    const r30 = run(HI, { interval: 33.3, gpu: 3 }, null, 30);
    expect(ids(input(r30, { hz: 30 }))).toContain('refresh30');
    expect(ids(input(smooth120))).not.toContain('refresh30');
  });

  it('4a. at 60 Hz with headroom for 120', () => {
    const r60 = run(HI, { interval: 16.7, gpu: 3, cpu: 2 }, null, 60);
    expect(ids(input(r60, { hz: 60 }))).toContain('could120');
    const slow = run(HI, { interval: 16.7, gpu: 9, cpu: 2 }, null, 60);
    expect(ids(input(slow, { hz: 60 }))).not.toContain('could120');
    const viaK = run(HI, { interval: 16.7, gpu: null, cpu: 2 }, 2, 60);
    expect(ids(input(viaK, { hz: 60 }))).toContain('could120');
    expect(ids(input(smooth120))).not.toContain('could120');
  });

  it('4b. at 120 Hz, holding only 60, with measured gains', () => {
    const main = run(HI, { interval: 16.7, gpu: 12 });
    const noAo = run({ quality: 'high', ao: false }, { interval: 16.7, gpu: 10 });
    const low = run({ quality: 'low', ao: false }, { interval: 8.33, gpu: 6 });
    const r = recommend(input(main, {}, [main, noAo, low]));
    const only60 = r.find((x) => x.id === 'only60')!;
    expect(only60.text).toContain('ambient occlusion off (+20% in');
    expect(only60.text).toContain('Low quality (+100% in');
    expect(r.map((x) => x.id)).not.toContain('gpuBound'); // folded into 4b
    expect(ids(input(smooth120))).not.toContain('only60');
  });

  it('5. GPU-bound with drops', () => {
    const r60 = run(HI, { interval: 33.4, gpu: 30 }, null, 60);
    const r = recommend(input(r60, { hz: 60 }));
    expect(r.find((x) => x.id === 'gpuBound')?.text).toBe('The graphics card is the limit in Table at rest. Try ambient occlusion off, then Low quality.');
    expect(ids(input(smooth120))).not.toContain('gpuBound');
  });

  it('6. room for more on lighter settings', () => {
    const lowFast = run({ quality: 'low', ao: false }, { interval: 8.33, gpu: 2 });
    expect(recommend(input(lowFast)).find((x) => x.id === 'roomForMore')?.text).toBe('Your PC has room for High quality with ambient occlusion.');
    const hiNoAo = run({ quality: 'high', ao: false }, { interval: 8.33, gpu: 2 });
    expect(recommend(input(hiNoAo)).find((x) => x.id === 'roomForMore')?.text).toBe('Your PC has room for ambient occlusion.');
    expect(ids(input(smooth120))).not.toContain('roomForMore'); // already High + AO
    expect(ids(input(run({ quality: 'low', ao: false }, { interval: 8.33, gpu: 6 })))).not.toContain('roomForMore');
  });

  it('7. CPU-bound', () => {
    expect(ids(input(run(HI, { interval: 16.7, gpu: 2, cpu: 12 })))).toContain('cpuBound');
    expect(ids(input(smooth120))).not.toContain('cpuBound');
  });

  it('8. draw calls over budget', () => {
    expect(ids(input(run(HI, { interval: 8.33, gpu: 2, calls: 150 })))).toContain('drawCalls');
    expect(ids(input(run(HI, { interval: 8.33, gpu: 2, calls: 149 })))).not.toContain('drawCalls');
  });

  it('gain compares frame cost', () => {
    const a = run(HI, { interval: 16.7, gpu: 13.8 });
    const b = run({ quality: 'low', ao: false }, { interval: 8.33, gpu: 10 });
    expect(gain(a, b, 'closeups')).toBeCloseTo(0.38);
  });
});

describe('compare pick', () => {
  const hiAo = run(HI, { interval: 16.7, gpu: 12 });
  const hi = run({ quality: 'high', ao: false }, { interval: 8.33, gpu: 6 });
  const low = run({ quality: 'low', ao: false }, { interval: 8.33, gpu: 4 });
  it('best-looking that holds the display rate', () => {
    expect(pickConfig([hiAo, hi, low], 120)).toBe('High + AO off: holds 120 fps.');
  });
  it('falls back to 60', () => {
    const slowHi = run({ quality: 'high', ao: false }, { interval: 16.7, gpu: 12 });
    const slowLow = run({ quality: 'low', ao: false }, { interval: 16.7, gpu: 10 });
    expect(pickConfig([hiAo, slowHi, slowLow], 120)).toBe('High + AO on: holds 60 fps; none of the three holds 120.');
  });
});

// --- summary, copy, history ------------------------------------------------------------------

function summary(id: string, overrides: Partial<BenchSummary> = {}): BenchSummary {
  const s = buildSummary('standard', SYS, { quality: 'high', ao: true, toneMapping: 'aces', exposure: 1 }, [
    { config: HI, headroom: { k: 3, tried: 8, equivalentFps: 360 }, phases: [{ id: 'rest', name: 'Table at rest', samples: frames(100, { interval: 8.33, gpu: 2 }) }] },
  ], new Date(id));
  return { ...s, ...overrides };
}

describe('summary', () => {
  it('copy text has the verdict, system, phases and suggestions', () => {
    const t = formatCopy(summary('2026-11-21T10:00:00.000Z'));
    expect(t).toContain('Property Night benchmark (standard)');
    expect(t).toContain('Runs smoothly at 120 fps');
    expect(t).toContain('Rendered: 3840 x 2160 (CSS 1920 x 1080 x DPR 2.00');
    expect(t).toContain('Table at rest | 120 |');
    expect(t).toContain('k = 3 renders per frame');
    expect(t).toContain('- No changes needed.');
    expect(t).not.toMatch(/monopoly/i);
  });

  it('history keeps the newest 10 and finds the previous same-config run', () => {
    let list: BenchSummary[] = [];
    for (let i = 0; i < 12; i++) list = pushHistory(list, summary(`2026-11-21T10:${String(i).padStart(2, '0')}:00.000Z`));
    expect(list).toHaveLength(HISTORY_MAX);
    expect(list[0].id).toBe('2026-11-21T10:11:00.000Z');
    const now = summary('2026-11-21T11:00:00.000Z');
    expect(findPrevious(list, now)?.id).toBe('2026-11-21T10:11:00.000Z');
    const other = summary('2026-11-21T11:01:00.000Z', { player: { quality: 'low', ao: false, toneMapping: 'aces', exposure: 1 } });
    expect(findPrevious(list, other)).toBeNull();
  });
});
