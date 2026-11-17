// Test helpers: build scenarios on top of newGame and steer the seeded RNG to exact dice.
import { apply, cloneState, newGame, type Action, type GameEvent, type Rules, type SeatKind, type State } from '../../src/engine';
import { CLASSIC_RULES } from '../../src/engine/rules';
import { rollDie, seedRng, type RngState } from '../../src/engine/rng';

export function game(n = 2, opts: { rules?: Partial<Rules>; kinds?: SeatKind[]; seed?: number } = {}): State {
  return newGame({
    seats: Array.from({ length: n }, (_, i) => ({ kind: opts.kinds?.[i] ?? 'human', name: `P${i}` })),
    seed: opts.seed ?? 1,
    turnOrder: 'fixed',
    rules: { ...CLASSIC_RULES, ...opts.rules },
  });
}

/** Return a copy of `s` whose next rolls are exactly `rolls` (pairs flattened: [a, b, c, d…]). */
export function withDice(s: State, ...rolls: number[]): State {
  for (let seed = 1; seed < 5_000_000; seed++) {
    const st = seedRng(seed);
    const probe = [...st] as RngState;
    if (rolls.every((r) => rollDie(probe) === r)) {
      const c = cloneState(s);
      c.rng = st;
      return c;
    }
  }
  throw new Error(`no seed for dice ${rolls.join(',')}`);
}

/** Mutable copy for scenario setup. */
export function edit(s: State, f: (d: State) => void): State {
  const d = cloneState(s);
  f(d);
  return d;
}

export function act(s: State, a: Action): { s: State; ev: GameEvent[] } {
  const r = apply(s, a);
  return { s: r.state, ev: r.events };
}

/** Apply a sequence; returns the final state and all events. */
export function run(s: State, ...actions: Action[]): { s: State; ev: GameEvent[] } {
  let cur = s;
  const ev: GameEvent[] = [];
  for (const a of actions) {
    const r = apply(cur, a);
    cur = r.state;
    ev.push(...r.events);
  }
  return { s: cur, ev };
}

export function own(d: State, seat: number, ...tiles: number[]): void {
  for (const t of tiles) d.tiles[t].owner = seat;
}

/** Put a specific card on top of a deck. */
export function topCard(d: State, deck: 'chance' | 'chest', text: RegExp): void {
  const idx = d.decks[deck].findIndex((c) => text.test(c.text));
  if (idx < 0) throw new Error(`no card ${text}`);
  d.deckOrder[deck] = [idx, ...d.deckOrder[deck].filter((i) => i !== idx)];
}
