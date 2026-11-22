import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetStack, back, hooks, layer, layers, topLayer } from '../../src/ui/menuStack';

// Minimal DOM stand-ins: node has no document, and the stack only needs a few members.
class El {
  isConnected = true;
  focused = 0;
  attrs: Record<string, string> = {};
  constructor(public textContent = '', public kids: El[] = []) {}
  getAttribute(k: string) {
    return this.attrs[k] ?? null;
  }
  focus() {
    this.focused++;
    doc.activeElement = this;
  }
  querySelectorAll() {
    return this.kids;
  }
}
const body = new El('body');
const doc: { activeElement: El | null; body: El } = { activeElement: null, body };

const flush = () => new Promise<void>((r) => queueMicrotask(r));

beforeEach(() => {
  _resetStack();
  (globalThis as { document?: unknown }).document = doc;
  doc.activeElement = body;
  hooks.restored = () => {};
  hooks.opened = () => {};
  hooks.closed = () => {};
});
afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

const mount = (el: El, kind: 'menu' | 'dialog' | 'decision' | 'root', close?: () => void) =>
  layer(el as unknown as Element, { kind, close });

describe('menu stack', () => {
  it('Back closes only the top menu, one level at a time', () => {
    const closeSettings = vi.fn();
    const closeSave = vi.fn();
    mount(new El(), 'menu', closeSettings);
    mount(new El(), 'menu', closeSave);
    expect(back()).toBe(true);
    expect(closeSave).toHaveBeenCalledTimes(1);
    expect(closeSettings).not.toHaveBeenCalled();
  });

  it('a dialog is cancelled, not its parent menu', () => {
    const closePause = vi.fn();
    const cancel = vi.fn();
    mount(new El(), 'menu', closePause);
    mount(new El(), 'dialog', cancel);
    expect(back()).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(closePause).not.toHaveBeenCalled();
  });

  it('Back does nothing on a game decision or a root screen', () => {
    const close = vi.fn();
    mount(new El(), 'decision', close);
    expect(back()).toBe(false);
    _resetStack();
    mount(new El(), 'root', close);
    expect(back()).toBe(false);
    _resetStack();
    expect(back()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it('removes a layer on destroy, whatever its position', () => {
    const a = mount(new El(), 'menu');
    const b = mount(new El(), 'menu');
    a.destroy();
    expect(layers().length).toBe(1);
    b.destroy();
    expect(topLayer()).toBeUndefined();
  });

  it('returns focus to the control that opened the layer', async () => {
    const opener = new El('Save game…');
    doc.activeElement = opener;
    const restored = vi.fn();
    hooks.restored = restored;
    const l = mount(new El(), 'menu');
    doc.activeElement = body; // the closed panel's focused control went away
    l.destroy();
    await flush();
    expect(opener.focused).toBe(1);
    expect(restored).toHaveBeenCalledWith(opener);
  });

  it('finds a re-rendered opener by its label in the new top layer', async () => {
    const old = new El('Forfeit Ann');
    const fresh = new El('Forfeit Ann');
    const parent = new El('', [new El('Resume'), fresh]);
    mount(parent, 'menu');
    doc.activeElement = old;
    const dialog = mount(new El(), 'dialog');
    old.isConnected = false;
    doc.activeElement = body;
    dialog.destroy();
    await flush();
    expect(fresh.focused).toBe(1);
  });

  it('does not steal focus another control already took', async () => {
    const opener = new El('Load game');
    doc.activeElement = opener;
    const l = mount(new El(), 'menu');
    const other = new El('Other');
    doc.activeElement = other;
    l.destroy();
    await flush();
    expect(opener.focused).toBe(0);
  });
});
