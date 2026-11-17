// Houses and hotels (SPEC §10.5): lacquered wood meshes standing on the color band,
// instanced (one draw call per type). Build: drops in from 0.03 above with a short bounce.
// Sell: lifts and fades (a temporary non-instanced copy carries the fade).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BAND_CENTER_LY,
  BOARD_TOP,
  PX,
  TILE_W_PX,
  houseSlotLX,
  tileFrame,
  tileLocalToWorld,
  tileYaw,
} from './layout';

// Houses are ≈19% of the tile width so four stand on the band with clear gaps
// (SPEC §10.5 says ≈30%, which cannot fit four across; see DECISIONS.md).
const HOUSE = { w: TILE_W_PX * 0.19 * PX, d: 0.019, h: 0.0115, roof: 0.0095 };
const HOTEL = { w: TILE_W_PX * 0.7 * PX, d: 0.024, h: 0.0150, roof: 0.0105 };
const MAX_HOUSES = 32;
const MAX_HOTELS = 12;

function buildingGeometry(dim: typeof HOUSE, body: THREE.Color, roof: THREE.Color): THREE.BufferGeometry {
  const bodyGeo = new THREE.BoxGeometry(dim.w, dim.h, dim.d);
  bodyGeo.translate(0, dim.h / 2, 0);
  // Triangular-prism roof, ridge along the width (along the band).
  const tri = new THREE.Shape();
  const overhang = 0.0007;
  tri.moveTo(-dim.d / 2 - overhang, 0);
  tri.lineTo(dim.d / 2 + overhang, 0);
  tri.lineTo(0, dim.roof);
  tri.closePath();
  const roofLen = dim.w + overhang * 2;
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: roofLen, bevelEnabled: false });
  roofGeo.translate(0, 0, -roofLen / 2);
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(0, dim.h, 0);
  const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const merged = mergeGeometries([paint(bodyGeo, body), paint(roofGeo, roof)], false);
  if (!merged) throw new Error('building merge failed');
  merged.computeVertexNormals();
  return merged;
}

/** Lighten in sRGB (perceptual) space, then convert: mixing in linear space washes colors out. */
const lighten = (hex: number, k: number) => {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => Math.round(v + (255 - v) * k));
  return new THREE.Color((c[0] << 16) | (c[1] << 8) | c[2]);
};

export type BuildingKind = 'house' | 'hotel';

interface Placed {
  kind: BuildingKind;
  tile: number;
  slot: number; // house slot 0–3; hotel 0
  matrix: THREE.Matrix4;
}

export class Buildings {
  readonly group = new THREE.Group();
  private houses: THREE.InstancedMesh;
  private hotels: THREE.InstancedMesh;
  private material: THREE.MeshPhysicalMaterial;
  private houseGeo: THREE.BufferGeometry;
  private hotelGeo: THREE.BufferGeometry;
  private placed: Placed[] = [];
  /** Instances currently animating (excluded from the instanced meshes). */
  private animating = new Map<Placed, THREE.Mesh>();

  constructor() {
    this.material = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.35,
    });
    // Linear colors: Color() parses hex as sRGB and converts.
    this.houseGeo = buildingGeometry(HOUSE, new THREE.Color(0x2e8b4e), lighten(0x2e8b4e, 0.1));
    this.hotelGeo = buildingGeometry(HOTEL, new THREE.Color(0xb4322a), lighten(0xb4322a, 0.1));
    this.houses = new THREE.InstancedMesh(this.houseGeo, this.material, MAX_HOUSES);
    this.hotels = new THREE.InstancedMesh(this.hotelGeo, this.material, MAX_HOTELS);
    for (const m of [this.houses, this.hotels]) {
      m.count = 0;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.group.name = 'buildings';
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

  private matrixFor(kind: BuildingKind, tile: number, slot: number, lift = 0, scale = 1): THREE.Matrix4 {
    const f = tileFrame(tile);
    const lx = kind === 'hotel' ? 0 : houseSlotLX(slot);
    const [x, z] = tileLocalToWorld(f, lx, BAND_CENTER_LY);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tileYaw(f));
    return new THREE.Matrix4().compose(new THREE.Vector3(x, BOARD_TOP + lift, z), q, new THREE.Vector3(scale, scale, scale));
  }

  private rebuild(): void {
    let h = 0;
    let H = 0;
    for (const p of this.placed) {
      if (this.animating.has(p)) continue;
      if (p.kind === 'house') this.houses.setMatrixAt(h++, p.matrix);
      else this.hotels.setMatrixAt(H++, p.matrix);
    }
    this.houses.count = h;
    this.hotels.count = H;
    this.houses.instanceMatrix.needsUpdate = true;
    this.hotels.instanceMatrix.needsUpdate = true;
  }

  /** Place without animation. */
  set(tile: number, houses: number, hotel: boolean): void {
    this.placed = this.placed.filter((p) => p.tile !== tile);
    if (hotel) this.placed.push({ kind: 'hotel', tile, slot: 0, matrix: this.matrixFor('hotel', tile, 0) });
    else for (let s = 0; s < houses; s++) this.placed.push({ kind: 'house', tile, slot: s, matrix: this.matrixFor('house', tile, s) });
    this.rebuild();
  }

  /**
   * Add one building with the drop-in animation. Five houses' worth becomes a hotel.
   * Returns an update function for the animation queue (true while running).
   */
  add(tile: number, durationScale = 1): ((dt: number) => boolean) | undefined {
    const { houses, hotel } = this.countOn(tile);
    if (hotel) return undefined;
    let p: Placed;
    if (houses === 4) {
      this.placed = this.placed.filter((q) => q.tile !== tile);
      p = { kind: 'hotel', tile, slot: 0, matrix: this.matrixFor('hotel', tile, 0) };
    } else {
      p = { kind: 'house', tile, slot: houses, matrix: this.matrixFor('house', tile, houses) };
    }
    this.placed.push(p);
    const mesh = new THREE.Mesh(p.kind === 'house' ? this.houseGeo : this.hotelGeo, this.material);
    mesh.castShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    this.animating.set(p, mesh);
    this.rebuild();
    const dur = 0.18 * durationScale;
    const drop = 0.03;
    let t = 0;
    const finish = () => {
      this.group.remove(mesh);
      this.animating.delete(p);
      this.rebuild();
    };
    if (dur <= 0) {
      finish();
      return undefined;
    }
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
      mesh.matrix.copy(this.matrixFor(p.kind, p.tile, p.slot, lift));
      if (k >= 1) {
        finish();
        return false;
      }
      return true;
    };
  }

  /** Remove one building (hotel → none in M0) with lift-and-fade. */
  remove(tile: number, durationScale = 1): ((dt: number) => boolean) | undefined {
    const on = this.placed.filter((p) => p.tile === tile);
    if (!on.length) return undefined;
    const p = on.reduce((a, b) => (b.slot > a.slot || b.kind === 'hotel' ? b : a));
    this.placed = this.placed.filter((q) => q !== p);
    this.rebuild();
    const mat = this.material.clone();
    mat.transparent = true;
    const mesh = new THREE.Mesh(p.kind === 'house' ? this.houseGeo : this.hotelGeo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(p.matrix);
    this.group.add(mesh);
    const dur = 0.35 * durationScale;
    let t = 0;
    const done = () => {
      this.group.remove(mesh);
      mat.dispose();
    };
    if (dur <= 0) {
      done();
      return undefined;
    }
    return (dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      mesh.matrix.copy(this.matrixFor(p.kind, p.tile, p.slot, 0.03 * k * k));
      mat.opacity = 1 - k;
      if (k >= 1) {
        done();
        return false;
      }
      return true;
    };
  }
}
