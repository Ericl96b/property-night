// SPEC_render_resolution A4: render resolution is per machine, defaults from the display, and a
// stored choice is never overwritten (even when above the current display).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSettings, resolveRenderHeight, saveSettings } from '../../src/app/settings';

function stubStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('render resolution setting', () => {
  it('keeps a stored choice, else uses the first-launch default', () => {
    expect(resolveRenderHeight(1440, 2160)).toBe(1440);
    expect(resolveRenderHeight(2160, 1080)).toBe(2160); // laptop on a smaller panel: clamp handles it
    expect(resolveRenderHeight(undefined, 2160)).toBe(2160);
    expect(resolveRenderHeight(undefined, 1600)).toBe(1440);
    expect(resolveRenderHeight(undefined, 900)).toBe(1080);
    expect(resolveRenderHeight(999, 1440)).toBe(1440);
  });

  it('first launch derives from the physical display (4K TV at 150%)', () => {
    stubStorage();
    vi.stubGlobal('screen', { width: 2560, height: 1440 });
    vi.stubGlobal('devicePixelRatio', 1.5);
    expect(loadSettings().renderHeight).toBe(2160);
  });

  it('older settings without the key get the display default; stored values survive a reload', () => {
    const store = stubStorage({ 'property-night.settings.v1': JSON.stringify({ speed: 'fast' }) });
    vi.stubGlobal('screen', { width: 1920, height: 1080 });
    vi.stubGlobal('devicePixelRatio', 1);
    const s = loadSettings();
    expect(s.renderHeight).toBe(1080);
    expect(s.speed).toBe('fast');
    saveSettings({ ...s, renderHeight: 2160 });
    expect(JSON.parse(store['property-night.settings.v1']).renderHeight).toBe(2160);
    expect(loadSettings().renderHeight).toBe(2160);
  });
});
