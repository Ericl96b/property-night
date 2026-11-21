// §10.10 performance check: startup time, draw calls with a full board, render-on-demand when
// idle, frame rate while animating. URL: PN_URL (default: dev server), quality: PN_QUALITY.
const base = process.env.PN_URL ?? 'http://localhost:5173/';
const quality = process.env.PN_QUALITY ?? 'high';
// PN_AO=1 / 0 forces the ambient-occlusion setting (Settings → Graphics).
const ao = process.env.PN_AO ? `&ao=${process.env.PN_AO}` : '';

export default {
  url: `${base}?auto=human,bot,bot,bot,bot,bot&seed=3&quality=${quality}&speed=normal${ao}`,
  steps: [
    { until: () => !!window.__pn?.controller?.state, label: 'booted', timeout: 30000 },
    {
      eval: () => {
        const nav = performance.getEntriesByType('navigation')[0];
        return { bootMs: Math.round(performance.now()), domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0), gpu: window.__pn.scene.renderer.gl.getContext().getParameter(0x1f01) };
      },
      label: 'startup (ms since navigation)',
    },
    { eval: () => (window.__pn.controller.setPaused(true), true), label: 'pause bots' },
    { wait: 2500 },
    {
      eval: async () => {
        const r = window.__pn.scene.renderer;
        const before = r.frameTimes.length;
        await new Promise((res) => setTimeout(res, 2000));
        return { idleFramesIn2s: r.frameTimes.filter((t) => performance.now() - t < 2000).length, running: r.isRunning, before };
      },
      label: 'idle: frames rendered in 2 s (expect 0)',
    },
    {
      eval: () => {
        // Worst case: every property owned, every street with a hotel or four houses, mortgages.
        window.__pn.patchState((s) => {
          s.tiles.forEach((t, i) => {
            const tile = s.board.tiles[i];
            if (!tile.price) return;
            t.owner = i % 6;
            if (tile.type === 'street') t.buildings = i % 3 === 0 ? 5 : 4;
            else t.mortgaged = i % 2 === 0;
          });
          s.bank = { houses: 1000, hotels: 1000 };
        });
        return true;
      },
      label: 'full board',
    },
    { wait: 1500 },
    {
      eval: () => {
        const r = window.__pn.scene.renderer;
        r.requestRender();
        return new Promise((res) => setTimeout(() => res(r.lastRenderInfo), 200));
      },
      label: 'draw calls, full board (budget < 150)',
    },
    { shot: `perf-${quality}` },
    {
      eval: async () => {
        const r = window.__pn.scene.renderer;
        const cam = window.__pn.scene.camera;
        cam.toSide((cam.side + 2) % 4);
        r.requestRender();
        r.wake();
        await new Promise((res) => setTimeout(res, 1000));
        return { fpsDuringTurn: r.fps, calls: r.lastRenderInfo.calls };
      },
      label: 'fps while the camera turns',
    },
  ],
};
