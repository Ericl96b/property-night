import type { TokenId } from '../render/tokens/tokens';

/** SPEC §10.1 player colors (+2 chosen hues, see DECISIONS.md). */
export const PLAYER_COLORS = ['#7B3FE4', '#0F9C84', '#C0582B', '#5B6472', '#C8326E', '#2E7DD7'];

export const TOKEN_NAMES: Record<TokenId, string> = {
  teacup: 'Teacup',
  key: 'Key',
  bicycle: 'Bicycle',
  cat: 'Cat',
  rocket: 'Rocket',
  crown: 'Crown',
  sailboat: 'Sailboat',
  umbrella: 'Umbrella',
  gramophone: 'Gramophone',
};
