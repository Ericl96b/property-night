// Batch 5 check (2026-11-22): Pink/Yellow swap, new colors, data wipe. Window: PN_W × PN_H.
//   node scripts/cdp.mjs scripts/plans/batch5.mjs .snapshots
import { H as HELPERS } from './helpers.mjs';

const base = process.env.PN_URL ?? 'http://localhost:5173/';
const W = Number(process.env.PN_W ?? 1920);
const H = Number(process.env.PN_H ?? 1080);

const idle = {
  eval: async () => {
    const c = window.__pn.controller;
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 100));
    while (c.view.busy && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 50));
    return Math.round(performance.now() - t0);
  },
  label: 'idle after (ms)',
};

/** Land `seat` on `target` with a forced 1+2 roll from 3 tiles back. */
const landOn = (seat, target) => [
  { eval: `(window.__pn.patchState((s) => { s.players[${seat}].position = ${(target + 37) % 40}; }), true)` },
  { wait: 600 },
  { eval: `(window.__pn.forceDice(1, 2), window.__pn.controller.dispatch({ type: 'roll', seat: ${seat} }))`, label: `seat ${seat} rolls 1+2 onto ${target}` },
  idle,
];

/** Turn to `side` and frame the buildings standing on tiles `a` and `b` (the span of a set). */
const frameSet = (side, a, b, shot) => [
  {
    eval: `(() => { const sc = window.__pn.scene;
      const pos = (t) => { const p = sc.buildings.placed.find((q) => q.tile === t); const { batch, id } = p.ids[0];
        const m = batch.getMatrixAt(id, batch.matrix.clone()); return [m.elements[12], m.elements[14], p.group, p.kind]; };
      const A = pos(${a}), B = pos(${b});
      sc.camera.toSide(${side}, true);
      sc.camera.frame((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, 0.28);
      sc.renderer.requestRender();
      return { [${a}]: A.slice(2), [${b}]: B.slice(2) }; })()`,
    label: `frame tiles ${a}–${b} (group, kind)`,
  },
  { wait: 900 },
  { shot },
];

const tileInfo = {
  eval: () => {
    const b = window.__pn.controller.state.board;
    const t = (i) => `${i} ${b.tiles[i].name} ${b.tiles[i].group} $${b.tiles[i].price}`;
    return { tiles: [11, 13, 14, 26, 27, 29].map(t), yellow: b.groups.yellow, pink: b.groups.pink, order: Object.keys(b.groups) };
  },
  label: 'board data in the running game',
};

export default {
  url: `${base}?auto=human,human&seed=5&speed=normal&quality=high`,
  width: W,
  height: H,
  steps: [
    { until: () => !!window.__pn?.controller?.state, label: 'booted', timeout: 30000 },
    { eval: HELPERS, label: 'helpers' },
    { wait: 1500 },
    tileInfo,
    { eval: () => (window.__pn.scene.camera.setFollow(null), window.__pn.scene.camera.frame(0, 0, 1), window.__pn.scene.camera.toSide(0, true), window.__pn.scene.renderer.requestRender(), true) },
    { wait: 900 },
    { shot: 'b5-board' },

    // Title deeds: seat 0 lands on Buttercup Row (14), seat 1 on Rosewood Lane (29).
    ...landOn(0, 14),
    { eval: () => document.querySelector('.context .deed')?.textContent.replace(/\s+/g, ' ').trim(), label: 'yellow deed text' },
    { shot: 'b5-deed-yellow' },
    { eval: () => window.__pn.controller.dispatch({ type: 'buy', seat: 0 }), label: 'buy 14' },
    idle,
    { eval: () => window.__pn.controller.dispatch({ type: 'endTurn', seat: 0 }), label: 'end turn' },
    idle,
    ...landOn(1, 29),
    { eval: () => document.querySelector('.context .deed')?.textContent.replace(/\s+/g, ' ').trim(), label: 'pink deed text' },
    { shot: 'b5-deed-pink' },
    { eval: () => window.__pn.controller.dispatch({ type: 'buy', seat: 1 }), label: 'buy 29' },
    idle,
    { eval: () => window.__pn.controller.dispatch({ type: 'endTurn', seat: 1 }), label: 'end turn' },
    idle,

    // Chance: put "Stroll down to {tile}" (target 11) on top and land seat 0 on Chance (7).
    {
      eval: () => {
        let idx = -1;
        window.__pn.patchState((s) => {
          idx = s.decks.chance.findIndex((c) => c.effect.kind === 'moveTo' && c.effect.tile === 11);
          s.deckOrder.chance = [idx, ...s.deckOrder.chance.filter((k) => k !== idx)];
        });
        return idx;
      },
      label: 'chance card to tile 11 on top (index)',
    },
    { eval: `(window.__pn.patchState((s) => { s.players[0].position = 4; }), true)` },
    { wait: 600 },
    { eval: () => (window.__pn.forceDice(1, 2), window.__pn.controller.dispatch({ type: 'roll', seat: 0 })), label: 'seat 0 rolls 1+2 onto Chance' },
    { until: () => !!document.querySelector('.card.chance .main'), label: 'chance card shown', timeout: 15000 },
    { wait: 900 },
    { eval: () => document.querySelector('.card.chance .main')?.textContent.trim(), label: 'chance card text' },
    { shot: 'b5-chance' },
    idle,
    { eval: () => window.__pn.controller.state.players[0].position, label: 'seat 0 position after the card (expect 11)' },

    // Close-ups: the full yellow and pink sets with 4 houses and a hotel each.
    {
      eval: () => {
        window.__pn.patchState((s) => {
          for (const [i, owner, b] of [[11, 0, 4], [13, 0, 4], [14, 0, 5], [26, 1, 4], [27, 1, 4], [29, 1, 5]]) {
            s.tiles[i].owner = owner;
            s.tiles[i].mortgaged = false;
            s.tiles[i].buildings = b;
          }
          s.bank = { houses: 1000, hotels: 1000 };
        });
        return window.__pn.scene.buildings.totals;
      },
      label: 'build both sets (totals)',
    },
    { wait: 1500 },
    ...frameSet(1, 11, 14, 'b5-yellow-closeup'),
    ...frameSet(2, 26, 29, 'b5-pink-closeup'),

    // Board editor color list, from the main menu.
    { cdp: 'Page.navigate', params: { url: `${base}?quality=high&seed=4` } },
    { until: () => !!window.__pn?.scene, label: 'menu booted', timeout: 30000 },
    { eval: HELPERS, label: 'helpers' },
    { wait: 800 },
    { eval: () => window.__h.click(/^\s*New game\s*$/), label: 'New game' },
    { wait: 300 },
    { eval: () => window.__h.click(/Edit board & cards/), label: 'open board editor' },
    { until: () => !!document.querySelector('.boards'), label: 'editor' },
    { wait: 400 },
    { eval: () => [...document.querySelectorAll('.boards input[type=color]')].map((i) => i.value), label: 'editor colors in order' },
    {
      eval: () => {
        const el = document.querySelector('.boards input[type=color]');
        el?.scrollIntoView({ block: 'center' });
        return !!el;
      },
      label: 'scroll to colors',
    },
    { wait: 300 },
    { shot: 'b5-editor-colors' },

    // Migration: plant old data through the app's KV, reload, expect it wiped.
    {
      eval: async () => {
        const kv = window.__pn.kv;
        await kv.put('saves', { id: 'dummy', name: 'Old save', version: 1 });
        await kv.put('meta', { id: 'dataVersion', value: 1 });
        return { saves: (await kv.list('saves')).length, version: (await kv.get('meta', 'dataVersion'))?.value };
      },
      label: 'planted (saves, dataVersion)',
    },
    { cdp: 'Page.navigate', params: { url: `${base}?quality=high&seed=4` } },
    { until: () => !!window.__pn?.kv, label: 'reloaded', timeout: 30000 },
    {
      eval: async () => {
        const kv = window.__pn.kv;
        const saves = await kv.list('saves');
        const version = (await kv.get('meta', 'dataVersion'))?.value;
        return { saves: saves.length, version, ok: saves.length === 0 && version === 2 };
      },
      label: 'after reload (expect 0 saves, version 2)',
    },
  ],
};
