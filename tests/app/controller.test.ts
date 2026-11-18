import { describe, expect, it } from 'vitest';
import { GameController, type Clock } from '../../src/app/controller';
import { checkInvariants, type SeatConfig } from '../../src/engine';
import { chooseMedium } from '../../src/bots';

const BOT_STEP = 700;

/** Deterministic fake clock: timers run in time order when advanced. */
class FakeClock implements Clock {
  t = 0;
  private timers: { at: number; f: () => void; id: number }[] = [];
  private nextId = 1;
  now() {
    return this.t;
  }
  setTimeout(f: () => void, ms: number) {
    const id = this.nextId++;
    this.timers.push({ at: this.t + ms, f, id });
    return id;
  }
  clearTimeout(h: unknown) {
    this.timers = this.timers.filter((x) => x.id !== h);
  }
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.t = next.at;
      next.f();
    }
    this.t = end;
  }
  get pending() {
    return this.timers.length;
  }
}

const seats = (...kinds: SeatConfig['kind'][]): SeatConfig[] =>
  kinds.map((kind, i) => ({ kind, name: `S${i}`, token: ['teacup', 'key', 'bicycle', 'cat'][i], color: `#00000${i}` }));

describe('game controller', () => {
  it('drives an all-bot game to the end with paced bot actions', () => {
    const clock = new FakeClock();
    const c = new GameController(null, clock);
    c.start({ seats: seats('bot', 'bot', 'bot'), seed: 12, turnOrder: 'fixed' });
    expect(c.state.turnNumber).toBe(1);
    clock.advance(649);
    expect(c.state.turn.rolled).toBe(false); // bots wait for their pause
    clock.advance(2);
    expect(c.state.turn.rolled).toBe(true);
    for (let i = 0; i < 200_000 && c.state.phase !== 'gameOver'; i++) clock.advance(1000);
    expect(c.state.phase).toBe('gameOver');
    expect(checkInvariants(c.state)).toEqual([]);
  });

  it('waits for a human; bots act around them; errors are reported, not thrown', () => {
    const clock = new FakeClock();
    const c = new GameController(null, clock);
    c.start({ seats: seats('human', 'bot'), seed: 3, turnOrder: 'fixed' });
    clock.advance(5000);
    expect(c.state.turn.seat).toBe(0);
    expect(c.view.humanActors).toEqual([0]);
    expect(c.dispatch({ type: 'endTurn', seat: 0 })).toMatch(/not allowed/);
    expect(c.view.error).toMatch(/not allowed/);
    expect(c.dispatch({ type: 'roll', seat: 0 })).toBeNull();
    expect(c.view.error).toBeNull();
  });

  it('runs the auction timer, resetting it on every bid', () => {
    const clock = new FakeClock();
    const c = new GameController(null, clock);
    c.start({ seats: seats('human', 'human'), seed: 5, turnOrder: 'fixed' });
    // Find a roll that lands on an unowned property, then decline it.
    while (c.state.phase !== 'buy') {
      if (c.state.phase === 'preRoll') c.dispatch({ type: 'roll', seat: c.state.turn.seat });
      else if (c.state.phase === 'postRoll') c.dispatch({ type: 'endTurn', seat: c.state.turn.seat });
      else throw new Error(`unexpected ${c.state.phase}`);
    }
    const tile = c.state.pendingBuy!;
    c.dispatch({ type: 'decline', seat: c.state.turn.seat });
    expect(c.state.phase).toBe('auction');
    expect(c.view.auctionDeadline).toBe(clock.t + 8000);
    clock.advance(5000);
    c.dispatch({ type: 'bid', seat: 1, amount: 10 });
    expect(c.view.auctionDeadline).toBe(clock.t + 8000);
    clock.advance(7999);
    expect(c.state.phase).toBe('auction');
    clock.advance(2);
    expect(c.state.phase).not.toBe('auction');
    expect(c.state.tiles[tile].owner).toBe(1);
  });

  it('M10: humans, a medium bot and a bank-backed bot play a full game', () => {
    let finished = 0;
    for (const seed of [21, 22, 23, 24]) {
      const clock = new FakeClock();
      const c = new GameController(null, clock);
      c.start({ seats: seats('human', 'human', 'bot', 'bankBot'), seed, turnOrder: 'random' });
      const bank = c.state.seats.findIndex((x) => x.kind === 'bankBot');
      let botActions = 0;
      for (let i = 0; i < 60_000 && c.state.phase !== 'gameOver' && c.state.turnNumber < 600; i++) {
        const humans = c.view.humanActors;
        // Humans play the medium strategy through the controller, like a person pressing buttons.
        const a = humans.length ? chooseMedium(c.state, humans[0]) : null;
        if (a) {
          expect(c.dispatch(a)).toBeNull();
          continue;
        }
        const before = c.state.log.at(-1);
        clock.advance(BOT_STEP);
        if (c.state.log.at(-1) !== before) botActions++;
      }
      expect(checkInvariants(c.state)).toEqual([]);
      expect(botActions).toBeGreaterThan(0);
      expect(c.state.tiles.every((t) => t.owner !== bank)).toBe(true);
      expect(c.state.players[bank].bankrupt).toBe(false);
      if (c.state.phase === 'gameOver') {
        finished++;
        // With 2+ humans the game ends the moment one human is left; that human wins.
        const aliveHumans = c.state.seats.map((_, i) => i).filter((i) => c.state.seats[i].kind === 'human' && !c.state.players[i].bankrupt);
        expect(aliveHumans).toEqual([c.state.winner]);
      }
    }
    expect(finished).toBeGreaterThan(0);
  });

  it('M10: one human (testing) loses on bankruptcy; no winner', () => {
    const clock = new FakeClock();
    const c = new GameController(null, clock);
    c.start({ seats: seats('human', 'bot', 'bot'), seed: 4, turnOrder: 'fixed' });
    expect(c.dispatch({ type: 'forfeit', seat: 0 })).toBeNull();
    expect(c.state.phase).toBe('gameOver');
    expect(c.state.winner).toBeNull();
  });

  it('M10: bot pauses follow the speed setting', () => {
    const delays: Record<string, number> = {};
    for (const speed of ['slow', 'normal', 'fast', 'instant'] as const) {
      const clock = new FakeClock();
      const c = new GameController(null, clock);
      c.speed = speed;
      c.start({ seats: seats('bot', 'bot'), seed: 9, turnOrder: 'fixed' });
      let t = 0;
      while (!c.state.turn.rolled && t < 5000) {
        clock.advance(1);
        t++;
      }
      delays[speed] = t;
    }
    expect(delays.slow).toBeGreaterThan(delays.normal);
    expect(delays.normal).toBeGreaterThan(delays.fast);
    expect(delays.fast).toBeGreaterThan(delays.instant);
    expect(delays.instant).toBeLessThanOrEqual(1);
  });

  it('pausing holds bots and the auction timer', () => {
    const clock = new FakeClock();
    const c = new GameController(null, clock);
    c.start({ seats: seats('bot', 'bot'), seed: 9, turnOrder: 'fixed' });
    c.setPaused(true);
    clock.advance(10_000);
    expect(c.state.turn.rolled).toBe(false);
    c.setPaused(false);
    clock.advance(700);
    expect(c.state.turn.rolled).toBe(true);
  });
});
