// M11 UI check: sound unlock + volume settings, end-of-game stats screen with the money chart.
import { H } from './helpers.mjs';

const idle = () => !window.__pn.controller.view.busy && !window.__pn.controller.view.moment && !window.__pn.controller.view.card;

export default {
  url: 'http://localhost:5173/?auto=human,bot,bot&seed=8&quality=low&speed=fast',
  steps: [
    { eval: H, label: 'helpers' },
    { until: () => !!window.__pn?.controller?.state && idle(), label: 'started', timeout: 20000 },
    // A click unlocks audio (autoplay policy).
    { eval: () => (document.querySelector('.stage').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), new Promise((r) => setTimeout(() => r(window.__pn.sound.running), 300))), label: 'audio running after a click' },
    { eval: () => window.__h.click(/Roll dice/), label: 'roll (dice clatter + taps)' },
    { until: idle, label: 'idle', timeout: 15000 },
    // Pause menu: volume selects.
    { key: 'KeyP' },
    { wait: 300 },
    { eval: () => [...document.querySelectorAll('.pause label')].map((l) => l.textContent.trim().split('\n')[0]).slice(0, 4), label: 'settings labels' },
    { shot: 'm11-settings' },
    { key: 'KeyP' },
    { wait: 200 },
    // Replace the game with a finished headless one (same seats) to show real stats.
    {
      eval: async () => {
        const { runHeadless } = await import('/src/bots/headless.ts');
        const seats = window.__pn.controller.state.seats.map((s) => ({ kind: 'bot', name: s.name, token: s.token, color: s.color }));
        const r = runHeadless({ seats, seed: 21, turnOrder: 'fixed' }, { maxTurns: 3000 });
        const human = window.__pn.controller.state.seats.findIndex((s) => s.kind === 'human');
        window.__pn.patchState((s) => {
          Object.assign(s, structuredClone(r.state));
          s.seats = s.seats.map((x, i) => ({ ...x, kind: i === human ? 'human' : 'bot' }));
        });
        return { finished: r.finished, turns: r.turns, winner: r.winner, samples: r.state.history.cash.length };
      },
      label: 'finished game loaded',
    },
    { until: () => [...document.querySelectorAll('.banner')].some((b) => /Game over/i.test(b.innerText)), label: 'game over banner', timeout: 15000 },
    { wait: 300 },
    { shot: 'm11-gameover' },
    { eval: () => window.__h.click(/Game stats/), label: 'open stats' },
    { until: () => !!document.querySelector('.statsp'), label: 'stats panel' },
    { wait: 300 },
    { eval: () => ({ rows: document.querySelectorAll('.statsp tbody tr').length, best: document.querySelector('.statsp .best').textContent.trim(), lines: document.querySelectorAll('.statsp polyline').length }), label: 'stats content' },
    { shot: 'm11-stats' },
    { eval: () => window.__h.click(/Back to the board/), label: 'close stats' },
    { eval: () => !document.querySelector('.statsp'), label: 'stats closed' },
  ],
};
