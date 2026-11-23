// SPEC_render_resolution Part A check. Emulates a 4K TV at 150% Windows scaling (2560×1440 CSS,
// DPR 1.5 → 3840×2160 physical). Steps through the Resolution setting in the pause menu with the
// keyboard (same path as a controller's D-pad) and reads the actual drawing buffer each time.
// PN_W / PN_H / PN_DPR override the window (e.g. a 1080p laptop: 1920 1080 1).
const base = process.env.PN_URL ?? 'http://localhost:5173/';
const width = Number(process.env.PN_W ?? 2560);
const height = Number(process.env.PN_H ?? 1440);
const dpr = Number(process.env.PN_DPR ?? 1.5);

const read = () => {
  const r = window.__pn.scene.renderer;
  const c = r.gl.domElement;
  const sel = [...document.querySelectorAll('label')].find((l) => l.firstChild?.textContent?.trim() === 'Resolution')?.querySelector('select');
  return {
    setting: window.__pn.settings.renderHeight,
    buffer: `${c.width}×${c.height}`,
    css: `${c.clientWidth}×${c.clientHeight}`,
    window: `${innerWidth}×${innerHeight}`,
    pixelRatio: r.gl.getPixelRatio(),
    selected: sel?.selectedOptions[0]?.textContent,
    options: sel ? [...sel.options].map((o) => `${o.textContent}${o.disabled ? ' [disabled]' : ''}`) : null,
    note: document.querySelector('[data-testid=display-note]')?.textContent,
    stored: JSON.parse(localStorage.getItem('property-night.settings.v1') ?? '{}').renderHeight ?? null,
    percentInUi: /\d+\s*%/.test([...document.querySelectorAll('select option')].filter((o) => o.closest('label')?.firstChild?.textContent?.trim() === 'Resolution').map((o) => o.textContent).join(' ')),
  };
};
const focusRes = () => {
  const sel = [...document.querySelectorAll('label')].find((l) => l.firstChild?.textContent?.trim() === 'Resolution')?.querySelector('select');
  sel?.focus();
  return !!sel;
};
const step = (label, key) => [{ key }, { wait: 600 }, { eval: read, label }];

export default {
  url: `${base}?auto=human,bot&seed=3&quality=high&ao=1&speed=normal`,
  width,
  height,
  dpr,
  steps: [
    { until: () => !!window.__pn?.controller?.state, label: 'booted', timeout: 30000 },
    { wait: 1500 },
    { eval: read, label: 'start (first-launch default)' },
    { shot: 'res-native' },
    { key: 'KeyP' },
    { wait: 600 },
    { eval: focusRes, label: 'focus Resolution' },
    { eval: read, label: 'pause menu open' },
    { shot: 'res-menu' },
    ...step('left → 1440', 'ArrowLeft'),
    ...step('left → 1080', 'ArrowLeft'),
    ...step('left at end (moves focus, value stays)', 'ArrowLeft'),
    { eval: focusRes, label: 'refocus' },
    ...step('right → 1440', 'ArrowRight'),
    { shot: 'res-1440-menu' },
    { key: 'KeyP' },
    { wait: 800 },
    { eval: read, label: 'resumed at 1440 (mid-game, no reload)' },
    { shot: 'res-1440' },
    { cdp: 'Emulation.setDeviceMetricsOverride', params: { width: 1280, height: 720, deviceScaleFactor: dpr, mobile: false } },
    { wait: 800 },
    { eval: read, label: 'small window 1280×720 → clamped' },
    { cdp: 'Emulation.setDeviceMetricsOverride', params: { width, height, deviceScaleFactor: dpr, mobile: false } },
    { wait: 800 },
    { eval: read, label: 'back to full size' },
  ],
};
