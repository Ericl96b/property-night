// Stage 2 tuning aid: Home shot on one tile at several pitch / yaw-offset pairs, to see where the
// active token stops hiding the property name. PN_TILE (default 26).
import { H } from './helpers.mjs';

const base = process.env.PN_URL ?? 'http://localhost:5173/';
const tile = Number(process.env.PN_TILE ?? 26);
const combos = (process.env.PN_COMBOS ?? '40:20,48:20,55:20,48:32,55:32').split(',').map((c) => c.split(':').map(Number));

export default {
  url: `${base}?quality=high&speed=normal`,
  width: 3840,
  height: 2160,
  steps: [
    { until: () => !!window.__pn?.perf, label: 'booted', timeout: 30000 },
    { eval: H, label: 'helpers' },
    { eval: () => window.__h.click(/^Test board$/), label: 'open test board' },
    { until: () => !!document.querySelector('.testb'), label: 'test board shown' },
    { wait: 600 },
    { eval: `(window.__pn.testBoard().applyPreset('allHotels'), window.__pn.testBoard().setTuning(true), window.__pn.testBoard().select(${tile}), 'ok')`, label: 'setup' },
    ...combos.flatMap(([p, y]) => [
      { eval: `(async () => { const tb = window.__pn.testBoard(); tb.setTunable('homeYawOffset', ${y}); tb.setTunable('homePitch', ${p}); await new Promise(r => setTimeout(r, 700)); return 'ok'; })()`, label: `pitch ${p} yaw ${y}` },
      { shot: `pitch-${tile}-${p}-${y}` },
    ]),
  ],
};
