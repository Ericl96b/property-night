import { describe, expect, it } from 'vitest';
import { InputManager, detectKind, type IntentEvent, type RawPad } from '../../src/input/manager';

const XBOX_ID = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
const SWITCH_ID = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';
const SWITCH_RAW_ID = 'Pro Controller (Vendor: 057e Product: 2009)';
const DS4_RAW_ID = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)';

function pad(id: string, index: number, opts: { standard?: boolean; pressed?: number[]; axes?: number[] } = {}): RawPad {
  return {
    id,
    index,
    connected: true,
    mapping: opts.standard === false ? '' : 'standard',
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!opts.pressed?.includes(i), value: opts.pressed?.includes(i) ? 1 : 0 })),
    axes: opts.axes ?? [0, 0, 0, 0],
  };
}

function rig() {
  let pads: (RawPad | null)[] = [];
  let t = 0;
  const m = new InputManager(() => pads, { now: () => t });
  const events: IntentEvent[] = [];
  m.onIntent = (e) => events.push(e);
  return {
    m,
    events,
    set: (p: (RawPad | null)[]) => (pads = p),
    tick: (ms = 16) => {
      t += ms;
      m.poll();
    },
  };
}

describe('device detection', () => {
  it('recognises DS4Windows/Xbox, raw DS4 and Switch Pro', () => {
    expect(detectKind(XBOX_ID)).toBe('xinput');
    expect(detectKind(DS4_RAW_ID)).toBe('ds4');
    expect(detectKind(SWITCH_ID)).toBe('switchPro');
  });
});

describe('input manager', () => {
  it('a DS4 (via DS4Windows) and a Switch Pro bid in the same frame without crossed or doubled input', () => {
    const r = rig();
    r.set([pad(XBOX_ID, 0), pad(SWITCH_ID, 1)]);
    r.tick();
    r.m.bind(XBOX_ID, 0);
    r.m.bind(SWITCH_ID, 1);
    // Both press Confirm on the same frame and hold it for several frames.
    r.set([pad(XBOX_ID, 0, { pressed: [0] }), pad(SWITCH_ID, 1, { pressed: [0] })]);
    r.tick();
    r.tick();
    r.tick();
    const confirms = r.events.filter((e) => e.intent === 'confirm');
    expect(confirms).toHaveLength(2);
    expect(confirms.map((e) => [e.deviceId, e.seat])).toEqual([
      [XBOX_ID, 0],
      [SWITCH_ID, 1],
    ]);
    // R1 on the Switch only cycles the Switch player's increment.
    r.set([pad(XBOX_ID, 0), pad(SWITCH_ID, 1, { pressed: [5] })]);
    r.tick();
    expect(r.events.at(-1)).toEqual({ intent: 'cycleRight', deviceId: SWITCH_ID, seat: 1 });
  });

  it('maps by position; Start pauses, Select opens the log', () => {
    const r = rig();
    r.set([pad(XBOX_ID, 0, { pressed: [9] })]);
    r.tick();
    r.set([pad(XBOX_ID, 0, { pressed: [8] })]);
    r.tick();
    r.set([pad(XBOX_ID, 0, { pressed: [1, 2, 3] })]);
    r.tick();
    expect(r.events.map((e) => e.intent)).toEqual(['pause', 'log', 'back', 'manage', 'trade']);
  });

  it('swap Confirm/Back applies to Nintendo pads only', () => {
    const r = rig();
    r.m.swapNintendo = true;
    r.set([pad(SWITCH_ID, 0, { pressed: [0] }), pad(XBOX_ID, 1, { pressed: [0] })]);
    r.tick();
    expect(r.events.map((e) => [e.deviceId, e.intent])).toEqual([
      [SWITCH_ID, 'back'],
      [XBOX_ID, 'confirm'],
    ]);
  });

  it('a raw (non-standard) Switch Pro uses the built-in table, D-pad on the hat axis', () => {
    const r = rig();
    const axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2857];
    r.set([pad(SWITCH_RAW_ID, 0, { standard: false, axes })]);
    r.tick();
    expect(r.m.pads.get(SWITCH_RAW_ID)!.needsRemap).toBe(false);
    const up = [...axes];
    up[9] = -1;
    r.set([pad(SWITCH_RAW_ID, 0, { standard: false, axes: up, pressed: [0] })]);
    r.tick();
    expect(r.events.map((e) => e.intent)).toEqual(['confirm', 'navUp']);
  });

  it('left stick navigates with repeat while held', () => {
    const r = rig();
    r.set([pad(XBOX_ID, 0, { axes: [0, 0.9, 0, 0] })]);
    r.tick(16);
    r.tick(200);
    expect(r.events.filter((e) => e.intent === 'navDown')).toHaveLength(1);
    r.tick(200); // past the 350 ms repeat delay
    r.tick(130);
    expect(r.events.filter((e) => e.intent === 'navDown')).toHaveLength(3);
  });

  it('unknown non-standard pads need a remap, and the remap capture records presses', () => {
    const r = rig();
    const id = 'Some Pad (Vendor: 1234 Product: 5678)';
    r.set([pad(id, 0, { standard: false })]);
    r.tick();
    expect(r.m.pads.get(id)!.needsRemap).toBe(true);
    const captured: unknown[] = [];
    r.m.capture = (_d, src) => captured.push(src);
    r.set([pad(id, 0, { standard: false, pressed: [7] })]);
    r.tick();
    r.set([pad(id, 0, { standard: false, axes: [0, 0.9, 0, 0] })]);
    r.tick();
    expect(captured).toEqual([{ b: 7 }, { axis: 1, dir: 1 }]);
    r.m.endCapture();
    r.m.setRemap(id, { confirm: { b: 7 } });
    r.set([pad(id, 0, { standard: false, pressed: [7] })]);
    r.tick();
    expect(r.events.at(-1)?.intent).toBe('confirm');
  });

  it('any button joins; disconnects and reconnects are reported with the bound seat', () => {
    const r = rig();
    const joins: string[] = [];
    const lost: [string, number | null][] = [];
    const back: [string, number | null][] = [];
    r.m.onAnyButton = (id) => joins.push(id);
    r.m.onDisconnect = (id, seat) => lost.push([id, seat]);
    r.m.onReconnect = (id, seat) => back.push([id, seat]);
    r.set([pad(XBOX_ID, 0, { pressed: [3] })]);
    r.tick();
    expect(joins).toEqual([XBOX_ID]);
    r.m.bind(XBOX_ID, 2);
    r.set([]);
    r.tick();
    expect(lost).toEqual([[XBOX_ID, 2]]);
    r.set([pad(XBOX_ID, 3)]);
    r.tick();
    expect(back).toEqual([[XBOX_ID, 2]]);
  });

  it('binding a seat moves it off any other device; two identical pads stay distinct', () => {
    const r = rig();
    r.set([pad(XBOX_ID, 0), pad(XBOX_ID, 1, { pressed: [0] })]);
    r.tick();
    expect([...r.m.pads.keys()]).toEqual([`${XBOX_ID}#1`, `${XBOX_ID}#2`]);
    expect(r.events[0].deviceId).toBe(`${XBOX_ID}#2`);
    r.m.bind(`${XBOX_ID}#1`, 0);
    r.m.bind(`${XBOX_ID}#2`, 0);
    expect(r.m.seatOf(`${XBOX_ID}#1`)).toBeNull();
    expect(r.m.seatOf(`${XBOX_ID}#2`)).toBe(0);
  });
});

describe('peek trigger (Stage 2)', () => {
  it('R2 / ZR held on a bound pad peeks; release ends it; no intent is emitted', () => {
    for (const [id, standard] of [
      [XBOX_ID, true],
      [SWITCH_RAW_ID, false],
    ] as const) {
      const r = rig();
      const peeks: boolean[] = [];
      r.m.onPeek = (h) => peeks.push(h);
      r.set([pad(id, 0, { standard })]);
      r.tick();
      r.m.bind(id, 0);
      r.set([pad(id, 0, { standard, pressed: [7] })]);
      r.tick();
      r.tick();
      r.set([pad(id, 0, { standard })]);
      r.tick();
      expect(peeks).toEqual([true, false]);
      expect(r.events).toHaveLength(0);
    }
  });

  it('an analog trigger counts once past halfway; unbound pads do not peek', () => {
    const r = rig();
    const peeks: boolean[] = [];
    r.m.onPeek = (h) => peeks.push(h);
    const analog = (v: number): RawPad => {
      const p = pad(XBOX_ID, 0);
      return { ...p, buttons: p.buttons.map((b, i) => (i === 7 ? { pressed: false, value: v } : b)) };
    };
    r.set([analog(0.8)]);
    r.tick();
    expect(peeks).toEqual([]);
    r.m.bind(XBOX_ID, 0);
    r.set([analog(0.3)]);
    r.tick();
    r.set([analog(0.8)]);
    r.tick();
    expect(peeks).toEqual([true]);
  });
});
