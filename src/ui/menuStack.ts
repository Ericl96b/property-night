// Menu stack (Stage 1 §1): every overlay registers a layer when it mounts, so Back, the
// on-screen Close/Back/Cancel buttons and mouse clicks all take one path: close the top layer,
// one level at a time. Focus returns to the control that opened the layer.
//
// Kinds:
//   menu     — a menu or submenu; Back closes it (returns to its parent or to the game).
//   dialog   — a confirmation; Back cancels it (same as choosing Cancel).
//   decision — a game-flow prompt (buy, auction, trade reply, debt…); Back does nothing there.
//   root     — a screen with no parent (main menu); Back does nothing there.
//
// Plain TypeScript (no Svelte imports) so it is unit-testable in node; `layer` is a Svelte action.

export type LayerKind = 'menu' | 'dialog' | 'decision' | 'root';

export interface LayerOpts {
  kind: LayerKind;
  /** Closes this layer (the same function its on-screen Close/Cancel button calls). */
  close?: () => void;
}

export interface Layer {
  id: number;
  el: Element;
  opts: LayerOpts;
  /** The control that had focus when the layer opened. */
  opener: Element | null;
  /** Fallback when the opener was re-rendered: its data-focus-key, else its label. */
  openerKey: string | null;
}

const stack: Layer[] = [];
let nextId = 1;

/** App hooks: `restored` runs after focus goes back to an opener (App marks it nav-focused). */
export const hooks: { restored: (el: HTMLElement) => void; opened: (l: Layer) => void; closed: () => void } = {
  restored: () => {},
  opened: () => {},
  closed: () => {},
};

const doc = (): Document | undefined => (globalThis as { document?: Document }).document;

export function focusKey(el: Element): string | null {
  return el.getAttribute?.('data-focus-key') ?? (el.textContent?.trim() || null);
}

export function topLayer(): Layer | undefined {
  return stack[stack.length - 1];
}

export function layers(): readonly Layer[] {
  return stack;
}

/**
 * The single Back path. Closes the top menu or cancels the top dialog and returns true;
 * returns false when the top is a game decision, a root screen, or nothing (Back does nothing).
 */
export function back(): boolean {
  const t = topLayer();
  if (!t || !t.opts.close) return false;
  if (t.opts.kind !== 'menu' && t.opts.kind !== 'dialog') return false;
  t.opts.close();
  return true;
}

function restoreFocus(l: Layer) {
  const d = doc();
  if (!d) return;
  const a = d.activeElement;
  // Something else already took focus (e.g. a newly opened layer): leave it.
  if (a && a !== d.body && a.isConnected) return;
  let target: Element | null = l.opener && l.opener.isConnected ? l.opener : null;
  if (!target && l.openerKey) {
    const scope = topLayer()?.el ?? d.body;
    const cands = scope.querySelectorAll<HTMLElement>('button, select, input, [tabindex]');
    target = [...cands].find((c) => !(c as HTMLButtonElement).disabled && focusKey(c) === l.openerKey) ?? null;
  }
  if (target instanceof Object && 'focus' in target) {
    (target as HTMLElement).focus({ focusVisible: true } as FocusOptions);
    hooks.restored(target as HTMLElement);
  }
}

/** Svelte action: `<div class="layer" use:layer={{ kind: 'menu', close }}>`. */
export function layer(node: Element, opts: LayerOpts) {
  const d = doc();
  const active = d?.activeElement ?? null;
  const opener = active && active !== d?.body ? active : null;
  const l: Layer = { id: nextId++, el: node, opts, opener, openerKey: opener ? focusKey(opener) : null };
  stack.push(l);
  hooks.opened(l);
  return {
    update(o: LayerOpts) {
      l.opts = o;
    },
    destroy() {
      const i = stack.indexOf(l);
      if (i >= 0) stack.splice(i, 1);
      // The layer's DOM is removed in the same flush; restore once it is gone.
      queueMicrotask(() => {
        restoreFocus(l);
        hooks.closed();
      });
    },
  };
}

/** Tests only. */
export function _resetStack() {
  stack.length = 0;
}
