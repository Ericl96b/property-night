// M10 UI check: lobby bot seats, turn order "As listed" with reordering, bot log lines, and
// the game-over wording for 1-human and 2-human games.
import { H } from './helpers.mjs';

const idle = () => !window.__pn.controller.view.busy && !window.__pn.controller.view.moment && !window.__pn.controller.view.card;

export default {
  url: 'http://localhost:5173/?seed=7&quality=low&speed=fast',
  steps: [
    { eval: H, label: 'helpers' },
    { until: () => !!document.querySelector('.menu h1'), label: 'main menu', timeout: 15000 },
    { eval: () => window.__h.click(/New game/), label: 'new game' },
    { until: () => !!document.querySelector('.setup'), label: 'lobby' },
    { eval: () => window.__h.click(/Add seat/), label: 'add seat 3' },
    { eval: () => window.__h.click(/Add seat/), label: 'add seat 4' },
    {
      eval: async () => {
        const kind = (i, v) => {
          const sel = document.querySelector(`select[aria-label="Seat ${i} kind"]`);
          sel.value = v;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        };
        kind(2, 'bot');
        kind(4, 'bankBot');
        await new Promise((r) => setTimeout(r, 100));
        return [...document.querySelectorAll('.setup .row input')].map((x) => x.value);
      },
      label: 'kinds set (expect Player 1, Bot 2, Bot 3, Bank 4)',
    },
    { eval: () => window.__h.click(/As listed/), label: 'turn order: as listed' },
    { wait: 100 },
    { eval: () => (document.querySelector('.setup .row .mv[aria-label^="Move Player 1 later"]').click(), true), label: 'move Player 1 down' },
    { wait: 150 },
    {
      eval: () => ({
        names: [...document.querySelectorAll('.setup .row input')].map((x) => x.value),
        ords: [...document.querySelectorAll('.setup .ord')].map((x) => x.textContent),
        hints: [...document.querySelectorAll('.setup .hint-line')].map((x) => x.textContent.slice(0, 40)),
        problem: document.querySelector('.setup .problem')?.textContent ?? null,
      }),
      label: 'lobby (expect Bot 2, Player 1, Bot 3, Bank 4; two hints; no problem)',
    },
    { shot: 'm10-lobby' },
    { eval: () => window.__h.click(/Start game/), label: 'start' },
    { until: () => !!window.__pn.controller.state, label: 'game started', timeout: 15000 },
    { eval: () => window.__pn.controller.state.seats.map((s) => `${s.name}:${s.kind}`), label: 'seat order kept' },
    { until: () => window.__pn.controller.state.turn.seat === 1 && window.__pn.controller.view.humanActors.length > 0 && idle(), label: "bots played until the human's turn", timeout: 60000 },
    { wait: 400 },
    { eval: () => window.__pn.controller.state.log.slice(-8).map((l) => l.text), label: 'recent log lines' },
    { shot: 'm10-bot-log' },
    { eval: () => (window.__pn.controller.dispatch({ type: 'forfeit', seat: 1 }), true), label: 'human forfeits (1-human game)' },
    { until: () => [...document.querySelectorAll('.banner')].some((b) => /Game over/i.test(b.innerText)) && idle(), label: 'game over', timeout: 30000 },
    { wait: 400 },
    { eval: () => [...document.querySelectorAll('.banner')].map((b) => b.innerText).join(' | '), label: 'banner (expect The bots win)' },
    { shot: 'm10-over-1human' },
    // Two humans and a bot: the last human wins although the bot is still in.
    { eval: () => ((location.href = 'http://localhost:5173/?auto=human,human,bot&seed=4&quality=low&speed=fast'), true), label: 'reload 2-human game' },
    { wait: 1500 },
    { eval: H, label: 'helpers again' },
    { until: () => !!window.__pn?.controller?.state && idle(), label: 'started', timeout: 20000 },
    { eval: () => (window.__pn.controller.dispatch({ type: 'forfeit', seat: 1 }), true), label: 'seat 1 forfeits' },
    { until: () => [...document.querySelectorAll('.banner')].some((b) => /Game over/i.test(b.innerText)) && idle(), label: 'game over', timeout: 30000 },
    { wait: 400 },
    { eval: () => [...document.querySelectorAll('.banner')].map((b) => b.innerText).join(' | '), label: 'banner (expect wins / last human standing)' },
    { shot: 'm10-over-2human' },
  ],
};
