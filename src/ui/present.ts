// Presentation helpers for the overlay: labels, deed data, money. Typed TS so the Svelte
// components stay thin.
import {
  borrowCapacity,
  buildBlocker,
  buildingCounts,
  buildingSellValue,
  isBankBacked,
  liquidationValue,
  mortgageBlocker,
  mortgageValue,
  sellBlocker,
  unmortgageBlocker,
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

export type GlyphFamily = 'playstation' | 'nintendo';

/**
 * Prompt glyph for the acting controller. Nintendo pads by position: bottom B, right A, left Y,
 * top X; with the swap setting, Confirm is A and Back is B. The approved set has A and B
 * symbols; X and Y are drawn as lettered discs in the same style.
 */
export function glyphFor(g: Glyph, family: GlyphFamily = 'playstation', swap = false): { symbol?: SymbolName; letter?: string } {
  if (family === 'playstation') return { symbol: GLYPH_SYMBOL[g] };
  switch (g) {
    case 'confirm':
      return { symbol: swap ? 'button-switch-a' : 'button-switch-b' };
    case 'back':
      return { symbol: swap ? 'button-switch-b' : 'button-switch-a' };
    case 'manage':
      return { letter: 'Y' };
    case 'trade':
      return { letter: 'X' };
  }
}

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
    case 'takeLoan':
      return `Borrow ${money(a.amount)}`;
    case 'repayLoan':
      return `Pay ${money(a.amount)} off a loan`;
    case 'speedChoice': {
      const pos = s.players[a.seat].position;
      if (a.target !== undefined) return `Go to ${tileName(s, a.target)}`;
      return `Move ${a.steps} → ${tileName(s, (pos + (a.steps ?? 0)) % 40)}`;
    }
    default:
      return a.type;
  }
}

/** The main buttons for the current decision (manage actions live in the Manage screen). */
export function primaryButtons(s: State, actions: Action[]): ActionButton[] {
  const order: Action['type'][] = ['roll', 'speedChoice', 'buy', 'payJailFine', 'useJailCard', 'decline', 'endTurn', 'acceptTrade', 'rejectTrade', 'cancelTrade', 'declareBankruptcy'];
  const out: ActionButton[] = [];
  for (const type of order) {
    // "Move anywhere" (triples) uses a picker instead of 40 buttons.
    if (type === 'speedChoice' && s.turn.speedChoice?.anyTile) continue;
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
        `If one utility is owned, rent is ${(s.board.utilityMultipliers ?? [4, 10])[0]} times the dice roll.`,
        `If both are owned, rent is ${(s.board.utilityMultipliers ?? [4, 10])[1]} times the dice roll.`,
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
  /** A bank-backed bot that left the table (rule "bankBotMode: remove"). */
  leftTable: boolean;
  /** Bank-backed bot whose money is still unlimited (shown as ∞). */
  backed: boolean;
  inJail: boolean;
  jailCards: number;
  properties: number;
  houses: number;
  hotels: number;
  active: boolean;
  kind: string;
  /** Rent-free promises involving this seat, with turns remaining. */
  promises: string[];
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
      leftTable: !!p.leftTable,
      backed: isBankBacked(s, i),
      inJail: !!p.jail,
      jailCards: p.gojf.length,
      properties: s.tiles.filter((t) => t.owner === i).length,
      houses: b.houses,
      hotels: b.hotels,
      active: s.turn.seat === i,
      kind: seat.kind,
      promises: s.promises
        .filter((pr) => pr.from === i || pr.to === i)
        .map((pr) => `${pr.to === i ? 'Rent-free' : 'Promised'} on ${s.board.tiles[pr.tileId].name} (${pr.turnsLeft})`),
    };
  });
}

/** Game-over banner text for the SPEC §3 win rules (2+ humans, 1-human testing, all bots). */
export function gameOverText(s: State): { title: string; subtitle: string } {
  const humans = s.seats.map((_, i) => i).filter((i) => s.seats[i].kind === 'human');
  const botsLeft = s.seats.some((x, i) => x.kind === 'bot' && !s.players[i].bankrupt);
  if (s.winner === null) {
    if (humans.length === 1) return { title: 'The bots win', subtitle: `${s.seats[humans[0]].name} went bankrupt.` };
    return { title: 'No winner', subtitle: 'Everyone is out.' };
  }
  const title = `${s.seats[s.winner].name} wins!`;
  if (s.seats[s.winner].kind !== 'human') return { title, subtitle: 'Last player standing.' };
  if (humans.length >= 2) return { title, subtitle: botsLeft ? 'Last human standing (bots still in play don’t count).' : 'Last human standing.' };
  return { title, subtitle: 'Every bot is out.' };
}

/** One-line prompt for the current phase. */
export function phasePrompt(s: State): string {
  const n = (i: number) => s.seats[i].name;
  switch (s.phase) {
    case 'gameOver':
      return gameOverText(s).title;
    case 'buy':
      return `${n(s.turn.seat)} landed on ${s.board.tiles[s.pendingBuy!].name}`;
    case 'auction':
      return s.auction!.kind === 'house' || s.auction!.kind === 'hotel'
        ? `Auction: the last ${s.auction!.kind === 'hotel' ? 'hotels' : 'houses'}`
        : `Auction: ${s.board.tiles[s.auction!.tile].name}`;
    case 'debt': {
      const d = s.debts[0];
      return `${n(d.from)} owes ${money(d.amount)} — raise the money`;
    }
    case 'mortgagedTransfer':
      return `${n(s.transfers[0].to)} received mortgaged property`;
    case 'trade':
      return `${n(s.trade!.to)}: answer the trade from ${n(s.trade!.from)}`;
    case 'speedChoice':
      return s.turn.speedChoice?.anyTile ? `${n(s.turn.seat)} rolled triples — go anywhere` : `${n(s.turn.seat)} rolled the bus — choose a move`;
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


// ---- Manage / raise money --------------------------------------------------------------------

export interface ManageOp {
  action: Action;
  label: string;
  ok: boolean;
  reason: string | null;
}

export interface ManageRow {
  tile: number;
  name: string;
  color: string;
  buildings: number;
  mortgaged: boolean;
  pledged: boolean;
  ops: ManageOp[];
}

export interface ManageGroup {
  key: string;
  label: string;
  color: string;
  full: boolean;
  rows: ManageRow[];
}

const GROUP_LABEL: Record<string, string> = {
  brown: 'Brown',
  lightBlue: 'Light blue',
  pink: 'Pink',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  darkBlue: 'Dark blue',
};

/** Every property a seat owns, grouped by set, with each management action and why it is blocked. */
export function manageGroups(s: State, seat: number): ManageGroup[] {
  const groups = new Map<string, ManageGroup>();
  for (const t of s.board.tiles) {
    const ts = s.tiles[t.index];
    if (ts.owner !== seat) continue;
    const key = t.group ?? t.type;
    const color = t.group ? s.board.groups[t.group].color : t.type === 'railroad' ? '#2B2119' : '#5E4C3B';
    const label = t.group ? GROUP_LABEL[t.group] ?? t.group : t.type === 'railroad' ? 'Railroads' : 'Utilities';
    if (!groups.has(key)) {
      const all = s.board.tiles.filter((x) => (x.group ?? x.type) === key);
      groups.set(key, { key, label, color, full: !!t.group && all.every((x) => s.tiles[x.index].owner === seat), rows: [] });
    }
    const tile = t.index;
    const ops: ManageOp[] = [];
    if (t.type === 'street') {
      const b = buildBlocker(s, seat, tile);
      ops.push({ action: { type: 'build', seat, tile }, label: `${ts.buildings === 4 ? 'Hotel' : 'House'} −${money(t.houseCost ?? 0)}`, ok: !b, reason: b });
      const sb = sellBlocker(s, seat, tile);
      ops.push({ action: { type: 'sell', seat, tile }, label: `Sell +${money(buildingSellValue(s, tile))}`, ok: !sb, reason: sb });
    }
    if (ts.mortgaged) {
      const u = unmortgageBlocker(s, seat, tile);
      ops.push({ action: { type: 'unmortgage', seat, tile }, label: `Unmortgage −${money(unmortgageCost(s, tile))}`, ok: !u, reason: u });
    } else {
      const m = mortgageBlocker(s, seat, tile);
      ops.push({ action: { type: 'mortgage', seat, tile }, label: `Mortgage +${money(mortgageValue(s, tile))}`, ok: !m, reason: m });
    }
    const pledged = s.players.some((p) => p.loans.some((l) => l.collateral.includes(tile)));
    groups.get(key)!.rows.push({ tile, name: t.name, color, buildings: ts.buildings, mortgaged: ts.mortgaged, pledged, ops });
  }
  return [...groups.values()];
}

export interface DebtInfo {
  debtor: number;
  amount: number;
  to: string;
  cash: number;
  canCover: boolean;
}

export function debtInfo(s: State): DebtInfo | null {
  if (s.phase !== 'debt') return null;
  const d = s.debts[0];
  return {
    debtor: d.from,
    amount: d.amount,
    to: d.to === 'bank' ? 'the bank' : s.seats[d.to].name,
    cash: s.players[d.from].cash,
    canCover: liquidationValue(s, d.from) + borrowCapacity(s, d.from) >= d.amount,
  };
}
