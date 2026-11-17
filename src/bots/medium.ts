// Normal bot, one fixed "medium" level (SPEC §3): buys most properties, prioritizes completing
// sets, builds up to 3 houses when cash allows, keeps a cash reserve, bids up to a value
// estimate, never takes loans. Deterministic: same state → same choice.
import {
  bidOptions,
  groupTiles,
  legalActions,
  mortgageValue,
  ownsGroup,
  rentFor,
  tradeTileBlocker,
  unmortgageCost,
  validateOffer,
  type Action,
  type State,
  type TradeOffer,
} from '../engine';

const MAX_HOUSES = 3;

/** Most rent any opponent could charge right now (danger level → reserve size). */
function worstRent(s: State, seat: number): number {
  let worst = 0;
  for (const t of s.board.tiles) {
    const ts = s.tiles[t.index];
    if (ts.owner === null || ts.owner === seat) continue;
    worst = Math.max(worst, rentFor(s, t.index, 7));
  }
  return worst;
}

export function reserve(s: State, seat: number): number {
  return Math.min(500, 150 + Math.round(worstRent(s, seat) * 0.3));
}

/** How much a property is worth to this bot. */
export function valueEstimate(s: State, seat: number, tile: number): number {
  const t = s.board.tiles[tile];
  const price = t.price ?? 0;
  if (t.type === 'railroad') {
    const owned = s.board.tiles.filter((x) => x.type === 'railroad' && s.tiles[x.index].owner === seat).length;
    return Math.round(price * (1.05 + 0.15 * owned));
  }
  if (t.type === 'utility') return Math.round(price * 0.9);
  if (!t.group) return price;
  const others = groupTiles(s.board, t.group).filter((i) => i !== tile);
  const mine = others.filter((i) => s.tiles[i].owner === seat).length;
  if (mine === others.length) return Math.round(price * 1.7); // completes my set
  const owners = new Set(others.map((i) => s.tiles[i].owner).filter((o) => o !== null && o !== seat));
  if (owners.size === 1 && others.every((i) => s.tiles[i].owner !== null && s.tiles[i].owner !== seat)) {
    return Math.round(price * 1.4); // blocks an opponent's set
  }
  if (mine > 0) return Math.round(price * 1.2);
  return price;
}

function find<T extends Action['type']>(acts: Action[], type: T): Extract<Action, { type: T }>[] {
  return acts.filter((a) => a.type === type) as Extract<Action, { type: T }>[];
}

function unownedCount(s: State): number {
  return s.board.tiles.filter((t) => t.price !== undefined && s.tiles[t.index].owner === null).length;
}

/** Build one house on the best set if affordable, keeping the reserve; up to 3 houses. */
function chooseBuild(s: State, seat: number, acts: Action[]): Action | null {
  const res = reserve(s, seat);
  // Normally stops at 3 houses; a very cash-rich bot (or one facing a house shortage) goes on to
  // hotels, which also returns houses to the bank.
  const cash = s.players[seat].cash;
  const cap = cash > res + 1500 || s.bank.houses === 0 ? 5 : MAX_HOUSES;
  const builds = find(acts, 'build').filter((a) => {
    const t = s.board.tiles[a.tile];
    return s.tiles[a.tile].buildings < cap && cash - (t.houseCost ?? 0) >= res;
  });
  if (!builds.length) return null;
  // Prefer the set with the best rent jump per dollar, then the lowest level (even building).
  builds.sort((a, b) => {
    const ta = s.board.tiles[a.tile];
    const tb = s.board.tiles[b.tile];
    const ga = (ta.rents![s.tiles[a.tile].buildings + 1] - ta.rents![s.tiles[a.tile].buildings]) / (ta.houseCost ?? 1);
    const gb = (tb.rents![s.tiles[b.tile].buildings + 1] - tb.rents![s.tiles[b.tile].buildings]) / (tb.houseCost ?? 1);
    return gb - ga || s.tiles[a.tile].buildings - s.tiles[b.tile].buildings;
  });
  return builds[0];
}

function chooseUnmortgage(s: State, seat: number, acts: Action[]): Action | null {
  const res = reserve(s, seat);
  const opts = find(acts, 'unmortgage').filter((a) => s.players[seat].cash - unmortgageCost(s, a.tile) >= res + 200);
  if (!opts.length) return null;
  // Lots in sets I own first (they unlock building), then the cheapest.
  opts.sort((a, b) => {
    const ga = s.board.tiles[a.tile].group;
    const gb = s.board.tiles[b.tile].group;
    const sa = ga && ownsGroup(s, seat, ga) ? 0 : 1;
    const sb = gb && ownsGroup(s, seat, gb) ? 0 : 1;
    return sa - sb || unmortgageCost(s, a.tile) - unmortgageCost(s, b.tile);
  });
  return opts[0];
}

/** Raise money: mortgage loose lots, then sell buildings, then mortgage set lots. */
function chooseRaise(s: State, seat: number, acts: Action[]): Action | null {
  const mortgages = find(acts, 'mortgage');
  const loose = mortgages.filter((a) => {
    const g = s.board.tiles[a.tile].group;
    return !g || !ownsGroup(s, seat, g);
  });
  const byValue = (a: { tile: number }, b: { tile: number }) => (s.board.tiles[a.tile].price ?? 0) - (s.board.tiles[b.tile].price ?? 0);
  if (loose.length) return loose.sort(byValue)[0];
  const sells = find(acts, 'sell');
  if (sells.length) return sells.sort((a, b) => s.tiles[b.tile].buildings - s.tiles[a.tile].buildings || byValue(a, b))[0];
  if (mortgages.length) return mortgages.sort(byValue)[0];
  return null;
}

// ---- trading ------------------------------------------------------------------------------

/** Would `seat` own the whole set of `tile` if it also held `extra` (and gave away `minus`)? */
function completesSet(s: State, seat: number, tile: number, extra: number[], minus: number[] = []): boolean {
  const g = s.board.tiles[tile].group;
  if (!g) return false;
  return groupTiles(s.board, g).every((i) => (s.tiles[i].owner === seat && !minus.includes(i)) || extra.includes(i));
}

/** Value to `me` of a trade, from my side: what I get minus what I give (positive = good). */
export function tradeValue(s: State, me: number, o: TradeOffer): { gain: number; loss: number } {
  const meIsFrom = o.from === me;
  const mine = meIsFrom ? o.give : o.get;
  const theirs = meIsFrom ? o.get : o.give;
  const other = meIsFrom ? o.to : o.from;
  const price = (t: number) => s.board.tiles[t].price ?? 0;
  const iCompleteASet = theirs.tiles.some((t) => completesSet(s, me, t, theirs.tiles, mine.tiles));
  let gain = theirs.cash + theirs.gojf * 50;
  for (const t of theirs.tiles) {
    let v = completesSet(s, me, t, theirs.tiles, mine.tiles) ? price(t) * 2.2 : valueEstimate(s, me, t);
    if (s.tiles[t].mortgaged) v -= mortgageValue(s, t) * 0.6;
    gain += v;
  }
  let loss = mine.cash + mine.gojf * 50;
  for (const t of mine.tiles) {
    const g = s.board.tiles[t].group;
    let v = g && ownsGroup(s, me, g) ? price(t) * 3 : price(t);
    // Handing an opponent a complete set is expensive unless I complete one too.
    if (completesSet(s, other, t, mine.tiles, theirs.tiles)) v += price(t) * (iCompleteASet ? 0.8 : 2);
    loss += v;
  }
  return { gain, loss };
}

/** A set-completing offer for the one or two lots I am missing, or null. */
function proposeTrade(s: State, seat: number): TradeOffer | null {
  if (!s.rules.tradingAllowed) return null;
  const p = s.players[seat];
  const available = p.cash - Math.round(reserve(s, seat) * 0.5);
  const mult = Math.min(4, 1.8 + s.turnNumber / 300);
  const groups = [...new Set(s.board.tiles.filter((t) => t.group).map((t) => t.group!))];
  const candidates: TradeOffer[] = [];
  for (const g of groups) {
    const tiles = groupTiles(s.board, g);
    const missing = tiles.filter((i) => s.tiles[i].owner !== seat);
    if (!missing.length || missing.length > 2 || missing.length === tiles.length) continue;
    const owner = s.tiles[missing[0]].owner;
    if (owner === null || owner === seat || !missing.every((i) => s.tiles[i].owner === owner)) continue;
    if (s.players[owner].bankrupt || s.seats[owner].kind === 'bankBot') continue;
    if (missing.some((i) => tradeTileBlocker(s, i))) continue;
    const price = missing.reduce((n, i) => n + (s.board.tiles[i].price ?? 0), 0);
    const want = Math.round(price * mult);
    const get = { tiles: missing, cash: 0, gojf: 0 };
    if (available >= want) {
      candidates.push({ from: seat, to: owner, give: { tiles: [], cash: want, gojf: 0 }, get, promises: [] });
      continue;
    }
    // Set for set: give them the lot that completes one of their sets, plus what cash I can.
    const swap = s.board.tiles.find(
      (t) => s.tiles[t.index].owner === seat && t.group && t.group !== g && !tradeTileBlocker(s, t.index) && completesSet(s, owner, t.index, [t.index]),
    );
    if (swap) {
      const cash = Math.max(0, Math.min(available, Math.round(price * (mult - 1))));
      candidates.push({ from: seat, to: owner, give: { tiles: [swap.index], cash, gojf: 0 }, get, promises: [] });
    }
  }
  // Best set first (highest rent potential per lot).
  candidates.sort((a, b) => (s.board.tiles[b.get.tiles[0]].price ?? 0) - (s.board.tiles[a.get.tiles[0]].price ?? 0));
  return candidates.find((o) => !validateOffer(s, o)) ?? null;
}

export function chooseMedium(s: State, seat: number): Action | null {
  const acts = legalActions(s, seat);
  if (!acts.length) return null;
  const p = s.players[seat];
  const has = (type: Action['type']) => acts.find((a) => a.type === type);

  switch (s.phase) {
    case 'auction': {
      const a = s.auction!;
      if (!a.active.includes(seat) || a.highBidder === seat) return null;
      const worth =
        a.kind === 'house' || a.kind === 'hotel'
          ? Math.round((s.board.tiles[a.buildFor?.[seat] ?? a.tile].houseCost ?? 100) * 1.4)
          : valueEstimate(s, seat, a.tile);
      const limit = Math.min(worth, p.cash - Math.round(reserve(s, seat) * 0.5));
      const bids = bidOptions(s, seat).filter((x) => x <= limit);
      if (!bids.length) return { type: 'pass', seat };
      // Jump by $10 while far below the limit, otherwise the smallest raise.
      const amount = limit - a.highBid > 60 && bids.length > 1 ? bids[1] : bids[0];
      return { type: 'bid', seat, amount };
    }
    case 'mortgagedTransfer': {
      const choices = find(acts, 'mortgagedChoice');
      const res = reserve(s, seat);
      const lift = choices.find((c) => c.unmortgage && p.cash - unmortgageCost(s, c.tile) >= res + 100);
      return lift ?? choices.find((c) => !c.unmortgage) ?? null;
    }
    case 'debt':
      return chooseRaise(s, seat, acts) ?? has('declareBankruptcy') ?? null;
    case 'buy': {
      if (s.turn.seat !== seat) return null;
      const tile = s.pendingBuy!;
      const price = s.board.tiles[tile].price ?? 0;
      const value = valueEstimate(s, seat, tile);
      const res = reserve(s, seat);
      const canBuy = has('buy');
      if (canBuy && (p.cash - price >= res || (value > price * 1.3 && p.cash - price >= 50))) return canBuy;
      return has('decline') ?? null;
    }
    case 'speedChoice': {
      if (s.turn.seat !== seat) return null;
      const sc = s.turn.speedChoice!;
      const pos = p.position;
      const score = (tile: number) => {
        const t = s.board.tiles[tile];
        const ts = s.tiles[tile];
        if (t.price !== undefined && ts.owner === null) return 1000 + valueEstimate(s, seat, tile);
        if (ts.owner !== null && ts.owner !== seat && !ts.mortgaged) return -rentFor(s, tile, 7);
        if (t.type === 'goToJail') return -500;
        if (t.type === 'tax') return -200;
        return 0;
      };
      if (sc.anyTile) {
        let best = 0;
        for (let t = 0; t < 40; t++) if (score(t) > score(best)) best = t;
        return { type: 'speedChoice', seat, target: best };
      }
      const steps = [...sc.options].sort((x, y) => score((pos + y) % 40) - score((pos + x) % 40) || y - x)[0];
      return { type: 'speedChoice', seat, steps };
    }
    case 'trade': {
      const o = s.trade!;
      if (o.to !== seat) return null;
      const { gain, loss } = tradeValue(s, seat, o);
      const cashAfter = p.cash - o.get.cash + o.give.cash;
      return gain >= loss * 1.15 && cashAfter >= 50 ? { type: 'acceptTrade', seat } : { type: 'rejectTrade', seat };
    }
    case 'preRoll': {
      if (s.turn.seat !== seat) return null;
      if (!s.turn.rolled && s.turn.trades === 0 && !p.jail) {
        const offer = proposeTrade(s, seat);
        if (offer) return { type: 'proposeTrade', seat, offer };
      }
      if (p.jail && !s.turn.rolled) {
        const early = unownedCount(s) > 6;
        if (early && has('useJailCard')) return has('useJailCard')!;
        if (early && p.cash > 300 + reserve(s, seat) && has('payJailFine')) return has('payJailFine')!;
        return has('roll') ?? null;
      }
      return chooseUnmortgage(s, seat, acts) ?? chooseBuild(s, seat, acts) ?? has('roll') ?? null;
    }
    case 'postRoll': {
      if (s.turn.seat !== seat) return null;
      return chooseUnmortgage(s, seat, acts) ?? chooseBuild(s, seat, acts) ?? has('endTurn') ?? null;
    }
    default:
      return null;
  }
}
