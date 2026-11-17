// Director (SPEC §12): consumes engine events in order and turns them into a queue of
// skippable, speed-scaled animations. The engine state is always the source of truth; after
// every batch the scene is re-synced to it.
import * as THREE from 'three';
import { BOARD_TOP, IN_JAIL, SIDE_YAW, tileFrame, tileLocalToWorld } from '../render/layout';
import { placeFlat, simulateThrow } from '../render/diceSim';
import type { GameScene } from '../render/scene';
import type { TokenId } from '../render/tokens/tokens';
import { Rng } from '../engine/rng';
import { groupTiles, type Creditor, type GameEvent, type State } from '../engine';
import { DEFAULT_SETTINGS, isBigPayment, type Settings } from '../app/settings';
import type { Animation } from './queue';

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
  | { kind: 'banner'; title: string; subtitle?: string; seat: number | null; tone: 'oxblood' | 'forest' | 'brass'; duration: number };

export interface DirectorHooks {
  card(card: CardView | null): void;
  moment(m: Moment | null): void;
  idle(): void;
}

const PAYMENT_TIME = 2.2;
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
          const side = state.seats[e.seat].boardSide;
          q.push({
            label: 'turn',
            start: () => {
              sc.camera.toSide(side, this.speed === Infinity);
              return () => sc.camera.rotating;
            },
            finish: () => sc.camera.toSide(side, true),
          });
          break;
        }
        case 'diceRolled': {
          const sideYaw = SIDE_YAW[state.seats[e.seat].boardSide];
          let th: ReturnType<typeof simulateThrow> | undefined;
          q.push({
            label: 'dice',
            start: () => {
              const opts = { sideYaw, floorY: BOARD_TOP };
              th = this.speed === Infinity ? placeFlat(e.dice, this.cosmetic, opts) : simulateThrow(e.dice, this.cosmetic, opts);
              return sc.dice.play(th, this.speed === Infinity ? 1000 : this.speed);
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
            q.push(sc.tokens.travel(id, path, speed, this.follow));
          }
          break;
        }
        case 'propertyTransferred': {
          const color = e.to === null ? null : state.seats[e.to].color;
          q.push(this.instant('owner', () => sc.decals.setOwner(e.tile, color)));
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
          q.push({ label: 'build', start: () => sc.buildings.add(e.tile, this.speed === Infinity ? 0 : 1 / this.speed) });
          break;
        }
        case 'sold': {
          q.push({ label: 'sell', start: () => sc.buildings.remove(e.tile, this.speed === Infinity ? 0 : 1 / this.speed) });
          break;
        }
        case 'cardDrawn': {
          const card: CardView = { deck: e.deck, text: e.text, seat: e.seat };
          q.push({
            label: 'card',
            start: () => {
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
        case 'payment': {
          if (e.reason === 'bankruptcy') break;
          if (typeof e.from === 'number' && state.seats[e.from].kind === 'bankBot') break;
          const payerBefore = typeof e.from === 'number' ? e.cash[e.from] + e.amount : null;
          if (!isBigPayment(this.settings(), e.amount, payerBefore)) break;
          const before = [...e.cash];
          if (typeof e.from === 'number') before[e.from] += e.amount;
          if (typeof e.to === 'number') before[e.to] -= e.amount;
          const m: Moment = { kind: 'payment', from: e.from, to: e.to, amount: e.amount, reason: e.reason, tile: e.tile, before, after: e.cash, duration: PAYMENT_TIME };
          q.push(this.momentAnim(m, e.tile));
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
    q.push(this.instant('sync', () => this.sync(state)));
    sc.renderer.requestRender();
  }

  /** Make the scene match the engine state exactly (load, skip, end of every batch). */
  sync(state: State): void {
    const sc = this.scene;
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
      sc.decals.setMortgaged(i, ts.mortgaged);
      sc.decals.setPromise(i, state.promises.some((p) => p.tileId === i));
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
