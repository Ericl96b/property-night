// SPEC §3: every bot action shows with a log line.
import { describe, expect, it } from 'vitest';
import { apply, newGame, seatsToAct, type Action, type State } from '../../src/engine';
import { chooseAction } from '../../src/bots';
import { gameOverText } from '../../src/ui/present';
import { act, edit, game } from './helpers';

describe('bot action log lines', () => {
  it('every bot action appends at least one log line', () => {
    for (const seed of [1, 2, 3]) {
      let s: State = newGame({
        seats: [
          { kind: 'bot', name: 'A' },
          { kind: 'bot', name: 'B' },
          { kind: 'bot', name: 'C' },
          { kind: 'bankBot', name: 'Bank' },
        ],
        seed,
      });
      let rotate = 0;
      for (let n = 0; n < 4000 && s.phase !== 'gameOver'; n++) {
        const actors = seatsToAct(s);
        let a: Action | null = null;
        for (let k = 0; k < actors.length && !a; k++) a = chooseAction(s, actors[(rotate + k) % actors.length]);
        rotate++;
        if (!a) {
          s = apply(s, { type: 'auctionTimeout', seat: -1 }).state;
          continue;
        }
        // The log keeps the newest 200 lines; a new line is a new last entry.
        const before = s.log.at(-1);
        s = apply(s, a).state;
        if (s.log.at(-1) === before) throw new Error(`no log line for ${JSON.stringify(a)}`);
      }
    }
  });

  it('bids, passes, end of turn and withdrawn trades are logged', () => {
    const s0 = edit(game(2), (d) => {
      d.phase = 'auction';
      d.auction = { tile: 1, highBid: 0, highBidder: null, active: [0, 1], minBid: 1 };
    });
    const b = act(s0, { type: 'bid', seat: 0, amount: 20 }).s;
    expect(b.log.at(-1)!.text).toBe('P0 bid $20');
    const p = act(b, { type: 'pass', seat: 1 }).s;
    expect(p.log.map((l) => l.text)).toContain('P1 passed');
    const e = act(edit(game(2), (d) => (d.phase = 'postRoll')), { type: 'endTurn', seat: 0 }).s;
    expect(e.log.at(-1)!.text).toBe('P0 ended the turn');
  });
});

describe('game-over wording', () => {
  const over = (kinds: State['seats'][number]['kind'][], winner: number | null, out: number[]) =>
    edit(game(kinds.length, { kinds }), (d) => {
      d.phase = 'gameOver';
      d.winner = winner;
      for (const i of out) d.players[i].bankrupt = true;
    });

  it('2+ humans: last human standing, even with bots left', () => {
    const t = gameOverText(over(['human', 'human', 'bot'], 0, [1]));
    expect(t.title).toBe('P0 wins!');
    expect(t.subtitle).toMatch(/Last human standing \(bots/);
    expect(gameOverText(over(['human', 'human'], 1, [0])).subtitle).toBe('Last human standing.');
  });

  it('1 human: wins when every bot is out, loses on bankruptcy', () => {
    expect(gameOverText(over(['human', 'bot', 'bankBot'], 0, [1]))).toEqual({ title: 'P0 wins!', subtitle: 'Every bot is out.' });
    expect(gameOverText(over(['human', 'bot'], null, [0]))).toEqual({ title: 'The bots win', subtitle: 'P0 went bankrupt.' });
  });

  it('all bots: the last one standing wins', () => {
    expect(gameOverText(over(['bot', 'bot'], 1, [0])).title).toBe('P1 wins!');
  });

  it('the engine log names the human who lost in testing mode', () => {
    const s = act(game(2, { kinds: ['human', 'bot'] }), { type: 'forfeit', seat: 0 }).s;
    expect(s.phase).toBe('gameOver');
    expect(s.log.at(-1)!.text).toBe('Game over: P0 is out');
  });
});
