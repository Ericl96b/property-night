// SPEC_render_resolution Part A: labels, display detection, first-launch default, clamp.
import { describe, expect, it } from 'vitest';
import {
  RESOLUTIONS,
  aboveDisplay,
  defaultResolution,
  displayPhysical,
  renderPixelRatio,
  resolutionShort,
} from '../../src/render/resolution';

describe('render resolution', () => {
  it('shows exactly the three labels, with the real × and no percentages', () => {
    expect(RESOLUTIONS.map((r) => r.label)).toEqual([
      '1920×1080 (Full HD / 1080p)',
      '2560×1440 (QHD / 1440p)',
      '3840×2160 (4K UHD)',
    ]);
    for (const r of RESOLUTIONS) {
      expect(r.label).toContain('×');
      expect(r.label).not.toMatch(/%|\dx\d/);
    }
    expect(resolutionShort(1440)).toBe('2560×1440');
  });

  it('detects physical pixels through Windows display scaling', () => {
    expect(displayPhysical({ width: 2560, height: 1440 }, 1.5)).toEqual({ w: 3840, h: 2160 });
    expect(displayPhysical({ width: 1920, height: 1080 }, 1)).toEqual({ w: 1920, h: 1080 });
    expect(displayPhysical({ width: 1536, height: 864 }, 1.25)).toEqual({ w: 1920, h: 1080 });
  });

  it('first-launch default is the largest option that fits, else 1080p', () => {
    expect(defaultResolution(2160)).toBe(2160);
    expect(defaultResolution(1600)).toBe(1440);
    expect(defaultResolution(1440)).toBe(1440);
    expect(defaultResolution(1200)).toBe(1080);
    expect(defaultResolution(768)).toBe(1080);
  });

  it('options above the display are greyed out; 1080p never is', () => {
    expect(aboveDisplay(2160, 1440)).toBe(true);
    expect(aboveDisplay(1440, 1440)).toBe(false);
    expect(aboveDisplay(1440, 1200)).toBe(true);
    expect(aboveDisplay(1080, 900)).toBe(false);
  });

  it('native selection returns the device pixel ratio exactly', () => {
    // 4K TV at 150%: canvas 2560×1440 CSS.
    expect(renderPixelRatio(2160, 1440, 1.5)).toBe(1.5);
    // Odd scaling where clientH × dpr is not a whole number.
    expect(renderPixelRatio(2160, 1201, 1.75)).toBe(1.75);
  });

  it('lower selections render at the selected height', () => {
    expect(renderPixelRatio(1440, 1440, 1.5)).toBe(1);
    expect(1440 * renderPixelRatio(1080, 1440, 1.5)).toBe(1080);
    // Width follows the canvas aspect: a 21:9 canvas (2240×960 CSS at dpr 1.5) at 1080p renders 2520×1080.
    const pr = renderPixelRatio(1080, 960, 1.5);
    expect([Math.round(2240 * pr), Math.round(960 * pr)]).toEqual([2520, 1080]);
  });

  it('never supersamples: a small window clamps to its own pixels', () => {
    // Windowed 1280×720 CSS at dpr 1.25 (900 physical rows) with 4K selected.
    expect(renderPixelRatio(2160, 720, 1.25)).toBe(1.25);
    expect(renderPixelRatio(1080, 720, 1.25)).toBe(1.25);
    // 1080p display, 4K stored from another monitor: clamped to native.
    expect(renderPixelRatio(2160, 1080, 1)).toBe(1);
  });
});
