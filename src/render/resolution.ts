// Render resolution (SPEC_render_resolution Part A): the 3D canvas draws at a chosen height and
// the browser upscales it to the canvas's CSS size. The HTML UI is never scaled. Pure functions,
// so the rules are unit-tested without WebGL.

export type RenderHeight = 1080 | 1440 | 2160;

export interface ResolutionOption {
  h: RenderHeight;
  w: number;
  label: string;
}

/** The three options, with the exact labels the Settings tab shows (real × sign, no percentages). */
export const RESOLUTIONS: readonly ResolutionOption[] = [
  { h: 1080, w: 1920, label: '1920×1080 (Full HD / 1080p)' },
  { h: 1440, w: 2560, label: '2560×1440 (QHD / 1440p)' },
  { h: 2160, w: 3840, label: '3840×2160 (4K UHD)' },
];

export function isRenderHeight(v: unknown): v is RenderHeight {
  return v === 1080 || v === 1440 || v === 2160;
}

export function resolutionLabel(h: RenderHeight): string {
  return RESOLUTIONS.find((r) => r.h === h)?.label ?? `${h}p`;
}

/** Short form for results and overlays: "2560×1440". */
export function resolutionShort(h: RenderHeight): string {
  const r = RESOLUTIONS.find((o) => o.h === h);
  return r ? `${r.w}×${r.h}` : `${h}p`;
}

export interface Size {
  w: number;
  h: number;
}

/**
 * The display's physical pixels. Handles Windows display scaling: a 4K TV at 150% reports
 * screen 2560×1440 with dpr 1.5, which gives 3840×2160.
 */
export function displayPhysical(screen: { width: number; height: number }, dpr: number): Size {
  return { w: Math.round(screen.width * dpr), h: Math.round(screen.height * dpr) };
}

/**
 * Greyed out as "Above this display"? 1080p never is: it is the floor (a smaller display uses it,
 * clamped to the canvas), so the control always has a choice.
 */
export function aboveDisplay(h: number, displayH: number): boolean {
  return h > 1080 && h > displayH;
}

/** First-launch default: the largest option that fits the display, else 1080p. */
export function defaultResolution(displayH: number): RenderHeight {
  let best: RenderHeight = 1080;
  for (const r of RESOLUTIONS) if (r.h <= displayH) best = r.h;
  return best;
}

/**
 * The renderer pixel ratio for a selected height. Matched by height (width follows the canvas
 * aspect), clamped to the canvas's own physical pixels so it never supersamples. When the
 * selection reaches the canvas's physical height, the device pixel ratio is returned exactly, so
 * native output is pixel-identical to rendering without this setting.
 */
export function renderPixelRatio(selectedH: number, clientH: number, dpr: number): number {
  if (!(clientH > 0) || !(dpr > 0)) return dpr > 0 ? dpr : 1;
  const canvasPhys = Math.round(clientH * dpr);
  if (selectedH >= canvasPhys) return dpr;
  return selectedH / clientH;
}
