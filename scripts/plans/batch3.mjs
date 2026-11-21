// Batch 3 check (2026-11-21): themed houses and hotels. Window: PN_W × PN_H.
//   node scripts/cdp.mjs scripts/plans/batch3.mjs .snapshots
const base = process.env.PN_URL ?? 'http://localhost:5173/';
const W = Number(process.env.PN_W ?? 1920);
const H = Number(process.env.PN_H ?? 1080);

const GROUPS = ['brown', 'lightBlue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkBlue'];

/** Run one Buildings animation through the scene's queue (scale stretches it for screenshots). */
const anim = (method, tile, scale) => ({
  eval: `(() => { const sc = window.__pn.scene;
    const before = sc.buildings.countOn(${tile});
    sc.queue.push({ label: 'b3-${method}', start: () => sc.buildings.${method}(${tile}, ${scale}) });
    sc.renderer.wake();
    return before; })()`,
  label: `${method} on tile ${tile} (count before)`,
});
const count = (tile) => ({ eval: `window.__pn.scene.buildings.countOn(${tile})`, label: `count on ${tile}` });

/** Frame the camera on the first building standing on `tile`. */
const frameTile = (tile) => ({
  eval: `(() => { const tile = ${tile};
    const sc = window.__pn.scene;
    const p = sc.buildings.placed.find((q) => q.tile === tile);
    const { batch, id } = p.ids[0];
    const m = batch.getMatrixAt(id, batch.matrix.clone());
    sc.camera.frame(m.elements[12], m.elements[14], 0.3);
    sc.renderer.requestRender();
    return { tile, kind: p.kind, group: p.group }; })()`,
  label: `frame tile ${tile}`,
});

const closeups = [];
for (const g of GROUPS) {
  for (const kind of ['house', 'hotel']) {
    closeups.push(
      {
        eval: `(() => { const g = '${g}', kind = '${kind}';
          const s = window.__pn.controller.state;
          const tiles = s.board.tiles.map((t, i) => (t.group === g ? i : -1)).filter((i) => i >= 0);
          const want = kind === 'hotel' ? 5 : 4;
          const tile = tiles.find((i) => s.tiles[i].buildings === want);
          window.__b3tile = tile;
          return tile; })()`,
        label: `${g} ${kind} tile`,
      },
      {
        eval: () => {
          const sc = window.__pn.scene;
          const p = sc.buildings.placed.find((q) => q.tile === window.__b3tile);
          const { batch, id } = p.ids[0];
          const m = batch.getMatrixAt(id, batch.matrix.clone());
          sc.camera.toSide(Math.floor(p.tile / 10) % 4, true);
          sc.camera.frame(m.elements[12], m.elements[14], 0.3);
          sc.renderer.requestRender();
          return { kind: p.kind, group: p.group };
        },
        label: 'frame',
      },
      { wait: 700 },
      { shot: `b3-${g}-${kind}` },
    );
  }
}

export default {
  url: `${base}?auto=human,human&seed=5&speed=normal&quality=high`,
  width: W,
  height: H,
  steps: [
    { until: () => !!window.__pn?.controller?.state, label: 'booted', timeout: 30000 },
    { wait: 1500 },
    { eval: () => ({ buildingsMs: Math.round(window.__pn.scene.stats.buildingsMs), startupMs: Math.round(window.__pn.scene.stats.startupMs) }), label: 'scene stats' },
    {
      eval: () => {
        const sizes = window.__pn.scene.buildings.designSizes();
        const houseW = Object.fromEntries(Object.entries(sizes).map(([g, s]) => [g, +(s.house.x * 0.016).toFixed(4)]));
        const maxHouseW = Math.max(...Object.values(houseW));
        const maxD = Math.max(...Object.values(sizes).flatMap((s) => [s.house.z, s.hotel.z])) * 0.016;
        const hotelW = Object.fromEntries(Object.entries(sizes).map(([g, s]) => [g, +(s.hotel.x * 0.016).toFixed(4)]));
        return { houseW, hotelW, maxHouseW, houseFits: maxHouseW < 0.0204, maxDepth: +maxD.toFixed(4), depthFits: maxD < 0.038 };
      },
      label: 'fit check (house < 0.0204, depth < 0.038)',
    },
    // Animations on an empty street (tile 1, brown), stretched ×8 so mid-drop can be caught.
    { eval: () => (window.__pn.scene.camera.setFollow(null), true) },
    { eval: () => window.__pn.patchState((s) => { s.tiles[1].owner = 0; }) ?? true, label: 'own tile 1' },
    { wait: 800 },
    anim('add', 1, 0),
    anim('add', 1, 0),
    anim('add', 1, 0),
    { wait: 200 },
    frameTile(1),
    { wait: 700 },
    anim('add', 1, 8),
    { wait: 700 },
    { shot: 'b3-drop' },
    { wait: 1500 },
    count(1),
    anim('add', 1, 8),
    { wait: 2500 },
    count(1),
    { shot: 'b3-hotel-upgrade' },
    anim('remove', 1, 8),
    { wait: 1400 },
    { shot: 'b3-sell' },
    { wait: 2500 },
    count(1),
    // Full board, as perf.mjs.
    {
      eval: () => {
        window.__pn.scene.buildings.set(1, 0, false);
        window.__pn.patchState((s) => {
          s.tiles.forEach((t, i) => {
            const tile = s.board.tiles[i];
            if (!tile.price) return;
            t.owner = i % 2;
            if (tile.type === 'street') t.buildings = i % 3 === 0 ? 5 : 4;
            else t.mortgaged = i % 2 === 0;
          });
          // Pink and green have no i % 3 === 0 street: give each group's last street a hotel.
          const last = {};
          s.board.tiles.forEach((tile, i) => { if (tile.type === 'street') last[tile.group] = i; });
          for (const i of Object.values(last)) if (!s.board.tiles.some((t, j) => t.group === s.board.tiles[i].group && s.tiles[j].buildings === 5)) s.tiles[i].buildings = 5;
          s.bank = { houses: 1000, hotels: 1000 };
        });
        return window.__pn.scene.buildings.totals;
      },
      label: 'full board (totals)',
    },
    { wait: 1500 },
    ...[0, 1, 2, 3].flatMap((side) => [
      { eval: `(() => { const c = window.__pn.scene.camera; c.frame(0, 0, 1); c.toSide(${side}, true); window.__pn.scene.renderer.requestRender(); return ${side}; })()`, label: `side ${side}` },
      { wait: 900 },
      { shot: `b3-side${side}` },
    ]),
    {
      eval: () => {
        const r = window.__pn.scene.renderer;
        r.requestRender();
        return new Promise((res) => setTimeout(() => res(r.lastRenderInfo), 300));
      },
      label: 'draw calls, full board (budget < 150)',
    },
    ...closeups,
    // Edited group colors: rebuild with swapped accents and re-place everything.
    {
      eval: async () => {
        const sc = window.__pn.scene;
        const b = structuredClone(window.__pn.controller.state.board);
        const cols = ['#5B2C83', '#00A6A6', '#222222', '#FFFFFF', '#7A9A01', '#C71585', '#FF6F00', '#8B0000'];
        Object.keys(b.groups).forEach((g, i) => (b.groups[g].color = cols[i]));
        await sc.setBoard(b);
        sc.camera.frame(0, 0, 1);
        sc.renderer.requestRender();
        return { totals: sc.buildings.totals, buildingsMs: Math.round(sc.stats.buildingsMs) };
      },
      label: 'custom colors (setBoard)',
    },
    { wait: 1200 },
    { shot: 'b3-custom-colors' },
    {
      eval: () => {
        const sc = window.__pn.scene;
        const p = sc.buildings.placed.find((q) => q.group === 'orange' && q.kind === 'hotel');
        const { batch, id } = p.ids[0];
        const m = batch.getMatrixAt(id, batch.matrix.clone());
        sc.camera.frame(m.elements[12], m.elements[14], 0.3);
        sc.renderer.requestRender();
        return true;
      },
    },
    { wait: 700 },
    { shot: 'b3-custom-colors-closeup' },
  ],
};
