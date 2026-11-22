// Trade screen helpers (Stage 3 §4): what each side can offer, the deal strip, counters.
import {
  COLOR_GROUP_ORDER,
  PROMISE_GROUP_ORDER,
  promiseGroupOf,
  promisesLock,
  tradeTileBlocker,
  validateOffer,
  type PromiseGroup,
  type PromiseTerm,
  type State,
  type TradeOffer,
  type TradeSide,
} from '../engine';
import { GROUP_LABEL, uiGroupColor } from './groups';
import { money } from './present';

export interface TradeTile {
  tile: number;
  name: string;
  group: PromiseGroup;
  color: string;
  mortgaged: boolean;
  /** Short chip text when the card can't be traded ("Has houses", "Pledged"), or null. */
  blocked: string | null;
}

/** Engine blocker → reason chip (Stage 3 §4.2). */
export function blockedChip(why: string | null): string | null {
  if (!why) return null;
  if (why.includes('buildings')) return 'Has houses';
  if (why.includes('pledged')) return 'Pledged';
  return why;
}

export function tradeTiles(gs: State, seat: number): TradeTile[] {
  return gs.board.tiles
    .filter((t) => gs.tiles[t.index].owner === seat)
    .map((t) => {
      const group = promiseGroupOf(gs.board, t.index)!;
      return {
        tile: t.index,
        name: t.name,
        group,
        color: uiGroupColor(gs.board, group),
        mortgaged: gs.tiles[t.index].mortgaged,
        blocked: blockedChip(tradeTileBlocker(gs, t.index)),
      };
    });
}

export function partners(gs: State, seat: number): number[] {
  return gs.seats.map((_, i) => i).filter((i) => i !== seat && !gs.players[i].bankrupt && gs.seats[i].kind !== 'bankBot');
}

export function emptyOffer(from: number, to: number): TradeOffer {
  return { from, to, give: { tiles: [], cash: 0, gojf: 0 }, get: { tiles: [], cash: 0, gojf: 0 }, promises: [] };
}

/** Counter: same screen with sides swapped (SPEC §6). Promises keep their promiser and holder. */
export function counterOf(o: TradeOffer): TradeOffer {
  return {
    from: o.to,
    to: o.from,
    give: { ...o.get, tiles: [...o.get.tiles] },
    get: { ...o.give, tiles: [...o.give.tiles] },
    promises: o.promises.map((p) => ({ ...p })),
  };
}

export function offerProblem(gs: State, o: TradeOffer): string | null {
  return validateOffer(gs, o);
}

/** The side `seat` gives in this offer. */
export function sideOf(o: TradeOffer, seat: number): TradeSide {
  return seat === o.from ? o.give : o.get;
}

/**
 * Tray summary (Stage 3 §4.1, as in the mock-ups): "List value $X · cash $Y · N cards · N promises".
 * List value is the printed price of the deeds; cards are Get Out of Jail Free cards.
 */
export function sideTotals(gs: State, o: TradeOffer, seat: number): { listValue: number; cash: number; cards: number; promises: number } {
  const side = sideOf(o, seat);
  const deeds = side.tiles.reduce((n, t) => n + (gs.board.tiles[t].price ?? 0), 0);
  return { listValue: deeds, cash: side.cash, cards: side.gojf, promises: o.promises.filter((p) => p.from === seat).length };
}

export function sideSummary(gs: State, o: TradeOffer, seat: number): string {
  const t = sideTotals(gs, o, seat);
  const parts = [`List value ${money(t.listValue)}`];
  if (t.cash) parts.push(`cash ${money(t.cash)}`);
  if (t.cards) parts.push(`${t.cards} ${t.cards === 1 ? 'card' : 'cards'}`);
  if (t.promises) parts.push(`${t.promises} ${t.promises === 1 ? 'promise' : 'promises'}`);
  return parts.join(' · ');
}

/** "A", "A and B", "A, B and C". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function sideItems(gs: State, side: TradeSide): string[] {
  return [
    ...side.tiles.map((t) => gs.board.tiles[t].name + (gs.tiles[t].mortgaged ? ' (mortgaged)' : '')),
    ...(side.cash ? [money(side.cash)] : []),
    ...(side.gojf ? [side.gojf === 1 ? 'a Get Out of Jail Free card' : `${side.gojf} Get Out of Jail Free cards`] : []),
  ];
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * One promise as a sentence. Names only, never pronouns (Stage 3 §4.4). `you` is the seat to
 * write as "you" (the receiver in review), or null.
 */
export function promiseSentence(gs: State, p: PromiseTerm, you: number | null = null): string {
  const who = (seat: number) => (seat === you ? 'you' : gs.seats[seat].name);
  const whose = (seat: number) => (seat === you ? 'your' : `${gs.seats[seat].name}'s`);
  const group = GROUP_LABEL[p.group];
  if (p.kind === 'noBuild') {
    return `${cap(who(p.from))} ${p.from === you ? 'promise' : 'promises'} not to build on ${group} for ${p.left} ${p.left === 1 ? 'round' : 'rounds'}.`;
  }
  const landings = p.left === 1 ? `1 of ${whose(p.to)} landings` : `${p.left} of ${whose(p.to)} landings`;
  return `${cap(who(p.from))} ${p.from === you ? 'promise' : 'promises'} ${who(p.to)} no rent on ${group} for ${landings}.`;
}

/**
 * The deal strip (Stage 3 §4.4): the whole trade in plain sentences.
 * Proposer's view (`viewer` null or the proposer): "Lawrence gives …. Riley gives …."
 * Receiver's view (`viewer` = receiver): "You get …. You give …."
 */
export function dealSentences(gs: State, o: TradeOffer, viewer: number | null = null): string[] {
  const out: string[] = [];
  const you = viewer === o.to ? o.to : null;
  if (you !== null) {
    const gets = sideItems(gs, o.give);
    const gives = sideItems(gs, o.get);
    out.push(gets.length ? `You get ${joinList(gets)}.` : 'You get nothing.');
    out.push(gives.length ? `You give ${joinList(gives)}.` : 'You give nothing.');
  } else {
    for (const seat of [o.from, o.to]) {
      const items = sideItems(gs, sideOf(o, seat));
      out.push(`${gs.seats[seat].name} gives ${items.length ? joinList(items) : 'nothing'}.`);
    }
  }
  for (const p of o.promises) out.push(promiseSentence(gs, p, you));
  if (promisesLock(gs)) out.push('Promises are off in this game.');
  return out;
}

/** Banner reason for locked promises (Stage 3 §4.6), or null when promises are on. */
export function promisesOffReason(gs: State): string | null {
  const lock = promisesLock(gs);
  if (!lock) return null;
  if (lock === 'bot') {
    const bot = gs.seats.find((s) => s.kind === 'bot');
    return `Promises are off: ${bot?.name ?? 'a player'} is a normal bot.`;
  }
  return "Promises are off in this game's rules.";
}

/** Groups the voucher sheet steps through (Stage 3 §4.3): noBuild skips railroads and utilities. */
export function promiseGroupsFor(kind: PromiseTerm['kind']): PromiseGroup[] {
  return kind === 'noBuild' ? [...COLOR_GROUP_ORDER] : [...PROMISE_GROUP_ORDER];
}
