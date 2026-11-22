// State invariants checked by tests and the headless simulator (SPEC §15).
import { groupTiles } from './queries';
import type { State } from './types';
import { isColorGroup, isPromiseGroup, samePromise } from './promises';

export function checkInvariants(s: State): string[] {
  const errors: string[] = [];
  const r = s.rules;
  s.players.forEach((p, i) => {
    if (!Number.isInteger(p.cash)) errors.push(`seat ${i} cash is not an integer: ${p.cash}`);
    // Debts wait outside the cash balance, so cash is never negative, even during raise-money.
    if (p.cash < 0) errors.push(`seat ${i} cash is negative: ${p.cash}`);
    if (p.bankrupt && p.cash !== 0) errors.push(`bankrupt seat ${i} holds cash`);
    if (p.position < 0 || p.position > 39) errors.push(`seat ${i} off the board`);
    if (p.jail && p.position !== 10) errors.push(`seat ${i} jailed off the jail tile`);
  });

  let houses = 0;
  let hotels = 0;
  s.board.tiles.forEach((t, i) => {
    const ts = s.tiles[i];
    if (ts.owner !== null && s.players[ts.owner].bankrupt) errors.push(`tile ${i} owned by bankrupt seat`);
    if (ts.owner !== null && s.seats[ts.owner].kind === 'bankBot') errors.push(`tile ${i} owned by a bank-backed bot`);
    if (ts.buildings < 0 || ts.buildings > 5) errors.push(`tile ${i} has ${ts.buildings} buildings`);
    if (ts.buildings > 0) {
      if (t.type !== 'street') errors.push(`buildings on non-street ${i}`);
      if (ts.mortgaged) errors.push(`buildings on mortgaged tile ${i}`);
      const group = groupTiles(s.board, t.group!);
      if (!group.every((g) => s.tiles[g].owner === ts.owner)) errors.push(`buildings on ${i} without the full set`);
      if (!r.buildWithMortgagedInSet && group.some((g) => s.tiles[g].mortgaged)) errors.push(`buildings in a set with a mortgaged lot (${i})`);
      if (ts.buildings === 5) hotels++;
      else houses += ts.buildings;
    }
    if (ts.mortgaged && ts.owner === null) errors.push(`unowned tile ${i} is mortgaged`);
  });

  if (r.evenBuilding) {
    const groups = new Set(s.board.tiles.filter((t) => t.group).map((t) => t.group!));
    for (const g of groups) {
      const b = groupTiles(s.board, g).map((i) => s.tiles[i].buildings);
      if (Math.max(...b) - Math.min(...b) > 1) errors.push(`uneven building in ${g}: ${b.join('/')}`);
    }
  }

  if (r.houseSupply !== 'unlimited' && houses + s.bank.houses !== r.houseSupply) {
    errors.push(`house supply mismatch: ${houses} placed + ${s.bank.houses} bank ≠ ${r.houseSupply}`);
  }
  if (r.hotelSupply !== 'unlimited' && hotels + s.bank.hotels !== r.hotelSupply) {
    errors.push(`hotel supply mismatch: ${hotels} placed + ${s.bank.hotels} bank ≠ ${r.hotelSupply}`);
  }
  if (s.bank.houses < 0 || s.bank.hotels < 0) errors.push('bank supply negative');

  // Get Out of Jail Free cards: each is either in its deck or held by exactly one player.
  for (const deck of ['chance', 'chest'] as const) {
    const idx = s.decks[deck].findIndex((k) => k.effect.kind === 'getOutOfJail');
    if (idx < 0) continue;
    const inDeck = s.deckOrder[deck].filter((k) => k === idx).length;
    const held = s.players.reduce((n, p) => n + p.gojf.filter((d) => d === deck).length, 0);
    if (inDeck + held !== 1) errors.push(`${deck} jail card count is ${inDeck + held}`);
    if (s.deckOrder[deck].length !== s.decks[deck].length - held) errors.push(`${deck} deck size wrong`);
  }

  if (s.phase === 'debt' && !s.debts.length) errors.push('debt phase without a debt');
  if (s.phase === 'auction' && !s.auction) errors.push('auction phase without an auction');
  if (s.phase === 'buy' && s.pendingBuy === null) errors.push('buy phase without a property');
  // A bankrupt active seat is fine while its estate resolves (auctions, transfers, debts).
  if (s.players[s.turn.seat].bankrupt && ['preRoll', 'buy', 'postRoll', 'trade'].includes(s.phase)) errors.push('active seat is bankrupt');
  if (s.phase === 'trade' && !s.trade) errors.push('trade phase without an offer');
  const pledged = new Set<number>();
  s.players.forEach((p, i) => {
    if (p.bankrupt && p.loans.length) errors.push(`bankrupt seat ${i} still has loans`);
    for (const l of p.loans) {
      if (l.principal <= 0) errors.push(`seat ${i} loan ${l.id} has no principal left`);
      for (const t of l.collateral) {
        if (s.tiles[t].owner !== i) errors.push(`pledged tile ${t} not owned by the borrower`);
        if (s.tiles[t].mortgaged) errors.push(`pledged tile ${t} is mortgaged`);
        if (pledged.has(t)) errors.push(`tile ${t} pledged twice`);
        pledged.add(t);
      }
    }
  });
  s.promises.forEach((pr, k) => {
    if (!(pr.left >= 1 && pr.left <= pr.total)) errors.push(`promise ${pr.id} count ${pr.left}/${pr.total} out of range`);
    if (!isPromiseGroup(pr.group)) errors.push(`promise ${pr.id} has unknown group ${pr.group}`);
    if (pr.kind === 'noBuild' && (!isColorGroup(pr.group) || pr.anchor === undefined)) errors.push(`noBuild promise ${pr.id} needs a color set and an anchor`);
    if (s.promises.findIndex((q) => samePromise(q, pr)) !== k) errors.push(`promise ${pr.id} duplicates another`);
  });
  return errors;
}
