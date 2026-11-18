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
