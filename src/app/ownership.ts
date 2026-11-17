// Per-seat controller ownership (SPEC §4): only the active player's controller acts in normal
// play; every human controller is live in auctions; trades: receiver answers, proposer may
// cancel; raise-money belongs to the debtor; pause and the log work from any bound controller.
// Keyboard and mouse always work as a fallback for whoever must act.
import { seatsToAct, type State } from '../engine';
import type { PadIntent } from '../input/manager';

export type Intent = PadIntent | 'fullscreen';

export interface Decision {
  allowed: boolean;
  /** Seat the intent acts for (null for global intents like pause). */
  seat: number | null;
}

const GLOBAL: Intent[] = ['pause', 'log', 'fullscreen'];

/**
 * May an intent from a controller bound to `deviceSeat` (null = keyboard / mouse) act now,
 * and for which seat?
 */
export function decide(gs: State, deviceSeat: number | null, intent: Intent): Decision {
  if (GLOBAL.includes(intent)) return { allowed: true, seat: deviceSeat };
  const humans = seatsToAct(gs).filter((i) => gs.seats[i].kind === 'human');
  if (deviceSeat === null) {
    // Keyboard / mouse: fallback for the first human who must act.
    if (gs.phase === 'auction') {
      const a = gs.auction!;
      const seat = humans.find((i) => a.highBidder !== i) ?? humans[0] ?? null;
      return { allowed: seat !== null, seat };
    }
    return { allowed: humans.length > 0, seat: humans[0] ?? null };
  }
  if (gs.players[deviceSeat]?.bankrupt) return { allowed: false, seat: null };
  switch (gs.phase) {
    case 'auction':
      return { allowed: gs.auction!.active.includes(deviceSeat), seat: deviceSeat };
    case 'debt':
      return { allowed: gs.debts[0].from === deviceSeat, seat: deviceSeat };
    case 'mortgagedTransfer':
      return { allowed: gs.transfers[0].to === deviceSeat, seat: deviceSeat };
    case 'trade': {
      const t = gs.trade!;
      return { allowed: t.to === deviceSeat || t.from === deviceSeat, seat: deviceSeat };
    }
    case 'gameOver':
      return { allowed: intent === 'confirm', seat: deviceSeat };
    default:
      return { allowed: gs.turn.seat === deviceSeat, seat: deviceSeat };
  }
}
