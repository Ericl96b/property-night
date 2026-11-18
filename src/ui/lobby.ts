// Lobby (new-game setup) helpers, kept pure so they can be unit-tested (SPEC §3, §9).
import type { SeatConfig, SeatKind } from '../engine';

export const KIND_LABEL: Record<SeatKind, string> = {
  human: 'Human',
  bot: 'Bot',
  bankBot: 'Bank-backed bot',
};

/** One-line description shown under a bot seat in the lobby. */
export const KIND_HINT: Record<SeatKind, string> = {
  human: '',
  bot: 'Medium bot: buys most properties, completes sets, builds, trades and bids up to a value estimate.',
  bankBot: 'Unlimited bank money. Never buys, bids or trades; unowned land goes to auction. Cannot win.',
};

const DEFAULT_PREFIX: Record<SeatKind, string> = { human: 'Player', bot: 'Bot', bankBot: 'Bank' };
const DEFAULT_NAME = /^(Player|Bot|Bank) (\d+)$/;

export function defaultName(kind: SeatKind, n: number): string {
  return `${DEFAULT_PREFIX[kind]} ${n}`;
}

/**
 * The name a seat should carry after its kind changes: a still-default name ("Player 2",
 * "Bot 3", "Bank 4") follows the new kind and keeps its number; a custom name is kept.
 */
export function renameForKind(name: string, kind: SeatKind, fallbackN: number): string {
  const m = DEFAULT_NAME.exec(name.trim());
  if (!m) return name;
  return defaultName(kind, Number(m[2]) || fallbackN);
}

/** Moves seat i one place up (-1) or down (+1); returns a new array (unchanged at the ends). */
export function moveSeat<T>(seats: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= seats.length || j < 0 || j >= seats.length) return [...seats];
  const out = [...seats];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Why the lobby cannot start yet, or null. */
export function lobbyProblem(seats: SeatConfig[]): string | null {
  if (seats.length < 2) return 'At least two seats are needed.';
  if (seats.length > 6) return 'At most six seats.';
  if (!seats.some((s) => s.kind === 'human')) return 'At least one human seat is needed.';
  if (seats.filter((s) => s.kind !== 'bankBot').length < 2) return 'At least two seats must be players (human or bot), not bank-backed bots.';
  if (new Set(seats.map((s) => s.token)).size !== seats.length) return 'Each seat needs its own token.';
  if (new Set(seats.map((s) => s.color)).size !== seats.length) return 'Each seat needs its own color.';
  if (seats.some((s) => !s.name.trim())) return 'Every seat needs a name.';
  return null;
}
