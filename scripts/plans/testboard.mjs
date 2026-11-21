// Batch 4 check (SPEC-benchmark §6.4): enter the test board, apply each preset, add and remove a
// building with the keyboard, screenshot Worst case and a One-group close-up, exit, and check the
// autosave / Continue are untouched. URL: PN_URL (default: dev server).
import { H } from './helpers.mjs';

const base = process.env.PN_URL ?? 'http://localhost:5173/';

export default {
  url: `${base}?quality=${process.env.PN_QUALITY ?? 'high'}&speed=normal`,
  steps: [
    { until: () => !!window.__pn?.perf, label: 'booted', timeout: 30000 },
    { eval: H, label: 'helpers' },
    {
      eval: async () => {
        const a = await window.__pn.saves.continueGame();
        window.__autosave = JSON.stringify(a ?? null);
        return { hasAutosave: !!a };
      },
      label: 'autosave before',
    },
    { eval: () => window.__h.click(/^Test board$/), label: 'open test board' },
    { until: () => !!document.querySelector('.testb'), label: 'test board shown' },
    { wait: 800 },
    { eval: () => ({ overlay: !!document.querySelector('.perf'), state: window.__pn.controller.state ?? null }), label: 'overlay forced on, no game state' },
    ...['All houses', 'All hotels', 'Empty board'].flatMap((name) => [{ eval: `window.__h.click(/^${name}$/)`, label: name }, { wait: 400 }]),
    { shot: 'tb-empty' },
    { eval: () => window.__pn.testBoard().select(1), label: 'select tile 1' },
    { key: 'ArrowRight', label: 'next property (→)' },
    { key: 'KeyB', label: 'add (B)' },
    { key: 'KeyB', label: 'add (B)' },
    { key: 'KeyB', label: 'add (B)' },
    { wait: 1500 },
    { key: 'KeyV', label: 'remove (V)' },
    { wait: 1500 },
    {
      eval: () => {
        const tb = window.__pn.testBoard();
        const n = tb.state.tiles[tb.tile].buildings;
        const placed = window.__pn.scene.buildings.countOn(tb.tile);
        return tb.tile === 3 && n === 2 && placed.houses === 2 ? { tile: tb.tile, buildings: n, placed } : { error: 'add/remove by keyboard failed', tile: tb.tile, buildings: n, placed };
      },
      label: 'tile 3 has 2 houses (state and scene)',
    },
    { eval: () => window.__h.click(/^Worst case$/), label: 'worst case' },
    { wait: 1500 },
    { eval: () => ({ calls: (window.__pn.scene.renderer.requestRender(), window.__pn.scene.renderer.lastRenderInfo.calls) }), label: 'draw calls' },
    { wait: 300 },
    {
      eval: () => {
        const c = window.__pn.scene.renderer.lastRenderInfo.calls;
        return c < 150 ? { calls: c } : { error: `draw calls ${c} ≥ 150` };
      },
      label: 'worst case draw calls < 150',
    },
    { shot: 'tb-worst' },
    { eval: () => window.__h.click(/^One group/), label: 'one group (brown)' },
    { wait: 300 },
    { eval: () => window.__h.click(/^One group/), label: 'next group (light blue)' },
    { wait: 300 },
    { eval: () => (window.__pn.testBoard().select(8), window.__h.click(/^Close-up/)), label: 'select tile 8, close-up' },
    { wait: 2500 },
    { shot: 'tb-onegroup-closeup' },
    { key: 'KeyE', label: 'rotate (E)' },
    { wait: 2500 },
    { eval: () => ({ side: window.__pn.scene.camera.side }), label: 'camera side after E' },
    { eval: () => window.__h.click(/^Overlay: FPS/), label: 'overlay detailed' },
    { wait: 800 },
    { eval: () => ({ continuous: window.__pn.scene.renderer.isContinuous, text: document.querySelector('.perf')?.textContent.trim() }), label: 'detailed: live (continuous)' },
    { shot: 'tb-detailed' },
    { eval: () => window.__h.click(/^Animate/), label: 'animate on' },
    { wait: 3000 },
    { shot: 'tb-animate' },
    { eval: () => window.__h.click(/^Animate/), label: 'animate off' },
    { key: 'Escape', label: 'exit (Back)' },
    { wait: 800 },
    {
      eval: async () => {
        const r = window.__pn.scene.renderer;
        const after = JSON.stringify((await window.__pn.saves.continueGame()) ?? null);
        const out = { menu: !!document.querySelector('.menu h1'), tokens: window.__pn.scene.tokens.tokens.size, continuous: r.isContinuous, autosaveUnchanged: after === window.__autosave, overlay: !!document.querySelector('.perf') };
        return out.menu && out.tokens === 0 && !out.continuous && out.autosaveUnchanged && !out.overlay ? out : { error: 'exit left state behind', ...out };
      },
      label: 'menu back: clean board, render-on-demand, autosave untouched',
    },
    {
      eval: async () => {
        const r = window.__pn.scene.renderer;
        await new Promise((res) => setTimeout(res, 2000));
        const frames = r.frameTimes.filter((t) => performance.now() - t < 2000).length;
        return frames === 0 ? { idleFramesIn2s: 0 } : { error: `rendered ${frames} frames while idle` };
      },
      label: 'idle (expect 0 frames in 2 s)',
    },
  ],
};
