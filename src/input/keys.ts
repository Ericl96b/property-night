// M0 input: keyboard + basic Gamepad API polling, emitting intents by button position
// (SPEC §4 layout). Full controller assignment, remapping and seat ownership arrive in M4.

export type Intent =
  | 'confirm'
  | 'back'
  | 'manage'
  | 'trade'
  | 'cycleLeft'
  | 'cycleRight'
  | 'pause'
  | 'log'
  | 'fullscreen'
  | 'nextPlayer';

export interface InputHandlers {
  intent(i: Intent): void;
  /** Camera nudge vector in [−1, 1]² (x = yaw, y = pitch); (0, 0) when released. */
  nudge(x: number, y: number): void;
}

const KEYMAP: Record<string, Intent> = {
  Space: 'confirm',
  Enter: 'confirm',
  Escape: 'back',
  KeyB: 'manage',
  KeyV: 'trade',
  KeyQ: 'cycleLeft',
  KeyE: 'cycleRight',
  KeyN: 'nextPlayer',
  KeyF: 'fullscreen',
  KeyP: 'pause',
  Tab: 'log',
};

// Standard-mapping button indices by position.
const PAD: Record<number, Intent> = {
  0: 'confirm', // bottom face
  1: 'back', // right face
  2: 'manage', // left face
  3: 'trade', // top face
  4: 'cycleLeft', // L1
  5: 'cycleRight', // R1
  8: 'log', // select / share / −
  9: 'pause', // start / options / +
  15: 'nextPlayer', // d-pad right
};

export function startInput(h: InputHandlers): void {
  const held = new Set<string>();
  const nudgeFromKeys = () => {
    const x = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
    const y = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
    h.nudge(x, y);
  };
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
    if (e.code.startsWith('Arrow')) {
      held.add(e.code);
      nudgeFromKeys();
      e.preventDefault();
      return;
    }
    const intent = KEYMAP[e.code];
    if (intent && !e.repeat) {
      e.preventDefault();
      h.intent(intent);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code.startsWith('Arrow')) {
      held.delete(e.code);
      nudgeFromKeys();
    }
  });

  // Gamepads: poll every frame on a lightweight loop (no rendering).
  const prev = new Map<number, boolean[]>();
  let lastNudge = [0, 0];
  const poll = () => {
    const pads = navigator.getGamepads?.() ?? [];
    let nx = 0;
    let ny = 0;
    for (const pad of pads) {
      if (!pad) continue;
      const before = prev.get(pad.index) ?? [];
      const now = pad.buttons.map((b) => b.pressed);
      now.forEach((pressed, i) => {
        if (pressed && !before[i] && PAD[i]) h.intent(PAD[i]);
      });
      prev.set(pad.index, now);
      const ax = pad.axes[2] ?? 0;
      const ay = pad.axes[3] ?? 0;
      if (Math.abs(ax) > 0.18) nx = ax;
      if (Math.abs(ay) > 0.18) ny = -ay;
    }
    if (nx !== lastNudge[0] || ny !== lastNudge[1]) {
      lastNudge = [nx, ny];
      if (!held.size) h.nudge(nx, ny);
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
