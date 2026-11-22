// Gamepad manager (SPEC §4, §12 input/): polling, device ids, mapping tables, remaps, seat
// binding, reconnects. Emits intents tagged with the device that produced them, so two pads
// never cross or double their input. Injectable gamepad source + clock for tests.

export type Logical =
  | 'confirm' // bottom face
  | 'back' // right face
  | 'manage' // left face
  | 'trade' // top face
  | 'l1'
  | 'r1'
  /** Right trigger (R2 / ZR): hold to peek at the board (Stage 2). Not an intent. */
  | 'r2'
  | 'select'
  | 'start'
  | 'up'
  | 'down'
  | 'left'
  | 'right';

export const LOGICAL_ORDER: Logical[] = ['confirm', 'back', 'manage', 'trade', 'l1', 'r1', 'r2', 'select', 'start', 'up', 'down', 'left', 'right'];

export type PadKind = 'xinput' | 'ds4' | 'switchPro' | 'generic';

export type PadIntent =
  | 'confirm'
  | 'back'
  | 'manage'
  | 'trade'
  | 'cycleLeft'
  | 'cycleRight'
  | 'log'
  | 'pause'
  | 'navUp'
  | 'navDown'
  | 'navLeft'
  | 'navRight';

/** A source of raw gamepad snapshots (navigator.getGamepads in the browser). */
export interface RawPad {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}

export interface PadInfo {
  id: string;
  index: number;
  kind: PadKind;
  label: string;
  standard: boolean;
  connected: boolean;
  /** Needs the "press each button" remap before it can be used. */
  needsRemap: boolean;
}

/** Where a logical button lives on a raw pad. */
export type Source = { b: number } | { axis: number; dir: 1 | -1 } | { hat: number; value: number };
export type Mapping = Partial<Record<Logical, Source>>;

/** Standard-mapping layout (by position). */
export const STANDARD: Mapping = {
  confirm: { b: 0 },
  back: { b: 1 },
  manage: { b: 2 },
  trade: { b: 3 },
  l1: { b: 4 },
  r1: { b: 5 },
  r2: { b: 7 },
  select: { b: 8 },
  start: { b: 9 },
  up: { b: 12 },
  down: { b: 13 },
  left: { b: 14 },
  right: { b: 15 },
};

/**
 * Switch Pro Controller read directly by Chrome on Windows without the standard mapping
 * (button indices by Nintendo label: B 0, A 1, Y 2, X 3, L 4, R 5, ZL 6, ZR 7, − 8, + 9,
 * D-pad as hat on axis 9).
 */
export const SWITCH_PRO_RAW: Mapping = {
  confirm: { b: 0 },
  back: { b: 1 },
  manage: { b: 2 },
  trade: { b: 3 },
  l1: { b: 4 },
  r1: { b: 5 },
  r2: { b: 7 },
  select: { b: 8 },
  start: { b: 9 },
  up: { hat: 9, value: -1 },
  right: { hat: 9, value: -0.43 },
  down: { hat: 9, value: 0.14 },
  left: { hat: 9, value: 0.71 },
};

export function detectKind(id: string): PadKind {
  const s = id.toLowerCase();
  if (s.includes('057e') && (s.includes('2009') || s.includes('pro controller'))) return 'switchPro';
  if (s.includes('pro controller')) return 'switchPro';
  if (s.includes('054c') || s.includes('wireless controller') || s.includes('dualshock')) return 'ds4';
  if (s.includes('xinput') || s.includes('xbox')) return 'xinput';
  return 'generic';
}

export const KIND_LABEL: Record<PadKind, string> = {
  xinput: 'Xbox-style pad (DS4Windows or Xbox)',
  ds4: 'DualShock 4 (raw)',
  switchPro: 'Switch Pro Controller',
  generic: 'Gamepad',
};

/** Glyph family for on-screen prompts. */
export type GlyphFamily = 'playstation' | 'nintendo';
export function glyphFamily(kind: PadKind): GlyphFamily {
  return kind === 'switchPro' ? 'nintendo' : 'playstation';
}

export interface InputClock {
  now(): number;
}

export interface IntentEvent {
  intent: PadIntent;
  deviceId: string;
  /** Seat the device is bound to, if any. */
  seat: number | null;
}

interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const memoryStore = (): Store => {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
};

export const browserStore: Store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
};

const BINDINGS_KEY = 'property-night.bindings.v1';
const REMAPS_KEY = 'property-night.remaps.v1';
const REPEAT_DELAY = 350;
const REPEAT_EVERY = 120;
const STICK = 0.55;

interface PadRuntime {
  prev: Record<string, boolean>;
  held: Partial<Record<string, number>>;
}

export class InputManager {
  pads = new Map<string, PadInfo>();
  /** deviceId → seat */
  bindings = new Map<string, number>();
  remaps = new Map<string, Mapping>();
  swapNintendo = false;
  /** Test board (Batch 4): any pad's right stick nudges the camera, bound or not. */
  nudgeAnyPad = false;
  onIntent: (e: IntentEvent) => void = () => {};
  onPadsChanged: () => void = () => {};
  /** Any button on any pad (lobby join, remap capture). */
  onAnyButton: (deviceId: string) => void = () => {};
  onDisconnect: (deviceId: string, seat: number | null) => void = () => {};
  onReconnect: (deviceId: string, seat: number | null) => void = () => {};
  onNudge: (x: number, y: number) => void = () => {};
  /** Stage 2: R2 / ZR held on any bound pad (true) or released by all (false). */
  onPeek: (held: boolean) => void = () => {};
  /** While set, raw presses go to the remap capture instead of intents. */
  capture: ((deviceId: string, src: Source) => void) | null = null;

  private rt = new Map<string, PadRuntime>();
  private lastNudge: [number, number] = [0, 0];
  private lastPeek = false;
  private captureRest = new Map<string, readonly number[]>();

  constructor(
    private source: () => (RawPad | null)[] = () => (navigator.getGamepads?.() ?? []) as (RawPad | null)[],
    private clock: InputClock = { now: () => performance.now() },
    private store: Store = memoryStore(),
  ) {
    try {
      const b = this.store.get(BINDINGS_KEY);
      if (b) this.bindings = new Map(JSON.parse(b));
      const r = this.store.get(REMAPS_KEY);
      if (r) this.remaps = new Map(JSON.parse(r));
    } catch {
      /* ignore corrupt storage */
    }
  }

  private persist(): void {
    this.store.set(BINDINGS_KEY, JSON.stringify([...this.bindings]));
    this.store.set(REMAPS_KEY, JSON.stringify([...this.remaps]));
  }

  bind(deviceId: string, seat: number): void {
    for (const [d, s] of this.bindings) if (s === seat && d !== deviceId) this.bindings.delete(d);
    this.bindings.set(deviceId, seat);
    this.persist();
    this.onPadsChanged();
  }

  unbind(deviceId: string): void {
    this.bindings.delete(deviceId);
    this.persist();
    this.onPadsChanged();
  }

  clearBindings(): void {
    this.bindings.clear();
    this.persist();
    this.onPadsChanged();
  }

  seatOf(deviceId: string): number | null {
    return this.bindings.get(deviceId) ?? null;
  }

  deviceForSeat(seat: number): PadInfo | null {
    for (const [d, s] of this.bindings) if (s === seat) return this.pads.get(d) ?? null;
    return null;
  }

  setRemap(deviceId: string, mapping: Mapping): void {
    this.remaps.set(deviceId, mapping);
    this.persist();
    const p = this.pads.get(deviceId);
    if (p) p.needsRemap = false;
    this.onPadsChanged();
  }

  mappingFor(info: PadInfo): Mapping | null {
    const custom = this.remaps.get(info.id);
    if (custom) return custom;
    if (info.standard) return STANDARD;
    if (info.kind === 'switchPro') return SWITCH_PRO_RAW;
    return null;
  }

  private read(src: Source, pad: RawPad): boolean {
    // Triggers are analog on some pads: past halfway counts as pressed.
    if ('b' in src) return !!pad.buttons[src.b]?.pressed || (pad.buttons[src.b]?.value ?? 0) > 0.5;
    if ('axis' in src) return (pad.axes[src.axis] ?? 0) * src.dir > STICK;
    const v = pad.axes[src.hat];
    return v !== undefined && Math.abs(v - src.value) < 0.1;
  }

  /** Poll once (call every frame). */
  poll(): void {
    const now = this.clock.now();
    const raw = this.source().filter((p): p is RawPad => !!p && p.connected);
    const seen = new Set<string>();
    let changed = false;
    let nx = 0;
    let ny = 0;
    let peek = false;
    for (const pad of raw) {
      // Two identical pads share an id string; the index keeps them apart.
      const id = this.uniqueId(pad, raw);
      seen.add(id);
      let info = this.pads.get(id);
      if (!info || !info.connected) {
        const kind = detectKind(pad.id);
        const standard = pad.mapping === 'standard';
        const wasKnown = !!info;
        info = {
          id,
          index: pad.index,
          kind,
          label: KIND_LABEL[kind],
          standard,
          connected: true,
          needsRemap: !standard && kind !== 'switchPro' && !this.remaps.has(id),
        };
        this.pads.set(id, info);
        this.rt.set(id, { prev: {}, held: {} });
        changed = true;
        if (wasKnown || this.bindings.has(id)) this.onReconnect(id, this.seatOf(id));
      }
      info.index = pad.index;
      if (this.capture) {
        this.captureFrom(id, pad);
        continue;
      }
      const mapping = this.mappingFor(info);
      if (!mapping) {
        // Unmapped pad: any button still counts for joining / starting a remap.
        if (pad.buttons.some((b) => b.pressed) && !this.rt.get(id)!.prev.any) this.onAnyButton(id);
        this.rt.get(id)!.prev.any = pad.buttons.some((b) => b.pressed);
        continue;
      }
      this.pollPad(id, info, pad, mapping, now);
      if (this.bindings.has(id) || this.nudgeAnyPad) {
        if (this.rt.get(id)!.prev.r2) peek = true;
        const ax = pad.axes[2] ?? 0;
        const ay = pad.axes[3] ?? 0;
        if (Math.abs(ax) > 0.2) nx = ax;
        if (Math.abs(ay) > 0.2) ny = -ay;
      }
    }
    for (const [id, info] of this.pads) {
      if (info.connected && !seen.has(id)) {
        info.connected = false;
        changed = true;
        this.onDisconnect(id, this.seatOf(id));
      }
    }
    if (peek !== this.lastPeek) {
      this.lastPeek = peek;
      this.onPeek(peek);
    }
    if (nx !== this.lastNudge[0] || ny !== this.lastNudge[1]) {
      this.lastNudge = [nx, ny];
      this.onNudge(nx, ny);
    }
    if (changed) this.onPadsChanged();
  }

  private uniqueId(pad: RawPad, all: RawPad[]): string {
    const same = all.filter((p) => p.id === pad.id);
    return same.length > 1 ? `${pad.id}#${same.indexOf(pad) + 1}` : pad.id;
  }

  /**
   * Stage 3 hold-to-accept: is the Confirm button held right now on the pad bound to `seat`
   * (or on any bound pad when `seat` is null)? Uses the last poll's button state.
   */
  confirmHeld(seat: number | null = null): boolean {
    for (const [id, info] of this.pads) {
      if (!info.connected) continue;
      const s = this.seatOf(id);
      if (s === null || (seat !== null && s !== seat)) continue;
      const prev = this.rt.get(id)?.prev ?? {};
      for (const l of ['confirm', 'back'] as const) if (prev[l] && this.logicalToIntent(l, info) === 'confirm') return true;
    }
    return false;
  }

  private logicalToIntent(l: Logical, info: PadInfo): PadIntent | null {
    let x = l;
    // Optional swap for Nintendo pads: A (right face) confirms, B (bottom) goes back.
    if (this.swapNintendo && info.kind === 'switchPro') {
      if (l === 'confirm') x = 'back';
      else if (l === 'back') x = 'confirm';
    }
    switch (x) {
      case 'confirm':
        return 'confirm';
      case 'back':
        return 'back';
      case 'manage':
        return 'manage';
      case 'trade':
        return 'trade';
      case 'l1':
        return 'cycleLeft';
      case 'r1':
        return 'cycleRight';
      case 'r2':
        return null;
      case 'select':
        return 'log';
      case 'start':
        return 'pause';
      case 'up':
        return 'navUp';
      case 'down':
        return 'navDown';
      case 'left':
        return 'navLeft';
      case 'right':
        return 'navRight';
    }
    return null;
  }

  private pollPad(id: string, info: PadInfo, pad: RawPad, mapping: Mapping, now: number): void {
    const rt = this.rt.get(id)!;
    const emit = (l: Logical) => {
      const intent = this.logicalToIntent(l, info);
      if (intent) this.onIntent({ intent, deviceId: id, seat: this.seatOf(id) });
    };
    const stick: Partial<Record<Logical, boolean>> = {
      up: (pad.axes[1] ?? 0) < -STICK,
      down: (pad.axes[1] ?? 0) > STICK,
      left: (pad.axes[0] ?? 0) < -STICK,
      right: (pad.axes[0] ?? 0) > STICK,
    };
    let anyNew = false;
    for (const l of LOGICAL_ORDER) {
      const src = mapping[l];
      const down = (src ? this.read(src, pad) : false) || !!stick[l];
      const was = !!rt.prev[l];
      if (down && !was) {
        anyNew = true;
        emit(l);
        if (l === 'up' || l === 'down' || l === 'left' || l === 'right') rt.held[l] = now + REPEAT_DELAY;
      } else if (down && was && rt.held[l] !== undefined && now >= rt.held[l]!) {
        emit(l);
        rt.held[l] = now + REPEAT_EVERY;
      } else if (!down) delete rt.held[l];
      rt.prev[l] = down;
    }
    if (anyNew) this.onAnyButton(id);
  }

  // ---- remap capture ("press each button") --------------------------------------------------

  private captureFrom(id: string, pad: RawPad): void {
    const rest = this.captureRest.get(id) ?? pad.axes;
    if (!this.captureRest.has(id)) this.captureRest.set(id, [...pad.axes]);
    const rt = this.rt.get(id)!;
    pad.buttons.forEach((b, i) => {
      const key = `b${i}`;
      if (b.pressed && !rt.prev[key]) this.capture?.(id, { b: i });
      rt.prev[key] = b.pressed;
    });
    pad.axes.forEach((v, i) => {
      const key = `a${i}`;
      const moved = Math.abs(v - (rest[i] ?? 0)) > 0.5;
      if (moved && !rt.prev[key]) {
        // Hats report discrete values; sticks report direction.
        const hat = Math.abs(v) <= 1 && Math.abs((rest[i] ?? 0) - 1.2857) < 0.1;
        this.capture?.(id, hat ? { hat: i, value: Math.round(v * 100) / 100 } : { axis: i, dir: v > 0 ? 1 : -1 });
      }
      rt.prev[key] = moved;
    });
  }

  endCapture(): void {
    this.capture = null;
    this.captureRest.clear();
    for (const rt of this.rt.values()) rt.prev = {};
  }
}
