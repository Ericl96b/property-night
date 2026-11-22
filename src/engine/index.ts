// Rules engine public API (SPEC §12). Pure: no rendering, no DOM.
export { apply } from './apply';
export { legalActions, manageActions, bidOptions, bidChoices, seatsToAct, BID_INCREMENTS, type BidChoice } from './legal';
export { newGame, cloneState, sidesFor, type NewGameConfig, type SeatConfig } from './state';
export { checkInvariants } from './invariants';
export { validateOffer, tradeTileBlocker } from './trade';
export * from './loans';
export { CLASSIC_RULES, type Rules } from './rules';
export { CLASSIC_CHANCE, CLASSIC_CHEST, cardText, effectSummary, type Card, type CardEffect, type DeckId } from './cards';
export * from './queries';
export * from './types';
