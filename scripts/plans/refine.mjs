// Alpha refinements check (2026-11-18): board fits between the side panels at every rotation,
// four wider houses on a band, AO / brightness / tone-mapping comparisons, overhead view, and
// draw calls with AO on. Window size: PN_W × PN_H (default 1920 × 1080).
//   node scripts/cdp.mjs scripts/plans/refine.mjs .snapshots
const base = process.env.PN_URL ?? 'http://localhost:5173/';
const W = Number(process.env.PN_W ?? 1920);
const H = Number(process.env.PN_H ?? 1080);
const tag = `${W}x${H}`;

const settle = { wait: 700 };

/** Projected board corners vs the panel rects: the smallest gap in CSS px (negative = overlap). */
const measure = () => {
  const { scene } = window.__pn;
  const cam = scene.camera.camera;
  cam.updateMatrixWorld();
  const V = cam.position.constructor;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pts = [-0.5, 0.5].flatMap((x) => [-0.5, 0.5].map((z) => new V(x, 0.012, z).project(cam))).map((p) => ({ x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h }));
  const left = document.querySelector('.panel.seats')?.getBoundingClientRect();
  const right = document.querySelector('.panel.context')?.getBoundingClientRect();
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  return {
    side: scene.camera.side,
    board: { minX: Math.round(minX), maxX: Math.round(maxX), minY: Math.round(minY), maxY: Math.round(maxY) },
    gapLeft: left ? Math.round(minX - left.right) : null,
    gapRight: right ? Math.round(right.left - maxX) : null,
    heightFill: +((maxY - minY) / h).toFixed(3),
  };
};

const toSide = (side) => ({
  eval: `(() => { const c = window.__pn.scene.camera; c.toSide(${side}, true); c.apply(); window.__pn.scene.renderer.requestRender(); return true; })()`,
});
const graphics = (g) => ({
  eval: `(() => { window.__pn.scene.renderer.setGraphics(${JSON.stringify(g)}); return true; })()`,
});

export default {
  url: `${base}?auto=human,human,bot,bank&seed=3&speed=instant&quality=high`,
  width: W,
  height: H,
  steps: [
    { until: () => !!window.__pn?.controller?.state, label: 'booted', timeout: 30000 },
    { eval: () => (window.__pn.controller.setPaused(true), true), label: 'pause bots' },
    { wait: 1500 },
    {
      eval: () => {
        // Four houses on every street of the bottom and left rows, hotels on the top and right.
        window.__pn.patchState((s) => {
          s.tiles.forEach((t, i) => {
            const tile = s.board.tiles[i];
            if (!tile.price) return;
            t.owner = i % 2;
            if (tile.type === 'street') t.buildings = i < 20 ? 4 : 5;
          });
          s.bank = { houses: 1000, hotels: 1000 };
        });
        return true;
      },
      label: 'built board',
    },
    { wait: 1200 },
    ...[0, 1, 2, 3].flatMap((side) => [toSide(side), settle, { eval: measure, label: `fit side ${side} @ ${tag}` }, { shot: `refine-${tag}-side${side}` }]),
    // Close-up of a band with four houses (bottom row, side 0).
    toSide(0),
    { eval: () => (window.__pn.scene.camera.frame(0.2, 0.42, 0.28), window.__pn.scene.renderer.requestRender(), true) },
    settle,
    { shot: `refine-${tag}-houses-closeup` },
    { eval: () => (window.__pn.scene.camera.frame(0, 0, 1), window.__pn.scene.camera.setFollow(null), true) },
    { wait: 1500 },
    // Graphics comparisons.
    graphics({ ao: false, exposure: 1, toneMapping: 'aces' }), settle, { shot: `refine-${tag}-aces-100` },
    graphics({ ao: true, exposure: 1, toneMapping: 'aces' }), { wait: 1200 }, { shot: `refine-${tag}-aces-100-ao` },
    {
      eval: () => {
        const r = window.__pn.scene.renderer;
        r.requestRender();
        return new Promise((res) => setTimeout(() => res(r.lastRenderInfo), 300));
      },
      label: 'draw calls with AO on (budget < 150)',
    },
    graphics({ ao: false, exposure: 0.8, toneMapping: 'aces' }), settle, { shot: `refine-${tag}-aces-80` },
    graphics({ ao: false, exposure: 1, toneMapping: 'agx' }), settle, { shot: `refine-${tag}-agx-100` },
    graphics({ ao: false, exposure: 0.8, toneMapping: 'agx' }), settle, { shot: `refine-${tag}-agx-80` },
    graphics({ ao: false, exposure: 1, toneMapping: 'neutral' }), settle, { shot: `refine-${tag}-neutral-100` },
    graphics({ ao: false, exposure: 0.8, toneMapping: 'neutral' }), settle, { shot: `refine-${tag}-neutral-80` },
    graphics({ ao: false, exposure: 1, toneMapping: 'aces' }),
    // Reduce motion: fixed overhead view.
    {
      eval: () => {
        const c = window.__pn.scene.camera;
        c.settings.reduceMotion = true;
        c.toSide(0, true);
        c.apply();
        window.__pn.scene.renderer.requestRender();
        return true;
      },
    },
    settle,
    { eval: measure, label: `fit overhead @ ${tag}` },
    { shot: `refine-${tag}-overhead` },
    {
      eval: () => {
        const c = window.__pn.scene.camera;
        c.settings.reduceMotion = false;
        c.toSide(0, true);
        c.apply();
        return true;
      },
    },
    // Follow: a token hop onto GO (the near-right corner on side 0) with follow on.
    {
      eval: () => {
        window.__pn.patchState((s) => {
          s.players[s.turn.seat].position = 33;
          s.players[s.turn.seat].jail = null;
        });
        return true;
      },
    },
    { wait: 800 },
    { eval: () => (window.__pn.scene.camera.settings.follow = true, window.__pn.forceDice(3, 4), true) },
    { eval: () => { window.__pn.app.intent('confirm', null); return true; }, label: 'roll' },
    { wait: 1100 },
    { eval: measure, label: `fit during follow @ ${tag}` },
    { shot: `refine-${tag}-follow-go` },
    // Classic "bankBotMode: remove": the first human hotel sends the bank-backed bot away.
    {
      eval: () => {
        window.__pn.patchState((s) => {
          s.tiles.forEach((t) => {
            t.owner = null;
            t.buildings = 0;
            t.mortgaged = false;
          });
          s.tiles[37].owner = 0;
          s.tiles[39].owner = 0;
          s.tiles[37].buildings = 4;
          s.tiles[39].buildings = 4;
          s.bank = { houses: 24, hotels: 12 };
          s.turn = { ...s.turn, seat: 0, rolled: false, extraRoll: false };
          s.phase = 'preRoll';
          s.pendingBuy = null;
          s.auction = null;
          s.auctionQueue = [];
          s.debts = [];
        });
        return true;
      },
    },
    { wait: 800 },
    { eval: () => window.__pn.controller.dispatch({ type: 'build', seat: 0, tile: 39 }), label: 'build the first human hotel (null = ok)' },
    { wait: 500 },
    { shot: `refine-${tag}-bank-leaves` },
    { wait: 2500 },
    {
      eval: () => {
        const s = window.__pn.controller.state;
        const bank = s.seats.findIndex((x) => x.kind === 'bankBot');
        return { bank, leftTable: s.players[bank].leftTable, bankrupt: s.players[bank].bankrupt, card: document.querySelectorAll('.panel.seats .seat')[bank]?.textContent.replace(/\s+/g, ' ').trim(), log: s.log.slice(-2).map((l) => l.text) };
      },
      label: 'bank bot after the hotel',
    },
    { shot: `refine-${tag}-bank-gone` },
  ],
};
