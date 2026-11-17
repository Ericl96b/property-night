// Field definitions for the rules editor (SPEC §5, §7). One row per setting, grouped by area.
import type { Rules } from '../engine';

export type FieldKind = 'number' | 'money' | 'percent' | 'select' | 'toggle';

export interface RuleField {
  key: keyof Rules;
  area: string;
  label: string;
  kind: FieldKind;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string }[];
  /** Show only when this returns true (e.g. loan settings when loans are on). */
  showIf?: (r: Rules) => boolean;
  help?: string;
}

const yes = (r: Rules) => r.loans;

export const RULE_FIELDS: RuleField[] = [
  { key: 'startingCash', area: 'Money', label: 'Starting cash', kind: 'money', min: 0, max: 1_000_000, step: 100, help: 'Presets: $1,000 / $1,500 / $2,000 / $2,500 / $5,000, or any amount.' },
  { key: 'goSalary', area: 'Money', label: 'GO salary', kind: 'money', min: 0, max: 100_000, step: 50 },
  {
    key: 'landOnGo',
    area: 'Money',
    label: 'Landing exactly on GO',
    kind: 'select',
    options: [
      { value: 'normal', label: 'Normal salary' },
      { value: 'double', label: 'Double salary' },
      { value: 'custom', label: 'Custom amount' },
    ],
  },
  { key: 'landOnGoAmount', area: 'Money', label: 'Custom landing-on-GO amount', kind: 'money', min: 0, max: 100_000, step: 50, showIf: (r) => r.landOnGo === 'custom' },
  {
    key: 'incomeTaxMode',
    area: 'Money',
    label: 'Income Tax',
    kind: 'select',
    options: [
      { value: 'flat', label: 'Flat amount' },
      { value: 'percent', label: '% of net worth' },
      { value: 'lower', label: 'Player pays the lower' },
    ],
  },
  { key: 'incomeTaxFlat', area: 'Money', label: 'Income Tax flat amount', kind: 'money', min: 0, max: 100_000, step: 10, showIf: (r) => r.incomeTaxMode !== 'percent' },
  { key: 'incomeTaxPercent', area: 'Money', label: 'Income Tax % of net worth', kind: 'percent', min: 0, max: 100, showIf: (r) => r.incomeTaxMode !== 'flat' },
  { key: 'luxuryTax', area: 'Money', label: 'Luxury Tax', kind: 'money', min: 0, max: 100_000, step: 10 },

  {
    key: 'declinedProperty',
    area: 'Buying',
    label: 'Declined property',
    kind: 'select',
    options: [
      { value: 'auction', label: 'Goes to auction' },
      { value: 'unowned', label: 'Stays unowned' },
    ],
  },
  { key: 'auctionOnly', area: 'Buying', label: 'Auction-only mode (every unowned property landed on is auctioned)', kind: 'toggle' },
  {
    key: 'auctionStart',
    area: 'Buying',
    label: 'Auction start bid',
    kind: 'select',
    options: [
      { value: 'one', label: '$1' },
      { value: 'pct10', label: '10% of price' },
      { value: 'pct50', label: '50% of price' },
      { value: 'custom', label: 'Custom' },
    ],
  },
  { key: 'auctionStartCustom', area: 'Buying', label: 'Custom start bid', kind: 'money', min: 1, max: 100_000, step: 10, showIf: (r) => r.auctionStart === 'custom' },
  { key: 'auctionTimer', area: 'Buying', label: 'Auction timer (seconds, resets on each bid; 0 = off, pass to exit)', kind: 'number', min: 0, max: 30 },

  { key: 'evenBuilding', area: 'Building', label: 'Even building', kind: 'toggle' },
  { key: 'houseSupply', area: 'Building', label: 'House supply (blank for unlimited)', kind: 'number', min: 0, max: 999 },
  { key: 'hotelSupply', area: 'Building', label: 'Hotel supply (blank for unlimited)', kind: 'number', min: 0, max: 999 },
  {
    key: 'shortageHandling',
    area: 'Building',
    label: 'Building shortage',
    kind: 'select',
    options: [
      { value: 'auction', label: 'Auction scarce buildings' },
      { value: 'firstCome', label: 'First come, first served' },
    ],
  },
  {
    key: 'buildTiming',
    area: 'Building',
    label: 'When you can build',
    kind: 'select',
    options: [
      { value: 'anyTime', label: 'Any legal time' },
      { value: 'ownTurn', label: 'Own turn only' },
    ],
  },
  { key: 'buildWithMortgagedInSet', area: 'Building', label: 'Build on a set with a mortgaged lot', kind: 'toggle' },
  { key: 'sellBackPercent', area: 'Building', label: 'Sell-back value (% of cost)', kind: 'percent', min: 0, max: 100 },

  { key: 'rentInJail', area: 'Rent', label: 'Collect rent while in jail', kind: 'toggle' },
  { key: 'unimprovedSetMultiplier', area: 'Rent', label: 'Unimproved full set multiplier', kind: 'number', min: 1, max: 10, step: 0.5 },

  { key: 'jailFine', area: 'Jail', label: 'Fine', kind: 'money', min: 0, max: 10_000, step: 10 },
  { key: 'maxJailTurns', area: 'Jail', label: 'Max turns in jail', kind: 'number', min: 1, max: 5 },
  { key: 'doublesRelease', area: 'Jail', label: 'Doubles release you', kind: 'toggle' },
  { key: 'threeDoublesJail', area: 'Jail', label: 'Three doubles send you to jail', kind: 'toggle' },

  {
    key: 'freeParking',
    area: 'Free Parking',
    label: 'Behavior',
    kind: 'select',
    options: [
      { value: 'nothing', label: 'Nothing' },
      { value: 'pot', label: 'Pot of taxes and fines' },
      { value: 'potSeed', label: 'Pot + seed' },
      { value: 'fixed', label: 'Fixed bonus' },
    ],
  },
  { key: 'freeParkingSeed', area: 'Free Parking', label: 'Pot seed', kind: 'money', min: 0, max: 100_000, step: 50, showIf: (r) => r.freeParking === 'potSeed' },
  { key: 'freeParkingBonus', area: 'Free Parking', label: 'Fixed bonus', kind: 'money', min: 0, max: 100_000, step: 50, showIf: (r) => r.freeParking === 'fixed' },

  { key: 'mortgagePercent', area: 'Mortgage', label: 'Mortgage value (% of price)', kind: 'percent', min: 0, max: 100 },
  { key: 'unmortgageInterestPercent', area: 'Mortgage', label: 'Unmortgage interest (%)', kind: 'percent', min: 0, max: 100 },
  {
    key: 'receiveMortgaged',
    area: 'Mortgage',
    label: 'Receiving a mortgaged property',
    kind: 'select',
    options: [
      { value: 'interest', label: 'Pay 10% now, unmortgage now or later' },
      { value: 'free', label: 'Free transfer' },
    ],
  },

  { key: 'speedDie', area: 'Dice', label: 'Speed die', kind: 'toggle' },
  { key: 'doublesExtraRoll', area: 'Dice', label: 'Doubles grant another roll', kind: 'toggle' },

  { key: 'tradingAllowed', area: 'Trading', label: 'Trading allowed', kind: 'toggle' },
  { key: 'promisesAllowed', area: 'Trading', label: 'Promises in trades', kind: 'toggle', showIf: (r) => r.tradingAllowed },

  { key: 'loans', area: 'Loans', label: 'Bank loans', kind: 'toggle' },
  {
    key: 'loanLimitMode',
    area: 'Loans',
    label: 'Loan limit',
    kind: 'select',
    showIf: yes,
    options: [
      { value: 'collateral', label: 'Collateral-based' },
      { value: 'fixed', label: 'Fixed cap' },
      { value: 'netWorth', label: '% of net worth' },
    ],
  },
  { key: 'collateralLoanPercent', area: 'Loans', label: 'Collateral loan value (% of pledged price)', kind: 'percent', min: 10, max: 100, showIf: yes },
  { key: 'loanFixedCap', area: 'Loans', label: 'Fixed cap', kind: 'money', min: 0, max: 1_000_000, step: 100, showIf: yes },
  { key: 'loanNetWorthPercent', area: 'Loans', label: '% of net worth cap', kind: 'percent', min: 10, max: 100, showIf: yes },
  { key: 'unsecuredLoans', area: 'Loans', label: 'Allow unsecured loans', kind: 'toggle', showIf: yes },
  { key: 'maxActiveLoans', area: 'Loans', label: 'Max active loans per player', kind: 'number', min: 1, max: 5, showIf: yes },
  { key: 'loanInterestPercent', area: 'Loans', label: 'Interest per GO pass (% of remaining principal)', kind: 'percent', min: 0, max: 50, showIf: yes },
  { key: 'loanTermMin', area: 'Loans', label: 'Shortest term (GO passes)', kind: 'number', min: 1, max: 20, showIf: yes },
  { key: 'loanTermMax', area: 'Loans', label: 'Longest term (GO passes)', kind: 'number', min: 1, max: 20, showIf: yes },
  { key: 'noBuildWithLoan', area: 'Loans', label: 'No building while a loan is unpaid', kind: 'toggle', showIf: yes },
  {
    key: 'seizureValue',
    area: 'Loans',
    label: 'Collateral seizure value',
    kind: 'select',
    showIf: yes,
    options: [
      { value: 'purchasePlusBuildings', label: 'Purchase price + building sell-back' },
      { value: 'purchase', label: 'Purchase price' },
      { value: 'mortgagePlusBuildings', label: 'Mortgage value + building sell-back' },
    ],
  },
  {
    key: 'seizedPropertyTo',
    area: 'Loans',
    label: 'Seized property goes to',
    kind: 'select',
    showIf: yes,
    options: [
      { value: 'auction', label: 'Auction' },
      { value: 'unowned', label: 'Unowned' },
    ],
  },

  {
    key: 'bankruptToBank',
    area: 'Bankruptcy',
    label: 'Owed to the bank',
    kind: 'select',
    options: [
      { value: 'auction', label: 'Properties auctioned' },
      { value: 'unowned', label: 'Returned unowned' },
    ],
  },
];

export const RULE_AREAS = [...new Set(RULE_FIELDS.map((f) => f.area))];

/** Clamp and type-correct a field value. */
export function coerce(f: RuleField, raw: unknown): unknown {
  if (f.kind === 'toggle') return !!raw;
  if (f.kind === 'select') {
    const opt = f.options!.find((o) => String(o.value) === String(raw));
    return opt ? opt.value : f.options![0].value;
  }
  if ((f.key === 'houseSupply' || f.key === 'hotelSupply') && (raw === '' || raw === null || raw === 'unlimited')) return 'unlimited';
  let n = Number(raw);
  if (!Number.isFinite(n)) n = f.min ?? 0;
  if (f.kind !== 'number' || !f.step || f.step >= 1) n = Math.round(n);
  if (f.min !== undefined) n = Math.max(f.min, n);
  if (f.max !== undefined) n = Math.min(f.max, n);
  return n;
}
