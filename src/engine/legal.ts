// legalActions(state, seat) (SPEC §12): every action the seat may take right now.
// Auction bids are listed at the UI increments (+$1, +$10, +$50, +$100); `apply` accepts any
// legal amount.
import {
  buildBlocker,
  isBankBot,
  liquidationValue,
  mortgageBlocker,
  sellBlocker,
  unmortgageBlocker,
  unmortgageCost,
} from './queries';
import type { Action, State } from './types';
import { borrowCapacity } from './loans';

export const BID_INCREMENTS = [1, 10, 50, 100];

/** Build / sell / mortgage / unmortgage options for a seat. */
export function manageActions(s: State, seat: number): Action[] {
  const out: Action[] = [];
  for (const t of s.board.tiles) {
    if (s.tiles[t.index].owner !== seat) continue;
    const tile = t.index;
    if (!buildBlocker(s, seat, tile)) out.push({ type: 'build', seat, tile });
    if (!sellBlocker(s, seat, tile)) out.push({ type: 'sell', seat, tile });
    if (!mortgageBlocker(s, seat, tile)) out.push({ type: 'mortgage', seat, tile });
    if (!unmortgageBlocker(s, seat, tile)) out.push({ type: 'unmortgage', seat, tile });
  }
  return out;
}

export interface BidChoice {
  /** The total that will be bid. */
  amount: number;
  /** The raise over the current high bid (the opening bid before any bids). */
  raise: number;
  affordable: boolean;
}

/**
 * Every raise a seat could make, smallest first, including ones it can't afford (the UI shows
 * those disabled with the reason). Empty when the seat isn't bidding or already leads.
 */
export function bidChoices(s: State, seat: number): BidChoice[] {
  const a = s.auction;
  if (!a || !a.active.includes(seat) || a.highBidder === seat) return [];
  const cash = s.players[seat].cash;
  const base = a.highBidder === null ? 0 : a.highBid; // opening bid = the increment (at least the minimum)
  const out: BidChoice[] = [];
  for (const inc of BID_INCREMENTS) {
    const amount = Math.max(a.minBid, base + inc);
    if (amount <= a.highBid || out.some((c) => c.amount === amount)) continue;
    out.push({ amount, raise: amount - base, affordable: amount <= cash });
  }
  return out.sort((x, y) => x.amount - y.amount);
}

export function bidOptions(s: State, seat: number): number[] {
  const a = s.auction;
  if (!a || !a.active.includes(seat)) return [];
  const cash = s.players[seat].cash;
  const base = a.highBidder === null ? 0 : a.highBid; // opening bid = the increment (at least the minimum)
  const amounts = new Set<number>();
  for (const inc of BID_INCREMENTS) {
    const amt = Math.max(a.minBid, base + inc);
    if (amt <= cash && amt > a.highBid) amounts.add(amt);
  }
  return [...amounts].sort((x, y) => x - y);
}

export function legalActions(s: State, seat: number): Action[] {
  if (s.phase === 'gameOver') return [];
  if (seat < 0 || seat >= s.players.length || s.players[seat].bankrupt) return [];
  const out: Action[] = [];
  const active = s.turn.seat === seat;
  const p = s.players[seat];

  switch (s.phase) {
    case 'auction': {
      const a = s.auction!;
      if (a.active.includes(seat)) {
        for (const amount of bidOptions(s, seat)) out.push({ type: 'bid', seat, amount });
        if (a.highBidder !== seat) out.push({ type: 'pass', seat });
      }
      break;
    }
    case 'mortgagedTransfer': {
      const tr = s.transfers[0];
      if (tr.to === seat) {
        for (const tile of tr.tiles) {
          out.push({ type: 'mortgagedChoice', seat, tile, unmortgage: false });
          if (p.cash >= unmortgageCost(s, tile)) out.push({ type: 'mortgagedChoice', seat, tile, unmortgage: true });
        }
      }
      break;
    }
    case 'debt': {
      const d = s.debts[0];
      if (d.from === seat) {
        out.push(...manageActions(s, seat));
        if (liquidationValue(s, seat) + borrowCapacity(s, seat) < d.amount) out.push({ type: 'declareBankruptcy', seat });
      }
      break;
    }
    case 'buy': {
      if (active) {
        const price = s.board.tiles[s.pendingBuy!].price ?? 0;
        if (p.cash >= price) out.push({ type: 'buy', seat });
        out.push({ type: 'decline', seat });
      }
      out.push(...manageActions(s, seat));
      break;
    }
    case 'preRoll': {
      if (active && !s.turn.rolled) {
        out.push({ type: 'roll', seat });
        if (p.jail) {
          if (p.cash >= s.rules.jailFine) out.push({ type: 'payJailFine', seat });
          if (p.gojf.length) out.push({ type: 'useJailCard', seat });
        }
      }
      out.push(...manageActions(s, seat));
      break;
    }
    case 'postRoll': {
      if (active) out.push({ type: 'endTurn', seat });
      out.push(...manageActions(s, seat));
      break;
    }
    case 'speedChoice': {
      if (active) {
        const sc = s.turn.speedChoice!;
        if (sc.anyTile) for (let t = 0; t < 40; t++) out.push({ type: 'speedChoice', seat, target: t });
        else for (const steps of sc.options) out.push({ type: 'speedChoice', seat, steps });
      }
      break;
    }
    case 'trade': {
      // proposeTrade and counterTrade carry an offer, so they are built by the UI or bot.
      const t = s.trade!;
      if (t.to === seat) out.push({ type: 'acceptTrade', seat }, { type: 'rejectTrade', seat });
      if (t.from === seat) out.push({ type: 'cancelTrade', seat });
      break;
    }
  }
  if (!isBankBot(s, seat) && s.seats[seat].kind === 'human') out.push({ type: 'forfeit', seat });
  return out;
}

/** Seats that currently have something to decide (the auction has several at once). */
export function seatsToAct(s: State): number[] {
  switch (s.phase) {
    case 'gameOver':
      return [];
    case 'auction':
      return [...s.auction!.active.filter((i) => i !== s.auction!.highBidder || s.auction!.active.length === 1)];
    case 'mortgagedTransfer':
      return [s.transfers[0].to];
    case 'debt':
      return [s.debts[0].from];
    case 'trade':
      return [s.trade!.to];
    default:
      return [s.turn.seat];
  }
}
