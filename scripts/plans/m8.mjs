import { H } from './helpers.mjs';

export default {
  url: 'http://localhost:5173/?quality=high&seed=4',
  steps: [
    { eval: H, label: 'helpers' },
    { eval: () => window.__h.click(/^\s*New game\s*$/), label: 'New game from the main menu' },
    { wait: 300 },
    { eval: () => window.__h.click(/Edit board & cards/), label: 'open board editor' },
    { until: () => !!document.querySelector('.boards'), label: 'editor' },
    { wait: 300 },
    { shot: 'm8-classic' },
    { eval: () => window.__h.click(/^Duplicate$/, '.boards button'), label: 'duplicate' },
    { until: () => /Classic board copy/.test(document.querySelector('.boards h2')?.textContent ?? ''), label: 'copy selected' },
    {
      label: 'rename Hazel Lane, recolor brown, bump Midnight Park',
      eval: async () => {
        const set = (el, v, ev = 'input') => {
          el.value = v;
          el.dispatchEvent(new Event(ev, { bubbles: true }));
        };
        const names = [...document.querySelectorAll('.boards .tname')];
        set(names.find((i) => i.value === 'Hazel Lane'), 'Maple Way');
        set(names.find((i) => i.value === 'Midnight Park'), 'Lighthouse Point');
        set(document.querySelector('.boards input[type=color]'), '#7a3e9d');
        await new Promise((r) => setTimeout(r, 700));
        return document.querySelector('.boards .note.ok')?.textContent;
      },
    },
    { shot: 'm8-edited' },
    { eval: () => window.__h.click(/^Chance$/, '.boards .tabs button'), label: 'chance tab' },
    { wait: 300 },
    { eval: () => [...document.querySelectorAll('.boards textarea')].map((t) => t.value).filter((t) => t.includes('{tile}')).length, label: 'templated cards' },
    { shot: 'm8-cards' },
    { eval: () => window.__h.click(/Use this board/), label: 'use board' },
    { wait: 300 },
    { eval: () => ({ ms0: window.__pn.scene.stats.boardMs }), label: 'texture before' },
    { eval: () => (document.querySelector('.opts input[type=checkbox]').click(), window.__h.click(/Start game/)), label: 'start' },
    { until: () => !!window.__pn.controller.state, label: 'game started', timeout: 15000 },
    { wait: 1500 },
    { eval: () => ({ hazel: window.__pn.controller.state.board.tiles[1].name, brown: window.__pn.controller.state.board.groups.brown.color, boardMs: window.__pn.scene.stats.boardMs }), label: 'game board' },
    { eval: () => (window.__pn.scene.camera.frame(0.25, 0.42, 0.45), window.__pn.scene.renderer.requestRender(), true), label: 'look at the bottom row' },
    { wait: 600 },
    { shot: 'm8-board' },
  ],
};
