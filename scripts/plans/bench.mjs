// Batch 4 check (SPEC-benchmark §6.3): Settings → Run benchmark → Quick, wait for the results,
// screenshot, then assert every phase has samples, draw calls < 150, continuous mode is off and
// the renderer goes idle (0 frames in the next 2 s). URL: PN_URL (default: dev server).
import { H } from './helpers.mjs';

const base = process.env.PN_URL ?? 'http://localhost:5173/';

export default {
  url: `${base}?quality=${process.env.PN_QUALITY ?? 'high'}`,
  steps: [
    { until: () => !!window.__pn?.perf, label: 'booted', timeout: 30000 },
    { eval: H, label: 'helpers' },
    { eval: () => window.__h.click(/^Settings$/), label: 'open settings' },
    { wait: 300 },
    { eval: () => window.__h.click(/^Run benchmark/), label: 'run benchmark…' },
    { wait: 300 },
    { shot: 'bench-pick' },
    { eval: () => window.__h.click(/^Quick/), label: 'quick' },
    { wait: 2500 },
    { eval: () => ({ continuous: window.__pn.scene.renderer.isContinuous, strip: !!document.querySelector('.benchp.strip') }), label: 'running: continuous on, strip shown' },
    { shot: 'bench-running' },
    { until: () => !!document.querySelector('.benchp .verdict'), label: 'results', timeout: 180000 },
    { wait: 500 },
    { shot: 'bench-results' },
    {
      eval: async () => {
        const [s] = await window.__pn.perf.history.list();
        if (!s) return { error: 'no result saved' };
        const phases = s.runs.flatMap((r) => r.phases.map((p) => ({ id: p.id, frames: p.stats.frames, calls: p.stats.maxCalls, avgFps: Math.round(p.stats.avgFps), p99: +p.stats.p99Interval.toFixed(1), gpu: p.stats.avgGpu, cpu: +p.stats.avgCpu.toFixed(2) })));
        const r = window.__pn.scene.renderer;
        const problems = [];
        if (phases.length !== 3) problems.push(`expected 3 phases, got ${phases.length}`);
        if (phases.some((p) => p.frames === 0)) problems.push('a phase has no samples');
        // The budget is for a full board at rest. The Construction wave's sell fades add 19 (house)
        // to 39 (hotel) temporary draw calls each (Batch 3 implementation; see DECISIONS.md,
        // "Batch 4"); reported, not failed.
        if (phases.some((p) => p.id !== 'wave' && p.calls >= 150)) problems.push('draw calls ≥ 150 in a steady phase');
        if (r.isContinuous) problems.push('continuous mode still on');
        const wave = phases.find((p) => p.id === 'wave');
        const out = { verdict: s.verdict, hz: s.system.hz, gpu: s.system.gpu, gpuTimer: s.system.gpuTimer, phases, recs: s.recommendations.map((x) => x.id), knownSellFadePeak: wave?.calls };
        return problems.length ? { error: problems.join('; '), ...out } : out;
      },
      label: 'results: samples per phase, draw calls, continuous off',
    },
    {
      eval: async () => {
        const r = window.__pn.scene.renderer;
        await new Promise((res) => setTimeout(res, 2000));
        const frames = r.frameTimes.filter((t) => performance.now() - t < 2000).length;
        return frames === 0 ? { idleFramesIn2s: 0, running: r.isRunning } : { error: `rendered ${frames} frames while idle` };
      },
      label: 'idle after the run (expect 0 frames in 2 s)',
    },
    { key: 'Escape', label: 'back' },
    { wait: 500 },
    {
      eval: () => ({ menu: !!document.querySelector('.menu h1'), tokens: window.__pn.scene.tokens.tokens.size, continue: null }),
      label: 'back on the main menu with a clean board',
    },
    // Cancel mid-run: Back stops it, no result is saved, continuous is off.
    { eval: () => window.__h.click(/^Settings$/), label: 'settings again' },
    { wait: 300 },
    { eval: () => window.__h.click(/^Run benchmark/) },
    { wait: 300 },
    { eval: async () => ((window.__count = (await window.__pn.perf.history.list()).length), window.__h.click(/^Quick/)), label: 'quick again' },
    { wait: 3000 },
    { key: 'Escape', label: 'cancel' },
    { wait: 1500 },
    {
      eval: async () => {
        const n = (await window.__pn.perf.history.list()).length;
        const r = window.__pn.scene.renderer;
        const ok = n === window.__count && !r.isContinuous && !document.querySelector('.benchp') && !!document.querySelector('.menu h1');
        return ok ? { cancelled: true, history: n } : { error: 'cancel left state behind', history: n, continuous: r.isContinuous };
      },
      label: 'cancelled: nothing saved, continuous off, menu back',
    },
  ],
};
