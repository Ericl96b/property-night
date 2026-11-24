// Director (SPEC §12): consumes engine events in order and turns them into a queue of
// skippable, speed-scaled animations. The engine state is always the source of truth; after
// every batch the scene is re-synced to it.
import * as THREE from 'three';
import { BOARD_TOP, IN_JAIL, SIDE_YAW, sideOfTile, tileFrame, tileLocalToWorld, type Side } from '../render/layout';
import { placeFlat, simulateThrow } from '../render/diceSim';
import type { GameScene } from '../render/scene';
import { CLOSEUP, type ShotPose } from '../render/cameraDirector';
import type { TokenId } from '../render/tokens/tokens';
import { Rng } from '../engine/rng';
import { groupTiles, promiseGroupOf, type Creditor, type GameEvent, type State } from '../engine';

/**
 * Which promise badges a tile shows (Stage 3 §5.3): the rent-free ribbon on every tile of the
 * group the promiser owns now; the No Building decal on every tile of the set.
 */
export function promiseBadgesOn(s: State, tile: number): { rentFree: boolean; noBuild: boolean } {
  const g = promiseGroupOf(s.board, tile);
  const owner = s.tiles[tile].owner;
  return {
    rentFree: s.promises.some((p) => p.kind === 'rentFree' && p.group === g && p.from === owner),
    noBuild: s.promises.some((p) => p.kind === 'noBuild' && p.group === g),
  };
}
import { DEFAULT_SETTINGS, isBigPayment, type Settings } from '../app/settings';
import type { Animation } from './queue';
import { SILENT, type PlayCtx, type SoundApi } from '../audio/sound';
import type { SoundId } from '../audio/registry';
import type { BoardData } from '../data/classicBoard';

/** Which money sound a payment plays (audio Phase 0 §4), from its reason. */
export function paymentSoundId(e: { reason: string; tile?: number }, board: Pick<BoardData, 'tiles'>): SoundId {
  const r = e.reason;
  if (r.startsWith('rent on ')) return 'money.rent';
  if (r === 'GO salary') return 'money.salary';
  if (r === 'Free Parking') return 'money.freeParking';
  if (r === 'purchase' || r.endsWith(' auction')) return 'money.purchase';
  if (r === 'building') return 'money.build';
  if (r === 'building sold') return 'money.sellBuilding';
  if (r === 'mortgage') return 'money.mortgage';
  if (r === 'unmortgage' || r.startsWith('interest on ')) return 'money.unmortgage';
  if (r === 'jail fine') return 'money.jailFine';
  if (r === 'bank loan') return 'money.loanTaken';
  if (r === 'loan installment') return 'money.loanInstallment';
  if (r === 'loan payoff') return 'money.loanPayoff';
  if (r === 'seizure refund') return 'money.seizureRefund';
  if (e.tile !== undefined && board.tiles[e.tile]?.type === 'tax') return 'money.tax';
  return 'money.generic';
}

export interface CardView {
  deck: 'chance' | 'chest';
  text: string;
  seat: number;
}

export type Moment =
  | {
      kind: 'payment';
      from: Creditor;
      to: Creditor;
      amount: number;
      reason: string;
      tile?: number;
      /** Cash before and after, per seat (counters tick between them). */
      before: number[];
      after: number[];
      duration: number;
    }
  /** Every other payment (owner request, 2026-11-18): banknotes fly, counters tick, no banner. */
  | {
      kind: 'transfer';
      from: Creditor;
      to: Creditor;
      amount: number;
      reason: string;
      before: number[];
      after: number[];
      duration: number;
    }
  | { kind: 'banner'; title: string; subtitle?: string; seat: number | null; tone: 'oxblood' | 'forest' | 'brass'; duration: number };

export interface DirectorHooks {
  card(card: CardView | null): void;
  moment(m: Moment | null): void;
  idle(): void;
  /** Stage 3 §1: Inventory or Trade is open; the camera must not move (no push-ins). */
  screenOpen?(): boolean;
}

const PAYMENT_TIME = 2.2;
/** Small payments; Manage actions (build, sell, mortgage) use the shorter one. */
const TRANSFER_TIME = 0.7;
const MANAGE_TRANSFER_TIME = 0.45;
const MANAGE_REASONS = new Set(['building', 'building sold', 'mortgage', 'unmortgage']);
const BANNER_TIME = 1.5;

/** What the controller needs from a director (a headless fake implements this in tests). */
export interface DirectorLike {
  readonly busy: boolean;
  play(events: GameEvent[], state: State): void;
  sync(state: State): void;
  skip(): void;
}

const CARD_TIME = 2.6;

export class Director implements DirectorLike {
  private cosmetic: Rng;

  /** Live settings (payment thresholds). */
  settings: () => Settings = () => DEFAULT_SETTINGS;
  /** Sound (SPEC §9, audio Phase 0): plays registry IDs; silent in tests. */
  sound: SoundApi = SILENT;
  /** The auction's current leader (auction.leaderChange). */
  private auctionLeader: number | null = null;

  constructor(
    private scene: GameScene,
    private hooks: DirectorHooks,
    seed = 1,
  ) {
    this.cosmetic = new Rng(seed ^ 0x5bd1e995);
    this.scene.queue.onIdle = () => this.hooks.idle();
    // Skips and multi-item frames play as one sound batch (audio Phase 0 §6).
    this.scene.queue.batch = { begin: () => this.sound.beginBatch(), end: () => this.sound.endBatch() };
  }

  get busy(): boolean {
    return this.scene.queue.busy;
  }

  /** Restart the cosmetic dice RNG (the benchmark replays identical throws). */
  reseed(seed: number): void {
    this.cosmetic = new Rng(seed ^ 0x5bd1e995);
  }

  private get speed(): number {
    return this.scene.queue.factor;
  }

  private tokenOf(state: State, seat: number): TokenId {
    return state.seats[seat].token as TokenId;
  }

  /** Where each token stands as the queued animations play (camera turns follow the token). */
  private positions: number[] = [];
  /** The side the camera will face once everything queued so far has played. */
  private plannedSide: Side | null = null;

  /** Turn the camera rig to `side` (skipped when already planned there, unless forced). */
  private turnTo(side: Side, force = false): void {
    if (!force && this.plannedSide === side) return;
    this.plannedSide = side;
    const sc = this.scene;
    sc.queue.push({
      label: 'turn',
      start: () => {
        sc.camera.toSide(side, this.speed === Infinity);
        return () => sc.camera.rotating;
      },
      finish: () => sc.camera.toSide(side, true),
    });
  }

  private follow = (token: THREE.Vector3 | null, destination?: THREE.Vector3) => this.scene.camera.setFollow(token, destination);

  /** Close-up chase: the token's hops drive the camera (Stage 2 section 2.3). */
  private chaseFollow(from: number, dir: 1 | -1) {
    return (token: THREE.Vector3 | null, _dest?: THREE.Vector3, hops?: number) => {
      if (!token || hops === undefined) return;
      this.scene.camera.chase({ s: from + dir * hops, dir, token });
    };
  }

  /**
   * Close-up camera move as a queue item (Stage 2 section 2.6). `start` sets the goal (and turns
   * the side yaw / light rig when `side` is given); a blocking item waits until the camera has
   * covered `gate` of the move; `finish` snaps, so skip and Instant land on the end state.
   */
  private cameraShot(label: string, pose: () => ShotPose, opts: { smooth: number; side?: Side; block?: boolean; gate?: number }): Animation {
    const cam = this.scene.camera;
    return {
      label,
      start: () => {
        if (opts.side !== undefined) cam.toSide(opts.side, this.speed === Infinity);
        cam.shot(pose(), opts.smooth, this.speed === Infinity);
        if (!opts.block) return;
        const gate = opts.gate ?? 0.99;
        return () => cam.progress() < gate;
      },
      finish: () => {
        if (opts.side !== undefined) cam.toSide(opts.side, true);
        cam.settle();
      },
    };
  }

  /**
   * Put the camera on the active seat's view without animating (new game, resume, camera style
   * or reduce motion changed): the Home shot in Close-up, the side turn in Table.
   */
  resetCamera(state: State, side?: Side): void {
    const cam = this.scene.camera;
    const p = state.players[state.turn.seat];
    const tile = p.jail ? IN_JAIL : p.position;
    cam.toSide(side ?? sideOfTile(tile), true);
    if (cam.closeup) cam.shot(cam.homePose(tile), CLOSEUP.shotSmooth, true);
    cam.apply();
    this.scene.renderer.requestRender();
  }

  private instant(label: string, f: () => void): Animation {
    return { label, start: () => void f(), finish: () => {} };
  }

  private momentAnim(m: Moment, tile?: number, sound?: () => void): Animation {
    const sc = this.scene;
    const end = () => {
      this.hooks.moment(null);
      if (tile !== undefined) sc.camera.pushIn(null);
    };
    return {
      label: `moment ${m.kind}`,
      start: () => {
        sound?.();
        this.hooks.moment(m);
        if (tile !== undefined && !this.hooks.screenOpen?.()) {
          const [x, z] = tileLocalToWorld(tileFrame(tile), 0, 0);
          sc.camera.pushIn(new THREE.Vector3(x, BOARD_TOP, z));
        }
        let t = 0;
        return (dt) => {
          t += dt * (this.speed === Infinity ? 1000 : this.speed);
          if (t < m.duration) return true;
          end();
          return false;
        };
      },
      // Skip path; the natural end runs the same cleanup from the tick above.
      finish: () => end(),
    };
  }

  play(events: GameEvent[], state: State): void {
    const q = this.scene.queue;
    const sc = this.scene;
    const speed = () => (this.speed === Infinity ? 1000 : this.speed);
    const name = (i: number) => state.seats[i].name;
    const setBanners = new Set<string>();
    const isBot = (seat: number | undefined) => seat !== undefined && state.seats[seat]?.kind !== 'human';
    /** Play a sound for an action by `seat` (fills seat and isBot). */
    const fx = (id: SoundId, seat?: number, extra: PlayCtx = {}) => this.sound.play(id, { seat, isBot: isBot(seat), ...extra });
    /** A sound in step with the animations queued so far. */
    const cue = (id: SoundId, seat?: number, extra?: PlayCtx) => q.push(this.instant(id, () => fx(id, seat, extra)));
    const banner = (id: SoundId, seat: number | null) => () => fx(id, seat ?? undefined);
    for (let ei = 0; ei < events.length; ei++) {
      const e = events[ei];
      const later = events.slice(ei + 1);
      switch (e.type) {
        case 'turnStarted': {
          cue('turn.start', e.seat);
          if (state.seats[e.seat]?.kind === 'human') cue('turn.start.local', e.seat);
          // Owner request (2026-11-18): the camera turns to the side the active token is on.
          const at = this.positions[e.seat] ?? state.players[e.seat].position;
          if (sc.camera.closeup) {
            // Stage 2 handoff: rotate to the side and move to the token in one move.
            const tile = state.players[e.seat].jail && at === 10 ? IN_JAIL : at;
            this.plannedSide = sideOfTile(tile);
            q.push(this.cameraShot('home', () => sc.camera.homePose(tile), { smooth: CLOSEUP.handoffSmooth, side: sideOfTile(tile), block: true }));
          } else this.turnTo(sideOfTile(at), true);
          break;
        }
        case 'diceRolled': {
          cue('dice.pickup', e.seat);
          if (sc.camera.closeup) {
            // Stage 2 Dice shot: pull back to the medium shot; throw at about 80% of the way.
            const at = this.positions[e.seat] ?? state.players[e.seat].position;
            q.push(this.cameraShot('dice-shot', () => sc.camera.dicePose(sc.camera.side, at), { smooth: CLOSEUP.shotSmooth, block: true, gate: CLOSEUP.diceGate }));
          }
          let th: ReturnType<typeof simulateThrow> | undefined;
          let settled = false;
          const settle = () => {
            if (settled) return;
            settled = true;
            fx('dice.settle', e.seat);
          };
          q.push({
            label: 'dice',
            start: () => {
              // Thrown from the side the camera faces (the active player's view).
              const opts = { sideYaw: SIDE_YAW[sc.camera.side], floorY: BOARD_TOP };
              th = this.speed === Infinity ? placeFlat(e.dice, this.cosmetic, opts) : simulateThrow(e.dice, this.cosmetic, opts);
              fx('dice.throw', e.seat);
              if (this.speed === Infinity) fx('dice.instant', e.seat);
              settled = false;
              return sc.dice.play(
                th,
                this.speed === Infinity ? 1000 : this.speed,
                (c) => fx(c.kind === 'die' ? 'dice.bounce.die' : 'dice.bounce.wood', e.seat, { intensity: c.intensity }),
                settle,
              );
            },
            finish: () => {
              if (th) sc.dice.pose(th, Infinity);
              settle();
            },
          });
          if (e.doubles) cue('dice.doubles', e.seat);
          else {
            // A roll for doubles in jail failed: still jailed afterwards (not newly jailed), or
            // released only because the last attempt ran out.
            const stillJailed = state.players[e.seat]?.jail && !later.some((x) => x.type === 'jailed' && x.seat === e.seat);
            const outOfTries = later.some((x) => x.type === 'released' && x.seat === e.seat && x.how === 'maxTurns');
            if (stillJailed || outOfTries) cue('jail.doublesFail', e.seat);
          }
          break;
        }
        case 'moved': {
          const id = this.tokenOf(state, e.seat);
          const closeup = sc.camera.closeup;
          const target = e.steps === 0 && e.to === 10 && state.players[e.seat].jail ? IN_JAIL : e.to;
          if (e.steps === 0) {
            // Direct move (to jail): glide. Close-up pulls back to the Table rest view for it.
            if (closeup) q.push(this.cameraShot('pull-back', () => sc.camera.restPose(SIDE_YAW[sc.camera.side], 1), { smooth: CLOSEUP.shotSmooth, block: true, gate: 0.9 }));
            cue('token.glide', e.seat);
            q.push(sc.tokens.glide(id, target, speed, closeup ? undefined : this.follow));
          } else {
            const n = Math.abs(e.steps);
            const dir = Math.sign(e.steps) as 1 | -1;
            const path = Array.from({ length: n }, (_, k) => (((e.from + dir * (k + 1)) % 40) + 40) % 40);
            // Instant speed: one tap on arrival (after the move) instead of a tap per tile.
            const instant = this.speed === Infinity;
            const step = instant ? undefined : (_k: number, last: boolean) => fx(last ? 'token.land' : 'token.step', e.seat);
            q.push(sc.tokens.travel(id, path, speed, closeup ? this.chaseFollow(e.from, dir) : this.follow, step));
            if (instant) cue('token.instant', e.seat);
          }
          this.positions[e.seat] = e.to;
          if (closeup) {
            // Stage 2 Landed shot: the group, its signs and buildings; holds through the buy
            // prompt, auction, rent and cards. The side (and light rig) switches on landing.
            const side = sideOfTile(target);
            this.plannedSide = side;
            q.push(this.cameraShot('landed', () => sc.camera.homePose(target, e.steps < 0 ? -1 : 1), { smooth: CLOSEUP.shotSmooth, side }));
          } else {
            // Landed on another side of the board: the camera turns there once the token lands.
            this.turnTo(sideOfTile(e.to));
          }
          break;
        }
        case 'propertyTransferred': {
          const color = e.to === null ? null : state.seats[e.to].color;
          q.push(
            this.instant('owner', () => {
              sc.decals.setOwner(e.tile, color);
              // SOLD sign pops up (re-colors on a new owner, sinks when the bank takes it back).
              sc.signs.setOwner(e.tile, color, true);
              // At all speeds (fix §8.2): batching keeps Instant from stacking them.
              fx(color ? 'property.transfer' : 'property.toBank', e.to ?? undefined);
              sc.renderer.requestRender();
            }),
          );
          const g = state.board.tiles[e.tile].group;
          if (e.to !== null && g && !setBanners.has(g) && groupTiles(state.board, g).every((i) => state.tiles[i].owner === e.to)) {
            setBanners.add(g);
            const sub = groupTiles(state.board, g).map((i) => state.board.tiles[i].name).join(' · ');
            q.push(this.momentAnim({ kind: 'banner', title: `${name(e.to)} owns the full set`, subtitle: sub, seat: e.to, tone: 'forest', duration: BANNER_TIME }, undefined, banner('banner.setComplete', e.to)));
          }
          break;
        }
        case 'mortgaged':
        case 'unmortgaged':
          q.push(this.instant('mortgage', () => sc.decals.setMortgaged(e.tile, e.type === 'mortgaged')));
          break;
        case 'built': {
          q.push({ label: 'build', start: () => (fx(e.buildings === 5 ? 'building.hotel' : 'building.house', e.seat), sc.buildings.add(e.tile, this.speed === Infinity ? 0 : 1 / this.speed)) });
          break;
        }
        case 'sold': {
          q.push({ label: 'sell', start: () => (fx('building.sell', e.seat), sc.buildings.remove(e.tile, this.speed === Infinity ? 0 : 1 / this.speed)) });
          break;
        }
        case 'cardDrawn': {
          const card: CardView = { deck: e.deck, text: e.text, seat: e.seat };
          q.push({
            label: 'card',
            start: () => {
              fx(e.deck === 'chance' ? 'card.chance.draw' : 'card.chest.draw', e.seat);
              this.hooks.card(card);
              fx('card.reveal', e.seat);
              let t = 0;
              return (dt) => {
                t += dt * speed();
                return t < CARD_TIME;
              };
            },
            finish: () => this.hooks.card(null),
          });
          q.push(
            this.instant('card-off', () => {
              this.hooks.card(null);
              fx('card.dismiss', e.seat);
            }),
          );
          break;
        }
        case 'bankrupt': {
          const id = this.tokenOf(state, e.seat);
          q.push(
            this.instant('bankrupt', () => {
              sc.tokens.remove(id);
              fx('token.removed', e.seat);
            }),
          );
          const sub = e.creditor === 'bank' ? 'Everything returns to the bank' : `Everything goes to ${name(e.creditor)}`;
          q.push(this.momentAnim({ kind: 'banner', title: `${name(e.seat)} is bankrupt`, subtitle: sub, seat: e.seat, tone: 'oxblood', duration: BANNER_TIME }, undefined, banner('banner.bankrupt', e.seat)));
          break;
        }
        case 'rentWaived': {
          // Stage 3 §5.1: the rent moment becomes a short rent-free banner.
          const sub = `${name(e.seat)} skips $${e.rent.toLocaleString('en-US')} on ${state.board.tiles[e.tile].name}`;
          const title = `Rent-free (${name(e.owner)}'s voucher) · ${e.promise.left} left`;
          q.push(this.momentAnim({ kind: 'banner', title, subtitle: sub, seat: e.seat, tone: 'forest', duration: BANNER_TIME }, e.tile, banner('banner.rentFree', e.seat)));
          break;
        }
        case 'bankBackingEnded': {
          const bots = e.seats.map((i) => name(i)).join(' and ');
          if (e.mode === 'remove') {
            for (const i of e.seats) {
              const id = this.tokenOf(state, i);
              q.push(
                this.instant('leave', () => {
                  sc.tokens.remove(id);
                  fx('token.removed', i);
                }),
              );
            }
          }
          const title = e.mode === 'remove' ? `${bots} ${e.seats.length > 1 ? 'leave' : 'leaves'} the table` : `The bank stops backing ${bots}`;
          const sub = `${name(e.by)} built the first hotel${e.mode === 'cutoff' ? ` · now playing on $${e.cash.toLocaleString('en-US')}` : ''}`;
          q.push(this.momentAnim({ kind: 'banner', title, subtitle: sub, seat: e.seats[0], tone: 'brass', duration: BANNER_TIME }, undefined, banner('banner.botsLeave', e.seats[0])));
          break;
        }
        case 'payment': {
          if (e.amount <= 0) break;
          const actor = typeof e.from === 'number' ? e.from : typeof e.to === 'number' ? e.to : undefined;
          cue(paymentSoundId(e, state.board), actor, { amount: e.amount, payer: e.from, payee: e.to });
          const bankBotPays = typeof e.from === 'number' && state.seats[e.from].kind === 'bankBot';
          const before = [...e.cash];
          if (typeof e.from === 'number' && !bankBotPays) before[e.from] += e.amount;
          if (typeof e.to === 'number') before[e.to] -= e.amount;
          const payerBefore = typeof e.from === 'number' ? e.cash[e.from] + e.amount : null;
          // Big payments keep the full moment; bank-backed bots' payments and bankruptcy
          // hand-overs never get the banner.
          if (!bankBotPays && e.reason !== 'bankruptcy' && isBigPayment(this.settings(), e.amount, payerBefore)) {
            const m: Moment = { kind: 'payment', from: e.from, to: e.to, amount: e.amount, reason: e.reason, tile: e.tile, before, after: e.cash, duration: PAYMENT_TIME };
            q.push(this.momentAnim(m, e.tile));
            break;
          }
          if (!this.settings().everyPayment) break;
          const duration = MANAGE_REASONS.has(e.reason) ? MANAGE_TRANSFER_TIME : TRANSFER_TIME;
          q.push(this.momentAnim({ kind: 'transfer', from: e.from, to: e.to, amount: e.amount, reason: e.reason, before, after: e.cash, duration }));
          break;
        }
        case 'loanSeized': {
          q.push(this.momentAnim({ kind: 'banner', title: `${name(e.seat)} missed a loan payment`, subtitle: `The bank seized ${e.tiles.map((t) => state.board.tiles[t].name).join(', ')}`, seat: e.seat, tone: 'oxblood', duration: BANNER_TIME }, undefined, banner('banner.seizure', e.seat)));
          break;
        }
        case 'auctionEnded': {
          this.auctionLeader = null;
          if (e.winner === null) {
            cue('auction.noWinner');
            break;
          }
          const what = e.kind === 'house' || e.kind === 'hotel' ? `A ${e.kind}` : state.board.tiles[e.tile].name;
          const sub = `${what} for $${e.amount.toLocaleString('en-US')}`;
          q.push(this.momentAnim({ kind: 'banner', title: `${name(e.winner)} wins the auction`, subtitle: sub, seat: e.winner, tone: 'brass', duration: BANNER_TIME }, undefined, banner('banner.auctionWon', e.winner)));
          break;
        }
        // Silent hooks (audio Phase 0 §4): IDs with no sound yet, so files can be dropped in.
        case 'turnEnded':
          cue('turn.end', e.seat);
          break;
        case 'passedGo':
          cue('go.pass', e.seat);
          break;
        case 'debtPending':
          cue('debt.pending', e.debt.from);
          break;
        case 'jailed':
          cue('jail.enter', e.seat);
          break;
        case 'released':
          cue(e.how === 'card' ? 'jail.release.card' : 'jail.release', e.seat);
          break;
        case 'auctionStarted':
          this.auctionLeader = null;
          cue('auction.start');
          break;
        case 'bid': {
          const change = this.auctionLeader !== null && this.auctionLeader !== e.seat;
          this.auctionLeader = e.seat;
          cue(change ? 'auction.leaderChange' : 'auction.bid', e.seat);
          break;
        }
        case 'passed':
          cue('auction.pass', e.seat);
          break;
        case 'tradeProposed': {
          const o = e.offer;
          if (state.seats[o.from]?.kind !== 'human' && state.seats[o.to]?.kind === 'human') cue('trade.incomingFromBot', o.from);
          else cue('trade.propose', o.from);
          break;
        }
        case 'tradeAccepted':
          cue('trade.accept', e.offer.to);
          break;
        case 'tradeRejected': {
          const o = e.offer;
          const next = later[0];
          const counter = next?.type === 'tradeProposed' && next.offer.from === o.to && next.offer.to === o.from;
          cue(counter ? 'trade.counter' : 'trade.decline', o.to);
          break;
        }
        case 'promiseEnded':
          cue('promise.ended');
          break;
        case 'gameOver':
          cue('game.over', e.winner ?? undefined);
          break;
        default:
          break;
      }
    }
    // After this batch every token stands where the engine says (later batches build on it).
    this.positions = state.players.map((p) => p.position);
    q.push(this.instant('sync', () => this.sync(state, true)));
    sc.renderer.requestRender();
  }

  /** Make the scene match the engine state exactly (load, skip, end of every batch). */
  sync(state: State, queued = false): void {
    const sc = this.scene;
    if (!queued) {
      // Loaded, resumed or skipped: start tracking from this state.
      this.positions = state.players.map((p) => p.position);
      this.plannedSide = null;
    }
    const live = new Set<string>();
    state.seats.forEach((seat, i) => {
      const p = state.players[i];
      const id = seat.token as TokenId;
      if (p.bankrupt) {
        sc.tokens.remove(id);
        return;
      }
      live.add(id);
      const tile = p.jail ? IN_JAIL : p.position;
      if (!sc.tokens.tokens.has(id)) sc.tokens.add(id, seat.color, tile);
      else sc.tokens.place(id, tile);
    });
    for (const id of [...sc.tokens.tokens.keys()]) if (!live.has(id)) sc.tokens.remove(id);
    state.tiles.forEach((ts, i) => {
      if (!state.board.tiles[i].price) return;
      sc.decals.setOwner(i, ts.owner === null ? null : state.seats[ts.owner].color);
      sc.signs.setOwner(i, ts.owner === null ? null : state.seats[ts.owner].color);
      sc.decals.setMortgaged(i, ts.mortgaged);
      sc.decals.setPromiseBadges(i, promiseBadgesOn(state, i));
      sc.decals.setPledged(i, state.players.some((p) => p.loans.some((l) => l.collateral.includes(i))));
      const cur = sc.buildings.countOn(i);
      const want = { houses: ts.buildings === 5 ? 0 : ts.buildings, hotel: ts.buildings === 5 };
      if (cur.houses !== want.houses || cur.hotel !== want.hotel) sc.buildings.set(i, want.houses, want.hotel);
    });
    sc.renderer.requestRender();
  }

  /** Confirm skips to the end state. */
  skip(): void {
    this.scene.queue.flush();
    // A close-up move still easing after its queue item ended snaps too (Stage 2 section 2.6).
    if (this.scene.camera.closeup) this.scene.camera.settle();
    this.scene.renderer.requestRender();
  }
}
