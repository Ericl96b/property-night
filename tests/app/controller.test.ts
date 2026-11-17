import { describe, expect, it } from 'vitest';
import { GameController, type Clock } from '../../src/app/controller';
import { checkInvariants, type SeatConfig } from '../../src/engine';

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
