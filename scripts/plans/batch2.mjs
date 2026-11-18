// Batch 2 check (2026-11-18): camera follows the token's side, bills for small payments, SOLD
// signs, names under the bands, card stacks, speed labels. Window: PN_W × PN_H.
//   node scripts/cdp.mjs scripts/plans/batch2.mjs .snapshots
const base = process.env.PN_URL ?? 'http://localhost:5173/';
const W = Number(process.env.PN_W ?? 1920);
const H = Number(process.env.PN_H ?? 1080);
const tag = `${W}x${H}`;

const idle = {
  eval: async () => {
    const c = window.__pn.controller;
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 100));
    while ((c.view.busy || c.view.card) && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 50));
    return Math.round(performance.now() - t0);
  },
  label: 'idle after (ms)',
};
const camSide = { eval: () => ({ side: window.__pn.scene.camera.side, seat: window.__pn.controller.state.turn.seat, pos: window.__pn.controller.state.players.map((p) => p.position) }), label: 'camera side' };

export default {
  url: `${base}?auto=human,human&seed=5&speed=normal&quality=high`,
  width: W,
  height: H,
  steps: [
    { until: () => !!window.__pn?.controller?.state, label: 'booted', timeout: 30000 },
    { wait: 1500 },
    // Board print, decks, no owners yet.
    { shot: `b2-${tag}-board` },
    { eval: () => (window.__pn.scene.camera.frame(0.2, 0.36, 0.3), window.__pn.scene.renderer.requestRender(), true) },
    { wait: 500 },
    { shot: `b2-${tag}-names-closeup` },
    { eval: () => (window.__pn.scene.camera.frame(-0.2, -0.2, 0.45), window.__pn.scene.renderer.requestRender(), true) },
    { wait: 500 },
    { shot: `b2-${tag}-deck-closeup` },
    { eval: () => (window.__pn.scene.camera.frame(0, 0, 1), window.__pn.scene.camera.setFollow(null), true) },
    { wait: 800 },
    // P1 (seat 0) on tile 7 rolls 2+3 → 12 (left side): bills to the bank when buying; camera turns left.
    { eval: () => { window.__pn.patchState((s) => { s.players[0].position = 7; }); return true; } },
    { wait: 600 },
    camSide,
    { eval: () => (window.__pn.forceDice(2, 3), window.__pn.controller.dispatch({ type: 'roll', seat: 0 })), label: 'roll 2+3 from tile 7' },
    idle,
    camSide,
    { shot: `b2-${tag}-landed-left` },
    { eval: () => window.__pn.controller.dispatch({ type: 'buy', seat: 0 }), label: 'buy (null = ok)' },
    { wait: 250 },
    { shot: `b2-${tag}-buy-bills` },
    idle,
    { shot: `b2-${tag}-sold-sign` },
    { eval: () => window.__pn.controller.dispatch({ type: 'endTurn', seat: 0 }), label: 'end turn' },
    idle,
    camSide,
    { shot: `b2-${tag}-p2-turn` },
    // P2 lands on P1's brown (tile 1): $2 rent → two $1 bills tab to tab.
    {
      eval: () => {
        window.__pn.patchState((s) => {
          s.tiles[1].owner = 0;
          s.players[1].position = 38;
        });
        return true;
      },
    },
    { wait: 800 },
    { eval: () => (window.__pn.forceDice(1, 2), window.__pn.controller.dispatch({ type: 'roll', seat: 1 })), label: 'P2 rolls 1+2 onto the brown' },
    { until: () => !!document.querySelector('.note.small'), timeout: 8000, label: 'bills flying' },
    { shot: `b2-${tag}-rent-bills` },
    idle,
    {
      eval: () => {
        const s = window.__pn.controller.state;
        return { cash: s.players.map((p) => p.cash), cards: [...document.querySelectorAll('.panel.seats .cash')].map((e) => e.textContent.trim()) };
      },
      label: 'cash after rent (engine vs cards)',
    },
    camSide,
    { shot: `b2-${tag}-after-rent` },
    // Many owners: signs at all four rotations.
    {
      eval: () => {
        window.__pn.patchState((s) => {
          s.tiles.forEach((t, i) => {
            if (s.board.tiles[i].price) t.owner = i % 2;
            if (s.board.tiles[i].type === 'street' && i > 20) t.buildings = i % 3 === 0 ? 5 : 4;
          });
          s.bank = { houses: 1000, hotels: 1000 };
        });
        return true;
      },
    },
    { wait: 1200 },
    ...[0, 1, 2, 3].flatMap((side) => [
      { eval: `(() => { const c = window.__pn.scene.camera; c.toSide(${side}, true); c.apply(); window.__pn.scene.renderer.requestRender(); return true; })()` },
      { wait: 600 },
      { shot: `b2-${tag}-signs-side${side}` },
    ]),
    { eval: () => (window.__pn.scene.camera.toSide(0, true), window.__pn.scene.camera.frame(0.05, -0.3, 0.32), window.__pn.scene.renderer.requestRender(), true) },
    { wait: 500 },
    { shot: `b2-${tag}-signs-far-row-closeup` },
    { eval: () => (window.__pn.scene.camera.frame(0.2, 0.33, 0.28), window.__pn.scene.renderer.requestRender(), true) },
    { wait: 500 },
    { shot: `b2-${tag}-signs-near-row-closeup` },
    { eval: () => (window.__pn.scene.camera.frame(0, 0, 1), true) },
    {
      eval: () => {
        const r = window.__pn.scene.renderer;
        r.requestRender();
        return new Promise((res) => setTimeout(() => res(r.lastRenderInfo), 300));
      },
      label: 'draw calls (budget < 150)',
    },
    { key: 'KeyP' },
    { wait: 600 },
    { shot: `b2-${tag}-pause` },
  ],
};
