import { H } from './helpers.mjs';
export default {
  url: 'http://localhost:5173/?auto=human,human&seed=4&quality=low',
  steps: [
    { eval: H, label: 'helpers' },
    {
      label: 'play 16 decisions with the mouse',
      eval: async () => {
        const h = window.__h;
        const c = h.c();
        const out = [];
        for (let k = 0; k < 16; k++) {
          await h.idle();
          const s = c.state;
          out.push(`${s.phase} s${s.turn.seat} @${s.players[s.turn.seat].position} [${h.buttons().join(' | ')}]`);
          if (!(h.click(/Roll/) || h.click(/Buy for/) || h.click(/End turn/) || h.click(/Pay /))) {
            out.push('STUCK');
            break;
          }
        }
        return { out, cash: c.state.players.map((p) => p.cash) };
      },
    },
    { shot: 'm2-human' },
  ],
};
