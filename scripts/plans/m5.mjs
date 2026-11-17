import { H } from './helpers.mjs';

const idle = () => !window.__pn.controller.view.busy && !window.__pn.controller.view.moment && !window.__pn.controller.view.card;
const setSelect = (sel, value) => {
  const el = document.querySelector(sel);
  el.value = String(value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

export default {
  url: 'http://localhost:5173/?auto=human,human&seed=4&quality=low',
  steps: [
    { eval: H, label: 'helpers' },
    {
      label: 'deal deeds',
      eval: () => {
        window.__pn.patchState((s) => {
          s.tiles[1].owner = 0;
          s.tiles[3].owner = 1;
          s.tiles[39].owner = 1;
        });
        return true;
      },
    },
    { until: idle, label: 'idle' },
    { eval: () => window.__h.click(/^\s*Trade\s*$/), label: 'open trade' },
    { until: () => !!document.querySelector('.trade'), label: 'trade panel' },
    {
      label: 'compose: Hazel + $100 for Briar, promise',
      eval: async () => {
        const tiles = [...document.querySelectorAll('.trade .tile')];
        tiles.find((b) => /Hazel/.test(b.textContent)).click();
        tiles.find((b) => /Briar/.test(b.textContent)).click();
        for (let k = 0; k < 10; k++) [...document.querySelectorAll('.trade .step')].find((b) => b.textContent.trim() === '+10').click();
        await new Promise((r) => setTimeout(r, 50));
        return [...document.querySelectorAll('.trade .money b')].map((b) => b.textContent);
      },
    },
    {
      label: 'add rent-free promise (P1 on Briar, 3 turns)',
      eval: async () => {
        const setSelect = (el, value) => {
          el.value = String(value);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const sels = document.querySelectorAll('.trade .padd select');
        setSelect(sels[0], 0);
        await new Promise((r) => setTimeout(r, 50));
        setSelect(document.querySelectorAll('.trade .padd select')[1], 3);
        await new Promise((r) => setTimeout(r, 50));
        [...document.querySelectorAll('.trade .padd button')].find((b) => /Add/.test(b.textContent)).click();
        await new Promise((r) => setTimeout(r, 50));
        return [...document.querySelectorAll('.trade .pline')].map((p) => p.textContent.trim());
      },
    },
    { shot: 'm5-compose' },
    { eval: () => window.__h.click(/^\s*Propose\s*$/), label: 'propose' },
    { until: () => window.__pn.controller.state.phase === 'trade' && !!document.querySelector('.trade') && idle(), label: 'respond panel' },
    { shot: 'm5-respond' },
    { eval: () => window.__h.click(/^\s*Counter\s*$/), label: 'counter' },
    { until: () => /Counter offer/.test(document.querySelector('.trade')?.textContent ?? ''), label: 'counter screen' },
    { eval: () => window.__h.click(/Send counter/), label: 'send counter' },
    { until: () => window.__pn.controller.state.trade?.from === 1 && idle(), label: 'counter is live' },
    { wait: 300 },
    { shot: 'm5-counter' },
    { eval: () => window.__h.click(/^\s*Accept\s*$/), label: 'P1 accepts' },
    { until: idle, label: 'idle' },
    {
      label: 'result',
      eval: () => {
        const s = window.__pn.controller.state;
        return { hazel: s.tiles[1].owner, briar: s.tiles[3].owner, cash: s.players.map((p) => p.cash), promises: s.promises, cards: [...document.querySelectorAll('.seats .promise')].map((e) => e.textContent) };
      },
    },
    { shot: 'm5-done' },
    // A bot proposes a set-completing trade to the human.
    {
      label: 'bot owns 2 of 3 light blues, human holds the third',
      eval: () => {
        window.__pn.patchState((s) => {
          s.seats[1].kind = 'bot';
          for (const t of [6, 8]) s.tiles[t].owner = 1;
          s.tiles[9].owner = 0;
          s.players[1].cash = 3000;
          s.turn = { seat: 1, doubles: 0, rolled: false, extraRoll: false, dice: null, trades: 0 };
          s.phase = 'preRoll';
          s.trade = null;
        });
        return true;
      },
    },
    { until: () => window.__pn.controller.state.phase === 'trade' && idle(), label: 'bot proposed', timeout: 10000 },
    { eval: () => ({ offer: window.__pn.controller.state.trade, panel: document.querySelector('.trade .eyebrow')?.textContent }), label: 'offer to human' },
    { shot: 'm5-bot-offer' },
    { wait: 200 },
    { eval: () => (window.__h.click(/^\s*Reject\s*$/), window.__pn.controller.state.trade), label: 'human rejects' },
  ],
};
