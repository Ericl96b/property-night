import { H } from './helpers.mjs';

const idle = () => !window.__pn.controller.view.busy && !window.__pn.controller.view.moment && !window.__pn.controller.view.card;

export default {
  url: 'http://localhost:5173/?auto=human,human&seed=4&quality=low',
  steps: [
    { eval: H, label: 'helpers' },
    {
      label: 'loans on, P1 owns the dark blues',
      eval: () => {
        window.__pn.patchState((s) => {
          s.rules.loans = true;
          s.tiles[37].owner = 0;
          s.tiles[39].owner = 0;
        });
        return true;
      },
    },
    { until: idle, label: 'idle' },
    { wait: 200 },
    { eval: () => window.__h.click(/Bank loans/), label: 'open loans' },
    { until: () => !!document.querySelector('.loans'), label: 'loan panel' },
    {
      label: 'secured by Midnight Park, $300 over 5 passes',
      eval: async () => {
        const radios = document.querySelectorAll('.loans input[type=radio]');
        radios[1].click();
        await new Promise((r) => setTimeout(r, 50));
        [...document.querySelectorAll('.loans .tile')].find((b) => /Midnight/.test(b.textContent)).click();
        await new Promise((r) => setTimeout(r, 50));
        for (let k = 0; k < 3; k++) [...document.querySelectorAll('.loans .op')].find((b) => b.textContent.trim() === '+100').click();
        await new Promise((r) => setTimeout(r, 50));
        return { amount: document.querySelector('.loans .amt').textContent, plan: document.querySelector('.loans .plan')?.textContent };
      },
    },
    { shot: 'm7-loan' },
    { eval: () => window.__h.click(/Take loan/), label: 'take' },
    { until: idle, label: 'idle' },
    { wait: 300 },
    { eval: () => ({ loans: window.__pn.controller.state.players[0].loans, cash: window.__pn.controller.state.players[0].cash }), label: 'loan state' },
    { eval: () => window.__h.click(/^Inventory/), label: 'manage' },
    { until: () => !!document.querySelector('[data-screen=inventory]'), label: 'manage open' },
    { eval: () => [...document.querySelectorAll('[data-screen=inventory] .lockb')].length, label: 'lock tags (expect 1)' },
    { shot: 'm7-manage' },
  ],
};
