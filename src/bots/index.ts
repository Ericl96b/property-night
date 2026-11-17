// Bots (SPEC §3, §12): chooseAction(state, seat) → action, using legalActions.
import { legalActions, type Action, type State } from '../engine';
import { chooseMedium } from './medium';

/**
 * Bank-backed bot: never buys (the engine auctions what it lands on), never bids, never
 * trades, draws no cards and never goes to jail. It only rolls and ends its turn.
 */
export function chooseBankBot(s: State, seat: number): Action | null {
  if (s.turn.seat !== seat) return null;
  const acts = legalActions(s, seat);
  return acts.find((a) => a.type === 'roll') ?? acts.find((a) => a.type === 'endTurn') ?? null;
}

export function chooseAction(s: State, seat: number): Action | null {
  switch (s.seats[seat].kind) {
    case 'bankBot':
      return chooseBankBot(s, seat);
    case 'bot':
      return chooseMedium(s, seat);
    default:
      return null;
  }
}

export { chooseMedium, valueEstimate, reserve } from './medium';
