// Bank loans (SPEC §7): pure helpers for limits, schedules and collateral.
import { buildingSellValue, isBankBot, mortgageValue, netWorth } from './queries';
import type { Loan, State } from './types';

export function pledgedTiles(s: State, seat?: number): Set<number> {
  const out = new Set<number>();
  s.players.forEach((p, i) => {
    if (seat !== undefined && i !== seat) return;
    for (const l of p.loans) for (const t of l.collateral) out.add(t);
  });
  return out;
}

export function isPledged(s: State, tile: number): boolean {
  return s.players.some((p) => p.loans.some((l) => l.collateral.includes(tile)));
}

export function outstanding(s: State, seat: number): number {
  return s.players[seat].loans.reduce((n, l) => n + l.principal, 0);
}

/** Can this tile be pledged by its owner? */
export function pledgeBlocker(s: State, seat: number, tile: number): string | null {
  const t = s.board.tiles[tile];
  if (t.price === undefined) return 'not a property';
  if (s.tiles[tile].owner !== seat) return 'not yours';
  if (s.tiles[tile].mortgaged) return 'mortgaged properties cannot be pledged';
  if (isPledged(s, tile)) return 'already pledged';
  return null;
}

/** Collateral value of a set of tiles for a secured loan. */
export function collateralValue(s: State, tiles: number[]): number {
  const pct = s.rules.collateralLoanPercent;
  return tiles.reduce((n, t) => n + Math.floor(((s.board.tiles[t].price ?? 0) * pct) / 100), 0);
}

/** The most a player may borrow now, secured by `collateral` (empty = unsecured). */
export function loanLimit(s: State, seat: number, collateral: number[]): number {
  const r = s.rules;
  const owed = outstanding(s, seat);
  const capFixed = Math.max(0, r.loanFixedCap - owed);
  const capWorth = Math.max(0, Math.floor((netWorth(s, seat) * r.loanNetWorthPercent) / 100) - owed);
  if (collateral.length) {
    if (r.loanLimitMode === 'collateral') return collateralValue(s, collateral);
    return r.loanLimitMode === 'fixed' ? capFixed : capWorth;
  }
  if (!r.unsecuredLoans) return 0;
  return r.loanLimitMode === 'netWorth' ? capWorth : capFixed;
}

export function loanBlocker(s: State, seat: number, amount: number, passes: number, collateral: number[]): string | null {
  const r = s.rules;
  if (!r.loans) return 'bank loans are off';
  if (isBankBot(s, seat)) return 'bank-backed bots never borrow';
  if (s.players[seat].loans.length >= r.maxActiveLoans) return `at most ${r.maxActiveLoans} active loan${r.maxActiveLoans === 1 ? '' : 's'}`;
  if (!Number.isInteger(passes) || passes < r.loanTermMin || passes > r.loanTermMax) return `term must be ${r.loanTermMin}–${r.loanTermMax} GO passes`;
  if (new Set(collateral).size !== collateral.length) return 'duplicate collateral';
  for (const t of collateral) {
    const why = pledgeBlocker(s, seat, t);
    if (why) return `${s.board.tiles[t].name}: ${why}`;
  }
  if (!collateral.length && !r.unsecuredLoans) return 'unsecured loans are off: pledge collateral';
  if (!Number.isInteger(amount) || amount <= 0) return 'choose an amount';
  const limit = loanLimit(s, seat, collateral);
  if (amount > limit) return `the limit is $${limit.toLocaleString('en-US')}`;
  return null;
}

/** This pass's installment: principal ÷ remaining passes + interest on the remaining principal. */
export function installment(l: Loan): { principal: number; interest: number; total: number } {
  const principal = l.passesLeft <= 1 ? l.principal : Math.min(l.principal, Math.ceil(l.principal / l.passesLeft));
  const interest = Math.ceil((l.principal * l.rate) / 100);
  return { principal, interest, total: principal + interest };
}

export interface ScheduleRow {
  pass: number;
  principal: number;
  interest: number;
  total: number;
  remaining: number;
}

/** Full repayment preview for a loan. */
export function schedule(amount: number, passes: number, rate: number): { rows: ScheduleRow[]; totalInterest: number } {
  const rows: ScheduleRow[] = [];
  let loan: Loan = { id: 0, principal: amount, rate, passesLeft: passes, collateral: [], secured: false };
  let totalInterest = 0;
  for (let k = 1; k <= passes && loan.principal > 0; k++) {
    const i = installment(loan);
    totalInterest += i.interest;
    loan = { ...loan, principal: loan.principal - i.principal, passesLeft: loan.passesLeft - 1 };
    rows.push({ pass: k, principal: i.principal, interest: i.interest, total: i.total, remaining: loan.principal });
  }
  return { rows, totalInterest };
}

/** What the bank credits for seizing a pledged tile (per the seizure-value setting). */
export function seizureValue(s: State, tile: number): number {
  const t = s.board.tiles[tile];
  const b = s.tiles[tile].buildings * buildingSellValue(s, tile);
  switch (s.rules.seizureValue) {
    case 'purchase':
      return t.price ?? 0;
    case 'mortgagePlusBuildings':
      return mortgageValue(s, tile) + b;
    default:
      return (t.price ?? 0) + b;
  }
}

/** Extra cash a player could still borrow (for the "can anything cover the debt?" check). */
export function borrowCapacity(s: State, seat: number): number {
  const r = s.rules;
  if (!r.loans || isBankBot(s, seat) || s.players[seat].loans.length >= r.maxActiveLoans) return 0;
  // Beyond what mortgaging would raise: pledging free tiles may lend more than their mortgage value.
  const free = s.board.tiles.filter((t) => !pledgeBlocker(s, seat, t.index)).map((t) => t.index);
  const mortgageSum = free.reduce((n, t) => n + mortgageValue(s, t), 0);
  return Math.max(loanLimit(s, seat, []), loanLimit(s, seat, free) - mortgageSum, 0);
}
