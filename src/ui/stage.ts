// The overlay's fixed 1920 × 1080 logical stage (SPEC §10.8), scaled uniformly and
// letterboxed. Shared by the overlay root and the camera, so the board can be sized to the
// free space between the side panels.

export const STAGE_W = 1920;
export const STAGE_H = 1080;
/** Logical px each side panel covers from its stage edge (32 px margin + 340 px panel). */
export const PANEL_INNER_PX = 372;
/** Extra logical px kept clear between the board and each panel. */
export const BOARD_MARGIN_PX = 24;

export function stageFit(w: number, h: number): { scale: number; offset: { x: number; y: number } } {
  const scale = Math.min(w / STAGE_W, h / STAGE_H);
  return { scale, offset: { x: (w - STAGE_W * scale) / 2, y: (h - STAGE_H * scale) / 2 } };
}

/** Largest |x| in normalized device coordinates the board may reach without meeting a panel. */
export function boardMaxNdcX(w: number, h: number): number {
  const { scale, offset } = stageFit(w, h);
  return 1 - (2 * (offset.x + (PANEL_INNER_PX + BOARD_MARGIN_PX) * scale)) / w;
}

/**
 * Stage 2: logical px kept clear at the top for moment banners (they start at 120 px and are
 * ≈110 px tall) and at the bottom. Close-up shots keep their subject inside what is left.
 */
export const BANNER_ZONE_PX = 230;
export const BOTTOM_MARGIN_PX = 48;

/** The free screen region between the side panels, below the banner zone, in NDC. */
export function safeAreaNdc(w: number, h: number): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const { scale, offset } = stageFit(w, h);
  const xMax = boardMaxNdcX(w, h);
  return {
    xMin: -xMax,
    xMax,
    yMin: -1 + (2 * (offset.y + BOTTOM_MARGIN_PX * scale)) / h,
    yMax: 1 - (2 * (offset.y + BANNER_ZONE_PX * scale)) / h,
  };
}
