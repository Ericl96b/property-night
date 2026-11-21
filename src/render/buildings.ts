// Houses and hotels (SPEC §10.5, Batch 3): each color group has its own house and hotel design
// from the approved asset module (buildingModels.js), accented in the group's board color.
// Drawn as one BatchedMesh per surface finish; a building is one instance in every batch its
// design has a part in. Build: drops in from 0.03 above with a short bounce (instance matrices
// animate). Sell: lifts and fades (temporary meshes with transparent material clones).
import * as THREE from 'three';
import type { BoardData, GroupId } from '../data/classicBoard';
import { type FinishName, type GameBuildingAssets, buildGameAssets } from './buildingModels.js';
import { BAND_CENTER_LY, BOARD_TOP, houseSlotLX, tileFrame, tileLocalToWorld, tileYaw } from './layout';

/** Board units per model unit, uniform for houses and hotels (Batch 3 spec §5). */
export const BUILDING_SCALE = 0.016;

const GROUP_IDS: GroupId[] = ['brown', 'lightBlue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkBlue'];

export type BuildingKind = 'house' | 'hotel';

interface Placed {
  kind: BuildingKind;
  tile: number;
  slot: number; // house slot 0–3; hotel 0
  group: GroupId;
  ids: { batch: THREE.BatchedMesh; id: number }[];
}

export class Buildings {
  readonly group = new THREE.Group();
  /** Milliseconds the last buildGameAssets call took. */
  lastBuildMs = 0;
  private board!: BoardData;
  private assets!: GameBuildingAssets;
  private batches = new Map<FinishName, THREE.BatchedMesh>();
  /** (group|kind|finish) → geometry id in that finish's batch. */
  private geoIds = new Map<string, number>();
  private placed: Placed[] = [];

  constructor(board: BoardData) {
    this.group.name = 'buildings';
    this.build(board);
  }

  private build(board: BoardData): void {
    this.board = board;
    const colors: Partial<Record<GroupId, number>> = {};
    for (const id of GROUP_IDS) colors[id] = parseInt(board.groups[id].color.replace('#', ''), 16);
    const t0 = performance.now();
    this.assets = buildGameAssets({ colors });
    this.lastBuildMs = performance.now() - t0;

    const { designs, finishes, castShadow } = this.assets;
    const sums = new Map<FinishName, { v: number; i: number }>();
    for (const id of GROUP_IDS) {
      for (const kind of ['house', 'hotel'] as const) {
        for (const p of designs[id][kind].parts) {
          const s = sums.get(p.finish) ?? { v: 0, i: 0 };
          s.v += p.geometry.attributes.position.count;
          s.i += p.geometry.index!.count;
          sums.set(p.finish, s);
        }
      }
    }
    const streets = board.tiles.filter((t) => t.type === 'street').length;
    for (const [finish, s] of sums) {
      const b = new THREE.BatchedMesh(5 * streets, s.v, s.i, finishes[finish]);
      b.name = `buildings-${finish}`;
      b.castShadow = castShadow[finish];
      b.receiveShadow = true;
      b.sortObjects = false;
      b.perObjectFrustumCulled = true;
      b.frustumCulled = false;
      this.batches.set(finish, b);
      this.group.add(b);
    }
    for (const id of GROUP_IDS) {
      for (const kind of ['house', 'hotel'] as const) {
        for (const p of designs[id][kind].parts) {
          this.geoIds.set(`${id}|${kind}|${p.finish}`, this.batches.get(p.finish)!.addGeometry(p.geometry));
        }
      }
    }
  }

  private teardown(): void {
    for (const b of this.batches.values()) {
      this.group.remove(b);
      b.dispose();
    }
    this.batches.clear();
    this.geoIds.clear();
    this.assets.dispose();
  }

  /** Board preset changed: rebuild the designs in the new colors and re-place everything at rest. */
  setBoard(board: BoardData): void {
    const keep = this.placed.map(({ kind, tile, slot }) => ({ kind, tile, slot }));
    this.placed = [];
    this.teardown();
    this.build(board);
    for (const k of keep) this.placeNew(k.kind, k.tile, k.slot, 0);
  }

  /** Design sizes in model units (for the batch3 fit check). */
  designSizes(): Record<GroupId, { house: THREE.Vector3; hotel: THREE.Vector3 }> {
    const out = {} as Record<GroupId, { house: THREE.Vector3; hotel: THREE.Vector3 }>;
    for (const id of GROUP_IDS) out[id] = { house: this.assets.designs[id].house.size.clone(), hotel: this.assets.designs[id].hotel.size.clone() };
    return out;
  }

  countOn(tile: number): { houses: number; hotel: boolean } {
    const on = this.placed.filter((p) => p.tile === tile);
    return { houses: on.filter((p) => p.kind === 'house').length, hotel: on.some((p) => p.kind === 'hotel') };
  }

  get totals(): { houses: number; hotels: number } {
    return {
      houses: this.placed.filter((p) => p.kind === 'house').length,
      hotels: this.placed.filter((p) => p.kind === 'hotel').length,
    };
  }

  private matrixFor(kind: BuildingKind, tile: number, slot: number, lift = 0): THREE.Matrix4 {
    const f = tileFrame(tile);
    const lx = kind === 'hotel' ? 0 : houseSlotLX(slot);
    const [x, z] = tileLocalToWorld(f, lx, BAND_CENTER_LY);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tileYaw(f));
    const s = BUILDING_SCALE;
    return new THREE.Matrix4().compose(new THREE.Vector3(x, BOARD_TOP + lift, z), q, new THREE.Vector3(s, s, s));
  }

  private partsOf(group: GroupId, kind: BuildingKind) {
    return this.assets.designs[group][kind].parts;
  }

  /** Add a building's instances to every batch its design uses. */
  private placeNew(kind: BuildingKind, tile: number, slot: number, lift: number): Placed {
    const group = this.board.tiles[tile].group!;
    const m = this.matrixFor(kind, tile, slot, lift);
    const ids = this.partsOf(group, kind).map((part) => {
      const batch = this.batches.get(part.finish)!;
      const id = batch.addInstance(this.geoIds.get(`${group}|${kind}|${part.finish}`)!);
      batch.setMatrixAt(id, m);
      return { batch, id };
    });
    const p: Placed = { kind, tile, slot, group, ids };
    this.placed.push(p);
    return p;
  }

  private unplace(p: Placed): void {
    for (const { batch, id } of p.ids) batch.deleteInstance(id);
    p.ids = [];
    this.placed = this.placed.filter((q) => q !== p);
  }

  private setMatrix(p: Placed, m: THREE.Matrix4): void {
    for (const { batch, id } of p.ids) batch.setMatrixAt(id, m);
  }

  /** Place without animation. */
  set(tile: number, houses: number, hotel: boolean): void {
    for (const p of this.placed.filter((q) => q.tile === tile)) this.unplace(p);
    if (hotel) this.placeNew('hotel', tile, 0, 0);
    else for (let s = 0; s < houses; s++) this.placeNew('house', tile, s, 0);
  }

  /**
   * Add one building with the drop-in animation. Five houses' worth becomes a hotel.
   * Returns an update function for the animation queue (true while running).
   */
  add(tile: number, durationScale = 1): ((dt: number) => boolean) | undefined {
    const { houses, hotel } = this.countOn(tile);
    if (hotel) return undefined;
    const dur = 0.18 * durationScale;
    const drop = 0.03;
    let kind: BuildingKind = 'house';
    let slot = houses;
    if (houses === 4) {
      for (const q of this.placed.filter((x) => x.tile === tile)) this.unplace(q);
      kind = 'hotel';
      slot = 0;
    }
    if (dur <= 0) {
      this.placeNew(kind, tile, slot, 0);
      return undefined;
    }
    const p = this.placeNew(kind, tile, slot, drop);
    let t = 0;
    return (dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      // Fall with gravity-like ease, then a small bounce in the last 30%.
      let lift: number;
      if (k < 0.7) {
        const u = k / 0.7;
        lift = drop * (1 - u * u);
      } else {
        const u = (k - 0.7) / 0.3;
        lift = 0.0025 * Math.sin(u * Math.PI);
      }
      // A set() during the drop may have replaced this building; then there is nothing to move.
      if (p.ids.length) this.setMatrix(p, this.matrixFor(p.kind, p.tile, p.slot, k >= 1 ? 0 : lift));
      return k < 1;
    };
  }

  /** Remove one building (the highest house slot, or the hotel) with lift-and-fade. */
  remove(tile: number, durationScale = 1): ((dt: number) => boolean) | undefined {
    const on = this.placed.filter((p) => p.tile === tile);
    if (!on.length) return undefined;
    const p = on.reduce((a, b) => (b.slot > a.slot || b.kind === 'hotel' ? b : a));
    this.unplace(p);
    const dur = 0.35 * durationScale;
    if (dur <= 0) return undefined;
    const { finishes, castShadow } = this.assets;
    const meshes = this.partsOf(p.group, p.kind).map((part) => {
      const mat = finishes[part.finish].clone();
      mat.transparent = true;
      const mesh = new THREE.Mesh(part.geometry, mat);
      mesh.castShadow = castShadow[part.finish];
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      return mesh;
    });
    let t = 0;
    const apply = (k: number) => {
      const m = this.matrixFor(p.kind, p.tile, p.slot, 0.03 * k * k);
      for (const mesh of meshes) {
        mesh.matrix.copy(m);
        (mesh.material as THREE.MeshPhysicalMaterial).opacity = 1 - k;
      }
    };
    apply(0);
    return (dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      apply(k);
      if (k >= 1) {
        for (const mesh of meshes) {
          this.group.remove(mesh);
          (mesh.material as THREE.Material).dispose();
        }
        return false;
      }
      return true;
    };
  }
}
