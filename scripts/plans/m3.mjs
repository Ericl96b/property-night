import { H } from './helpers.mjs';

const idle = () => !window.__pn.controller.view.busy && !window.__pn.controller.view.moment && !window.__pn.controller.view.card;

export default {
  url: 'http://localhost:5173/?auto=human,bot&seed=4&quality=high',
  steps: [
    { eval: H, label: 'helpers' },
    // --- Auction: decline Briar Street, bid against the bot -------------------------------
    { eval: () => window.__pn.forceDice(1, 2), label: 'dice 1+2' },
    { eval: () => window.__h.click(/Roll dice/), label: 'roll' },
    { until: () => window.__pn.controller.view.state.phase === 'buy' && !window.__pn.controller.view.busy, label: 'buy prompt' },
    { eval: () => window.__h.click(/Decline/), label: 'decline' },
    { until: () => !!document.querySelector('.auction'), label: 'auction panel' },
    { wait: 400 },
    { shot: 'm3-auction' },
    { eval: () => window.__h.click(/^\s*Bid \$/, '.auction button'), label: 'human bids' },
    {
      label: 'finish auction',
      eval: async () => {
        const c = window.__pn.controller;
        for (let k = 0; k < 120 && c.state.phase === 'auction'; k++) {
          await new Promise((r) => setTimeout(r, 250));
          const a = c.state.auction;
          if (a && a.highBidder === 1 && a.highBid < 40) window.__h.click(/^\s*Bid \$/, '.auction button');
          else if (a && a.highBidder === 1) window.__h.click(/Pass/, '.auction button');
        }
        await window.__h.idle();
        return { phase: c.state.phase, owner: c.state.tiles[3].owner, log: c.state.log.slice(-4).map((l) => l.text) };
      },
    },
    // --- Manage: give the human the light-blue set and build evenly ----------------------
    {
      label: 'give light blues',
      eval: () => {
        window.__pn.patchState((s) => {
          for (const t of [6, 8, 9]) s.tiles[t].owner = 0;
          s.turn = { ...s.turn, seat: 0, rolled: true, extraRoll: false };
          s.phase = 'postRoll';
          s.players[0].cash = 1500;
        });
        return true;
      },
    },
    { until: idle, label: 'idle' },
    { eval: () => window.__h.click(/Manage properties/), label: 'open manage' },
    { until: () => !!document.querySelector('.manage'), label: 'manage panel' },
    {
      label: 'build 4 houses evenly',
      eval: async () => {
        for (let k = 0; k < 4; k++) {
          window.__h.click(/^House/, '.manage button');
          await window.__h.idle();
        }
        const s = window.__pn.controller.state;
        return [6, 8, 9].map((t) => s.tiles[t].buildings);
      },
    },
    { wait: 300 },
    { shot: 'm3-manage' },
    { key: 'Escape' },
    // --- Big payment: the human pays $2,000 at Midnight Park ------------------------------
    {
      label: 'set up hotel rent',
      eval: () => {
        window.__pn.patchState((s) => {
          for (const t of [37, 39]) {
            s.tiles[t].owner = 1;
            s.tiles[t].buildings = 5;
          }
          s.bank.hotels = 10;
          s.players[0].position = 34;
          s.players[0].cash = 5000;
          s.turn = { seat: 0, doubles: 0, rolled: false, extraRoll: false, dice: null, trades: 0 };
          s.phase = 'preRoll';
        });
        return window.__pn.forceDice(2, 3);
      },
    },
    { until: idle, label: 'idle' },
    { eval: () => window.__h.click(/Roll dice/), label: 'roll to Midnight Park' },
    { until: () => window.__pn.controller.view.moment?.kind === 'payment', label: 'payment moment', timeout: 20000 },
    { wait: 1150 },
    { shot: 'm3-payment' },
    { until: idle, label: 'moment done', timeout: 20000 },
    { eval: () => window.__pn.controller.state.players.map((p) => p.cash), label: 'cash after' },
    // --- Raise money and bankruptcy -------------------------------------------------------
    {
      label: 'set up ruin',
      eval: () => {
        window.__pn.patchState((s) => {
          s.players[0].position = 34;
          s.players[0].cash = 100;
          s.tiles[5].owner = 0;
          s.tiles[15].owner = 0;
          s.turn = { seat: 0, doubles: 0, rolled: false, extraRoll: false, dice: null, trades: 0 };
          s.phase = 'preRoll';
        });
        return window.__pn.forceDice(2, 3);
      },
    },
    { until: idle, label: 'idle' },
    { eval: () => window.__h.click(/Roll dice/), label: 'roll into debt' },
    { until: () => !!document.querySelector('.manage') && window.__pn.controller.state.phase === 'debt', label: 'raise-money panel', timeout: 20000 },
    { wait: 300 },
    { shot: 'm3-raise' },
    { eval: () => window.__h.click(/Declare bankruptcy/), label: 'declare' },
    { until: () => window.__pn.controller.view.moment?.kind === 'banner', label: 'bankrupt banner', timeout: 20000 },
    { wait: 500 },
    { shot: 'm3-bankrupt' },
    { until: () => window.__pn.controller.state.phase === 'gameOver' && idle(), label: 'game over', timeout: 20000 },
    { wait: 300 },
    { shot: 'm3-gameover' },
    { key: 'KeyP' },
    { wait: 300 },
    { shot: 'm3-pause' },
    { eval: () => ({ paused: window.__pn.controller.paused, winner: window.__pn.controller.state.winner }), label: 'final' },
  ],
};
