// Stage 2 check (SPEC-closeup-camera §5, §9): at 3840 × 2160, test board with all hotels, Camera
// panel on; Home / Landed shots on three groups, the Dice shot, a chase across a corner, and peek.
// Quality from PN_QUALITY (high | low). Screenshots land in the out dir as s2-<quality>-*.
//   node scripts/cdp.mjs scripts/plans/stage2.mjs .snapshots
import { H } from './helpers.mjs';

const base = process.env.PN_URL ?? 'http://localhost:5173/';
const q = process.env.PN_QUALITY ?? 'high';

const pose = (tile, shot) => ({
  eval: `(async () => { const tb = window.__pn.testBoard(); tb.setTuneShot('${shot}'); tb.select(${tile}); await new Promise(r => setTimeout(r, 1200)); return { tile: tb.tile, shot: tb.tuneShot, board: window.__pn.scene.stats.boardSize, shadow: window.__pn.scene.quality.shadowMap }; })()`,
  label: `${shot} ${tile}`,
});

export default {
  url: `${base}?quality=${q}&speed=normal`,
  width: Number(process.env.PN_W ?? 3840),
  height: Number(process.env.PN_H ?? 2160),
  steps: [
    { until: () => !!window.__pn?.perf, label: 'booted', timeout: 30000 },
    { eval: H, label: 'helpers' },
    { eval: () => window.__h.click(/^Test board$/), label: 'open test board' },
    { until: () => !!document.querySelector('.testb'), label: 'test board shown' },
    { wait: 800 },
    { eval: () => (window.__pn.testBoard().applyPreset('allHotels'), window.__pn.testBoard().setTuning(true), 'ok'), label: 'all hotels + camera panel' },
    { wait: 800 },
    pose(26, 'home'),
    { shot: `s2-${q}-home-26` },
    pose(37, 'home'),
    { shot: `s2-${q}-home-37` },
    pose(1, 'home'),
    { shot: `s2-${q}-home-1` },
    pose(13, 'dice'),
    { shot: `s2-${q}-dice-13` },
    pose(6, 'home'),
    { eval: () => (window.__pn.testBoard().setMoveLen(7), window.__pn.testBoard().playMove(), 'moving'), label: 'play 6 → 13' },
    { until: () => (window.__pn.scene.queue.current?.anim?.label ?? '').startsWith('travel'), timeout: 5000, label: 'travelling' },
    { wait: 700 },
    { shot: `s2-${q}-chase-corner` },
    { wait: 3500 },
    { shot: `s2-${q}-landed-13` },
    { key: 'KeyC', label: 'peek down (C)' },
    { eval: () => (window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' })), new Promise((r) => setTimeout(() => r(window.__pn.scene.camera.peeking), 1500))), label: 'peeking' },
    { shot: `s2-${q}-peek` },
    { eval: () => (window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' })), new Promise((r) => setTimeout(() => r(window.__pn.scene.camera.peeking), 1500))), label: 'released' },
  ],
};
