// SOLD signs (owner request, 2026-11-18): a small yard sign pops up on every owned property,
// standing just past the tile's inner edge (in the board's center area, so it never covers the
// color band). The hanging panel is the owner's color with a cream "SOLD" sticker on both
// faces. Signs turn to face the camera, like the tokens. Instanced: three draw calls for all.
import * as THREE from 'three';
import { BOARD_TOP, TILE_H_PX, isCorner, tileFrame, tileLocalToWorld } from './layout';
import { makeCanvas } from './noise';
import { quoteFamily } from './symbols';

/** Tile-local y of the sign: 18 px past the inner edge (the band side is local −y). */
export const SIGN_LY = -TILE_H_PX / 2 - 18;

// Sizes in board units (a tile is ≈0.082 wide). Kept short so far-row houses stay visible.
const POST = { w: 0.003, h: 0.042 };
const ARM = { w: 0.031, h: 0.0024 };
const PANEL = { w: 0.036, h: 0.024, d: 0.002, top: 0.0385 };
const STICKER = { w: 0.029, h: 0.0098, d: 0.003 };
const POP_TIME = 0.35;

interface SignState {
  color: THREE.Color | null;
  /** Shown scale (0 = hidden). */
  scale: number;
  target: number;
  /** Pop animation clock (seconds of animation, speed-scaled); null when settled. */
  t: number | null;
  from: number;
  pendingColor?: THREE.Color | null;
}

function stickerTexture(): THREE.CanvasTexture {
  const c = makeCanvas(512, 160);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FBF6EA';
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 152, 22);
  ctx.fill();
  ctx.strokeStyle = '#8E2F23';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(16, 16, 480, 128, 14);
  ctx.stroke();
  ctx.fillStyle = '#8E2F23';
  ctx.font = `900 112px ${quoteFamily('Fraunces')}`;
  ctx.letterSpacing = '10px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SOLD', 261, 86);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function frameGeometry(): THREE.BufferGeometry {
  // Post on the left, an arm across the top; the panel hangs from the arm.
  const post = new THREE.BoxGeometry(POST.w, POST.h, POST.w);
  post.translate(-PANEL.w / 2 - 0.0012, POST.h / 2, 0);
  const arm = new THREE.BoxGeometry(ARM.w + 0.006, ARM.h, ARM.h);
  arm.translate(-PANEL.w / 2 + ARM.w / 2 + 0.0008, PANEL.top + ARM.h / 2 + 0.0006, 0);
  const g = new THREE.BufferGeometry();
  const parts = [post.toNonIndexed(), arm.toNonIndexed()];
  const pos = parts.flatMap((p) => [...(p.attributes.position.array as Float32Array)]);
  const nor = parts.flatMap((p) => [...(p.attributes.normal.array as Float32Array)]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export class Signs {
  readonly group = new THREE.Group();
  private frame: THREE.InstancedMesh;
  private panel: THREE.InstancedMesh;
  private sticker: THREE.InstancedMesh;
  private tiles: number[];
  private state = new Map<number, SignState>();
  private yaw = 0;
  private dirty = true;
  /** Speed factor (animations scale with the speed setting; Infinity = instant). */
  speed = 1;

  constructor() {
    // Every edge tile can hold a sign; only ownable ones ever get an owner.
    this.tiles = Array.from({ length: 40 }, (_, i) => i).filter((i) => !isCorner(i));
    const n = this.tiles.length;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.55 });
    const panelMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, clearcoat: 0.3 });
    const tex = stickerTexture();
    const edge = new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.5 });
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
    // Box faces: +x, −x, +y, −y, +z (front), −z (back). The sticker reads on both faces.
    const stickerMats = [edge, edge, edge, edge, face, face];
    const stickerGeo = new THREE.BoxGeometry(STICKER.w, STICKER.h, STICKER.d);
    // The back face's UVs are mirrored by BoxGeometry; flip them so SOLD reads from behind.
    const uv = stickerGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 20; i < 24; i++) uv.setX(i, 1 - uv.getX(i));
    stickerGeo.rotateZ((12 * Math.PI) / 180);
    stickerGeo.translate(0, PANEL.top - PANEL.h / 2, 0);
    const panelGeo = new THREE.BoxGeometry(PANEL.w, PANEL.h, PANEL.d);
    panelGeo.translate(0, PANEL.top - PANEL.h / 2, 0);
    this.frame = new THREE.InstancedMesh(frameGeometry(), frameMat, n);
    this.panel = new THREE.InstancedMesh(panelGeo, panelMat, n);
    this.sticker = new THREE.InstancedMesh(stickerGeo, stickerMats, n);
    for (const m of [this.frame, this.panel, this.sticker]) {
      m.count = 0;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.panel.setColorAt(0, new THREE.Color(0xffffff)); // allocates instanceColor
    this.group.name = 'sold-signs';
  }

  /** Show `tile` as owned by `color` (null = unowned). Animated pops up, re-colors or sinks. */
  setOwner(tile: number, color: string | null, animate = false): void {
    const st = this.state.get(tile) ?? { color: null, scale: 0, target: 0, t: null, from: 0 };
    this.state.set(tile, st);
    const next = color === null ? null : new THREE.Color(color);
    const same = (a: THREE.Color | null, b: THREE.Color | null) => (a === null ? b === null : b !== null && a.equals(b));
    if (same(st.pendingColor === undefined ? st.color : st.pendingColor, next) && st.target === (next ? 1 : 0)) return;
    const instant = !animate || this.speed === Infinity;
    if (instant) {
      st.color = next;
      st.pendingColor = undefined;
      st.scale = st.target = next ? 1 : 0;
      st.t = null;
    } else if (next && st.color && st.scale > 0) {
      // New owner: shrink a little, swap color, pop back (handled in update()).
      st.pendingColor = next;
      st.from = st.scale;
      st.target = 1;
      st.t = 0;
    } else {
      if (next) st.color = next;
      st.pendingColor = undefined;
      st.from = st.scale;
      st.target = next ? 1 : 0;
      st.t = 0;
    }
    this.dirty = true;
  }

  clear(): void {
    this.state.clear();
    this.dirty = true;
    this.rebuild();
  }

  faceYaw(yaw: number): void {
    if (Math.abs(yaw - this.yaw) < 1e-5) return;
    this.yaw = yaw;
    this.dirty = true;
  }

  /** Advance animations; returns true while any sign is still popping. */
  update(dt: number): boolean {
    let active = false;
    const k = this.speed === Infinity ? 1000 : this.speed;
    for (const st of this.state.values()) {
      if (st.t === null) continue;
      st.t += dt * k;
      const u = Math.min(1, st.t / POP_TIME);
      if (st.pendingColor !== undefined) {
        // Re-color: dip to 60% at the midpoint, swap, pop back with overshoot.
        if (u >= 0.5 && st.pendingColor !== undefined) {
          st.color = st.pendingColor;
          st.pendingColor = undefined;
        }
        st.scale = u < 0.5 ? 1 - 0.8 * u : 0.6 + 0.4 * backOut((u - 0.5) * 2);
      } else if (st.target > st.from) {
        st.scale = st.from + (st.target - st.from) * backOut(u);
      } else {
        st.scale = st.from + (st.target - st.from) * u * u;
      }
      if (u >= 1) {
        st.scale = st.target;
        st.t = null;
        if (st.target === 0) st.color = null;
      } else active = true;
      this.dirty = true;
    }
    if (this.dirty) this.rebuild();
    return active;
  }

  private rebuild(): void {
    this.dirty = false;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    let n = 0;
    for (const tile of this.tiles) {
      const st = this.state.get(tile);
      if (!st || !st.color || st.scale <= 0.001) continue;
      const [x, z] = tileLocalToWorld(tileFrame(tile), 0, SIGN_LY);
      pos.set(x, BOARD_TOP, z);
      // Pops up from the board: height scales fully, width a little.
      scl.set(0.6 + 0.4 * Math.min(1, st.scale), st.scale, 0.6 + 0.4 * Math.min(1, st.scale));
      m.compose(pos, q, scl);
      this.frame.setMatrixAt(n, m);
      this.panel.setMatrixAt(n, m);
      this.sticker.setMatrixAt(n, m);
      this.panel.setColorAt(n, st.color);
      n++;
    }
    for (const mesh of [this.frame, this.panel, this.sticker]) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.panel.instanceColor) this.panel.instanceColor.needsUpdate = true;
  }

  /** Tiles that currently show a sign (review helper and tests). */
  get shown(): number[] {
    return this.tiles.filter((t) => {
      const st = this.state.get(t);
      return !!st?.color && st.scale > 0;
    });
  }
}

function backOut(u: number): number {
  const c = 1.9;
  const x = u - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}
