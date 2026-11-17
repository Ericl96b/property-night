// Every rule is a setting (SPEC §5, §7). CLASSIC_RULES is the built-in read-only "Classic"
// preset: the current official rules.

export type IncomeTaxMode = 'flat' | 'percent' | 'lower';
export type FreeParkingMode = 'nothing' | 'pot' | 'potSeed' | 'fixed';
export type AuctionStartMode = 'one' | 'pct10' | 'pct50' | 'custom';
export type LoanLimitMode = 'collateral' | 'fixed' | 'netWorth';

export interface Rules {
  // Money
  startingCash: number;
  goSalary: number;
  landOnGo: 'normal' | 'double' | 'custom';
  landOnGoAmount: number;
  incomeTaxMode: IncomeTaxMode;
  incomeTaxFlat: number;
  incomeTaxPercent: number;
  luxuryTax: number;
  // Buying
  declinedProperty: 'auction' | 'unowned';
  auctionOnly: boolean;
  auctionStart: AuctionStartMode;
  auctionStartCustom: number;
  /** Seconds; 0 = off (pass to exit). The engine is timeless: the UI sends `auctionTimeout`. */
  auctionTimer: number;
  // Building
  evenBuilding: boolean;
  houseSupply: number | 'unlimited';
  hotelSupply: number | 'unlimited';
  shortageHandling: 'auction' | 'firstCome';
  buildTiming: 'anyTime' | 'ownTurn';
  buildWithMortgagedInSet: boolean;
  sellBackPercent: number;
  // Rent
  rentInJail: boolean;
  unimprovedSetMultiplier: number;
  // Jail
  jailFine: number;
  maxJailTurns: number;
  doublesRelease: boolean;
  threeDoublesJail: boolean;
  // Free Parking
  freeParking: FreeParkingMode;
  freeParkingSeed: number;
  freeParkingBonus: number;
  // Mortgage
  mortgagePercent: number;
  unmortgageInterestPercent: number;
  receiveMortgaged: 'interest' | 'free';
  // Dice
  speedDie: boolean;
  doublesExtraRoll: boolean;
  // Trading
  tradingAllowed: boolean;
  promisesAllowed: boolean;
  // Loans (§7)
  loans: boolean;
  loanLimitMode: LoanLimitMode;
  collateralLoanPercent: number;
  loanFixedCap: number;
  loanNetWorthPercent: number;
  unsecuredLoans: boolean;
  maxActiveLoans: number;
  loanInterestPercent: number;
  loanTermMin: number;
  loanTermMax: number;
  noBuildWithLoan: boolean;
  seizureValue: 'purchasePlusBuildings' | 'purchase' | 'mortgagePlusBuildings';
  seizedPropertyTo: 'auction' | 'unowned';
  // Bankruptcy
  bankruptToBank: 'auction' | 'unowned';
}

export const CLASSIC_RULES: Readonly<Rules> = Object.freeze({
  startingCash: 1500,
  goSalary: 200,
  landOnGo: 'normal',
  landOnGoAmount: 400,
  incomeTaxMode: 'flat',
  incomeTaxFlat: 200,
  incomeTaxPercent: 10,
  luxuryTax: 100,
  declinedProperty: 'auction',
  auctionOnly: false,
  auctionStart: 'one',
  auctionStartCustom: 1,
  auctionTimer: 8,
  evenBuilding: true,
  houseSupply: 32,
  hotelSupply: 12,
  shortageHandling: 'auction',
  buildTiming: 'anyTime',
  buildWithMortgagedInSet: false,
  sellBackPercent: 50,
  rentInJail: true,
  unimprovedSetMultiplier: 2,
  jailFine: 50,
  maxJailTurns: 3,
  doublesRelease: true,
  threeDoublesJail: true,
  freeParking: 'nothing',
  freeParkingSeed: 500,
  freeParkingBonus: 500,
  mortgagePercent: 50,
  unmortgageInterestPercent: 10,
  receiveMortgaged: 'interest',
  speedDie: false,
  doublesExtraRoll: true,
  tradingAllowed: true,
  promisesAllowed: true,
  loans: false,
  loanLimitMode: 'collateral',
  collateralLoanPercent: 75,
  loanFixedCap: 1000,
  loanNetWorthPercent: 50,
  unsecuredLoans: true,
  maxActiveLoans: 1,
  loanInterestPercent: 10,
  loanTermMin: 3,
  loanTermMax: 10,
  noBuildWithLoan: false,
  seizureValue: 'purchasePlusBuildings',
  seizedPropertyTo: 'auction',
  bankruptToBank: 'auction',
});
