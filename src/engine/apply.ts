// apply(state, action) → { state, events } (SPEC §12). Pure and deterministic: the input state
// is never mutated, all randomness comes from the seeded RNG stored in the state.
import type { DeckId } from './cards';
import { nextInt, rollDie } from './rng';
import {
  buildBlocker,
  buildingCounts,
  buildingSellValue,
  groupTiles,
  isBankBot,
  isOwnable,
  liquidationValue,
  mortgageBlocker,
  mortgageValue,
  netWorth,
  rentFor,
  sellBlocker,
  unmortgageBlocker,
  unmortgageCost,
  unmortgageInterest,
  type RentMods,
} from './queries';
import { cloneState } from './state';
import { validateOffer } from './trade';
import { EngineError, SPEED_BUS, SPEED_MR, type Action, type ApplyResult, type Creditor, type GameEvent, type State, type TradeOffer } from './types';

interface Ctx {
  s: State;
  ev: GameEvent[];
}

const fail = (msg: string): never => {
  throw new EngineError(msg);
};

function log(c: Ctx, seat: number | null, text: string): void {
  c.s.log.push({ turn: c.s.turnNumber, seat, text });
}

const name = (c: Ctx, seat: number) => c.s.seats[seat].name;
/** Every player's cash right after a payment (lets the UI tick counters precisely). */
const cashSnap = (c: Ctx) => c.s.players.map((p) => p.cash);
const tileName = (c: Ctx, tile: number) => c.s.board.tiles[tile].name;

// ---- money ---------------------------------------------------------------------------------

function credit(c: Ctx, seat: number, amount: number): void {
  if (isBankBot(c.s, seat)) return; // bank-backed bots collect nothing
  c.s.players[seat].cash += amount;
}

/** Owe `amount`; settled immediately if affordable, otherwise the debt waits for raise-money. */
function addDebt(c: Ctx, from: number, to: Creditor, amount: number, reason: string, opts: { tile?: number; pot?: boolean; rent?: boolean } = {}): void {
  if (amount <= 0) return;
  if (typeof to === 'number' && (isBankBot(c.s, to) || c.s.players[to].bankrupt)) return;
  if (isBankBot(c.s, from)) {
    // Unlimited money: the bank pays on the bank-backed bot's behalf.
    if (typeof to === 'number') credit(c, to, amount);
    c.ev.push({ type: 'payment', cash: cashSnap(c), from, to, amount, reason, tile: opts.tile });
    return;
  }
  c.s.debts.push({ from, to, amount, reason, ...opts });
}

function settle(c: Ctx, i: number): void {
  const d = c.s.debts[i];
  const p = c.s.players[d.from];
  p.cash -= d.amount;
  if (d.to === 'bank') {
    if (d.pot && (c.s.rules.freeParking === 'pot' || c.s.rules.freeParking === 'potSeed')) c.s.freeParkingPot += d.amount;
  } else {
    credit(c, d.to, d.amount);
    if (d.rent) {
      p.stats.rentPaid += d.amount;
      c.s.players[d.to].stats.rentReceived += d.amount;
    }
  }
  c.ev.push({ type: 'payment', cash: cashSnap(c), from: d.from, to: d.to, amount: d.amount, reason: d.reason, tile: d.tile });
  log(c, d.from, `${name(c, d.from)} paid $${d.amount} ${d.to === 'bank' ? 'to the bank' : `to ${name(c, d.to)}`} (${d.reason})`);
  c.s.debts.splice(i, 1);
}

// ---- movement and landing -------------------------------------------------------------------

function salaryFor(c: Ctx, landedOnGo: boolean): number {
  const r = c.s.rules;
  if (!landedOnGo) return r.goSalary;
  if (r.landOnGo === 'double') return r.goSalary * 2;
  if (r.landOnGo === 'custom') return r.landOnGoAmount;
  return r.goSalary;
}

function moveForward(c: Ctx, seat: number, steps: number, direct: boolean): number {
  const p = c.s.players[seat];
  const from = p.position;
  const to = (from + steps) % 40;
  p.position = to;
  c.ev.push({ type: 'moved', seat, from, to, steps, direct });
  if (from + steps >= 40) p.lapped = true;
  if (from + steps >= 40 && !isBankBot(c.s, seat)) {
    const amount = salaryFor(c, to === 0);
    credit(c, seat, amount);
    c.ev.push({ type: 'passedGo', seat, amount });
    log(c, seat, `${name(c, seat)} collected $${amount} at GO`);
  }
  return to;
}

function moveTo(c: Ctx, seat: number, target: number): number {
  const from = c.s.players[seat].position;
  const steps = (target - from + 40) % 40 || 40;
  return moveForward(c, seat, steps, true);
}

function sendToJail(c: Ctx, seat: number, reason: 'tile' | 'card' | 'doubles'): void {
  if (isBankBot(c.s, seat)) return; // bank-backed bots never go to jail
  const p = c.s.players[seat];
  const from = p.position;
  p.position = 10;
  p.jail = { attempts: 0 };
  c.s.turn.extraRoll = false;
  c.s.turn.rolled = true;
  c.ev.push({ type: 'moved', seat, from, to: 10, steps: 0, direct: true });
  c.ev.push({ type: 'jailed', seat, reason });
  log(c, seat, `${name(c, seat)} went to jail`);
}

function release(c: Ctx, seat: number, how: 'fine' | 'card' | 'doubles' | 'maxTurns'): void {
  c.s.players[seat].jail = null;
  c.ev.push({ type: 'released', seat, how });
}

function diceTotal(c: Ctx): number {
  const d = c.s.turn.dice;
  return d ? d[0] + d[1] : 0;
}

function landOn(c: Ctx, seat: number, tile: number, mods: RentMods = {}): void {
  const s = c.s;
  const t = s.board.tiles[tile];
  const bankBot = isBankBot(s, seat);
  if (isOwnable(t)) {
    const ts = s.tiles[tile];
    if (ts.owner === null) {
      if (bankBot || s.rules.auctionOnly) s.auctionQueue.push(tile);
      else s.pendingBuy = tile;
      return;
    }
    if (ts.owner === seat || ts.mortgaged) return;
    const owner = s.players[ts.owner];
    if (owner.bankrupt) return;
    if (owner.jail && !s.rules.rentInJail) return;
    if (s.promises.some((p) => p.kind === 'rentFree' && p.tileId === tile && p.to === seat && p.from === ts.owner)) {
      log(c, seat, `${name(c, seat)} owes no rent on ${t.name} (promise)`);
      return;
    }
    const rent = rentFor(s, tile, diceTotal(c), mods);
    addDebt(c, seat, ts.owner, rent, `rent on ${t.name}`, { tile, rent: true });
    return;
  }
  switch (t.type) {
    case 'tax': {
      let amount = t.taxAmount ?? 0;
      if (t.tax === 'income') {
        const r = s.rules;
        const pct = Math.round((netWorth(s, seat) * r.incomeTaxPercent) / 100);
        amount = r.incomeTaxMode === 'flat' ? r.incomeTaxFlat : r.incomeTaxMode === 'percent' ? pct : Math.min(r.incomeTaxFlat, pct);
      } else if (t.tax === 'luxury') amount = s.rules.luxuryTax;
      addDebt(c, seat, 'bank', amount, t.name, { tile, pot: true });
      return;
    }
    case 'chance':
    case 'chest':
      if (!bankBot) drawCard(c, seat, t.type);
      return;
    case 'goToJail':
      sendToJail(c, seat, 'tile');
      return;
    case 'freeParking': {
      const fp = s.rules.freeParking;
      if (bankBot || fp === 'nothing') return;
      const amount = fp === 'fixed' ? s.rules.freeParkingBonus : s.freeParkingPot;
      if (amount > 0) {
        credit(c, seat, amount);
        c.ev.push({ type: 'payment', cash: cashSnap(c), from: 'bank', to: seat, amount, reason: 'Free Parking' });
        log(c, seat, `${name(c, seat)} collected $${amount} on Free Parking`);
      }
      if (fp !== 'fixed') s.freeParkingPot = fp === 'potSeed' ? s.rules.freeParkingSeed : 0;
      return;
    }
    default:
      return;
  }
}

function drawCard(c: Ctx, seat: number, deck: DeckId): void {
  const s = c.s;
  const order = s.deckOrder[deck];
  if (!order.length) return;
  const index = order.shift()!;
  const card = s.decks[deck][index];
  c.ev.push({ type: 'cardDrawn', seat, deck, index, text: card.text });
  log(c, seat, `${name(c, seat)} drew: ${card.text}`);
  const e = card.effect;
  if (e.kind === 'getOutOfJail') {
    s.players[seat].gojf.push(deck);
    return; // held, not returned to the deck
  }
  order.push(index);
  const others = s.players.map((_, i) => i).filter((i) => i !== seat && !s.players[i].bankrupt && !isBankBot(s, i));
  switch (e.kind) {
    case 'collect':
      credit(c, seat, e.amount);
      c.ev.push({ type: 'payment', cash: cashSnap(c), from: 'bank', to: seat, amount: e.amount, reason: 'card' });
      return;
    case 'pay':
      addDebt(c, seat, 'bank', e.amount, 'card', { pot: true });
      return;
    case 'collectFromEach':
      for (const o of others) addDebt(c, o, seat, e.amount, 'card');
      return;
    case 'payEach':
      for (const o of others) addDebt(c, seat, o, e.amount, 'card');
      return;
    case 'moveTo':
      landOn(c, seat, moveTo(c, seat, e.tile));
      return;
    case 'nearestRailroad':
    case 'nearestUtility': {
      const type = e.kind === 'nearestRailroad' ? 'railroad' : 'utility';
      const pos = s.players[seat].position;
      let target = pos;
      for (let k = 1; k <= 40; k++) {
        const i = (pos + k) % 40;
        if (s.board.tiles[i].type === type) {
          target = i;
          break;
        }
      }
      const to = moveTo(c, seat, target);
      if (type === 'railroad') landOn(c, seat, to, { railroadMultiplier: 2 });
      else {
        const ts = s.tiles[to];
        if (ts.owner !== null && ts.owner !== seat && !ts.mortgaged) {
          const d: [number, number] = [rollDie(s.rng), rollDie(s.rng)];
          c.ev.push({ type: 'diceRolled', seat, dice: d, doubles: false });
          landOn(c, seat, to, { utilityRollTotal: d[0] + d[1] });
        } else landOn(c, seat, to);
      }
      return;
    }
    case 'back': {
      const p = s.players[seat];
      const from = p.position;
      p.position = (from - e.spaces + 40) % 40;
      c.ev.push({ type: 'moved', seat, from, to: p.position, steps: -e.spaces, direct: false });
      landOn(c, seat, p.position);
      return;
    }
    case 'goToJail':
      sendToJail(c, seat, 'card');
      return;
    case 'repairs': {
      const { houses, hotels } = buildingCounts(s, seat);
      addDebt(c, seat, 'bank', houses * e.perHouse + hotels * e.perHotel, 'repairs', { pot: true });
      return;
    }
  }
}

// ---- auctions ------------------------------------------------------------------------------

function auctionMin(c: Ctx, tile: number): number {
  const r = c.s.rules;
  const price = c.s.board.tiles[tile].price ?? 0;
  switch (r.auctionStart) {
    case 'pct10':
      return Math.max(1, Math.ceil(price * 0.1));
    case 'pct50':
      return Math.max(1, Math.ceil(price * 0.5));
    case 'custom':
      return Math.max(1, r.auctionStartCustom);
    default:
      return 1;
  }
}

function startAuction(c: Ctx, tile: number): boolean {
  const s = c.s;
  const n = s.players.length;
  const active: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (s.turn.seat + k) % n;
    if (!s.players[i].bankrupt && !isBankBot(s, i)) active.push(i);
  }
  if (!active.length) return false;
  s.auction = { tile, highBid: 0, highBidder: null, active, minBid: auctionMin(c, tile) };
  c.ev.push({ type: 'auctionStarted', tile, minBid: s.auction.minBid });
  log(c, null, `${tileName(c, tile)} goes to auction`);
  return true;
}

function endAuction(c: Ctx): void {
  const s = c.s;
  const a = s.auction!;
  s.auction = null;
  if (a.kind === 'house' || a.kind === 'hotel') {
    endBuildingAuction(c, a);
    return;
  }
  if (a.highBidder !== null) {
    const w = a.highBidder;
    s.players[w].cash -= a.highBid;
    s.tiles[a.tile].owner = w;
    s.players[w].stats.auctionBuys++;
    c.ev.push({ type: 'propertyTransferred', tile: a.tile, from: null, to: w });
    log(c, w, `${name(c, w)} won ${tileName(c, a.tile)} at auction for $${a.highBid}`);
  } else log(c, null, `No bids: ${tileName(c, a.tile)} stays unowned`);
  c.ev.push({ type: 'auctionEnded', tile: a.tile, winner: a.highBidder, amount: a.highBid });
}

function checkAuctionEnd(c: Ctx): void {
  const a = c.s.auction!;
  const othersLeft = a.active.filter((i) => i !== a.highBidder);
  if ((a.highBidder !== null && othersLeft.length === 0) || a.active.length === 0) endAuction(c);
}

// ---- scarce buildings: shortage auction (SPEC §5 "Shortage handling") -------------------------

/** Would `seat` be able to build one `kind` somewhere right now (ignoring turn and timing)? Best tile or null. */
function buildableTile(s: State, seat: number, kind: 'house' | 'hotel'): number | null {
  let best: number | null = null;
  let bestRent = -1;
  for (const t of s.board.tiles) {
    if (t.type !== 'street' || s.tiles[t.index].owner !== seat) continue;
    const b = s.tiles[t.index].buildings;
    if ((kind === 'hotel') !== (b === 4) || b >= 5) continue;
    const g = groupTiles(s.board, t.group!);
    if (!g.every((i) => s.tiles[i].owner === seat)) continue;
    if (!s.rules.buildWithMortgagedInSet && g.some((i) => s.tiles[i].mortgaged)) continue;
    if (s.rules.evenBuilding && b > Math.min(...g.map((i) => s.tiles[i].buildings))) continue;
    if (s.players[seat].cash < (t.houseCost ?? 0)) continue;
    const gain = t.rents![b + 1] - t.rents![b];
    if (gain > bestRent) {
      bestRent = gain;
      best = t.index;
    }
  }
  return best;
}

/** Start a building auction instead of building when supply is scarce; returns true if started. */
function maybeShortageAuction(c: Ctx, seat: number, tile: number): boolean {
  const s = c.s;
  if (s.rules.shortageHandling !== 'auction') return false;
  const kind: 'house' | 'hotel' = s.tiles[tile].buildings === 4 ? 'hotel' : 'house';
  const supply = kind === 'hotel' ? s.bank.hotels : s.bank.houses;
  const n = s.players.length;
  const bidders: number[] = [];
  const buildFor: Record<number, number> = {};
  for (let k = 0; k < n; k++) {
    const i = (seat + k) % n;
    if (s.players[i].bankrupt || isBankBot(s, i)) continue;
    const t = i === seat ? tile : buildableTile(s, i, kind);
    if (t === null) continue;
    bidders.push(i);
    buildFor[i] = t;
  }
  if (bidders.length < 2 || supply >= bidders.length) return false;
  s.auction = { tile, highBid: 0, highBidder: null, active: bidders, minBid: 1, kind, buildFor };
  c.ev.push({ type: 'auctionStarted', tile, minBid: 1 });
  log(c, seat, `Only ${supply} ${kind === 'hotel' ? 'hotel' : 'house'}${supply === 1 ? '' : 's'} left: the next one goes to auction`);
  return true;
}

function placeBuilding(c: Ctx, seat: number, tile: number): void {
  const s = c.s;
  const ts = s.tiles[tile];
  if (ts.buildings === 4) {
    s.bank.hotels--;
    s.bank.houses += 4;
  } else s.bank.houses--;
  ts.buildings++;
  c.ev.push({ type: 'built', seat, tile, buildings: ts.buildings });
  log(c, seat, `${name(c, seat)} built ${ts.buildings === 5 ? 'a hotel' : 'a house'} on ${tileName(c, tile)}`);
}

function endBuildingAuction(c: Ctx, a: NonNullable<State['auction']>): void {
  const s = c.s;
  const kind = a.kind as 'house' | 'hotel';
  c.ev.push({ type: 'auctionEnded', tile: a.tile, winner: a.highBidder, amount: a.highBid, kind });
  if (a.highBidder === null) {
    log(c, null, `No bids: the ${kind} stays in the bank`);
    return;
  }
  const w = a.highBidder;
  // Build where the winner wanted, or anywhere still legal for them.
  const wanted = a.buildFor?.[w];
  const stillOk = wanted !== undefined && buildableTile({ ...s, players: s.players.map((p, i) => (i === w ? { ...p, cash: Infinity } : p)) }, w, kind) !== null;
  const target = stillOk ? wanted! : null;
  const supplyOk = kind === 'hotel' ? s.bank.hotels > 0 : s.bank.houses > 0;
  if (target === null || !supplyOk) {
    log(c, w, `${name(c, w)} won the ${kind} but can no longer place it; no charge`);
    return;
  }
  s.players[w].cash -= a.highBid;
  c.ev.push({ type: 'payment', cash: cashSnap(c), from: w, to: 'bank', amount: a.highBid, reason: `${kind} auction` });
  log(c, w, `${name(c, w)} won a ${kind} at auction for $${a.highBid}`);
  placeBuilding(c, w, target);
}

// ---- speed die (SPEC §5 "Speed die") -------------------------------------------------------------

/** "Mr. Monopoly": advance to the next unowned property, else the next one where rent is due. */
function mrMonopolyMove(c: Ctx, seat: number): void {
  const s = c.s;
  const pos = s.players[seat].position;
  let target: number | null = null;
  for (const wantUnowned of [true, false]) {
    for (let k = 1; k < 40 && target === null; k++) {
      const i = (pos + k) % 40;
      const t = s.board.tiles[i];
      if (!isOwnable(t)) continue;
      const o = s.tiles[i].owner;
      if (wantUnowned ? o === null : o !== null && o !== seat && !s.tiles[i].mortgaged && !s.players[o].bankrupt) target = i;
    }
    if (target !== null) break;
  }
  if (target === null) return;
  log(c, seat, `${name(c, seat)} follows the speed die to ${tileName(c, target)}`);
  landOn(c, seat, moveTo(c, seat, target));
}

// ---- bankruptcy and game end ----------------------------------------------------------------

function bankrupt(c: Ctx, seat: number, creditor: Creditor): void {
  const s = c.s;
  const p = s.players[seat];
  // Buildings go back to the bank at the sell-back value.
  for (const t of s.board.tiles) {
    const ts = s.tiles[t.index];
    if (ts.owner !== seat || ts.buildings === 0) continue;
    p.cash += ts.buildings * buildingSellValue(s, t.index);
    if (ts.buildings === 5) s.bank.hotels++;
    else s.bank.houses += ts.buildings;
    ts.buildings = 0;
  }
  const owned = s.board.tiles.filter((t) => s.tiles[t.index].owner === seat).map((t) => t.index);
  const toPlayer = typeof creditor === 'number' && !s.players[creditor].bankrupt;
  if (toPlayer) {
    const cr = creditor as number;
    credit(c, cr, p.cash);
    if (p.cash > 0) c.ev.push({ type: 'payment', cash: cashSnap(c), from: seat, to: cr, amount: p.cash, reason: 'bankruptcy' });
    const mortgaged: number[] = [];
    for (const i of owned) {
      s.tiles[i].owner = cr;
      c.ev.push({ type: 'propertyTransferred', tile: i, from: seat, to: cr });
      if (s.tiles[i].mortgaged) mortgaged.push(i);
    }
    if (mortgaged.length && s.rules.receiveMortgaged === 'interest') s.transfers.push({ to: cr, tiles: mortgaged });
    s.players[cr].gojf.push(...p.gojf);
  } else {
    for (const i of owned) {
      s.tiles[i].owner = null;
      s.tiles[i].mortgaged = false;
      c.ev.push({ type: 'propertyTransferred', tile: i, from: seat, to: null });
      if (s.rules.bankruptToBank === 'auction') s.auctionQueue.push(i);
    }
    for (const d of p.gojf) s.deckOrder[d].push(s.decks[d].findIndex((k) => k.effect.kind === 'getOutOfJail'));
  }
  p.cash = 0;
  p.gojf = [];
  p.jail = null;
  p.bankrupt = true;
  s.debts = s.debts.filter((d) => d.from !== seat && d.to !== seat);
  s.transfers = s.transfers.filter((t) => t.to !== seat);
  if (s.pendingBuy !== null && s.turn.seat === seat) s.pendingBuy = null;
  if (s.trade && (s.trade.from === seat || s.trade.to === seat)) s.trade = null;
  if (s.auction) {
    const a = s.auction;
    a.active = a.active.filter((i) => i !== seat);
    if (a.highBidder === seat) {
      a.highBidder = null;
      a.highBid = 0;
    }
    checkAuctionEnd(c);
  }
  c.ev.push({ type: 'bankrupt', seat, creditor });
  log(c, seat, `${name(c, seat)} is bankrupt${toPlayer ? ` to ${name(c, creditor as number)}` : ''}`);
}

function checkWin(c: Ctx): boolean {
  const s = c.s;
  const seats = s.seats.map((_, i) => i);
  const contenders = seats.filter((i) => s.seats[i].kind !== 'bankBot');
  const alive = contenders.filter((i) => !s.players[i].bankrupt);
  const humans = seats.filter((i) => s.seats[i].kind === 'human');
  const aliveHumans = humans.filter((i) => !s.players[i].bankrupt);
  let over = false;
  let winner: number | null = null;
  if (humans.length >= 2) {
    over = aliveHumans.length <= 1;
    winner = aliveHumans[0] ?? null;
  } else if (humans.length === 1) {
    if (aliveHumans.length === 0) over = true;
    else if (alive.length === 1) {
      over = true;
      winner = alive[0];
    }
  } else {
    over = alive.length <= 1;
    winner = alive[0] ?? null;
  }
  if (!over) return false;
  s.phase = 'gameOver';
  s.winner = winner;
  s.auction = null;
  s.debts = [];
  c.ev.push({ type: 'gameOver', winner });
  log(c, winner, winner === null ? 'Game over' : `${name(c, winner)} wins!`);
  return true;
}

// ---- trades and promises (SPEC §6) -------------------------------------------------------------

/** Promises are void once the tile changes owner (or either side is out). */
function voidPromises(c: Ctx): void {
  const s = c.s;
  const keep = s.promises.filter((p) => s.tiles[p.tileId].owner === p.from && !s.players[p.from].bankrupt && !s.players[p.to].bankrupt);
  if (keep.length === s.promises.length) return;
  for (const p of s.promises) if (!keep.includes(p)) c.ev.push({ type: 'promiseEnded', promise: { ...p }, reason: 'void' });
  s.promises = keep;
}

function executeTrade(c: Ctx, o: TradeOffer): void {
  const s = c.s;
  const why = validateOffer(s, o);
  if (why) fail(why);
  const moveSide = (giver: number, taker: number, side: TradeOffer['give']) => {
    const mortgaged: number[] = [];
    for (const tile of side.tiles) {
      s.tiles[tile].owner = taker;
      c.ev.push({ type: 'propertyTransferred', tile, from: giver, to: taker });
      if (s.tiles[tile].mortgaged) mortgaged.push(tile);
    }
    if (mortgaged.length && s.rules.receiveMortgaged === 'interest') s.transfers.push({ to: taker, tiles: mortgaged });
    if (side.cash > 0) {
      s.players[giver].cash -= side.cash;
      s.players[taker].cash += side.cash;
      c.ev.push({ type: 'payment', cash: cashSnap(c), from: giver, to: taker, amount: side.cash, reason: 'trade' });
    }
    for (let k = 0; k < side.gojf; k++) s.players[taker].gojf.push(s.players[giver].gojf.shift()!);
  };
  moveSide(o.from, o.to, o.give);
  moveSide(o.to, o.from, o.get);
  for (const p of o.promises) s.promises.push({ ...p, id: s.nextPromiseId++ });
  c.ev.push({ type: 'tradeAccepted', offer: o });
  log(c, o.to, `${name(c, o.to)} accepted a trade with ${name(c, o.from)}`);
}

// ---- turn flow --------------------------------------------------------------------------------

function nextTurn(c: Ctx): void {
  const s = c.s;
  const ended = s.turn.seat;
  c.ev.push({ type: 'turnEnded', seat: ended });
  for (const p of s.promises) if (p.to === ended) p.turnsLeft--;
  for (const p of s.promises.filter((x) => x.turnsLeft <= 0)) c.ev.push({ type: 'promiseEnded', promise: { ...p }, reason: 'expired' });
  s.promises = s.promises.filter((p) => p.turnsLeft > 0);
  const n = s.players.length;
  let next = s.turn.seat;
  for (let k = 1; k <= n; k++) {
    const i = (s.turn.seat + k) % n;
    if (!s.players[i].bankrupt) {
      next = i;
      break;
    }
  }
  s.turn = { seat: next, doubles: 0, rolled: false, extraRoll: false, dice: null, trades: 0, speed: null, speedChoice: null, mrMonopoly: false };
  s.turnNumber++;
  s.phase = 'preRoll';
  c.ev.push({ type: 'turnStarted', seat: next });
}

/** Resolve everything pending in order, then settle on the next phase that needs input. */
function advance(c: Ctx): void {
  const s = c.s;
  for (let guard = 0; guard < 500; guard++) {
    if (s.phase === 'gameOver') return;
    voidPromises(c);
    if (checkWin(c)) return;
    if (s.transfers.length) {
      s.phase = 'mortgagedTransfer';
      return;
    }
    if (s.debts.length) {
      const d = s.debts[0];
      if (s.players[d.from].bankrupt || (typeof d.to === 'number' && s.players[d.to].bankrupt)) {
        s.debts.shift();
        continue;
      }
      if (s.players[d.from].cash >= d.amount) {
        settle(c, 0);
        continue;
      }
      if (s.phase !== 'debt') c.ev.push({ type: 'debtPending', debt: { ...d } });
      s.phase = 'debt';
      return;
    }
    if (s.auction) {
      s.phase = 'auction';
      return;
    }
    if (s.auctionQueue.length) {
      if (startAuction(c, s.auctionQueue.shift()!)) {
        s.phase = 'auction';
        return;
      }
      continue;
    }
    if (s.trade) {
      s.phase = 'trade';
      return;
    }
    if (s.pendingBuy !== null) {
      s.phase = 'buy';
      return;
    }
    if (s.players[s.turn.seat].bankrupt) {
      nextTurn(c);
      continue;
    }
    if (s.turn.speedChoice) {
      s.phase = 'speedChoice';
      return;
    }
    if (s.turn.mrMonopoly) {
      s.turn.mrMonopoly = false;
      if (!s.players[s.turn.seat].jail) mrMonopolyMove(c, s.turn.seat);
      continue;
    }
    if (s.turn.extraRoll) {
      s.turn.extraRoll = false;
      s.turn.rolled = false;
    }
    s.phase = s.turn.rolled ? 'postRoll' : 'preRoll';
    return;
  }
  fail('advance did not settle');
}

function doRoll(c: Ctx, seat: number): void {
  const s = c.s;
  const p = s.players[seat];
  const dice: [number, number] = [rollDie(s.rng), rollDie(s.rng)];
  const doubles = dice[0] === dice[1];
  s.turn.dice = dice;
  c.ev.push({ type: 'diceRolled', seat, dice, doubles });
  log(c, seat, `${name(c, seat)} rolled ${dice[0]} + ${dice[1]}${doubles ? ' (doubles)' : ''}`);
  const total = dice[0] + dice[1];

  if (p.jail) {
    if (doubles && s.rules.doublesRelease) {
      release(c, seat, 'doubles');
      s.turn.rolled = true; // leaving jail on doubles does not earn another roll
      landOn(c, seat, moveForward(c, seat, total, false));
      return;
    }
    p.jail.attempts++;
    if (p.jail.attempts >= s.rules.maxJailTurns) {
      release(c, seat, 'maxTurns');
      addDebt(c, seat, 'bank', s.rules.jailFine, 'jail fine', { pot: true });
      s.turn.rolled = true;
      landOn(c, seat, moveForward(c, seat, total, false));
      return;
    }
    s.turn.rolled = true;
    return;
  }

  s.turn.doubles = doubles ? s.turn.doubles + 1 : 0;
  if (doubles && s.turn.doubles >= 3 && s.rules.threeDoublesJail && !isBankBot(s, seat)) {
    sendToJail(c, seat, 'doubles');
    return;
  }
  s.turn.rolled = true;
  s.turn.extraRoll = doubles && s.rules.doublesExtraRoll;
  if (s.rules.speedDie && p.lapped) {
    const face = 1 + nextInt(s.rng, 6);
    s.turn.speed = face;
    // Annotate this roll's dice event with the speed die face (one throw, three dice).
    const ev = [...c.ev].reverse().find((e) => e.type === 'diceRolled');
    if (ev && ev.type === 'diceRolled') ev.speed = face;
    if (face <= 3 && dice[0] === face && dice[1] === face) {
      // Triples: move to any space; the turn then ends.
      s.turn.extraRoll = false;
      s.turn.speedChoice = { options: [], anyTile: true };
      log(c, seat, `${name(c, seat)} rolled triples: move anywhere`);
      return;
    }
    if (SPEED_BUS(face)) {
      const options = [...new Set([dice[0], dice[1], total])].sort((x, y) => x - y);
      s.turn.speedChoice = { options, anyTile: false };
      log(c, seat, `${name(c, seat)} rolled the bus: choose a move`);
      return;
    }
    if (face === SPEED_MR) s.turn.mrMonopoly = true;
    else {
      log(c, seat, `${name(c, seat)} adds ${face} from the speed die`);
      landOn(c, seat, moveForward(c, seat, total + face, false));
      return;
    }
  }
  landOn(c, seat, moveForward(c, seat, total, false));
}

// ---- reducer ------------------------------------------------------------------------------------

function requireActive(s: State, seat: number): void {
  if (s.turn.seat !== seat) fail('not your turn');
}

function requirePhase(s: State, ...phases: State['phase'][]): void {
  if (!phases.includes(s.phase)) fail(`not allowed during ${s.phase}`);
}

export function apply(state: State, action: Action): ApplyResult {
  if (state.phase === 'gameOver') fail('the game is over');
  const c: Ctx = { s: cloneState(state), ev: [] };
  const s = c.s;
  const seat = action.seat;
  if (seat >= 0 && (seat >= s.players.length || s.players[seat].bankrupt)) fail('seat is out of the game');

  switch (action.type) {
    case 'roll': {
      requirePhase(s, 'preRoll');
      requireActive(s, seat);
      if (s.turn.rolled) fail('already rolled');
      doRoll(c, seat);
      break;
    }
    case 'payJailFine': {
      requirePhase(s, 'preRoll');
      requireActive(s, seat);
      const p = s.players[seat];
      if (!p.jail || s.turn.rolled) fail('not in jail');
      if (p.cash < s.rules.jailFine) fail('not enough cash');
      p.cash -= s.rules.jailFine;
      if (s.rules.freeParking === 'pot' || s.rules.freeParking === 'potSeed') s.freeParkingPot += s.rules.jailFine;
      c.ev.push({ type: 'payment', cash: cashSnap(c), from: seat, to: 'bank', amount: s.rules.jailFine, reason: 'jail fine' });
      release(c, seat, 'fine');
      log(c, seat, `${name(c, seat)} paid the $${s.rules.jailFine} fine`);
      break;
    }
    case 'useJailCard': {
      requirePhase(s, 'preRoll');
      requireActive(s, seat);
      const p = s.players[seat];
      if (!p.jail || s.turn.rolled) fail('not in jail');
      const deck = p.gojf.shift();
      if (!deck) fail('no Get Out of Jail Free card');
      const idx = s.decks[deck!].findIndex((k) => k.effect.kind === 'getOutOfJail');
      s.deckOrder[deck!].push(idx);
      release(c, seat, 'card');
      log(c, seat, `${name(c, seat)} used a Get Out of Jail Free card`);
      break;
    }
    case 'buy': {
      requirePhase(s, 'buy');
      requireActive(s, seat);
      const tile = s.pendingBuy!;
      const price = s.board.tiles[tile].price ?? 0;
      if (s.players[seat].cash < price) fail('not enough cash');
      s.players[seat].cash -= price;
      s.tiles[tile].owner = seat;
      s.players[seat].stats.directBuys++;
      s.pendingBuy = null;
      c.ev.push({ type: 'bought', seat, tile, price });
      c.ev.push({ type: 'propertyTransferred', tile, from: null, to: seat });
      log(c, seat, `${name(c, seat)} bought ${tileName(c, tile)} for $${price}`);
      break;
    }
    case 'decline': {
      requirePhase(s, 'buy');
      requireActive(s, seat);
      const tile = s.pendingBuy!;
      s.pendingBuy = null;
      log(c, seat, `${name(c, seat)} declined ${tileName(c, tile)}`);
      if (s.rules.declinedProperty === 'auction') s.auctionQueue.push(tile);
      break;
    }
    case 'bid': {
      requirePhase(s, 'auction');
      const a = s.auction!;
      if (!a.active.includes(seat)) fail('not in this auction');
      const min = Math.max(a.minBid, a.highBid + 1);
      if (!Number.isInteger(action.amount) || action.amount < min) fail(`bid at least $${min}`);
      if (action.amount > s.players[seat].cash) fail('bids are capped at your cash');
      a.highBid = action.amount;
      a.highBidder = seat;
      c.ev.push({ type: 'bid', seat, amount: action.amount });
      checkAuctionEnd(c);
      break;
    }
    case 'pass': {
      requirePhase(s, 'auction');
      const a = s.auction!;
      if (!a.active.includes(seat)) fail('not in this auction');
      if (a.highBidder === seat) fail('the high bidder cannot pass');
      a.active = a.active.filter((i) => i !== seat);
      c.ev.push({ type: 'passed', seat });
      checkAuctionEnd(c);
      break;
    }
    case 'auctionTimeout': {
      requirePhase(s, 'auction');
      endAuction(c);
      break;
    }
    case 'build': {
      const why = buildBlocker(s, seat, action.tile);
      if (why) fail(why);
      if (maybeShortageAuction(c, seat, action.tile)) break;
      s.players[seat].cash -= s.board.tiles[action.tile].houseCost ?? 0;
      placeBuilding(c, seat, action.tile);
      break;
    }
    case 'sell': {
      const why = sellBlocker(s, seat, action.tile);
      if (why) fail(why);
      const ts = s.tiles[action.tile];
      const value = buildingSellValue(s, action.tile);
      if (ts.buildings === 5 && s.bank.houses >= 4) {
        // Breaking a hotel takes 4 houses from the bank.
        s.bank.hotels++;
        s.bank.houses -= 4;
        s.players[seat].cash += value;
        ts.buildings = 4;
      } else if (ts.buildings === 5) {
        // House shortage: the hotel cannot be broken into houses, so the whole set is cleared
        // back to the bank at the sell-back value (keeps the set even).
        for (const i of groupTiles(s.board, s.board.tiles[action.tile].group!)) {
          const b = s.tiles[i].buildings;
          if (b === 5) s.bank.hotels++;
          else s.bank.houses += b;
          s.players[seat].cash += b * buildingSellValue(s, i);
          s.tiles[i].buildings = 0;
          if (i !== action.tile && b > 0) c.ev.push({ type: 'sold', seat, tile: i, buildings: 0 });
        }
      } else {
        s.bank.houses++;
        s.players[seat].cash += value;
        ts.buildings--;
      }
      c.ev.push({ type: 'sold', seat, tile: action.tile, buildings: ts.buildings });
      log(c, seat, `${name(c, seat)} sold a building on ${tileName(c, action.tile)}`);
      break;
    }
    case 'mortgage': {
      const why = mortgageBlocker(s, seat, action.tile);
      if (why) fail(why);
      s.tiles[action.tile].mortgaged = true;
      s.players[seat].cash += mortgageValue(s, action.tile);
      c.ev.push({ type: 'mortgaged', seat, tile: action.tile });
      log(c, seat, `${name(c, seat)} mortgaged ${tileName(c, action.tile)}`);
      break;
    }
    case 'unmortgage': {
      const why = unmortgageBlocker(s, seat, action.tile);
      if (why) fail(why);
      s.players[seat].cash -= unmortgageCost(s, action.tile);
      s.tiles[action.tile].mortgaged = false;
      c.ev.push({ type: 'unmortgaged', seat, tile: action.tile });
      log(c, seat, `${name(c, seat)} lifted the mortgage on ${tileName(c, action.tile)}`);
      break;
    }
    case 'mortgagedChoice': {
      requirePhase(s, 'mortgagedTransfer');
      const tr = s.transfers[0];
      if (tr.to !== seat || !tr.tiles.includes(action.tile)) fail('not your decision');
      if (action.unmortgage) {
        const cost = unmortgageCost(s, action.tile);
        if (s.players[seat].cash < cost) fail('not enough cash');
        s.players[seat].cash -= cost;
        s.tiles[action.tile].mortgaged = false;
        c.ev.push({ type: 'unmortgaged', seat, tile: action.tile });
      } else {
        addDebt(c, seat, 'bank', unmortgageInterest(s, action.tile), `interest on ${tileName(c, action.tile)}`);
      }
      tr.tiles = tr.tiles.filter((t) => t !== action.tile);
      if (!tr.tiles.length) s.transfers.shift();
      break;
    }
    case 'declareBankruptcy': {
      requirePhase(s, 'debt');
      const d = s.debts[0];
      if (d.from !== seat) fail('no debt to declare against');
      if (liquidationValue(s, seat) >= d.amount) fail('you can still raise the money');
      bankrupt(c, seat, d.to);
      break;
    }
    case 'forfeit': {
      if (isBankBot(s, seat)) fail('bank-backed bots cannot forfeit');
      log(c, seat, `${name(c, seat)} forfeited`);
      bankrupt(c, seat, 'bank');
      break;
    }
    case 'speedChoice': {
      requirePhase(s, 'speedChoice');
      requireActive(s, seat);
      const sc = s.turn.speedChoice!;
      if (sc.anyTile) {
        const target = action.target;
        if (target === undefined || !Number.isInteger(target) || target < 0 || target > 39) fail('choose a space');
        s.turn.speedChoice = null;
        landOn(c, seat, s.players[seat].position === target ? target : moveTo(c, seat, target!));
      } else {
        if (action.steps === undefined || !sc.options.includes(action.steps)) fail('choose one of the bus moves');
        s.turn.speedChoice = null;
        landOn(c, seat, moveForward(c, seat, action.steps!, false));
      }
      break;
    }
    case 'proposeTrade': {
      requirePhase(s, 'preRoll', 'postRoll');
      requireActive(s, seat);
      if (!s.rules.tradingAllowed) fail('trading is off');
      if (action.offer.from !== seat) fail('you can only propose your own side');
      const why = validateOffer(s, action.offer);
      if (why) fail(why);
      s.trade = action.offer;
      s.turn.trades++;
      c.ev.push({ type: 'tradeProposed', offer: action.offer });
      log(c, seat, `${name(c, seat)} proposed a trade to ${name(c, action.offer.to)}`);
      break;
    }
    case 'acceptTrade': {
      requirePhase(s, 'trade');
      if (s.trade!.to !== seat) fail('not your offer to answer');
      const o = s.trade!;
      s.trade = null;
      executeTrade(c, o);
      break;
    }
    case 'rejectTrade': {
      requirePhase(s, 'trade');
      if (s.trade!.to !== seat) fail('not your offer to answer');
      c.ev.push({ type: 'tradeRejected', offer: s.trade! });
      log(c, seat, `${name(c, seat)} rejected the trade`);
      s.trade = null;
      break;
    }
    case 'counterTrade': {
      requirePhase(s, 'trade');
      const o = s.trade!;
      if (o.to !== seat) fail('not your offer to answer');
      if (action.offer.from !== seat || action.offer.to !== o.from) fail('a counter swaps the two sides');
      const why = validateOffer(s, action.offer);
      if (why) fail(why);
      c.ev.push({ type: 'tradeRejected', offer: o });
      s.trade = action.offer;
      c.ev.push({ type: 'tradeProposed', offer: action.offer });
      log(c, seat, `${name(c, seat)} countered`);
      break;
    }
    case 'cancelTrade': {
      requirePhase(s, 'trade');
      if (s.trade!.from !== seat) fail('not your offer');
      s.trade = null;
      break;
    }
    case 'endTurn': {
      requirePhase(s, 'postRoll');
      requireActive(s, seat);
      nextTurn(c);
      break;
    }
    default:
      fail('unknown action');
  }
  advance(c);
  return { state: s, events: c.ev };
}

