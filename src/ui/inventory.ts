// Inventory (Stage 3 §3): the binder view model. Every action ManagePanel offered keeps its
// engine call (build, sell, mortgage, unmortgage); this only arranges them by card and words
// the reasons as sentences.
import {
  buildBlocker,
  buildingSellValue,
  countOwned,
  mortgageBlocker,
  mortgageValue,
  promiseGroupOf,
  rentFor,
  sellBlocker,
  tilesInPromiseGroup,
  unmortgageBlocker,
  unmortgageCost,
  type Action,
  type GamePromise,
  type PromiseGroup,
  type State,
} from '../engine';
import { symbolUrl } from '../render/symbols';
import { deedCard, voucherCard, type CardItem, type EmptyInfo } from './cards/model';
import { GROUP_LABEL, PROMISE_GROUP_ORDER, uiGroupColor } from './groups';
import { money } from './present';

export interface RowTag {
  text: string;
  color: string;
}

export interface BinderSlot {
  key: string;
  /** The card when the binder's owner holds it; null for an empty slot. */
  item: CardItem | null;
  empty: EmptyInfo | null;
  tile?: number;
  pledged?: boolean;
  promiseId?: number;
  tag?: { text: string; color: string };
}

export interface BinderRow {
  key: string;
  label: string;
  /** Color chip for color sets; none for railroads, utilities, jail cards, promises. */
  chip: string | null;
  owned: number;
  total: number;
  /** "of 3", or "active" for promises. */
  unit: string;
  full: boolean;
  tags: RowTag[];
  slots: BinderSlot[];
  /** Shown when a row has no slots at all (promises). */
  emptyNote?: string;
}

const TAG = { noBuild: '#8E2F23', given: '#5E4C3B', held: '#2F5D46' };

function rowTags(s: State, owner: number, viewer: number, g: PromiseGroup): RowTag[] {
  const you = owner === viewer;
  const tags: RowTag[] = [];
  for (const p of s.promises) {
    if (p.group !== g) continue;
    if (p.kind === 'noBuild' && p.from === owner) tags.push({ text: `No building · ${p.left} ${p.left === 1 ? 'round' : 'rounds'}`, color: TAG.noBuild });
    else if (p.kind === 'rentFree' && p.from === owner) tags.push({ text: `${s.seats[p.to].name} rent-free · ${p.left}`, color: TAG.given });
    else if (p.kind === 'rentFree' && p.to === owner) tags.push({ text: `${you ? 'You ride' : `${s.seats[owner].name} rides`} free · ${p.left}`, color: TAG.held });
  }
  return tags;
}

const isPledged = (s: State, tile: number) => s.players.some((p) => p.loans.some((l) => l.collateral.includes(tile)));

function emptyFor(s: State, tile: number): EmptyInfo {
  const t = s.board.tiles[tile];
  const o = s.tiles[tile].owner;
  const g = promiseGroupOf(s.board, tile)!;
  return {
    name: t.name,
    band: t.type === 'street' ? uiGroupColor(s.board, g) : null,
    icon: t.type === 'railroad' ? symbolUrl('railroad') : t.type === 'utility' ? symbolUrl(t.utility === 'water' ? 'utility-water' : 'utility-power') : undefined,
    owner: o === null ? null : { name: s.seats[o].name, color: s.seats[o].color },
  };
}

/** The binder of `owner` as `viewer` sees it: one row per group in board order, then jail cards and promises. */
export function binderRows(s: State, owner: number, viewer = owner): BinderRow[] {
  const rows: BinderRow[] = [];
  for (const g of PROMISE_GROUP_ORDER) {
    const tiles = tilesInPromiseGroup(s.board, g);
    if (!tiles.length) continue;
    const owned = tiles.filter((t) => s.tiles[t].owner === owner).length;
    const color = g === 'railroad' || g === 'utility' ? null : uiGroupColor(s.board, g);
    rows.push({
      key: g,
      label: GROUP_LABEL[g],
      chip: color,
      owned,
      total: tiles.length,
      unit: `of ${tiles.length}`,
      full: color !== null && owned === tiles.length,
      tags: rowTags(s, owner, viewer, g),
      slots: tiles.map((t) =>
        s.tiles[t].owner === owner
          ? { key: `t${t}`, tile: t, item: deedCard(s, t), empty: null, pledged: isPledged(s, t) }
          : { key: `t${t}`, tile: t, item: null, empty: emptyFor(s, t) },
      ),
    });
  }
  // Jail cards: one slot per deck card; held ones as cards, the rest show where they are.
  const held = s.players[owner].gojf;
  const jail: BinderSlot[] = held.map((deck, i) => ({ key: `j${i}`, item: { t: 'gojf', deck }, empty: null }));
  for (const deck of ['chance', 'chest'] as const) {
    const n = s.decks[deck].filter((c) => c.effect.kind === 'getOutOfJail').length;
    const mine = held.filter((d) => d === deck).length;
    for (let k = mine; k < n; k++) {
      const other = s.players.findIndex((p, i) => i !== owner && p.gojf.includes(deck));
      jail.push({
        key: `j-${deck}-${k}`,
        item: null,
        empty: {
          name: `Jail Free · ${deck === 'chance' ? 'Chance' : 'Chest'}`,
          band: deck === 'chance' ? '#8E2F23' : '#2F5D46',
          owner: other >= 0 ? { name: s.seats[other].name, color: s.seats[other].color } : null,
          note: other >= 0 ? undefined : 'In deck',
        },
      });
    }
  }
  const total = jail.length;
  rows.push({ key: 'jail', label: 'Jail cards', chip: null, owned: held.length, total, unit: `of ${total}`, full: false, tags: [], slots: jail });
  const ps = s.promises.filter((p) => p.from === owner || p.to === owner);
  rows.push({
    key: 'promises',
    label: 'Promises',
    chip: null,
    owned: ps.length,
    total: ps.length,
    unit: 'active',
    full: false,
    tags: [],
    slots: ps.map((p) => ({
      key: `p${p.id}`,
      promiseId: p.id,
      item: voucherCard(s, p),
      empty: null,
      tag: p.to === owner ? { text: 'HELD', color: TAG.held } : { text: 'GIVEN', color: TAG.given },
    })),
    emptyNote: 'No active promises. Vouchers you give or hold in trades land here.',
  });
  return rows;
}

export interface BinderStats {
  deeds: number;
  fullSets: number;
  houses: number;
  hotels: number;
  cash: number;
}

export function binderStats(s: State, owner: number): BinderStats {
  let houses = 0;
  let hotels = 0;
  for (const ts of s.tiles) {
    if (ts.owner !== owner) continue;
    if (ts.buildings === 5) hotels++;
    else houses += ts.buildings;
  }
  const fullSets = PROMISE_GROUP_ORDER.slice(0, 8).filter((g) => {
    const t = tilesInPromiseGroup(s.board, g);
    return t.length > 0 && t.every((i) => s.tiles[i].owner === owner);
  }).length;
  return { deeds: s.tiles.filter((t) => t.owner === owner).length, fullSets, houses, hotels, cash: s.players[owner].cash };
}

// ---- detail pane ---------------------------------------------------------------------------

export interface SideInfo {
  label: string;
  value: string;
  sub?: string;
  tone?: 'ox' | 'fo';
  /** Building icons (0–4 houses, 5 = hotel). */
  buildings?: number;
}

export interface InvAction {
  label: string;
  hint?: string;
  /** Sentence shown in red when the action is blocked. */
  why?: string;
  /** Reason chip ("Pledged") for collateral. */
  chip?: string;
  action?: Action;
  ok: boolean;
}

export interface Detail {
  title: string;
  sub: string;
  chip: string | null;
  icon?: string;
  item: CardItem;
  side: SideInfo[];
  actions: InvAction[];
  note?: string;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Engine reason → sentence (Stage 3 §3: a disabled action shows its reason in red). */
export function reasonSentence(s: State, tile: number, why: string): string {
  const m = /^blocked by your promise to (.+) \((\d+) rounds? left\)$/.exec(why);
  if (m) return `Blocked by your promise to ${m[1]} for ${plural(Number(m[2]), 'more round', 'more rounds')}.`;
  const g = promiseGroupOf(s.board, tile);
  if (why === 'sell the buildings in this set first' && g) {
    const n = tilesInPromiseGroup(s.board, g).reduce((k, i) => k + (s.tiles[i].buildings === 5 ? 1 : s.tiles[i].buildings), 0);
    return `Sell all ${n} ${GROUP_LABEL[g]} ${n === 1 ? 'building' : 'buildings'} first.`;
  }
  if (why === 'needs the full color set' && g) {
    const missing = tilesInPromiseGroup(s.board, g).filter((i) => s.tiles[i].owner !== s.tiles[tile].owner);
    return `You don't own ${missing.map((i) => s.board.tiles[i].name).join(' or ')}.`;
  }
  if (why === 'no buildings') return 'No buildings to sell.';
  if (why === 'not now' && s.phase === 'debt') return 'Not while raising money: sell or mortgage instead.';
  if (why === 'pledged to a loan') return 'Pledged to a bank loan.';
  return `${cap(why)}.`;
}

function streetRentAt(s: State, tile: number, b: number): number {
  const t = s.board.tiles[tile];
  if (b > 0) return t.rents![b];
  const owner = s.tiles[tile].owner;
  const full = owner !== null && tilesInPromiseGroup(s.board, t.group!).every((i) => s.tiles[i].owner === owner);
  return full ? Math.round(t.rents![0] * s.rules.unimprovedSetMultiplier) : t.rents![0];
}

function deedActions(s: State, actor: number, tile: number): InvAction[] {
  const t = s.board.tiles[tile];
  const ts = s.tiles[tile];
  const out: InvAction[] = [];
  const op = (label: string, hint: string, action: Action, why: string | null): InvAction => ({
    label,
    hint,
    action,
    ok: !why,
    why: why ? reasonSentence(s, tile, why) : undefined,
    chip: why === 'pledged to a loan' ? 'Pledged' : undefined,
  });
  const mort = ts.mortgaged
    ? op('Unmortgage', `−${money(unmortgageCost(s, tile))} · you have ${money(s.players[actor].cash)}`, { type: 'unmortgage', seat: actor, tile }, unmortgageBlocker(s, actor, tile))
    : op(`Mortgage ${t.name}`, `+${money(mortgageValue(s, tile))}`, { type: 'mortgage', seat: actor, tile }, mortgageBlocker(s, actor, tile));
  if (t.type === 'street') {
    const b = ts.buildings;
    const noBuild = s.promises.find((p) => p.kind === 'noBuild' && p.from === actor && p.group === t.group);
    const bLabel = noBuild ? `Build on ${GROUP_LABEL[t.group!]}` : b === 4 ? 'Build a hotel' : 'Build a house';
    const rentNow = streetRentAt(s, tile, b);
    const build = op(bLabel, b < 5 ? `−${money(t.houseCost ?? 0)} · rent ${money(rentNow)} → ${money(t.rents![b + 1])}` : '', { type: 'build', seat: actor, tile }, buildBlocker(s, actor, tile));
    const sell = op(
      b === 5 ? 'Sell the hotel' : b > 0 ? 'Sell a house' : 'Sell',
      b > 0 ? `+${money(buildingSellValue(s, tile))} · rent → ${money(streetRentAt(s, tile, b - 1))}` : '',
      { type: 'sell', seat: actor, tile },
      sellBlocker(s, actor, tile),
    );
    if (ts.mortgaged) out.push(mort, build, sell);
    else out.push(build, sell, mort);
  } else {
    out.push(mort, { label: 'Build', ok: false, why: `${t.type === 'railroad' ? 'Railroads' : 'Utilities'} can't have buildings.` });
  }
  return out;
}

function deedDetail(s: State, owner: number, actor: number | null, tile: number): Detail {
  const t = s.board.tiles[tile];
  const ts = s.tiles[tile];
  const g = promiseGroupOf(s.board, tile)!;
  const tiles = tilesInPromiseGroup(s.board, g);
  const k = tiles.filter((i) => s.tiles[i].owner === owner).length;
  const who = actor === owner ? 'you own' : `${s.seats[owner].name} owns`;
  const others = tiles.filter((i) => s.tiles[i].owner !== owner);
  const belong = () => {
    const byOwner = new Map<string, string[]>();
    for (const i of others) {
      const o = s.tiles[i].owner;
      const key = o === null ? 'the bank' : s.seats[o].name;
      byOwner.set(key, [...(byOwner.get(key) ?? []), s.board.tiles[i].name]);
    }
    return [...byOwner].map(([o, names]) => (o === 'the bank' ? `${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} unowned` : `${names.join(' and ')} ${names.length === 1 ? 'belongs' : 'belong'} to ${o}`)).join('; ');
  };
  const side: SideInfo[] = [];
  let sub: string;
  if (ts.mortgaged) {
    sub = `${GROUP_LABEL[g]} · ${who} ${k} of ${tiles.length} · mortgaged`;
    side.push({ label: 'Status', value: 'Mortgaged', sub: 'Earns no rent until lifted', tone: 'ox' });
    side.push({ label: 'Lift for', value: money(unmortgageCost(s, tile)), sub: `${money(mortgageValue(s, tile))} + 10% interest` });
    side.push({ label: t.type === 'street' ? 'Set' : GROUP_LABEL[g], value: `${k} of ${tiles.length}`, sub: others.length ? belong() : undefined });
  } else if (t.type === 'street') {
    const full = k === tiles.length;
    const b = ts.buildings;
    const each = full && tiles.every((i) => s.tiles[i].buildings === b) && b > 0 ? ` · ${b === 5 ? 'a hotel' : plural(b, 'house', 'houses')} on each lot` : '';
    sub = `${GROUP_LABEL[g]} · ${full ? 'full set' : `${who} ${k} of ${tiles.length}`}${each}`;
    side.push({ label: 'Rent now', value: money(rentFor(s, tile, 7)), sub: b === 5 ? 'with a hotel' : b > 0 ? `with ${plural(b, 'house', 'houses')}` : full ? 'doubled: full set' : 'base rent' });
    const bank = b === 4 ? (s.bank.hotels > 99 ? 'Bank: hotels available' : `Bank: ${plural(s.bank.hotels, 'hotel', 'hotels')} left`) : s.bank.houses > 99 ? `Next house ${money(t.houseCost ?? 0)}` : `Bank: ${plural(s.bank.houses, 'house', 'houses')} left`;
    side.push({ label: 'Buildings', value: b === 0 ? 'None' : '', buildings: b, sub: b < 5 ? bank : undefined });
    const rest = tiles.filter((i) => i !== tile);
    side.push({
      label: 'Set',
      value: `${k} of ${tiles.length}`,
      sub: full
        ? `${rest.map((i) => s.board.tiles[i].name).join(', ')}: ${rest.map((i) => s.tiles[i].buildings).every((x) => x === rest.map((i) => s.tiles[i].buildings)[0]) ? `${s.tiles[rest[0]].buildings === 5 ? 'a hotel' : plural(s.tiles[rest[0]].buildings, 'house', 'houses')} each` : 'mixed'}`
        : belong(),
    });
  } else if (t.type === 'railroad') {
    const n = countOwned(s, owner, 'railroad');
    sub = `Railroads · ${who} ${n} of ${tiles.length}`;
    side.push({ label: 'Rent now', value: money(rentFor(s, tile, 7)), sub: plural(n, 'line owned', 'lines owned') });
    if (n < 4) side.push({ label: 'Next line', value: money(t.rents![n]), sub: belong() });
    side.push({ label: 'Mortgage', value: money(mortgageValue(s, tile)), sub: 'Not mortgaged' });
  } else {
    const n = countOwned(s, owner, 'utility');
    const [one, both] = s.board.utilityMultipliers ?? [4, 10];
    sub = `Utilities · ${who} ${n} of ${tiles.length}`;
    side.push({ label: 'Rent now', value: `${n >= 2 ? both : one}× dice`, sub: plural(n, 'utility owned', 'utilities owned') });
    if (n < 2) side.push({ label: 'Both owned', value: `${both}× dice`, sub: belong() });
    side.push({ label: 'Mortgage', value: money(mortgageValue(s, tile)), sub: 'Not mortgaged' });
  }
  return {
    title: t.name,
    sub,
    chip: t.type === 'street' ? uiGroupColor(s.board, g) : null,
    icon: t.type === 'railroad' ? symbolUrl('railroad') : t.type === 'utility' ? symbolUrl(t.utility === 'water' ? 'utility-water' : 'utility-power') : undefined,
    item: deedCard(s, tile),
    side,
    actions: actor === owner ? deedActions(s, actor, tile) : [],
  };
}

function promiseLine(s: State, p: GamePromise, viewer: number): string {
  const name = (i: number) => (i === viewer ? 'you' : s.seats[i].name);
  const g = GROUP_LABEL[p.group];
  if (p.kind === 'noBuild') return `${name(p.from)} can't build on ${g} for ${plural(p.left, 'more round', 'more rounds')}`;
  const lots = p.group === 'railroad' || p.group === 'utility' ? g : `${g} lots`;
  const holder = name(p.to);
  return `${holder} ${holder === 'you' ? 'ride' : 'rides'} rent-free on ${p.from === viewer ? 'your' : `${s.seats[p.from].name}'s`} ${lots} for ${plural(p.left, 'more landing', 'more landings')}`;
}

function promiseDetail(s: State, owner: number, viewer: number, p: GamePromise): Detail {
  const g = GROUP_LABEL[p.group];
  const rf = p.kind === 'rentFree';
  const mine = p.from === owner;
  const ownerName = owner === viewer ? 'You' : s.seats[owner].name;
  const other = s.seats[mine ? p.to : p.from].name;
  const sub = `${mine ? `${ownerName} promised ${other}` : `${other} promised ${owner === viewer ? 'you' : ownerName}`} · ${p.left} of ${p.total} ${rf ? (p.total === 1 ? 'landing' : 'landings') : p.total === 1 ? 'round' : 'rounds'} left`;
  const tiles = tilesInPromiseGroup(s.board, p.group);
  const side: SideInfo[] = rf
    ? [
        { label: 'Waives', value: 'Rent', sub: `On every ${p.group === 'railroad' ? 'railroad' : p.group === 'utility' ? 'utility' : `${g} lot`} ${s.seats[p.from].name} owns, now or later`, tone: 'fo' },
        { label: 'Counts', value: 'Landings', sub: 'Only landings that would owe rent use one up' },
        { label: 'Ends', value: plural(p.left, 'landing', 'landings'), sub: 'Or when either player is out' },
      ]
    : [
        { label: 'Blocks', value: 'Building', sub: `Houses and hotels on ${tiles.map((i) => s.board.tiles[i].name).join(', ')}`, tone: 'ox' },
        { label: 'Still allowed', value: 'Selling', sub: 'Houses can be sold any time' },
        { label: 'Ends', value: plural(p.left, 'round', 'rounds'), sub: `After everyone has taken ${plural(p.left, 'more turn', 'more turns')}` },
      ];
  const actions: InvAction[] = [];
  if (!rf && p.from === owner && owner === viewer) {
    actions.push({ label: `Build on ${g}`, ok: false, why: `Blocked by your promise to ${s.seats[p.to].name} for ${plural(p.left, 'more round', 'more rounds')}.` });
  }
  const others = s.promises.filter((q) => q.id !== p.id && (q.from === owner || q.to === owner));
  return {
    title: `${rf ? 'Rent-Free' : 'No Building'} · ${g}`,
    sub,
    chip: p.group === 'railroad' || p.group === 'utility' ? null : uiGroupColor(s.board, p.group),
    icon: p.group === 'railroad' ? symbolUrl('railroad') : p.group === 'utility' ? symbolUrl('utility-power') : undefined,
    item: voucherCard(s, p),
    side,
    actions,
    note: others.length ? `Other active promises: ${others.map((q) => promiseLine(s, q, viewer)).join('; ')}.` : undefined,
  };
}

/** Detail pane for a slot. `actor` is the seat allowed to act (null when viewing someone else). */
export function slotDetail(s: State, owner: number, viewer: number, slot: BinderSlot): Detail | null {
  const actor = owner === viewer ? viewer : null;
  if (slot.tile !== undefined && slot.item) return deedDetail(s, owner, actor, slot.tile);
  if (slot.promiseId !== undefined) {
    const p = s.promises.find((q) => q.id === slot.promiseId);
    return p ? promiseDetail(s, owner, viewer, p) : null;
  }
  if (slot.item?.t === 'gojf') {
    const deck = slot.item.deck === 'chance' ? 'Chance' : 'Community Chest';
    return {
      title: 'Get Out of Jail Free',
      sub: `${deck} card · keep it, use it or trade it`,
      chip: null,
      item: slot.item,
      side: [
        { label: 'Use', value: 'In jail', sub: 'Offered on your turn while you are in jail' },
        { label: 'Trade', value: 'Any time', sub: 'Add it to an offer in Trade' },
      ],
      actions: [],
    };
  }
  return null;
}
