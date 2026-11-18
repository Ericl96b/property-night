// End-of-game stats (SPEC §9): rent paid/received, most profitable tile, money over time,
// auction vs direct purchases, loans. Pure helpers so they can be unit-tested.
import type { State } from '../engine';
import { NEW_STATS } from '../engine/state';

export interface StatsRow {
  seat: number;
  name: string;
  color: string;
  kind: State['seats'][number]['kind'];
  winner: boolean;
  bankrupt: boolean;
  cash: number;
  rentReceived: number;
  rentPaid: number;
  directBuys: number;
  auctionBuys: number;
  loansTaken: number;
  borrowed: number;
  loanInterest: number;
}

export function statsRows(s: State): StatsRow[] {
  return s.seats.map((seat, i) => {
    const p = s.players[i];
    const st = { ...NEW_STATS, ...p.stats };
    return {
      seat: i,
      name: seat.name,
      color: seat.color,
      kind: seat.kind,
      winner: s.winner === i,
      bankrupt: p.bankrupt,
      cash: p.cash,
      rentReceived: st.rentReceived,
      rentPaid: st.rentPaid,
      directBuys: st.directBuys,
      auctionBuys: st.auctionBuys,
      loansTaken: st.loansTaken,
      borrowed: st.borrowed,
      loanInterest: st.loanInterest,
    };
  });
}

/** The tile that collected the most rent over the game (null if no rent was paid). */
export function mostProfitableTile(s: State): { tile: number; name: string; rent: number; owner: number | null } | null {
  const rent = s.history?.tileRent ?? [];
  let best = -1;
  for (let i = 0; i < rent.length; i++) if (rent[i] > 0 && (best < 0 || rent[i] > rent[best])) best = i;
  if (best < 0) return null;
  return { tile: best, name: s.board.tiles[best].name, rent: rent[best], owner: s.tiles[best].owner };
}

export interface ChartLine {
  seat: number;
  color: string;
  name: string;
  points: string;
}

export interface Chart {
  width: number;
  height: number;
  lines: ChartLine[];
  /** Y gridlines: value and y position. */
  yTicks: { value: number; y: number }[];
  /** X labels: turn and x position. */
  xTicks: { turn: number; x: number }[];
}

/** "Nice" step for about `n` ticks up to `max`. */
export function niceStep(max: number, n = 4): number {
  if (max <= 0) return 1;
  const raw = max / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

/** Money-over-time line chart geometry (bank-backed bots are left out: their money is unlimited). */
export function moneyChart(s: State, width = 760, height = 280, pad = { l: 64, r: 12, t: 12, b: 28 }): Chart {
  const samples = s.history?.cash ?? [];
  const seats = s.seats.map((x, i) => ({ x, i })).filter(({ x }) => x.kind !== 'bankBot');
  const firstTurn = samples[0]?.turn ?? 1;
  const lastTurn = Math.max(firstTurn + 1, samples[samples.length - 1]?.turn ?? firstTurn + 1);
  let max = 0;
  for (const sm of samples) for (const { i } of seats) max = Math.max(max, sm.cash[i] ?? 0);
  const step = niceStep(max || 1);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const X = (turn: number) => pad.l + ((turn - firstTurn) / (lastTurn - firstTurn)) * w;
  const Y = (v: number) => pad.t + h - (Math.max(0, v) / top) * h;
  const r = (v: number) => Math.round(v * 10) / 10;
  const lines = seats.map(({ x, i }) => ({
    seat: i,
    color: x.color,
    name: x.name,
    points: samples.map((sm) => `${r(X(sm.turn))},${r(Y(sm.cash[i] ?? 0))}`).join(' '),
  }));
  const yTicks: Chart['yTicks'] = [];
  for (let v = 0; v <= top + 1e-9; v += step) yTicks.push({ value: v, y: r(Y(v)) });
  const xStep = niceStep(lastTurn - firstTurn, 5);
  const xTicks: Chart['xTicks'] = [];
  for (let t = firstTurn; t <= lastTurn; t += xStep) xTicks.push({ turn: Math.round(t), x: r(X(t)) });
  return { width, height, lines, yTicks, xTicks };
}
