// Keyboard input (always available as a fallback, SPEC §4). Gamepads live in manager.ts.
import type { Intent } from '../app/ownership';

export type { Intent };

export interface KeyboardHandlers {
  intent(i: Intent): void;
  /** Camera nudge vector in [−1, 1]² (x = yaw, y = pitch); (0, 0) when released. */
  nudge(x: number, y: number): void;
}

const KEYMAP: Record<string, Intent> = {
  Space: 'confirm',
  Enter: 'confirm',
  Escape: 'back',
  Backspace: 'back',
  KeyB: 'manage',
  KeyV: 'trade',
  KeyQ: 'cycleLeft',
  KeyE: 'cycleRight',
  KeyF: 'fullscreen',
  KeyP: 'pause',
  KeyL: 'log',
  ArrowUp: 'navUp',
  ArrowDown: 'navDown',
  ArrowLeft: 'navLeft',
  ArrowRight: 'navRight',
};

/** Shift + arrows nudge the camera (arrows alone navigate menus). */
export function startKeyboard(h: KeyboardHandlers): void {
  const held = new Set<string>();
  const nudgeFromKeys = () => {
    const x = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
    const y = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
    h.nudge(x, y);
  };
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'number');
    // Arrows on selects and number fields go through the shared stepper driver (ui/focus.ts),
    // so the keyboard behaves like the D-pad: up/down move, left/right change the value.
    const numberArrow = t instanceof HTMLInputElement && t.type === 'number' && e.code.startsWith('Arrow');
    if (typing && !numberArrow && !['Escape', 'Enter'].includes(e.code)) return;
    if (e.shiftKey && e.code.startsWith('Arrow')) {
      held.add(e.code);
      nudgeFromKeys();
      e.preventDefault();
      return;
    }
    const intent = KEYMAP[e.code];
    if (!intent) return;
    if (e.repeat && !intent.startsWith('nav')) return;
    e.preventDefault();
    h.intent(intent);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code.startsWith('Arrow')) {
      held.delete(e.code);
      nudgeFromKeys();
    }
  });
}
