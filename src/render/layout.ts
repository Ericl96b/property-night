// Board geometry shared by the texture generator and the 3D scene.
// Reference space = reference/board-face.html: a 1000 × 1000 px board, y down.
// World space: board centered at the origin on the XZ plane, 1 px = 0.001 units,
// reference +x → world +x, reference +y → world +z (bottom row nearest the default camera).

export const BOARD_PX = 1000;
export const CORNER_PX = 132;
export const TILE_W_PX = (BOARD_PX - 2 * CORNER_PX) / 9; // 81.78
export const TILE_H_PX = CORNER_PX;
export const BAND_PX = 38;

export const BOARD_SIZE = 1.0;
export const BOARD_THICKNESS = 0.012;
/** World y of the board's printed face. */
export const BOARD_TOP = BOARD_THICKNESS;
export const PX = BOARD_SIZE / BOARD_PX;

export type Side = 0 | 1 | 2 | 3; // 0 bottom, 1 left, 2 top, 3 right
/** Camera-rig yaw that puts each side nearest the viewer (SPEC §10.7). */
export const SIDE_YAW: Record<Side, number> = { 0: 0, 1: -Math.PI / 2, 2: Math.PI, 3: Math.PI / 2 };
/** Print rotation of each side's tiles, in degrees (CSS sense: clockwise, y down). */
export const SIDE_ROTATION_DEG: Record<Side, number> = { 0: 0, 1: 90, 2: 180, 3: -90 };

export interface TileFrame {
  index: number;
  corner: boolean;
  side: Side;
  /** Tile center in reference px. */
  cx: number;
  cy: number;
  /** Print rotation in radians (CSS sense). */
  angle: number;
}

export function isCorner(index: number): boolean {
  return index % 10 === 0;
}

export function tileFrame(index: number): TileFrame {
  const side = Math.floor(index / 10) as Side;
  const k = index % 10;
  const half = TILE_W_PX / 2;
  const angle = (SIDE_ROTATION_DEG[side] * Math.PI) / 180;
  if (k === 0) {
    const c = CORNER_PX / 2;
    const far = BOARD_PX - c;
    const pos = [
      [far, far],
      [c, far],
      [c, c],
      [far, c],
    ][side];
    return { index, corner: true, side, cx: pos[0], cy: pos[1], angle };
  }
  const along = CORNER_PX + (k - 1) * TILE_W_PX + half;
  const outer = BOARD_PX - TILE_H_PX / 2;
  const inner = TILE_H_PX / 2;
  const centers: Record<Side, [number, number]> = {
    0: [BOARD_PX - along, outer],
    1: [inner, BOARD_PX - along],
    2: [along, inner],
    3: [outer, along],
  };
  const [cx, cy] = centers[side];
  return { index, corner: false, side, cx, cy, angle };
}

/** Tile-local px (origin at tile center, band toward local −y) → reference px. */
export function localToRef(f: TileFrame, lx: number, ly: number): [number, number] {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  return [f.cx + lx * c - ly * s, f.cy + lx * s + ly * c];
}

export function refToWorld(px: number, py: number): [number, number] {
  return [px * PX - BOARD_SIZE / 2, py * PX - BOARD_SIZE / 2];
}

/** World yaw that aligns a mesh's +X with the tile's local +X. */
export function tileYaw(f: TileFrame): number {
  return -f.angle;
}

/** Local y of the color-band center and the token body center (tile-local px). */
export const BAND_CENTER_LY = -TILE_H_PX / 2 + BAND_PX / 2; // −47
export const BODY_CENTER_LY = -TILE_H_PX / 2 + BAND_PX + (TILE_H_PX - BAND_PX) / 2; // 19
export const OWNER_DISC_LY = TILE_H_PX / 2 - 4.5;

/** World (x, z) of a point in tile-local px. */
export function tileLocalToWorld(f: TileFrame, lx: number, ly: number): [number, number] {
  const [px, py] = localToRef(f, lx, ly);
  return refToWorld(px, py);
}

/** Pseudo-tile for tokens that are *in* jail (inside the jail square, not Just Visiting). */
export const IN_JAIL = 40;

/** Where tokens stand on a tile: positions for `n` tokens, fanned out in a small arc. */
export function tokenSpots(index: number, n: number): [number, number][] {
  if (index === IN_JAIL) {
    // Inside the orange jail square (38–132 × 868–962 px), tokens in a tight grid.
    const perRow = 2;
    const spacing = 30;
    const rows = Math.ceil(n / perRow);
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - row * perRow);
      const col = i - row * perRow;
      out.push(refToWorld(85 + (col - (inRow - 1) / 2) * spacing, 915 + (row - (rows - 1) / 2) * spacing));
    }
    return out;
  }
  const f = tileFrame(index);
  const local: [number, number][] = [];
  if (f.corner) {
    // Corners: Just Visiting strip for jail, the open area for the rest.
    const perRow = 3;
    const spacing = 32;
    const rows = Math.ceil(n / perRow);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - row * perRow);
      const col = i - row * perRow;
      const x = (col - (inRow - 1) / 2) * spacing;
      const y = (row - (rows - 1) / 2) * spacing;
      local.push([x, y]);
    }
    const [ax, ay] = cornerAnchor(f.index);
    return local.map(([x, y]) => refToWorld(ax + x, ay + y));
  }
  const rows = n > 3 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const row = rows === 2 ? (i < Math.ceil(n / 2) ? 0 : 1) : 0;
    const inRow = rows === 2 ? (row === 0 ? Math.ceil(n / 2) : Math.floor(n / 2)) : n;
    const col = row === 0 ? i : i - Math.ceil(n / 2);
    const spacing = inRow <= 1 ? 0 : Math.min(26, (TILE_W_PX - 30) / (inRow - 1));
    const x = (col - (inRow - 1) / 2) * spacing;
    // Arc: outer tokens sit a little closer to the outer edge.
    const arc = 0.012 * x * x;
    const rowY = rows === 2 ? (row === 0 ? -18 : 20) : 2;
    local.push([x, BODY_CENTER_LY + rowY + arc]);
  }
  return local.map(([x, y]) => tileLocalToWorld(f, x, y));
}

function cornerAnchor(index: number): [number, number] {
  switch (index) {
    case 10:
      // Just Visiting: along the L-shaped strip, nearest the outer corner.
      return [52, BOARD_PX - 48];
    case 0:
      return [BOARD_PX - 62, BOARD_PX - 72];
    case 20:
      return [66, 66];
    default:
      return [BOARD_PX - 66, 66];
  }
}

/** House slot centers along the band (tile-local x), 4 per band. */
export const HOUSE_PITCH_PX = TILE_W_PX / 4;
export function houseSlotLX(slot: number): number {
  return (slot - 1.5) * HOUSE_PITCH_PX;
}
