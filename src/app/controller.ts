// Game controller: owns the engine state, applies actions, hands events to the director,
// paces bots, and runs the auction timer. The UI reads `view` and calls `dispatch`.
// Plain TypeScript with injectable timing so it runs headless in tests.
import {
  apply,
  EngineError,
  legalActions,
  newGame,
  seatsToAct,
  type Action,
  type GameEvent,
  type NewGameConfig,
  type State,
} from '../engine';
import { chooseAction } from '../bots';
import { audio } from '../audio';
import type { CardView, DirectorLike, Moment } from '../director/director';
import type { Speed } from '../director/queue';

/** Decisions that can be undone (SPEC §9): buy, build, mortgage, trade sent. */
const UNDOABLE = new Set<Action['type']>(['buy', 'build', 'sell', 'mortgage', 'unmortgage', 'proposeTrade']);

export interface UndoPoint {
  state: State;
  actions: number;
  seat: number;
  label: string;
}

export interface GameView {
  /** State as currently shown (lags the engine while animations play). */
  state: State;
  busy: boolean;
  card: CardView | null;
  moment: Moment | null;
  /** Seats a human may act for right now. */
  humanActors: number[];
  /** Auction countdown end (ms timestamp) when the timer is running. */
  auctionDeadline: number | null;
  error: string | null;
  events: GameEvent[];
  /** Label of the decision Undo would revert, or null. */
  undo: string | null;
}

export interface Clock {
  now(): number;
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

const realClock: Clock = {
  now: () => performance.now(),
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

const BOT_PAUSE: Record<Speed, number> = { slow: 1400, normal: 1100, fast: 650, instant: 0 };

type Listener = (v: GameView) => void;

export class GameController {
  state!: State;
  private shown!: State;
  private listeners = new Set<Listener>();
  private card: CardView | null = null;
  private moment: Moment | null = null;
  private error: string | null = null;
  private lastEvents: GameEvent[] = [];
  private botTimer: unknown = null;
  private auctionTimer: unknown = null;
  private auctionDeadline: number | null = null;
  private auctionKey = '';
  private rotate = 0;
  speed: Speed = 'normal';
  /** Paused (menu open, disconnect): bots and timers wait. */
  paused = false;
  /** Every action applied since the game began (save format, replay). */
  actions: Action[] = [];
  seed = 0;
  undoEnabled = true;
  private undoPoint: UndoPoint | null = null;
  /** Called after every applied action (autosave). */
  onChange: () => void = () => {};

  constructor(
    private director: DirectorLike | null,
    private clock: Clock = realClock,
  ) {}

  /** Director hooks. */
  onCard = (c: CardView | null) => {
    this.card = c;
    this.emit();
  };

  onMoment = (m: Moment | null) => {
    this.moment = m;
    this.emit();
  };

  onIdle = () => {
    this.shown = this.state;
    this.emit();
    this.pump();
  };

  start(cfg: NewGameConfig): void {
    this.seed = cfg.seed;
    this.load(newGame(cfg), []);
    this.onChange();
  }

  /** Back to the setup screen. */
  reset(): void {
    this.stopTimers();
    this.director?.skip();
    this.state = undefined as unknown as State;
    this.shown = undefined as unknown as State;
    this.card = null;
    this.moment = null;
    this.paused = false;
    this.actions = [];
    this.undoPoint = null;
    this.emit();
  }

  load(state: State, actions: Action[] = this.actions, seed = this.seed): void {
    this.stopTimers();
    this.actions = [...actions];
    this.seed = seed;
    this.undoPoint = null;
    this.state = state;
    this.shown = state;
    this.director?.sync(state);
    this.emit();
    this.pump();
  }

  get view(): GameView {
    return {
      state: this.shown,
      busy: !!this.director?.busy,
      card: this.card,
      moment: this.moment,
      humanActors: this.humanActors(),
      auctionDeadline: this.auctionDeadline,
      error: this.error,
      events: this.lastEvents,
      undo: this.undoEnabled && this.undoPoint && !this.director?.busy ? this.undoPoint.label : null,
    };
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.view);
    return () => this.listeners.delete(l);
  }

  private emit(): void {
    const v = this.view;
    for (const l of this.listeners) l(v);
  }

  humanActors(): number[] {
    if (!this.state || this.director?.busy) return [];
    return seatsToAct(this.state).filter((i) => this.state.seats[i].kind === 'human');
  }

  /** Legal actions for a seat (empty while animating). */
  actionsFor(seat: number): Action[] {
    if (this.director?.busy || !this.state) return [];
    return legalActions(this.state, seat);
  }

  /** Apply an action. Returns an error message for illegal actions instead of throwing. */
  dispatch(action: Action): string | null {
    if (this.director?.busy && action.type !== 'auctionTimeout') {
      this.director.skip();
    }
    let events: GameEvent[];
    const before = this.state;
    try {
      const r = apply(this.state, action);
      this.state = r.state;
      events = r.events;
    } catch (e) {
      if (e instanceof EngineError) {
        // A person's action was refused (bots retry silently).
        if (this.state.seats[action.seat]?.kind === 'human') audio.play('ui.error', { seat: action.seat });
        this.error = e.message;
        this.emit();
        return e.message;
      }
      throw e;
    }
    this.error = null;
    this.lastEvents = events;
    this.actions.push(action);
    this.trackUndo(before, action, events);
    this.onChange();
    if (this.director) {
      this.director.play(events, this.state);
      this.emit();
    } else {
      this.onIdle();
    }
    this.afterAction(action, events);
    return null;
  }

  private trackUndo(before: State, action: Action, events: GameEvent[]): void {
    const human = action.seat >= 0 && before.seats[action.seat]?.kind === 'human';
    const cardOrRoll = action.type === 'roll' || events.some((e) => e.type === 'cardDrawn' || e.type === 'diceRolled');
    if (UNDOABLE.has(action.type) && human && !cardOrRoll) {
      this.undoPoint = { state: before, actions: this.actions.length - 1, seat: action.seat, label: undoLabel(before, action) };
    } else if (!this.undoPoint || cardOrRoll || action.seat !== this.undoPoint.seat || action.type === 'endTurn') {
      // The next roll or card, or another player acting, ends the undo window.
      this.undoPoint = null;
    }
  }

  /** Undo the last decision (SPEC §9). */
  undo(): boolean {
    const u = this.undoPoint;
    if (!u || !this.undoEnabled) return false;
    this.director?.skip();
    this.load(u.state, this.actions.slice(0, u.actions));
    audio.play('game.undo', { seat: u.seat });
    this.onChange();
    return true;
  }

  /** Skip running animations (Confirm). */
  skip(): void {
    this.director?.skip();
  }

  private stopTimers(): void {
    if (this.botTimer) this.clock.clearTimeout(this.botTimer);
    if (this.auctionTimer) this.clock.clearTimeout(this.auctionTimer);
    this.botTimer = null;
    this.auctionTimer = null;
    this.auctionDeadline = null;
    this.auctionKey = '';
  }

  private afterAction(action: Action, events: GameEvent[]): void {
    // Auction timer: (re)start on a new auction and on every bid.
    if (this.state.phase !== 'auction') {
      if (this.auctionTimer) this.clock.clearTimeout(this.auctionTimer);
      this.auctionTimer = null;
      this.auctionDeadline = null;
      this.auctionKey = '';
    } else if (events.some((e) => e.type === 'auctionStarted' || e.type === 'bid')) {
      this.armAuctionTimer();
    }
    void action;
  }

  private armAuctionTimer(): void {
    const secs = this.state.rules.auctionTimer;
    if (this.auctionTimer) this.clock.clearTimeout(this.auctionTimer);
    this.auctionTimer = null;
    this.auctionDeadline = null;
    if (secs <= 0) return;
    const ms = secs * 1000;
    this.auctionDeadline = this.clock.now() + ms;
    const key = `${this.state.turnNumber}:${this.state.auction?.tile}:${this.state.auction?.highBid}`;
    this.auctionKey = key;
    const fire = () => {
      if (this.paused) {
        this.auctionTimer = this.clock.setTimeout(fire, 250);
        return;
      }
      if (this.state.phase === 'auction' && this.auctionKey === key) this.dispatch({ type: 'auctionTimeout', seat: -1 });
    };
    this.auctionTimer = this.clock.setTimeout(fire, ms);
  }

  /** Let bots act when the scene is idle. */
  pump(): void {
    if (this.paused || !this.state || this.state.phase === 'gameOver') return;
    if (this.director?.busy || this.botTimer) return;
    // Auctions started while animations ran need their timer.
    if (this.state.phase === 'auction' && this.auctionDeadline === null && this.state.rules.auctionTimer > 0) this.armAuctionTimer();
    const actors = seatsToAct(this.state);
    const bots = actors.filter((i) => this.state.seats[i].kind !== 'human');
    if (!bots.length) return;
    const delay = this.state.phase === 'auction' ? BOT_PAUSE[this.speed] * 0.9 : BOT_PAUSE[this.speed];
    this.botTimer = this.clock.setTimeout(() => {
      this.botTimer = null;
      if (this.paused || this.director?.busy) return;
      const now = seatsToAct(this.state).filter((i) => this.state.seats[i].kind !== 'human');
      let chosen: Action | null = null;
      for (let k = 0; k < now.length && !chosen; k++) chosen = chooseAction(this.state, now[(this.rotate + k) % now.length]);
      this.rotate++;
      if (chosen) this.dispatch(chosen);
      else if (this.state.phase === 'auction' && this.state.rules.auctionTimer <= 0 && !this.humanActors().length) {
        this.dispatch({ type: 'auctionTimeout', seat: -1 });
      }
      this.pump();
    }, delay);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.pump();
  }
}

function undoLabel(s: State, a: Action): string {
  const t = (i: number) => s.board.tiles[i].name;
  switch (a.type) {
    case 'buy':
      return `buying ${t(s.pendingBuy!)}`;
    case 'build':
      return `building on ${t(a.tile)}`;
    case 'sell':
      return `selling on ${t(a.tile)}`;
    case 'mortgage':
      return `mortgaging ${t(a.tile)}`;
    case 'unmortgage':
      return `unmortgaging ${t(a.tile)}`;
    case 'proposeTrade':
      return 'the trade offer';
    default:
      return 'the last decision';
  }
}
