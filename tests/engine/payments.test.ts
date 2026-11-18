// Owner request (2026-11-18): banknotes fly for every transaction, so every cash change must
// come with a payment event. Replays full headless games and checks, for every action and every
// seat, that the cash change equals what that seat's payment events say.
import { describe, expect, it } from 'vitest';
import { apply, newGame, type NewGameConfig } from '../../src/engine';
import { CLASSIC_RULES } from '../../src/engine/rules';
import { runHeadless } from '../../src/bots/headless';

function check(cfg: NewGameConfig): { actions: number; payments: number; problems: string[] } {
  const r = runHeadless(cfg, { maxTurns: 600, keepLog: true, humansAsBots: true });
  expect(r.errors).toEqual([]);
  let s = newGame(cfg);
  const problems: string[] = [];
  let payments = 0;
  for (const a of r.log) {
    const before = s.players.map((p) => p.cash);
    const res = apply(s, a);
    const delta = s.players.map(() => 0);
    for (const e of res.events) {
      if (e.type !== 'payment') continue;
      payments++;
      if (typeof e.from === 'number') delta[e.from] -= e.amount;
      if (typeof e.to === 'number') delta[e.to] += e.amount;
      // The snapshot shows balances after the payment, never a negative one.
      expect(e.cash.every((v) => v >= 0)).toBe(true);
    }
    res.state.players.forEach((p, i) => {
      if (res.state.seats[i].kind === 'bankBot') return; // unlimited money: its cash never moves
      const got = p.cash - before[i];
      if (got !== delta[i] && problems.length < 5) problems.push(`${a.type} (turn ${s.turnNumber}): seat ${i} cash changed ${got}, payment events say ${delta[i]}`);
    });
    s = res.state;
  }
  return { actions: r.log.length, payments, problems };
}

describe('payment events', () => {
  it('cover every cash change (Classic, loans on, Free Parking pot)', () => {
    const variants = [
      { ...CLASSIC_RULES },
      { ...CLASSIC_RULES, loans: true, freeParking: 'pot' as const, speedDie: true },
      { ...CLASSIC_RULES, bankBotMode: 'cutoff' as const, startingCash: 800 },
    ];
    let payments = 0;
    for (const [vi, rules] of variants.entries()) {
      for (let seed = 1; seed <= 6; seed++) {
        // Humans are played by the medium strategy, which never borrows; with loans on, only
        // bots (who cannot borrow either) keep raise-money decidable.
        const k = rules.loans ? ('bot' as const) : ('human' as const);
        const res = check({
          seats: [
            { kind: k, name: 'Ann' },
            { kind: k, name: 'Ben' },
            { kind: 'bot', name: 'Bot' },
            { kind: 'bankBot', name: 'Bank' },
          ],
          seed: seed + vi * 100,
          rules,
        });
        expect(res.problems).toEqual([]);
        payments += res.payments;
      }
    }
    expect(payments).toBeGreaterThan(1000);
  }, 120_000);
});
