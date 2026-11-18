// Bots (SPEC §3, §12): chooseAction(state, seat) → action, using legalActions.
import { legalActions, type Action, type State } from '../engine';
import { chooseMedium } from './medium';

/**
 * Bank-backed bot: never buys (the engine auctions what it lands on), never bids, never
 * trades, draws no cards and never goes to jail. It only rolls and ends its turn. Once the
 * bank stops backing it (rule "bankBotMode: cutoff") it owns nothing to sell, so a debt it
 * cannot pay means bankruptcy.
 */
export function chooseBankBot(s: State, seat: number): Action | null {
  const acts = legalActions(s, seat);
  const broke = acts.find((a) => a.type === 'declareBankruptcy');
  if (broke) return broke;
  if (s.turn.seat !== seat) return null;
  // Speed die: it has no preference, so it takes the first offered move (bus) or stays put
  // (triples: "move to any space" — its own tile). Without this a game with the speed die and
  // a bank-backed bot stalled.
  if (s.phase === 'speedChoice') {
    const sc = s.turn.speedChoice!;
    if (sc.anyTile) return { type: 'speedChoice', seat, target: s.players[seat].position };
    return acts.find((a) => a.type === 'speedChoice') ?? null;
  }
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
