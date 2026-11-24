// Audio Phase 0 §10: engine events → sound IDs, through the real director with a recording sound.
import { describe, expect, it } from 'vitest';
import { Director, paymentSoundId } from '../../src/director/director';
import { AnimationQueue, type Speed } from '../../src/director/queue';
import type { GameScene } from '../../src/render/scene';
import type { SoundApi, PlayCtx } from '../../src/audio/sound';
import type { SoundId } from '../../src/audio/registry';
import { CLASSIC_BOARD } from '../../src/data/classicBoard';
import type { GameEvent, State } from '../../src/engine';
import { edit, game } from '../engine/helpers';

/** Records every play (batching is tested on its own). */
class RecordingSound implements SoundApi {
  plays: { id: SoundId; ctx: PlayCtx }[] = [];
  play(id: SoundId, ctx: PlayCtx = {}) {
    this.plays.push({ id, ctx });
  }
  beginBatch() {}
  endBatch() {}
  duck() {}
  get ids() {
    return this.plays.map((p) => p.id);
  }
}

/** Any property is a no-op function (and an object of no-op functions), unless overridden. */
function stub(over: Record<string, unknown> = {}): any {
  return new Proxy(function () {}, {
    get: (_t, k) => (k in over ? over[k as string] : k === 'then' ? undefined : stub()),
    apply: () => undefined,
  });
}

function rig(speed: Speed = 'fast') {
  const queue = new AnimationQueue();
  queue.speed = speed;
  const scene = stub({
    queue,
    camera: stub({ closeup: false, side: 0, rotating: false }),
    buildings: stub({ countOn: () => ({ houses: 0, hotel: false }) }),
    // Dice: one die-on-die and one floor hit, then settle.
    dice: {
      play: (_th: unknown, _s: number, onContact?: (c: { kind: 'wood' | 'die'; intensity: number; step: number }) => void, onSettle?: () => void) => {
        onContact?.({ kind: 'die', intensity: 0.8, step: 1 });
        onContact?.({ kind: 'wood', intensity: 0.3, step: 9 });
        onSettle?.();
        return () => false;
      },
      pose() {},
    },
    tokens: {
      tokens: new Map(),
      travel: (_id: unknown, path: number[], _sp: unknown, _f: unknown, onStep?: (k: number, last: boolean) => void) => ({
        start: () => path.forEach((_, k) => onStep?.(k, k === path.length - 1)),
      }),
      glide: () => ({ start() {} }),
      remove() {},
      add() {},
      place() {},
    },
  }) as GameScene;
  const director = new Director(scene, { card() {}, moment() {}, idle() {} });
  const sound = new RecordingSound();
  director.sound = sound;
  const run = (events: object[], state: State) => {
    sound.plays = [];
    director.play(events as GameEvent[], state);
    queue.flush();
    return sound;
  };
  return { run, sound, queue };
}

const pay = (s: State, from: number | 'bank', to: number | 'bank', amount: number, reason: string, tile?: number) => ({ type: 'payment', from, to, amount, reason, tile, cash: s.players.map((p) => p.cash) });

describe('director → sound IDs (audio Phase 0 §4)', () => {
  const s = game(2);

  it('payments play one money ID chosen by the reason', () => {
    const { run } = rig();
    expect(run([pay(s, 1, 0, 50, 'rent on Hazel Lane', 1)], s).ids).toEqual(['money.rent']);
    expect(run([pay(s, 'bank', 0, 200, 'GO salary')], s).ids).toEqual(['money.salary']);
    expect(run([pay(s, 0, 'bank', 200, 'Income Tax', 4)], s).ids).toEqual(['money.tax']);
    expect(run([pay(s, 0, 'bank', 60, 'purchase', 1)], s).ids).toEqual(['money.purchase']);
    const r = run([pay(s, 1, 'bank', 60, 'purchase', 1)], s);
    expect(r.plays[0].ctx).toMatchObject({ amount: 60, payer: 1, payee: 'bank', seat: 1, isBot: false });
  });

  it('paymentSoundId covers every reason the engine emits', () => {
    const id = (reason: string, tile?: number) => paymentSoundId({ reason, tile }, CLASSIC_BOARD);
    expect(id('Free Parking')).toBe('money.freeParking');
    expect(id('property auction')).toBe('money.purchase');
    expect(id('building', 1)).toBe('money.build');
    expect(id('building sold', 1)).toBe('money.sellBuilding');
    expect(id('mortgage', 1)).toBe('money.mortgage');
    expect(id('unmortgage', 1)).toBe('money.unmortgage');
    expect(id('interest on Hazel Lane')).toBe('money.unmortgage');
    expect(id('jail fine')).toBe('money.jailFine');
    expect(id('bank loan')).toBe('money.loanTaken');
    expect(id('loan installment')).toBe('money.loanInstallment');
    expect(id('loan payoff')).toBe('money.loanPayoff');
    expect(id('seizure refund')).toBe('money.seizureRefund');
    expect(id('card')).toBe('money.generic');
    expect(id('repairs')).toBe('money.generic');
    expect(id('bankruptcy')).toBe('money.generic');
  });

  it('houses, hotels and sales', () => {
    const { run } = rig();
    expect(run([{ type: 'built', seat: 0, tile: 1, buildings: 1 }], s).ids).toEqual(['building.house']);
    expect(run([{ type: 'built', seat: 0, tile: 1, buildings: 5 }], s).ids).toEqual(['building.hotel']);
    expect(run([{ type: 'sold', seat: 0, tile: 1, buildings: 4 }], s).ids).toEqual(['building.sell']);
  });

  it('both card decks', () => {
    const { run } = rig();
    expect(run([{ type: 'cardDrawn', seat: 0, deck: 'chance', index: 0, text: 'x' }], s).ids).toEqual(['card.chance.draw', 'card.reveal', 'card.dismiss']);
    expect(run([{ type: 'cardDrawn', seat: 0, deck: 'chest', index: 0, text: 'x' }], s).ids[0]).toBe('card.chest.draw');
  });

  it('all six banners', () => {
    const { run } = rig();
    const owned = edit(s, (d) => {
      d.tiles[1].owner = 0;
      d.tiles[3].owner = 0;
    });
    expect(run([{ type: 'propertyTransferred', tile: 3, from: null, to: 0 }], owned).ids).toEqual(['property.transfer', 'banner.setComplete']);
    expect(run([{ type: 'bankrupt', seat: 1, creditor: 'bank' }], s).ids).toEqual(['token.removed', 'banner.bankrupt']);
    expect(run([{ type: 'rentWaived', seat: 1, owner: 0, tile: 1, rent: 2, promise: { left: 2 } }], s).ids).toEqual(['banner.rentFree']);
    expect(run([{ type: 'bankBackingEnded', mode: 'cutoff', seats: [1], by: 0, tile: 1, cash: 500 }], s).ids).toEqual(['banner.botsLeave']);
    expect(run([{ type: 'loanSeized', seat: 0, loanId: 1, tiles: [1], value: 60, balance: 100 }], s).ids).toEqual(['banner.seizure']);
    expect(run([{ type: 'auctionEnded', tile: 1, winner: 0, amount: 70, kind: 'property' }], s).ids).toEqual(['banner.auctionWon']);
  });

  it('jail entry, turn start (human and bot) and dice', () => {
    const { run } = rig();
    expect(run([{ type: 'jailed', seat: 0, reason: 'tile' }], s).ids).toEqual(['jail.enter']);
    expect(run([{ type: 'turnStarted', seat: 0 }], s).ids).toEqual(['turn.start', 'turn.start.local']);
    const bots = game(2, { kinds: ['bot', 'bot'] });
    const r = run([{ type: 'turnStarted', seat: 1 }], bots);
    expect(r.ids).toEqual(['turn.start']);
    expect(r.plays[0].ctx.isBot).toBe(true);
    const dice = run([{ type: 'diceRolled', seat: 0, dice: [3, 3], doubles: true }], s);
    expect(dice.ids).toEqual(['dice.pickup', 'dice.throw', 'dice.bounce.die', 'dice.bounce.wood', 'dice.settle', 'dice.doubles']);
    expect(dice.plays[2].ctx.intensity).toBe(0.8);
  });

  it('token hops: steps, then one landing; Instant plays one tap after the move', () => {
    const { run } = rig();
    expect(run([{ type: 'moved', seat: 0, from: 0, to: 3, steps: 3 }], s).ids).toEqual(['token.step', 'token.step', 'token.land']);
    const fast = rig('instant');
    expect(fast.run([{ type: 'moved', seat: 0, from: 0, to: 3, steps: 3 }], s).ids).toEqual(['token.instant']);
  });

  it('property transfers sound at Instant speed too (fix §8.2)', () => {
    const { run } = rig('instant');
    expect(run([{ type: 'propertyTransferred', tile: 1, from: null, to: 0 }], s).ids).toEqual(['property.transfer']);
    expect(run([{ type: 'propertyTransferred', tile: 1, from: 0, to: null }], s).ids).toEqual(['property.toBank']);
  });

  it('silent hooks: auctions and trades', () => {
    const { run } = rig();
    expect(run([{ type: 'auctionStarted', tile: 1, minBid: 10 }, { type: 'bid', seat: 0, amount: 10 }, { type: 'bid', seat: 1, amount: 20 }, { type: 'passed', seat: 0 }], s).ids).toEqual([
      'auction.start',
      'auction.bid',
      'auction.leaderChange',
      'auction.pass',
    ]);
    const offer = { from: 0, to: 1, give: {}, get: {} };
    const counter = { from: 1, to: 0, give: {}, get: {} };
    expect(run([{ type: 'tradeRejected', offer }, { type: 'tradeProposed', offer: counter }], s).ids).toEqual(['trade.counter', 'trade.propose']);
    expect(run([{ type: 'tradeRejected', offer }], s).ids).toEqual(['trade.decline']);
    const mixed = game(2, { kinds: ['human', 'bot'] });
    expect(run([{ type: 'tradeProposed', offer: counter }], mixed).ids).toEqual(['trade.incomingFromBot']);
  });
});
