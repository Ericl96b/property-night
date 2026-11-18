import { describe, expect, it } from 'vitest';
import { runHeadless } from '../../src/bots/headless';
import { apply, cloneState } from '../../src/engine';
import { HISTORY_MAX } from '../../src/engine/state';
import { moneyChart, mostProfitableTile, niceStep, statsRows } from '../../src/ui/stats';
import { act, edit, game, withDice } from '../engine/helpers';

const bots = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'bot' as const, name: `B${i}` }));

describe('end-of-game stats (SPEC §9)', () => {
  it('records money over time, thinned to a bounded series, with the final position last', () => {
    const r = runHeadless({ seats: bots(4), seed: 11 });
    expect(r.finished).toBe(true);
    const h = r.state.history;
    expect(h.cash.length).toBeGreaterThan(5);
    expect(h.cash.length).toBeLessThanOrEqual(HISTORY_MAX);
    expect(h.cash[0]).toEqual({ turn: 1, cash: [1500, 1500, 1500, 1500] });
    const last = h.cash[h.cash.length - 1];
    expect(last.turn).toBe(r.state.turnNumber);
    expect(last.cash).toEqual(r.state.players.map((p) => (p.bankrupt ? 0 : p.cash)));
    for (let i = 1; i < h.cash.length; i++) expect(h.cash[i].turn).toBeGreaterThan(h.cash[i - 1].turn);
  });

  it('rent per tile adds up to the rent the players received', () => {
    const r = runHeadless({ seats: bots(3), seed: 5 });
    const tileTotal = r.state.history.tileRent.reduce((a, b) => a + b, 0);
    const received = r.state.players.reduce((a, p) => a + p.stats.rentReceived, 0);
    expect(tileTotal).toBe(received);
    const best = mostProfitableTile(r.state)!;
    expect(best.rent).toBe(Math.max(...r.state.history.tileRent));
  });

  it('counts rent paid by a bank-backed bot as rent received', () => {
    const s0 = withDice(edit(game(2, { kinds: ['bankBot', 'human'] }), (d) => (d.tiles[3].owner = 1)), 1, 2);
    const { s } = act(s0, { type: 'roll', seat: 0 });
    expect(s.players[0].position).toBe(3);
    expect(s.players[1].stats.rentReceived).toBeGreaterThan(0);
    expect(s.history.tileRent[3]).toBe(s.players[1].stats.rentReceived);
  });

  it('tracks loans taken, amount borrowed and interest', () => {
    const s0 = edit(game(2, { rules: { loans: true } }), (d) => (d.phase = 'preRoll'));
    const { s } = act(s0, { type: 'takeLoan', seat: 0, amount: 300, passes: 5, collateral: [] });
    expect(s.players[0].stats.loansTaken).toBe(1);
    expect(s.players[0].stats.borrowed).toBe(300);
  });

  it('old saves without stats history are filled in on the next action', () => {
    const s0 = game(2);
    const old = cloneState(s0) as unknown as Record<string, unknown>;
    delete old.history;
    for (const p of (old as { players: { stats: Record<string, number> }[] }).players) delete p.stats.loansTaken;
    const next = apply(old as never, { type: 'roll', seat: 0 }).state;
    expect(next.history.tileRent).toHaveLength(40);
    expect(next.players[0].stats.loansTaken).toBe(0);
    expect(statsRows(next)[0].borrowed).toBe(0);
  });

  it('chart geometry: nice ticks, bank-backed bots left out, lines inside the box', () => {
    expect(niceStep(1500)).toBe(500);
    expect(niceStep(3700)).toBe(1000);
    expect(niceStep(90, 5)).toBe(20);
    const r = runHeadless({ seats: [...bots(2), { kind: 'bankBot', name: 'Bank' }], seed: 3 }, { maxTurns: 300 });
    const c = moneyChart(r.state, 800, 300);
    expect(c.lines.map((l) => l.name)).toEqual(r.state.seats.filter((x) => x.kind !== 'bankBot').map((x) => x.name));
    for (const l of c.lines)
      for (const pt of l.points.split(' ')) {
        const [x, y] = pt.split(',').map(Number);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(800);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(300);
      }
    expect(c.yTicks[0].value).toBe(0);
  });
});
