// Ownership and state on the board (SPEC §10.2): thin meshes, never texture redraws.
// Owner = enamel disc set into the tile's outer edge; mortgaged = the tile's print desaturated
// plus an oxblood "M" stamp; promise = small ribbon decal.
import * as THREE from 'three';
import {
  BOARD_TOP,
  OWNER_DISC_LY,
  PX,
  TILE_H_PX,
  TILE_W_PX,
  tileFrame,
  tileLocalToWorld,
  tileYaw,
} from './layout';
import { enamel } from './tokens/materials';
import { makeCanvas } from './noise';
import { OXBLOOD } from './boardTexture';
import { boardUV } from './board';

const LIFT = 0.00035;

function stampTexture(): THREE.CanvasTexture {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = OXBLOOD;
  ctx.fillStyle = 'rgba(251,246,234,.86)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(18, 18, s - 36, s - 36, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = OXBLOOD;
  ctx.font = `800 ${s * 0.62}px Fraunces`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', s / 2, s / 2 + s * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function lockTexture(): THREE.CanvasTexture {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = '#2B2119';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(64, 52, 24, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#2B2119';
  ctx.beginPath();
  ctx.roundRect(28, 52, 72, 58, 8);
  ctx.fill();
  ctx.fillStyle = '#C39445';
  ctx.beginPath();
  ctx.arc(64, 76, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(60, 80, 8, 18);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ribbonTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2F5D46';
  // Two tails.
  ctx.beginPath();
  ctx.moveTo(98, 120);
  ctx.lineTo(60, 236);
  ctx.lineTo(92, 212);
  ctx.lineTo(112, 240);
  ctx.lineTo(132, 126);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(158, 120);
  ctx.lineTo(196, 236);
  ctx.lineTo(164, 212);
  ctx.lineTo(144, 240);
  ctx.lineTo(124, 126);
  ctx.closePath();
  ctx.fill();
  // Rosette.
  ctx.beginPath();
  ctx.arc(128, 96, 70, 0, Math.PI * 2);
  ctx.fillStyle = '#3B7458';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#FBF6EA';
  ctx.beginPath();
  ctx.arc(128, 96, 52, 0, Math.PI * 2);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Decals {
  readonly group = new THREE.Group();
  private discGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.0011, 28);
  private stampMat = new THREE.MeshStandardMaterial({ map: stampTexture(), transparent: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  private ribbonMat = new THREE.MeshStandardMaterial({ map: ribbonTexture(), transparent: true, alphaTest: 0.05, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  private owners = new Map<number, THREE.Mesh>();
  private mortgaged = new Map<number, THREE.Group>();
  private promises = new Map<number, THREE.Mesh>();
  private locks = new Map<number, THREE.Mesh>();
  private lockMat = new THREE.MeshStandardMaterial({ map: lockTexture(), transparent: true, alphaTest: 0.05, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  private desatMat: THREE.MeshStandardMaterial;

  constructor(boardTexture: THREE.Texture) {
    this.group.name = 'decals';
    this.desatMat = new THREE.MeshStandardMaterial({ map: boardTexture, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -1 });
    this.desatMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.0, 0.97, 0.92), 0.88);`,
      );
    };
  }

  setBoardTexture(t: THREE.Texture): void {
    this.desatMat.map = t;
    this.desatMat.needsUpdate = true;
  }

  private ownerColors = new Map<number, string | null>();

  setOwner(tile: number, color: string | null): void {
    if ((this.ownerColors.get(tile) ?? null) === color) return;
    this.ownerColors.set(tile, color);
    const old = this.owners.get(tile);
    if (old) this.group.remove(old);
    this.owners.delete(tile);
    if (!color) return;
    const f = tileFrame(tile);
    const [x, z] = tileLocalToWorld(f, 0, OWNER_DISC_LY);
    const m = new THREE.Mesh(this.discGeo, enamel(color));
    // Set into the board: mostly sunk, a sliver proud of the print.
    m.position.set(x, BOARD_TOP + 0.00005, z);
    m.receiveShadow = true;
    this.group.add(m);
    this.owners.set(tile, m);
  }

  setMortgaged(tile: number, on: boolean): void {
    if (this.mortgaged.has(tile) === on) return;
    const old = this.mortgaged.get(tile);
    if (old) this.group.remove(old);
    this.mortgaged.delete(tile);
    if (!on) return;
    const f = tileFrame(tile);
    const g = new THREE.Group();
    // Desaturated copy of the tile's print, sampling the board texture at the same UVs.
    const w = TILE_W_PX * PX;
    const h = TILE_H_PX * PX;
    const plane = new THREE.PlaneGeometry(w, h);
    plane.rotateX(-Math.PI / 2);
    const uv = plane.attributes.uv;
    const pos = plane.attributes.position;
    const yaw = tileYaw(f);
    const [cx, cz] = tileLocalToWorld(f, 0, 0);
    plane.rotateY(yaw);
    plane.translate(cx, BOARD_TOP + LIFT, cz);
    for (let i = 0; i < pos.count; i++) uv.setXY(i, ...boardUV(pos.getX(i), pos.getZ(i)));
    const tileMesh = new THREE.Mesh(plane, this.desatMat);
    tileMesh.receiveShadow = true;
    g.add(tileMesh);
    // "M" stamp in the tile body.
    const stamp = new THREE.PlaneGeometry(0.026, 0.026);
    stamp.rotateX(-Math.PI / 2);
    stamp.rotateY(yaw + (-18 * Math.PI) / 180);
    const [sx, sz] = tileLocalToWorld(f, 0, 6);
    stamp.translate(sx, BOARD_TOP + LIFT * 2, sz);
    const sm = new THREE.Mesh(stamp, this.stampMat);
    sm.receiveShadow = true;
    g.add(sm);
    this.group.add(g);
    this.mortgaged.set(tile, g);
  }

  /** Pledged to a bank loan (SPEC §7): small padlock at the tile's outer edge. */
  setPledged(tile: number, on: boolean): void {
    if (this.locks.has(tile) === on) return;
    const old = this.locks.get(tile);
    if (old) this.group.remove(old);
    this.locks.delete(tile);
    if (!on) return;
    const f = tileFrame(tile);
    const geo = new THREE.PlaneGeometry(0.014, 0.014);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(tileYaw(f));
    const [x, z] = tileLocalToWorld(f, -TILE_W_PX / 2 + 11, OWNER_DISC_LY - 10);
    geo.translate(x, BOARD_TOP + LIFT * 2, z);
    const m = new THREE.Mesh(geo, this.lockMat);
    this.group.add(m);
    this.locks.set(tile, m);
  }

  setPromise(tile: number, on: boolean): void {
    if (this.promises.has(tile) === on) return;
    const old = this.promises.get(tile);
    if (old) this.group.remove(old);
    this.promises.delete(tile);
    if (!on) return;
    const f = tileFrame(tile);
    const geo = new THREE.PlaneGeometry(0.016, 0.016);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(tileYaw(f));
    const [x, z] = tileLocalToWorld(f, TILE_W_PX / 2 - 11, OWNER_DISC_LY - 10);
    geo.translate(x, BOARD_TOP + LIFT * 2, z);
    const m = new THREE.Mesh(geo, this.ribbonMat);
    m.receiveShadow = true;
    this.group.add(m);
    this.promises.set(tile, m);
  }
}
