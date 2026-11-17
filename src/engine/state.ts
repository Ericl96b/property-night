// Game creation and cheap structural cloning.
import { CLASSIC_BOARD, type BoardData } from '../data/classicBoard';
import { CLASSIC_CHANCE, CLASSIC_CHEST, type Card, type DeckId } from './cards';
import { nextInt, seedRng, type RngState } from './rng';
import { CLASSIC_RULES, type Rules } from './rules';
import type { Seat, SeatKind, State } from './types';

const UNLIMITED = 1_000_000;

export interface SeatConfig {
  kind: SeatKind;
  name: string;
  token?: string;
  color?: string;
  controllerId?: string;
}

export interface NewGameConfig {
  seats: SeatConfig[];
  seed: number;
  rules?: Rules;
  board?: BoardData;
  decks?: Record<DeckId, Card[]>;
  /** 'random' (default) shuffles seat order with the game RNG; 'fixed' keeps the given order. */
  turnOrder?: 'random' | 'fixed';
}

function shuffle<T>(arr: T[], rng: RngState): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Board sides by turn order (SPEC §10.7). */
export function sidesFor(n: number): (0 | 1 | 2 | 3)[] {
  if (n === 2) return [0, 2];
  if (n === 3) return [0, 1, 2];
  return Array.from({ length: n }, (_, i) => (i % 4) as 0 | 1 | 2 | 3);
}

export function newGame(cfg: NewGameConfig): State {
  if (cfg.seats.length < 2 || cfg.seats.length > 6) throw new Error('2–6 seats required');
  const rules = { ...(cfg.rules ?? CLASSIC_RULES) };
  const board = cfg.board ?? CLASSIC_BOARD;
  const decks = cfg.decks ?? { chance: CLASSIC_CHANCE, chest: CLASSIC_CHEST };
  const rng = seedRng(cfg.seed);
  const order = cfg.turnOrder === 'fixed' ? cfg.seats : shuffle(cfg.seats, rng);
  const sides = sidesFor(order.length);
  const seats: Seat[] = order.map((c, i) => ({
    kind: c.kind,
    name: c.name,
    token: c.token ?? 'teacup',
    color: c.color ?? '#7B3FE4',
    controllerId: c.controllerId,
    boardSide: sides[i],
  }));
  const deckOrder = {
    chance: shuffle([...decks.chance.keys()], rng),
    chest: shuffle([...decks.chest.keys()], rng),
  };
  const s: State = {
    version: 1,
    rules,
    board,
    decks,
    deckOrder,
    seats,
    players: seats.map(() => ({
      cash: rules.startingCash,
      position: 0,
      jail: null,
      gojf: [],
      bankrupt: false,
      lapped: false,
      stats: { rentPaid: 0, rentReceived: 0, auctionBuys: 0, directBuys: 0 },
    })),
    tiles: board.tiles.map(() => ({ owner: null, buildings: 0, mortgaged: false })),
    bank: {
      houses: rules.houseSupply === 'unlimited' ? UNLIMITED : rules.houseSupply,
      hotels: rules.hotelSupply === 'unlimited' ? UNLIMITED : rules.hotelSupply,
    },
    freeParkingPot: rules.freeParking === 'potSeed' ? rules.freeParkingSeed : 0,
    turnNumber: 1,
    turn: { seat: 0, doubles: 0, rolled: false, extraRoll: false, dice: null, trades: 0, speed: null, speedChoice: null, mrMonopoly: false },
    phase: 'preRoll',
    pendingBuy: null,
    auction: null,
    auctionQueue: [],
    debts: [],
    transfers: [],
    trade: null,
    promises: [],
    nextPromiseId: 1,
    winner: null,
    log: [{ turn: 1, seat: 0, text: `${seats[0].name} goes first` }],
    rng,
  };
  return s;
}

/** Structural clone. Rules, board, decks and seats are treated as immutable and shared. */
export function cloneState(s: State): State {
  return {
    ...s,
    deckOrder: { chance: [...s.deckOrder.chance], chest: [...s.deckOrder.chest] },
    players: s.players.map((p) => ({
      ...p,
      jail: p.jail ? { ...p.jail } : null,
      gojf: [...p.gojf],
      stats: { ...p.stats },
    })),
    tiles: s.tiles.map((t) => ({ ...t })),
    bank: { ...s.bank },
    turn: {
      ...s.turn,
      dice: s.turn.dice ? [s.turn.dice[0], s.turn.dice[1]] : null,
      speedChoice: s.turn.speedChoice ? { ...s.turn.speedChoice, options: [...s.turn.speedChoice.options] } : null,
    },
    auction: s.auction ? { ...s.auction, active: [...s.auction.active], buildFor: s.auction.buildFor ? { ...s.auction.buildFor } : undefined } : null,
    auctionQueue: [...s.auctionQueue],
    debts: s.debts.map((d) => ({ ...d })),
    transfers: s.transfers.map((t) => ({ ...t, tiles: [...t.tiles] })),
    trade: s.trade, // offers are immutable; replaced, never edited in place
    promises: s.promises.map((p) => ({ ...p })),
    log: s.log.length > 200 ? s.log.slice(-200) : [...s.log],
    rng: [...s.rng] as RngState,
  };
}
