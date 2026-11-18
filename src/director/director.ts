// Director (SPEC §12): consumes engine events in order and turns them into a queue of
// skippable, speed-scaled animations. The engine state is always the source of truth; after
// every batch the scene is re-synced to it.
import * as THREE from 'three';
import { BOARD_TOP, IN_JAIL, SIDE_YAW, sideOfTile, tileFrame, tileLocalToWorld, type Side } from '../render/layout';
import { placeFlat, simulateThrow } from '../render/diceSim';
import type { GameScene } from '../render/scene';
import type { TokenId } from '../render/tokens/tokens';
import { Rng } from '../engine/rng';
import { groupTiles, type Creditor, type GameEvent, type State } from '../engine';
import { DEFAULT_SETTINGS, isBigPayment, type Settings } from '../app/settings';
import type { Animation } from './queue';
import { SILENT, type SoundFx } from '../audio/sound';

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
  /** Sound effects (SPEC §9); silent in tests and until audio is unlocked. */
  sound: SoundFx = SILENT;

  constructor(
    private scene: GameScene,
    private hooks: DirectorHooks,
    seed = 1,
  ) {
    this.cosmetic = new Rng(seed ^ 0x5bd1e995);
    this.scene.queue.onIdle = () => this.hooks.idle();
  }

  get busy(): boolean {
    return this.scene.queue.busy;
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

  private instant(label: string, f: () => void): Animation {
    return { label, start: () => void f(), finish: () => {} };
  }

  private momentAnim(m: Moment, tile?: number): Animation {
    const sc = this.scene;
    const end = () => {
      this.hooks.moment(null);
      if (tile !== undefined) sc.camera.pushIn(null);
    };
    return {
      label: `moment ${m.kind}`,
      start: () => {
        if (m.kind === 'banner') this.sound.sting(m.tone === 'oxblood' ? 'bad' : 'good');
        this.hooks.moment(m);
        if (tile !== undefined) {
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
    for (const e of events) {
      switch (e.type) {
        case 'turnStarted': {
          // Owner request (2026-11-18): the camera turns to the side the active token is on.
          this.turnTo(sideOfTile(this.positions[e.seat] ?? state.players[e.seat].position), true);
          break;
        }
        case 'diceRolled': {
          let th: ReturnType<typeof simulateThrow> | undefined;
          q.push({
            label: 'dice',
            start: () => {
              // Thrown from the side the camera faces (the active player's view).
              const opts = { sideYaw: SIDE_YAW[sc.camera.side], floorY: BOARD_TOP };
              th = this.speed === Infinity ? placeFlat(e.dice, this.cosmetic, opts) : simulateThrow(e.dice, this.cosmetic, opts);
              if (this.speed === Infinity) this.sound.dice();
              return sc.dice.play(th, this.speed === Infinity ? 1000 : this.speed, () => this.sound.dice());
            },
            finish: () => th && sc.dice.pose(th, Infinity),
          });
          break;
        }
        case 'moved': {
          const id = this.tokenOf(state, e.seat);
          if (e.steps === 0) {
            // Direct move (to jail): glide.
            const target = e.to === 10 && state.players[e.seat].jail ? IN_JAIL : e.to;
            q.push(sc.tokens.glide(id, target, speed, this.follow));
          } else {
            const n = Math.abs(e.steps);
            const dir = Math.sign(e.steps);
            const path = Array.from({ length: n }, (_, k) => (((e.from + dir * (k + 1)) % 40) + 40) % 40);
            // Instant speed: one tap on arrival instead of a tap per tile.
            const tap = this.speed === Infinity ? undefined : () => this.sound.tap();
            if (!tap) q.push(this.instant('tap', () => this.sound.tap()));
            q.push(sc.tokens.travel(id, path, speed, this.follow, tap));
          }
          // Landed on another side of the board: the camera turns there once the token lands.
          this.positions[e.seat] = e.to;
          this.turnTo(sideOfTile(e.to));
          break;
        }
        case 'propertyTransferred': {
          const color = e.to === null ? null : state.seats[e.to].color;
          q.push(
            this.instant('owner', () => {
              sc.decals.setOwner(e.tile, color);
              // SOLD sign pops up (re-colors on a new owner, sinks when the bank takes it back).
              sc.signs.setOwner(e.tile, color, true);
              if (color && this.speed !== Infinity) this.sound.tock();
              sc.renderer.requestRender();
            }),
          );
          const g = state.board.tiles[e.tile].group;
          if (e.to !== null && g && !setBanners.has(g) && groupTiles(state.board, g).every((i) => state.tiles[i].owner === e.to)) {
            setBanners.add(g);
            const sub = groupTiles(state.board, g).map((i) => state.board.tiles[i].name).join(' · ');
            q.push(this.momentAnim({ kind: 'banner', title: `${name(e.to)} owns the full set`, subtitle: sub, seat: e.to, tone: 'forest', duration: BANNER_TIME }));
          }
          break;
        }
        case 'mortgaged':
        case 'unmortgaged':
          q.push(this.instant('mortgage', () => sc.decals.setMortgaged(e.tile, e.type === 'mortgaged')));
          break;
        case 'built': {
          q.push({ label: 'build', start: () => (this.sound.tock(), sc.buildings.add(e.tile, this.speed === Infinity ? 0 : 1 / this.speed)) });
          break;
        }
        case 'sold': {
          q.push({ label: 'sell', start: () => (this.sound.tock(true), sc.buildings.remove(e.tile, this.speed === Infinity ? 0 : 1 / this.speed)) });
          break;
        }
        case 'cardDrawn': {
          const card: CardView = { deck: e.deck, text: e.text, seat: e.seat };
          q.push({
            label: 'card',
            start: () => {
              this.sound.card();
              this.hooks.card(card);
              let t = 0;
              return (dt) => {
                t += dt * speed();
                return t < CARD_TIME;
              };
            },
            finish: () => this.hooks.card(null),
          });
          q.push(this.instant('card-off', () => this.hooks.card(null)));
          break;
        }
        case 'bankrupt': {
          const id = this.tokenOf(state, e.seat);
          q.push(this.instant('bankrupt', () => sc.tokens.remove(id)));
          const sub = e.creditor === 'bank' ? 'Everything returns to the bank' : `Everything goes to ${name(e.creditor)}`;
          q.push(this.momentAnim({ kind: 'banner', title: `${name(e.seat)} is bankrupt`, subtitle: sub, seat: e.seat, tone: 'oxblood', duration: BANNER_TIME }));
          break;
        }
        case 'bankBackingEnded': {
          const bots = e.seats.map((i) => name(i)).join(' and ');
          if (e.mode === 'remove') {
            for (const i of e.seats) {
              const id = this.tokenOf(state, i);
              q.push(this.instant('leave', () => sc.tokens.remove(id)));
            }
          }
          const title = e.mode === 'remove' ? `${bots} ${e.seats.length > 1 ? 'leave' : 'leaves'} the table` : `The bank stops backing ${bots}`;
          const sub = `${name(e.by)} built the first hotel${e.mode === 'cutoff' ? ` · now playing on $${e.cash.toLocaleString('en-US')}` : ''}`;
          q.push(this.momentAnim({ kind: 'banner', title, subtitle: sub, seat: e.seats[0], tone: 'brass', duration: BANNER_TIME }));
          break;
        }
        case 'payment': {
          if (e.amount <= 0) break;
          q.push(this.instant('coins', () => this.sound.coins(e.amount)));
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
          q.push(this.momentAnim({ kind: 'banner', title: `${name(e.seat)} missed a loan payment`, subtitle: `The bank seized ${e.tiles.map((t) => state.board.tiles[t].name).join(', ')}`, seat: e.seat, tone: 'oxblood', duration: BANNER_TIME }));
          break;
        }
        case 'auctionEnded': {
          if (e.winner === null) break;
          const what = e.kind === 'house' || e.kind === 'hotel' ? `A ${e.kind}` : state.board.tiles[e.tile].name;
          const sub = `${what} for $${e.amount.toLocaleString('en-US')}`;
          q.push(this.momentAnim({ kind: 'banner', title: `${name(e.winner)} wins the auction`, subtitle: sub, seat: e.winner, tone: 'brass', duration: BANNER_TIME }));
          break;
        }
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
      sc.decals.setPromise(i, state.promises.some((p) => p.tileId === i));
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
    this.scene.renderer.requestRender();
  }
}
