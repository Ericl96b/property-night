// Rule "bankBotMode" (owner request, 2026-11-18): what happens to bank-backed bots after the
// first hotel a human builds — always backed, cut off (plays on its starting cash), or removed.
import { describe, expect, it } from 'vitest';
import { checkInvariants, legalActions, type Action, type SeatKind, type State } from '../../src/engine';
import type { BankBotMode } from '../../src/engine/rules';
import { chooseBankBot } from '../../src/bots';
import { runHeadless } from '../../src/bots/headless';
import { CLASSIC_RULES } from '../../src/engine/rules';
import { act, edit, game, own, run, withDice } from './helpers';

/**
 * Seat 1 is a bank-backed bot standing on tile 34; seat 0 owns the dark-blue set
 * (37, 39) with four houses on each. It is the bot's turn, before its roll.
 */
function setup(mode: BankBotMode | undefined, kinds: SeatKind[] = ['human', 'bankBot', 'human'], dice: number[] = [2, 3]): State {
  const s = game(3, { kinds, rules: mode ? { bankBotMode: mode } : {} });
  return edit(withDice(s, ...dice), (d) => {
    if (!mode) delete (d.rules as Partial<typeof d.rules>).bankBotMode; // a save from before the rule
    own(d, 0, 37, 39);
    d.tiles[37].buildings = 4;
    d.tiles[39].buildings = 4;
    d.bank.houses -= 8;
    d.players[1].position = 34;
    d.turn.seat = 1;
  });
}

const hotel = (s: State, tile = 39, seat = 0) => act(s, { type: 'build', seat, tile });
const roll = (s: State) => act(s, { type: 'roll', seat: 1 });

describe('bank-backed bot modes (rule bankBotMode)', () => {
  it('Classic default is "remove"', () => {
    expect(game(2).rules.bankBotMode).toBe('remove');
  });

  it('always: after a human hotel the bank keeps paying its rent', () => {
    const h = hotel(setup('always'));
    expect(h.s.bankBackingEnded).toBeFalsy();
    expect(h.ev.some((e) => e.type === 'bankBackingEnded')).toBe(false);
    const r = roll(h.s).s;
    expect(r.players[0].cash).toBe(1500 - 200 + 2000);
    expect(r.players[1].bankrupt).toBe(false);
    expect(checkInvariants(r)).toEqual([]);
  });

  it('cutoff: plays on its starting cash, keeps its limits, and goes bankrupt to the creditor', () => {
    const h = hotel(setup('cutoff'));
    expect(h.s.bankBackingEnded).toBe(true);
    expect(h.s.players[1].cash).toBe(1500);
    expect(h.ev).toContainEqual(expect.objectContaining({ type: 'bankBackingEnded', mode: 'cutoff', seats: [1], by: 0, tile: 39, cash: 1500 }));
    // Lands on the $2,000 hotel with $1,500: cannot pay.
    const r = roll(h.s).s;
    expect(r.phase).toBe('debt');
    expect(r.debts[0]).toMatchObject({ from: 1, to: 0, amount: 2000 });
    const a = chooseBankBot(r, 1) as Action;
    expect(a).toEqual({ type: 'declareBankruptcy', seat: 1 });
    const out = act(r, a).s;
    expect(out.players[1].bankrupt).toBe(true);
    expect(out.players[1].leftTable).toBeFalsy();
    expect(out.players[0].cash).toBe(1500 - 200 + 1500);
    expect(out.phase).not.toBe('gameOver');
    expect(checkInvariants(out)).toEqual([]);
  });

  it('cutoff: pays smaller rent from its own cash and still never buys, draws or goes to jail', () => {
    const h = hotel(setup('cutoff', undefined, [1, 2])).s; // 34 → 37 (four houses): rent it can afford
    const r = roll(h).s;
    expect(r.players[1].position).toBe(37);
    const rent37 = 1500 - r.players[1].cash;
    expect(rent37).toBeGreaterThan(0);
    expect(r.players[0].cash).toBe(1500 - 200 + rent37);
    expect(r.tiles.some((t) => t.owner === 1)).toBe(false);
    // Go To Jail does nothing to it; GO pays it nothing.
    const gtj = run(edit(withDice(h, 3, 4), (d) => (d.players[1].position = 23)), { type: 'roll', seat: 1 }).s;
    expect(gtj.players[1].jail).toBeNull();
    expect(gtj.players[1].cash).toBe(1500);
  });

  it('remove: the bot leaves the table, even mid-turn, and play moves on', () => {
    const h = hotel(setup('remove'));
    expect(h.s.players[1]).toMatchObject({ bankrupt: true, leftTable: true, cash: 0 });
    expect(h.ev).toContainEqual(expect.objectContaining({ type: 'bankBackingEnded', mode: 'remove', seats: [1] }));
    expect(h.s.turn.seat).toBe(2);
    expect(h.s.phase).toBe('preRoll');
    expect(legalActions(h.s, 1)).toEqual([]);
    expect(checkInvariants(h.s)).toEqual([]);
  });

  it("a normal bot's hotel does not count", () => {
    const h = hotel(setup('remove', ['bot', 'bankBot', 'human']));
    expect(h.s.bankBackingEnded).toBeFalsy();
    expect(h.s.players[1].bankrupt).toBe(false);
  });

  it('only the first human hotel counts', () => {
    const first = hotel(setup('cutoff')).s;
    const spent = edit(first, (d) => (d.players[1].cash = 700));
    const second = hotel(spent, 37);
    expect(second.s.tiles[37].buildings).toBe(5);
    expect(second.s.players[1].cash).toBe(700);
    expect(second.ev.some((e) => e.type === 'bankBackingEnded')).toBe(false);
  });

  it('a hotel won in a shortage auction counts', () => {
    const s0 = edit(setup('remove'), (d) => {
      own(d, 2, 1, 3);
      d.tiles[1].buildings = 4;
      d.tiles[3].buildings = 4;
      d.bank.houses -= 8;
      d.bank.hotels = 1;
    });
    let s = hotel(s0).s;
    expect(s.phase).toBe('auction');
    expect(s.auction!.kind).toBe('hotel');
    const bid = legalActions(s, 0).find((a) => a.type === 'bid')!;
    s = run(s, bid, { type: 'pass', seat: 2 }).s;
    expect(s.tiles[39].buildings).toBe(5);
    expect(s.players[1].leftTable).toBe(true);
  });

  it('a game saved before the rule existed keeps the bank backing', () => {
    const h = hotel(setup(undefined)).s;
    expect(h.bankBackingEnded).toBeFalsy();
    expect(h.players[1].bankrupt).toBe(false);
  });

  it('full games with humans (played by the medium strategy) stay legal in every mode', () => {
    const summary: Record<string, { finished: number; triggered: number }> = {};
    for (const mode of ['always', 'cutoff', 'remove'] as const) {
      summary[mode] = { finished: 0, triggered: 0 };
      for (let seed = 1; seed <= 30; seed++) {
        const r = runHeadless(
          {
            seats: [
              { kind: 'human', name: 'Ann' },
              { kind: 'human', name: 'Ben' },
              { kind: 'bot', name: 'Bot' },
              { kind: 'bankBot', name: 'Bank' },
            ],
            seed,
            rules: { ...CLASSIC_RULES, bankBotMode: mode },
          },
          { maxTurns: 1500, checkEveryAction: true, humansAsBots: true },
        );
        expect(r.errors).toEqual([]);
        if (r.finished) summary[mode].finished++;
        if (r.state.bankBackingEnded) summary[mode].triggered++;
        if (mode === 'always') expect(r.state.bankBackingEnded).toBeFalsy();
      }
    }
    console.log('bankBotMode headless summary (30 games each):', JSON.stringify(summary));
    expect(summary.cutoff.triggered).toBeGreaterThan(0);
    expect(summary.remove.triggered).toBeGreaterThan(0);
    expect(summary.remove.finished).toBeGreaterThanOrEqual(summary.always.finished);
  }, 180_000);

  it('a game saved after the cutoff reloads and continues identically', () => {
    const cut = hotel(setup('cutoff')).s;
    const reloaded = JSON.parse(JSON.stringify(cut)) as State;
    expect(roll(reloaded).s).toEqual(roll(cut).s);
  });
});
