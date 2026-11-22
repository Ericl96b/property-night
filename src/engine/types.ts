// Engine data model (SPEC §12). Plain JSON-serializable objects: the state can be saved,
// cloned and replayed. No rendering or DOM types here.
import type { BoardData } from '../data/classicBoard';
import type { Card, DeckId } from './cards';
import type { RngState } from './rng';
import type { Rules } from './rules';

export type SeatKind = 'human' | 'bot' | 'bankBot';

export interface Seat {
  kind: SeatKind;
  name: string;
  token: string;
  color: string;
  controllerId?: string;
  boardSide: 0 | 1 | 2 | 3;
}

export interface JailState {
  /** Failed doubles attempts so far. */
  attempts: number;
}

export interface Loan {
  id: number;
  /** Remaining principal. */
  principal: number;
  /** Interest per GO pass, % of remaining principal (fixed when the loan is taken). */
  rate: number;
  passesLeft: number;
  /** Pledged tiles (empty = unsecured). */
  collateral: number[];
  secured: boolean;
}

export interface PlayerState {
  cash: number;
  position: number;
  jail: JailState | null;
  gojf: DeckId[];
  bankrupt: boolean;
  /** A bank-backed bot that left the table (rule "bankBotMode: remove"); also marked bankrupt. */
  leftTable?: boolean;
  /** Has passed GO at least once (the speed die joins after the first lap). */
  lapped: boolean;
  loans: Loan[];
  /** Stats for the end-of-game screen (SPEC §9). */
  stats: PlayerStats;
}

export interface PlayerStats {
  rentPaid: number;
  rentReceived: number;
  auctionBuys: number;
  directBuys: number;
  loansTaken: number;
  borrowed: number;
  loanInterest: number;
}

/** Game-wide stats for the end-of-game screen: money over time and rent per tile. */
export interface GameHistory {
  /** Cash per seat, sampled at turn starts (thinned to stay small) plus the final position. */
  cash: { turn: number; cash: number[] }[];
  /** Sample every N turns (doubles each time the series is thinned). */
  every: number;
  /** Rent collected on each tile over the whole game. */
  tileRent: number[];
}

export interface TileState {
  owner: number | null;
  /** 0–4 houses, 5 = hotel. */
  buildings: number;
  mortgaged: boolean;
}

export type Creditor = number | 'bank';

export interface Debt {
  from: number;
  to: Creditor;
  amount: number;
  reason: string;
  /** Tile the debt arose on (rent), for the payment moment. */
  tile?: number;
  /** Paid into the Free Parking pot instead of the bank (pot rule). */
  pot?: boolean;
  /** Counts as rent for stats. */
  rent?: boolean;
}

export interface Auction {
  /** Property auctions: the lot. Building auctions: the tile the requester wanted to build on. */
  tile: number;
  highBid: number;
  highBidder: number | null;
  /** Seats still allowed to bid. */
  active: number[];
  minBid: number;
  /** Property (default) or a scarce building (shortage rule). */
  kind?: 'property' | 'house' | 'hotel';
  /** Building auctions: where each bidder would build if they win (seat → tile). */
  buildFor?: Record<number, number>;
  /** Each seat's latest bid in this auction (seat → amount), for the "Outbid" status. */
  lastBids?: Record<number, number>;
}

/** Speed die faces: 1–3 are numbers, 4 and 5 are the bus, 6 is the "Mr. Monopoly" face. */
export type SpeedFace = 1 | 2 | 3 | 4 | 5 | 6;
export const SPEED_BUS = (f: number) => f === 4 || f === 5;
export const SPEED_MR = 6;

export interface MortgagedTransfer {
  to: number;
  tiles: number[];
}

export type Phase = 'preRoll' | 'speedChoice' | 'buy' | 'auction' | 'debt' | 'mortgagedTransfer' | 'trade' | 'postRoll' | 'gameOver';

export interface TradeSide {
  tiles: number[];
  cash: number;
  /** Number of Get Out of Jail Free cards. */
  gojf: number;
}

/** Generic promise model (SPEC §6). rentFree: `to` pays no rent to `from` on `tileId`. */
export interface PromiseTerm {
  kind: 'rentFree';
  from: number;
  to: number;
  tileId: number;
  /** Counts down at the end of each of `to`'s turns. */
  turnsLeft: number;
}

export interface GamePromise extends PromiseTerm {
  id: number;
}

export interface TradeOffer {
  from: number;
  to: number;
  /** What `from` gives. */
  give: TradeSide;
  /** What `from` gets from `to`. */
  get: TradeSide;
  promises: PromiseTerm[];
}

export interface TurnState {
  seat: number;
  /** Doubles rolled in a row this turn. */
  doubles: number;
  /** True when the player has rolled and has no extra roll pending. */
  rolled: boolean;
  extraRoll: boolean;
  dice: [number, number] | null;
  /** Trade proposals made this turn. */
  trades: number;
  /** Speed die face this roll (null when not rolled). */
  speed?: number | null;
  /** Pending speed-die decision: bus (choose a move) or triples (any tile). */
  speedChoice?: { options: number[]; anyTile: boolean } | null;
  /** "Mr. Monopoly" face: after this landing resolves, advance to the next property. */
  mrMonopoly?: boolean;
}

export interface LogEntry {
  turn: number;
  seat: number | null;
  text: string;
}

export interface State {
  version: 1;
  rules: Rules;
  board: BoardData;
  decks: Record<DeckId, Card[]>;
  /** Draw order (card indices); index 0 is the top. Held Get Out of Jail Free cards are removed. */
  deckOrder: Record<DeckId, number[]>;
  seats: Seat[];
  players: PlayerState[];
  tiles: TileState[];
  bank: { houses: number; hotels: number };
  freeParkingPot: number;
  turnNumber: number;
  turn: TurnState;
  phase: Phase;
  /** Unowned property the active player may buy. */
  pendingBuy: number | null;
  auction: Auction | null;
  auctionQueue: number[];
  debts: Debt[];
  transfers: MortgagedTransfer[];
  trade: TradeOffer | null;
  promises: GamePromise[];
  nextPromiseId: number;
  nextLoanId: number;
  winner: number | null;
  log: LogEntry[];
  rng: RngState;
  /** Stats history (absent in saves from before M11; filled in on load). */
  history: GameHistory;
  /**
   * The first human hotel has gone up and the bank no longer backs bank-backed bots (rule
   * "bankBotMode" cutoff or remove). Absent in older saves = false.
   */
  bankBackingEnded?: boolean;
}

// ---- actions ------------------------------------------------------------------------------

export type Action =
  | { type: 'roll'; seat: number }
  | { type: 'payJailFine'; seat: number }
  | { type: 'useJailCard'; seat: number }
  | { type: 'buy'; seat: number }
  | { type: 'decline'; seat: number }
  | { type: 'bid'; seat: number; amount: number }
  | { type: 'pass'; seat: number }
  /** Sent by the UI when the auction timer runs out (seat −1 = system). */
  | { type: 'auctionTimeout'; seat: number }
  | { type: 'build'; seat: number; tile: number }
  | { type: 'sell'; seat: number; tile: number }
  | { type: 'mortgage'; seat: number; tile: number }
  | { type: 'unmortgage'; seat: number; tile: number }
  | { type: 'mortgagedChoice'; seat: number; tile: number; unmortgage: boolean }
  | { type: 'declareBankruptcy'; seat: number }
  | { type: 'forfeit'; seat: number }
  | { type: 'endTurn'; seat: number }
  | { type: 'takeLoan'; seat: number; amount: number; passes: number; collateral: number[] }
  | { type: 'repayLoan'; seat: number; loanId: number; amount: number }
  /** Speed die: move `steps` (bus) or go to `target` (triples). */
  | { type: 'speedChoice'; seat: number; steps?: number; target?: number }
  | { type: 'proposeTrade'; seat: number; offer: TradeOffer }
  | { type: 'acceptTrade'; seat: number }
  | { type: 'rejectTrade'; seat: number }
  /** Receiver replies with a new offer from their side (sides swapped). */
  | { type: 'counterTrade'; seat: number; offer: TradeOffer }
  | { type: 'cancelTrade'; seat: number };

export type ActionType = Action['type'];

// ---- events (consumed in order by the director; SPEC §12) ---------------------------------

export type GameEvent =
  | { type: 'turnStarted'; seat: number }
  | { type: 'diceRolled'; seat: number; dice: [number, number]; doubles: boolean; speed?: number }
  | { type: 'moved'; seat: number; from: number; to: number; steps: number; direct: boolean }
  | { type: 'passedGo'; seat: number; amount: number }
  | { type: 'jailed'; seat: number; reason: 'tile' | 'card' | 'doubles' }
  | { type: 'released'; seat: number; how: 'fine' | 'card' | 'doubles' | 'maxTurns' }
  | { type: 'bought'; seat: number; tile: number; price: number }
  | { type: 'auctionStarted'; tile: number; minBid: number }
  | { type: 'bid'; seat: number; amount: number }
  | { type: 'passed'; seat: number }
  | { type: 'auctionEnded'; tile: number; winner: number | null; amount: number; kind?: 'property' | 'house' | 'hotel' }
  | { type: 'payment'; from: Creditor; to: Creditor; amount: number; reason: string; tile?: number; cash: number[] }
  | { type: 'debtPending'; debt: Debt }
  | { type: 'cardDrawn'; seat: number; deck: 'chance' | 'chest'; index: number; text: string }
  | { type: 'built'; seat: number; tile: number; buildings: number }
  | { type: 'sold'; seat: number; tile: number; buildings: number }
  | { type: 'mortgaged'; seat: number; tile: number }
  | { type: 'unmortgaged'; seat: number; tile: number }
  | { type: 'propertyTransferred'; tile: number; from: number | null; to: number | null }
  | { type: 'bankrupt'; seat: number; creditor: Creditor }
  | { type: 'loanTaken'; seat: number; loan: Loan }
  | { type: 'loanPaid'; seat: number; loanId: number; principal: number; interest: number; closed: boolean }
  | { type: 'loanSeized'; seat: number; loanId: number; tiles: number[]; value: number; balance: number }
  | { type: 'tradeProposed'; offer: TradeOffer }
  | { type: 'tradeAccepted'; offer: TradeOffer }
  | { type: 'tradeRejected'; offer: TradeOffer }
  | { type: 'promiseEnded'; promise: GamePromise; reason: 'expired' | 'void' }
  | { type: 'turnEnded'; seat: number }
  /** First human hotel: bank-backed bots lose their backing (cutoff) or leave the table (remove). */
  | { type: 'bankBackingEnded'; mode: 'cutoff' | 'remove'; seats: number[]; by: number; tile: number; cash: number }
  | { type: 'gameOver'; winner: number | null };

export interface ApplyResult {
  state: State;
  events: GameEvent[];
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}
