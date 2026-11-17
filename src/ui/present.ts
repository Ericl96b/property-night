// Presentation helpers for the overlay: labels, deed data, money. Typed TS so the Svelte
// components stay thin.
import {
  buildingCounts,
  mortgageValue,
  unmortgageCost,
  type Action,
  type State,
} from '../engine';
import type { SymbolName } from '../render/symbols';

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export type Glyph = 'confirm' | 'back' | 'manage' | 'trade';

export const GLYPH_SYMBOL: Record<Glyph, SymbolName> = {
  confirm: 'button-cross',
  back: 'button-circle',
  manage: 'button-square',
  trade: 'button-triangle',
};

export interface ActionButton {
  action: Action;
  label: string;
  glyph?: Glyph;
  primary?: boolean;
}

const tileName = (s: State, t: number) => s.board.tiles[t].name;

export function actionLabel(s: State, a: Action): string {
  switch (a.type) {
    case 'roll':
      return s.players[a.seat].jail ? 'Roll for doubles' : 'Roll dice';
    case 'payJailFine':
      return `Pay ${money(s.rules.jailFine)} fine`;
    case 'useJailCard':
      return 'Use Get Out of Jail Free';
    case 'buy':
      return `Buy for ${money(s.board.tiles[s.pendingBuy!].price ?? 0)}`;
    case 'decline':
      return s.rules.declinedProperty === 'auction' ? 'Decline — auction it' : 'Decline';
    case 'bid':
      return `Bid ${money(a.amount)}`;
    case 'pass':
      return 'Pass';
    case 'build':
      return `Build on ${tileName(s, a.tile)}`;
    case 'sell':
      return `Sell building on ${tileName(s, a.tile)}`;
    case 'mortgage':
      return `Mortgage ${tileName(s, a.tile)} (+${money(mortgageValue(s, a.tile))})`;
    case 'unmortgage':
      return `Unmortgage ${tileName(s, a.tile)} (−${money(unmortgageCost(s, a.tile))})`;
    case 'mortgagedChoice':
      return a.unmortgage
        ? `Unmortgage ${tileName(s, a.tile)} now (−${money(unmortgageCost(s, a.tile))})`
        : `Keep ${tileName(s, a.tile)} mortgaged (pay 10%)`;
    case 'declareBankruptcy':
      return 'Declare bankruptcy';
    case 'forfeit':
      return 'Forfeit';
    case 'endTurn':
      return 'End turn';
    case 'acceptTrade':
      return 'Accept trade';
    case 'rejectTrade':
      return 'Reject trade';
    case 'cancelTrade':
      return 'Cancel trade';
    default:
      return a.type;
  }
}

/** The main buttons for the current decision (manage actions live in the Manage screen). */
export function primaryButtons(s: State, actions: Action[]): ActionButton[] {
  const order: Action['type'][] = ['roll', 'buy', 'payJailFine', 'useJailCard', 'decline', 'endTurn', 'acceptTrade', 'rejectTrade', 'cancelTrade', 'declareBankruptcy'];
  const out: ActionButton[] = [];
  for (const type of order) {
    for (const a of actions.filter((x) => x.type === type)) {
      out.push({ action: a, label: actionLabel(s, a) });
    }
  }
  if (s.phase === 'mortgagedTransfer') for (const a of actions.filter((x) => x.type === 'mortgagedChoice')) out.push({ action: a, label: actionLabel(s, a) });
  if (out.length) {
    out[0].primary = true;
    out[0].glyph = 'confirm';
    const back = out.find((b, i) => i > 0 && (b.action.type === 'decline' || b.action.type === 'rejectTrade' || b.action.type === 'cancelTrade'));
    if (back) back.glyph = 'back';
  }
  return out;
}

export interface DeedRow {
  label: string;
  value: string;
}

export interface DeedInfo {
  kind: 'street' | 'railroad' | 'utility' | 'other';
  name: string;
  band?: string;
  lightText?: boolean;
  headline: string;
  rows: DeedRow[];
  notes: string[];
  footnote?: string;
  mortgaged: boolean;
  mortgagedFor?: string;
  unmortgageFor?: string;
  owner: number | null;
  price?: number;
}

export function deedInfo(s: State, tile: number): DeedInfo {
  const t = s.board.tiles[tile];
  const ts = s.tiles[tile];
  const base = { name: t.name, mortgaged: ts.mortgaged, owner: ts.owner, price: t.price };
  const mort = t.price !== undefined ? { mortgagedFor: money(mortgageValue(s, tile)), unmortgageFor: money(unmortgageCost(s, tile)) } : {};
  if (t.type === 'street') {
    const g = s.board.groups[t.group!];
    const r = t.rents!;
    return {
      ...base,
      ...mort,
      kind: 'street',
      band: g.color,
      lightText: g.lightText,
      headline: `Rent ${money(r[0])}`,
      rows: [
        { label: 'With 1 house', value: money(r[1]) },
        { label: 'With 2 houses', value: money(r[2]) },
        { label: 'With 3 houses', value: money(r[3]) },
        { label: 'With 4 houses', value: money(r[4]) },
        { label: 'With hotel', value: money(r[5]) },
      ],
      notes: [
        `Mortgage value ${money(mortgageValue(s, tile))}`,
        `Houses cost ${money(t.houseCost ?? 0)} each`,
        `Hotels, ${money(t.houseCost ?? 0)} each plus 4 houses`,
      ],
      footnote: 'Own every lot in the color set and rent doubles on lots without houses.',
    };
  }
  if (t.type === 'railroad') {
    const r = t.rents!;
    return {
      ...base,
      ...mort,
      kind: 'railroad',
      headline: `Fare ${money(r[0])}`,
      rows: [
        { label: 'If 2 lines are owned', value: money(r[1]) },
        { label: 'If 3 lines are owned', value: money(r[2]) },
        { label: 'If 4 lines are owned', value: money(r[3]) },
      ],
      notes: [`Mortgage value ${money(mortgageValue(s, tile))}`],
    };
  }
  if (t.type === 'utility') {
    return {
      ...base,
      ...mort,
      kind: 'utility',
      headline: 'Rent depends on the dice',
      rows: [],
      notes: [
        'If one utility is owned, rent is 4 times the dice roll.',
        'If both are owned, rent is 10 times the dice roll.',
        `Mortgage value ${money(mortgageValue(s, tile))}`,
      ],
    };
  }
  return { ...base, kind: 'other', headline: '', rows: [], notes: [] };
}

export interface PlayerSummary {
  seat: number;
  name: string;
  color: string;
  token: string;
  cash: number;
  bankrupt: boolean;
  inJail: boolean;
  jailCards: number;
  properties: number;
  houses: number;
  hotels: number;
  active: boolean;
  kind: string;
}

export function players(s: State): PlayerSummary[] {
  return s.seats.map((seat, i) => {
    const p = s.players[i];
    const b = buildingCounts(s, i);
    return {
      seat: i,
      name: seat.name,
      color: seat.color,
      token: seat.token,
      cash: p.cash,
      bankrupt: p.bankrupt,
      inJail: !!p.jail,
      jailCards: p.gojf.length,
      properties: s.tiles.filter((t) => t.owner === i).length,
      houses: b.houses,
      hotels: b.hotels,
      active: s.turn.seat === i,
      kind: seat.kind,
    };
  });
}

/** One-line prompt for the current phase. */
export function phasePrompt(s: State): string {
  const n = (i: number) => s.seats[i].name;
  switch (s.phase) {
    case 'gameOver':
      return s.winner === null ? 'Game over' : `${n(s.winner)} wins!`;
    case 'buy':
      return `${n(s.turn.seat)} landed on ${s.board.tiles[s.pendingBuy!].name}`;
    case 'auction':
      return `Auction: ${s.board.tiles[s.auction!.tile].name}`;
    case 'debt': {
      const d = s.debts[0];
      return `${n(d.from)} owes ${money(d.amount)} — raise the money`;
    }
    case 'mortgagedTransfer':
      return `${n(s.transfers[0].to)} received mortgaged property`;
    case 'trade':
      return `${n(s.trade!.to)}: answer the trade from ${n(s.trade!.from)}`;
    case 'preRoll':
      return s.players[s.turn.seat].jail ? `${n(s.turn.seat)} is in jail` : `${n(s.turn.seat)} to roll`;
    case 'postRoll':
      return `${n(s.turn.seat)}'s turn`;
    default:
      return '';
  }
}

/** Tile the context panel shows: the pending purchase, the auction lot, else where the active player stands. */
export function focusTile(s: State): number {
  if (s.phase === 'buy') return s.pendingBuy!;
  if (s.phase === 'auction') return s.auction!.tile;
  const p = s.players[s.turn.seat];
  return p.position;
}
