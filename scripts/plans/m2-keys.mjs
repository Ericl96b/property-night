import { H } from './helpers.mjs';
const press = Array.from({ length: 6 }, () => [{ key: 'Space' }, { wait: 2600 }]).flat();
export default {
  url: 'http://localhost:5173/?auto=human,human&seed=4&quality=high',
  steps: [
    { eval: H, label: 'helpers' },
    { eval: () => ({ turn: window.__h.c().state.turnNumber, rolled: window.__h.c().state.turn.rolled }), label: 'before' },
    ...press,
    { eval: () => ({ turn: window.__h.c().state.turnNumber, log: window.__h.c().state.log.slice(-6).map((l) => l.text) }), label: 'after keyboard' },
    // Drive to the next card draw and capture it.
    {
      label: 'until card',
      eval: async () => {
        const h = window.__h;
        const c = h.c();
        for (let k = 0; k < 80; k++) {
          if (c.view.card) return c.view.card;
          if (!c.view.busy) h.click(/Roll/) || h.click(/Buy for/) || h.click(/End turn/) || h.click(/Pay /);
          await new Promise((r) => setTimeout(r, 120));
        }
        return null;
      },
    },
    { wait: 500 },
    { shot: 'm2-card' },
  ],
};
