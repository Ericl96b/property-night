import { describe, expect, it } from 'vitest';
import { CLASSIC_BOARD } from '../src/data/classicBoard';
import { CORNER_PX, TILE_W_PX, tileFrame, tokenSpots } from '../src/render/layout';

const tiles = CLASSIC_BOARD.tiles;

describe('classic board data', () => {
  it('has 40 tiles in index order', () => {
    expect(tiles).toHaveLength(40);
    tiles.forEach((t, i) => expect(t.index).toBe(i));
  });

  it('has the classic layout', () => {
    const at = (type: string) => tiles.filter((t) => t.type === type).map((t) => t.index);
    expect(at('railroad')).toEqual([5, 15, 25, 35]);
    expect(at('utility')).toEqual([12, 28]);
    expect(at('chance')).toEqual([7, 22, 36]);
    expect(at('chest')).toEqual([2, 17, 33]);
    expect(at('tax')).toEqual([4, 38]);
    expect([0, 10, 20, 30].map((i) => tiles[i].type)).toEqual(['go', 'jail', 'freeParking', 'goToJail']);
  });

  it('has 22 streets in 8 classic color groups', () => {
    const streets = tiles.filter((t) => t.type === 'street');
    expect(streets).toHaveLength(22);
    const groups = new Map<string, number>();
    for (const s of streets) groups.set(s.group!, (groups.get(s.group!) ?? 0) + 1);
    expect(Object.fromEntries(groups)).toEqual({ brown: 2, lightBlue: 3, pink: 3, orange: 3, red: 3, yellow: 3, green: 3, darkBlue: 2 });
    expect(CLASSIC_BOARD.groups.brown.color).toBe('#955436');
    expect(CLASSIC_BOARD.groups.darkBlue.color).toBe('#0072BB');
  });

  it('rent tables never decrease', () => {
    for (const t of tiles.filter((x) => x.rents)) {
      for (let i = 1; i < t.rents!.length; i++) expect(t.rents![i]).toBeGreaterThan(t.rents![i - 1]);
    }
  });

  it('uses standard US prices and mortgage values', () => {
    expect(tiles[1].price).toBe(60);
    expect(tiles[39].price).toBe(400);
    expect(tiles[39].rents).toEqual([50, 200, 600, 1400, 1700, 2000]);
    for (const t of tiles.filter((x) => x.price)) expect(t.mortgage).toBe(t.price! / 2);
  });
});

describe('board layout geometry (matches reference/board-face.html)', () => {
  it('places tiles like the reference', () => {
    // Reference: tile 1 box at left 786.22, top 868 (bottom row, unrotated, 81.78 × 132).
    const f1 = tileFrame(1);
    expect(f1.cx - TILE_W_PX / 2).toBeCloseTo(786.22, 1);
    expect(f1.cy - 66).toBeCloseTo(868, 1);
    // Tile 11 (left column) box at left 25.11, top 761.11, rotated 90°.
    const f11 = tileFrame(11);
    expect(f11.cx - TILE_W_PX / 2).toBeCloseTo(25.11, 1);
    expect(f11.cy - 66).toBeCloseTo(761.11, 1);
    expect(f11.angle).toBeCloseTo(Math.PI / 2);
    // Tile 21 (top row) at left 132, rotated 180°; tile 31 (right) at top 106.89, rotated −90°.
    expect(tileFrame(21).cx - TILE_W_PX / 2).toBeCloseTo(CORNER_PX, 1);
    expect(tileFrame(31).cy - 66).toBeCloseTo(106.89, 1);
    expect(tileFrame(31).angle).toBeCloseTo(-Math.PI / 2);
  });

  it('fans up to 6 tokens out on a tile without stacking them', () => {
    for (const tile of [0, 1, 10, 11, 21, 31, 5]) {
      for (let n = 1; n <= 6; n++) {
        const spots = tokenSpots(tile, n);
        expect(spots).toHaveLength(n);
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const d = Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]);
            expect(d).toBeGreaterThan(0.018);
          }
        }
      }
    }
  });
});
