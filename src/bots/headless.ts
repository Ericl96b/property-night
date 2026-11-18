// Headless bot-vs-bot games (SPEC §14 M1, §15): drive the engine with bots only, optionally
// checking invariants after every action.
import { apply, checkInvariants, newGame, seatsToAct, type Action, type NewGameConfig, type State } from '../engine';
import { chooseAction } from './index';
import { chooseMedium } from './medium';

export interface HeadlessResult {
  state: State;
  finished: boolean;
  winner: number | null;
  turns: number;
  actions: number;
  errors: string[];
  /** Every action applied, in order (for replay tests). */
  log: Action[];
}

export interface HeadlessOptions {
  maxTurns?: number;
  checkEveryAction?: boolean;
  keepLog?: boolean;
  /** Human seats play the medium-bot strategy (games with humans, run unattended). */
  humansAsBots?: boolean;
}

export function runHeadless(cfg: NewGameConfig, opts: HeadlessOptions = {}): HeadlessResult {
  const maxTurns = opts.maxTurns ?? 2000;
  let s = newGame(cfg);
  const log: Action[] = [];
  const errors: string[] = [];
  let actions = 0;
  let rotate = 0;
  while (s.phase !== 'gameOver' && s.turnNumber <= maxTurns) {
    const actors = seatsToAct(s);
    let action: Action | null = null;
    // Auctions: every bidder is live; take decisions round-robin so bids alternate.
    for (let k = 0; k < actors.length && !action; k++) {
      const seat = actors[(rotate + k) % actors.length];
      action = opts.humansAsBots && s.seats[seat].kind === 'human' ? chooseMedium(s, seat) : chooseAction(s, seat);
    }
    rotate++;
    if (!action) {
      if (s.phase === 'auction') action = { type: 'auctionTimeout', seat: -1 };
      else {
        errors.push(`stalled in ${s.phase} (turn ${s.turnNumber}, seat ${s.turn.seat})`);
        break;
      }
    }
    try {
      s = apply(s, action).state;
    } catch (e) {
      errors.push(`illegal ${JSON.stringify(action)} in ${s.phase}: ${(e as Error).message}`);
      break;
    }
    if (opts.keepLog) log.push(action);
    actions++;
    if (opts.checkEveryAction) {
      const bad = checkInvariants(s);
      if (bad.length) {
        errors.push(`after ${JSON.stringify(action)} (turn ${s.turnNumber}): ${bad.join('; ')}`);
        break;
      }
    }
  }
  return { state: s, finished: s.phase === 'gameOver', winner: s.winner, turns: s.turnNumber, actions, errors, log };
}

export function botSeats(n: number): NewGameConfig['seats'] {
  return Array.from({ length: n }, (_, i) => ({ kind: 'bot' as const, name: `Bot ${i + 1}` }));
}
