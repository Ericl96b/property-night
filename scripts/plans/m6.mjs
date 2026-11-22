import { H } from './helpers.mjs';

const idle = () => !window.__pn.controller.view.busy && !window.__pn.controller.view.moment && !window.__pn.controller.view.card;

export default {
  url: 'http://localhost:5173/?quality=low&seed=4',
  steps: [
    { eval: H, label: 'helpers' },
    { eval: () => window.__h.click(/^\s*New game\s*$/), label: 'New game from the main menu' },
    { wait: 300 },
    { eval: () => window.__h.click(/Edit rules/), label: 'open rules editor' },
    { until: () => !!document.querySelector('.rules'), label: 'editor' },
    { wait: 300 },
    { shot: 'm6-classic' },
    { eval: () => window.__h.click(/^Duplicate$/, '.rules button'), label: 'duplicate classic' },
    { until: () => /Classic copy/.test(document.querySelector('.rules h2')?.textContent ?? ''), label: 'copy selected' },
    {
      label: 'edit: Free Parking pot, starting cash 2500, speed die on',
      eval: async () => {
        const fields = [...document.querySelectorAll('.rules .field')];
        const byLabel = (re) => fields.find((f) => re.test(f.querySelector('.lbl').textContent));
        const fp = byLabel(/^Behavior/).querySelector('select');
        fp.value = 'pot';
        fp.dispatchEvent(new Event('change', { bubbles: true }));
        const sc = byLabel(/^Starting cash/).querySelector('input');
        sc.value = '2500';
        sc.dispatchEvent(new Event('change', { bubbles: true }));
        byLabel(/^Speed die/).querySelector('input').click();
        await new Promise((r) => setTimeout(r, 600));
        return document.querySelector('.rules .note.ok')?.textContent;
      },
    },
    { shot: 'm6-edited' },
    { eval: () => window.__h.click(/Use these rules/), label: 'use' },
    { wait: 300 },
    { eval: () => document.querySelector('select[aria-label="Rules preset"]').selectedOptions[0].textContent, label: 'lobby shows preset' },
    { eval: () => window.__h.click(/Start game/), label: 'start' },
    { wait: 1500 },
    { eval: () => ({ fp: window.__pn.controller.state.rules.freeParking, cash: window.__pn.controller.state.players.map((p) => p.cash), speed: window.__pn.controller.state.rules.speedDie }), label: 'game rules' },
    // Speed die bus choice UI.
    {
      label: 'force a bus roll',
      eval: () => {
        window.__pn.patchState((s) => {
          s.players.forEach((p) => (p.lapped = true));
          s.turn = { ...s.turn, rolled: false, extraRoll: false };
          s.phase = 'preRoll';
        });
        return window.__pn.forceDice(1, 2, 4);
      },
    },
    { until: idle, label: 'idle' },
    { eval: () => window.__h.click(/Roll dice/), label: 'roll' },
    { until: () => window.__pn.controller.state.phase === 'speedChoice' && idle(), label: 'bus choice' },
    { wait: 300 },
    { eval: () => window.__h.buttons(), label: 'bus buttons' },
    { shot: 'm6-bus' },
    { eval: () => window.__h.click(/^\s*Move 3/), label: 'take 3' },
    { until: idle, label: 'idle' },
    { eval: () => window.__pn.controller.state.players[window.__pn.controller.state.turn.seat].position, label: 'position (expect 3)' },
    // Building shortage auction screen.
    {
      label: 'scarce houses',
      eval: () => {
        window.__pn.patchState((s) => {
          const me = s.turn.seat;
          const other = 1 - me;
          for (const t of [6, 8, 9]) s.tiles[t].owner = me;
          for (const t of [1, 3]) s.tiles[t].owner = other;
          s.rules.houseSupply = 1;
          s.bank.houses = 1;
          s.phase = 'postRoll';
          s.turn = { ...s.turn, rolled: true, speedChoice: null };
        });
        return true;
      },
    },
    { until: idle, label: 'idle' },
    { eval: () => window.__h.click(/^Inventory/), label: 'manage' },
    { until: () => !!document.querySelector('[data-screen=inventory]'), label: 'manage open' },
    { eval: () => window.__h.invBuildAny(), label: 'try to build' },
    { until: () => !!document.querySelector('.auction .lot'), label: 'house auction panel' },
    { wait: 300 },
    { shot: 'm6-house-auction' },
  ],
};
