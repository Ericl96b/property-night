// Stage 3 check (docs/stage3/property-night-stage3-spec.md §9): the mock-up table loaded with
// ?demo=stage3, then every Inventory and Trade state the mock-ups show, the debt phase, the
// hold-to-accept, the rent-free banner, the card sheet and a locked (normal bot) game.
// Compare the shots with docs/stage3/property-night-stage3-mockups/screenshots/*.png.
//   node scripts/cdp.mjs scripts/plans/stage3.mjs .snapshots
import { H } from './helpers.mjs';

const base = process.env.PN_URL ?? 'http://localhost:5173/';
const idle = () => !window.__pn.controller.view.busy && !window.__pn.controller.view.moment && !window.__pn.controller.view.card;
const focusKey = (k, click = false) => ({
  eval: `(() => { const e = document.querySelector('[data-focus-key="${k}"]'); if (!e) return 'missing ${k}'; e.focus(); ${click ? 'e.click();' : ''} return e.getAttribute('aria-label') ?? e.textContent.trim().slice(0, 40); })()`,
  label: `${click ? 'click' : 'focus'} ${k}`,
});
const intent = (i, seat = null) => ({ eval: `(window.__pn.app.intent('${i}', ${seat}), '${i}')`, label: `intent ${i}` });
const text = (sel) => ({ eval: `[...document.querySelectorAll('${sel}')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`, label: `read ${sel}` });

const PROMISES = `[
  { id: 1, kind: 'rentFree', from: 1, to: 0, group: 'pink', total: 2, left: 1 },
  { id: 2, kind: 'rentFree', from: 0, to: 1, group: 'orange', total: 3, left: 3 },
  { id: 3, kind: 'noBuild', from: 0, to: 1, group: 'lightBlue', total: 3, left: 2, anchor: 0 },
]`;

export default {
  url: `${base}?demo=stage3&quality=low&speed=fast`,
  width: 1920,
  height: 1080,
  steps: [
    { cdp: 'Emulation.setFocusEmulationEnabled', params: { enabled: true }, label: 'page keeps focus (focus styles, focus events)' },
    { until: () => !!window.__pn?.controller?.state, label: 'demo loaded', timeout: 30000 },
    { eval: H, label: 'helpers' },
    { until: idle, label: 'idle' },

    // ---- Inventory ------------------------------------------------------------------------
    intent('manage'),
    { until: () => !!document.querySelector('[data-screen=inventory]'), label: 'inventory open' },
    focusKey('t5'),
    { wait: 300 },
    { shot: 's3-inventory-1-collection' },
    focusKey('t9', true),
    { wait: 300 },
    { shot: 's3-inventory-2-buildable' },
    intent('back'),
    focusKey('t37'),
    { wait: 300 },
    { shot: 's3-inventory-3-mortgaged' },
    intent('back'),
    { eval: `(window.__pn.patchState((s) => { s.promises = ${PROMISES}; s.nextPromiseId = 4; }), 'promises')`, label: 'add promises' },
    { until: idle, label: 'idle' },
    intent('manage'),
    { until: () => !!document.querySelector('[data-screen=inventory]'), label: 'inventory open' },
    focusKey('p3'),
    { wait: 300 },
    { shot: 's3-inventory-4-promises' },
    text('[data-screen=inventory] .acts'),
    intent('cycleRight'),
    { wait: 300 },
    { shot: 's3-inventory-viewonly-riley' },
    text('[data-screen=inventory] .h1'),
    intent('cycleLeft'),
    intent('back'),

    // ---- Debt phase: raise money -------------------------------------------------------------
    {
      eval: () => (
        window.__pn.patchState((s) => {
          s.rules.loans = true;
          s.players[0].loans = [{ id: 1, principal: 300, rate: 10, passesLeft: 4, collateral: [15], secured: true }];
          s.phase = 'debt';
          s.debts = [{ from: 0, to: 1, amount: 1100, reason: 'rent on Rose Court' }];
        }),
        'debt'
      ),
      label: 'debt to Riley',
    },
    { until: () => !!document.querySelector('[data-screen=inventory] .debtbar'), label: 'raise-money banner' },
    { wait: 300 },
    { shot: 's3-inventory-debt' },
    intent('back'),
    { eval: () => !!document.querySelector('[data-screen=inventory]'), label: 'Back does nothing in debt (expect true)' },
    { eval: () => (window.__pn.patchState((s) => { s.phase = 'preRoll'; s.debts = []; s.players[0].loans = []; s.promises = []; }), 'clear'), label: 'clear debt' },
    { until: idle, label: 'idle' },

    // ---- Trade: building an offer ---------------------------------------------------------------
    { eval: () => (window.__pn.app.intent('back', null), window.__pn.app.intent('trade', null), 'trade'), label: 'open trade' },
    { until: () => document.querySelector('[data-screen=trade]')?.dataset.mode === 'compose', label: 'compose open' },
    focusKey('0-t15', true),
    focusKey('0-j0', true),
    focusKey('1-t19', true),
    focusKey('0-cash', true),
    intent('cycleRight'),
    intent('navRight'),
    intent('navRight'),
    intent('navRight'),
    intent('navRight'),
    intent('navRight'),
    { wait: 300 },
    { shot: 's3-trade-1-building-offer' },
    intent('confirm'),
    text('[data-deal]'),

    // ---- Trade: promise vouchers --------------------------------------------------------------
    focusKey('1-promise', true),
    focusKey('v-group'),
    intent('navRight'),
    intent('navRight'),
    intent('navRight'),
    intent('navRight'),
    intent('navRight'),
    intent('navRight'),
    intent('trade'),
    focusKey('0-promise', true),
    { eval: () => (document.querySelectorAll('.vsheet .kind')[1].click(), 'noBuild'), label: 'No Building' },
    focusKey('v-group'),
    intent('navRight'),
    intent('navRight'),
    focusKey('v-length'),
    intent('navLeft'),
    { wait: 300 },
    { shot: 's3-trade-2-promise-voucher' },
    intent('trade'),
    { wait: 200 },
    text('[data-deal]'),
    { shot: 's3-trade-2b-offer-with-promises' },

    // ---- Trade: review, hold to accept -----------------------------------------------------------
    intent('trade'),
    { until: () => document.querySelector('[data-screen=trade]')?.dataset.mode === 'review', label: 'review' },
    { wait: 400 },
    { shot: 's3-trade-3-review' },
    text('[data-deal]'),
    intent('back'),
    { eval: () => window.__pn.controller.state.phase, label: 'Back on review does nothing (expect trade)' },
    focusKey('accept'),
    { eval: () => (window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })), 'down'), label: 'hold Space' },
    { wait: 400 },
    { shot: 's3-trade-3b-holding' },
    { wait: 700 },
    { eval: () => (window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })), 'up'), label: 'release' },
    { until: () => window.__pn.controller.state.phase !== 'trade', label: 'accepted' },
    { eval: () => { const s = window.__pn.controller.state; return { phase: s.phase, eastLine: s.tiles[15].owner, sunset: s.tiles[19].owner, promises: s.promises }; }, label: 'trade result' },
    { until: idle, label: 'idle', timeout: 20000 },

    // ---- Rent-free landing: banner and badge ---------------------------------------------------------
    {
      eval: () => (
        window.__pn.patchState((s) => {
          s.promises = [{ id: 9, kind: 'rentFree', from: 1, to: 0, group: 'railroad', total: 3, left: 3 }];
          s.players[0].position = 22;
          s.phase = 'preRoll';
          s.turn = { seat: 0, doubles: 0, rolled: false, extraRoll: false, dice: null, trades: 0, speed: null, speedChoice: null, mrMonopoly: false };
        }),
        window.__pn.forceDice(1, 2),
        window.__pn.controller.dispatch({ type: 'roll', seat: 0 })
      ),
      label: 'roll onto South Line',
    },
    { until: () => window.__pn.controller.view.moment?.kind === 'banner', label: 'rent-free banner', timeout: 20000 },
    { wait: 300 },
    { shot: 's3-rent-free-banner' },
    { eval: () => ({ cash: window.__pn.controller.state.players[0].cash, promises: window.__pn.controller.state.promises }), label: 'no rent, 2 left' },

    // ---- Card sheet ---------------------------------------------------------------------------
    { eval: `(location.href = '${base}?cards', 'cards')`, label: 'card sheet' },
    { until: () => !!document.querySelector('.sheet'), label: 'sheet', timeout: 20000 },
    { wait: 600 },
    { eval: () => (document.querySelector('[data-autofocus]').focus(), 'focus'), label: 'focus slot' },
    { shot: 's3-card-sheet' },

    // ---- Locked: a normal bot at the table -----------------------------------------------------
    { eval: `(location.href = '${base}?demo=stage3bot&quality=low&speed=fast', 'bot')`, label: 'bot table' },
    { until: () => !!window.__pn?.controller?.state, label: 'demo loaded', timeout: 30000 },
    { until: idle, label: 'idle' },
    intent('trade'),
    { until: () => !!document.querySelector('[data-screen=trade]'), label: 'compose open' },
    focusKey('0-t15', true),
    focusKey('1-t19', true),
    focusKey('propose'),
    { wait: 300 },
    { shot: 's3-trade-4-promises-locked' },
    text('.lockline'),
  ],
};
