import { H } from './helpers.mjs';

const XBOX = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
const SWITCH = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';

// Page-side fake gamepads: navigator.getGamepads is read on every poll.
const FAKE = `(() => {
  const mk = (id, index) => ({ id, index, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
  window.__pads = [mk(${JSON.stringify(XBOX)}, 0), mk(${JSON.stringify(SWITCH)}, 1)];
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__pads });
  window.__press = async (i, b) => {
    const p = window.__pads[i];
    p.buttons[b] = { pressed: true, value: 1 };
    await new Promise((r) => setTimeout(r, 90));
    p.buttons[b] = { pressed: false, value: 0 };
    await new Promise((r) => setTimeout(r, 90));
  };
  return true;
})()`;

const idle = () => !window.__pn.controller.view.busy && !window.__pn.controller.view.moment && !window.__pn.controller.view.card;

export default {
  url: 'http://localhost:5173/?quality=low&seed=4',
  steps: [
    { eval: H, label: 'helpers' },
    { eval: FAKE, label: 'fake pads' },
    { wait: 300 },
    { eval: async () => (await window.__press(0, 3), await window.__press(1, 3), [...document.querySelectorAll('.pad span')].map((s) => s.textContent)), label: 'join both pads' },
    { eval: () => (window.__h.click(/^\s*$/, 'input[type=checkbox]') || document.querySelector('.opts input[type=checkbox]').click(), true), label: 'fixed order' },
    { wait: 200 },
    { shot: 'm4-lobby' },
    { eval: () => window.__h.click(/Start game/), label: 'start' },
    { wait: 1200 },
    { eval: () => [...window.__pn.input.bindings], label: 'bindings' },
    // Ownership: the Switch (seat 1) cannot roll on seat 0's turn; the Xbox (seat 0) can.
    { eval: () => window.__pn.forceDice(1, 2), label: 'dice' },
    { eval: async () => (await window.__press(1, 0), window.__pn.controller.state.turn.rolled), label: 'switch confirm on P1 turn (expect false)' },
    { eval: async () => (await window.__press(0, 0), true), label: 'xbox confirm rolls' },
    { until: () => window.__pn.controller.state.phase === 'buy' && !window.__pn.controller.view.busy, label: 'buy prompt' },
    { eval: () => [...document.querySelectorAll('.context .btn img')].map((i) => i.getAttribute('src').split('/').pop()), label: 'glyphs for xbox actor' },
    { eval: async () => (await window.__press(0, 1), window.__pn.controller.state.phase), label: 'xbox back declines → auction' },
    { until: () => !!document.querySelector('.auction'), label: 'auction panel' },
    {
      label: 'both pads bid in the same auction',
      eval: async () => {
        await window.__press(1, 5); // Switch R1: +$50
        await window.__press(1, 0); // Switch bids
        const afterSwitch = { ...window.__pn.controller.state.auction };
        await window.__press(0, 0); // Xbox bids (+$10 default)
        const afterXbox = { ...window.__pn.controller.state.auction };
        return { afterSwitch: [afterSwitch.highBidder, afterSwitch.highBid], afterXbox: [afterXbox.highBidder, afterXbox.highBid] };
      },
    },
    { shot: 'm4-auction' },
    { eval: async () => (await window.__press(1, 1), window.__pn.controller.state.tiles[3].owner), label: 'switch passes → xbox wins' },
    { until: idle, label: 'idle' },
    // Disconnect the Switch: the game pauses until it returns.
    { eval: () => (window.__pads = [window.__pads[0]], true), label: 'unplug switch' },
    { until: () => !!document.querySelector('.padlost'), label: 'reconnect overlay', timeout: 5000 },
    { shot: 'm4-padlost' },
    {
      label: 'plug back in',
      eval: () => {
        const mk = (id, index) => ({ id, index, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
        window.__pads = [window.__pads[0], mk('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 1)];
        return true;
      },
    },
    { until: () => !document.querySelector('.padlost') && !window.__pn.controller.paused, label: 'resumed', timeout: 5000 },
    // D-pad navigation in the pause menu from the Switch.
    { eval: async () => (await window.__press(1, 9), await window.__press(1, 13), await window.__press(1, 13), document.activeElement?.textContent?.trim()), label: 'switch opens pause, d-pad down twice' },
    { shot: 'm4-pause-nav' },
    { eval: async () => (await window.__press(1, 1), window.__pn.controller.paused), label: 'back resumes (expect false)' },
  ],
};
