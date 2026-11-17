// Board object (SPEC §10.2): a thin 1.0 × 1.0 × 0.012 slab with slightly beveled edges.
// The printed face uses the generated board texture; the sides show layered card stock
// (cream with a darker lamination line). Satin sheen with one large-scale roughness map.
import * as THREE from 'three';
import { BOARD_SIZE, BOARD_THICKNESS } from './layout';
import { largeScaleRoughnessCanvas, makeCanvas } from './noise';

const BEVEL = 0.0016;

function edgeTexture(): THREE.CanvasTexture {
  const h = 128;
  const c = makeCanvas(4, h);
  const ctx = c.getContext('2d')!;
  // v = 0 at the bottom of the side wall, 1 at the top.
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, '#CDB894');
  g.addColorStop(0.12, '#E6D7B8');
  g.addColorStop(0.44, '#EFE3C8');
  g.addColorStop(0.46, '#8C7556'); // lamination line
  g.addColorStop(0.53, '#8C7556');
  g.addColorStop(0.55, '#EADCC0');
  g.addColorStop(0.9, '#F1E6CE');
  g.addColorStop(1, '#F3EAD6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Board-face UV for a world (x, z) on the printed face. Canvas top row (far side, −z) is v = 1. */
export function boardUV(x: number, z: number): [number, number] {
  return [x + 0.5, 0.5 - z];
}

export interface BoardObject {
  mesh: THREE.Mesh;
  faceMaterial: THREE.MeshStandardMaterial;
  setFaceTexture(tex: THREE.Texture): void;
}

export function createBoard(faceTexture: THREE.Texture): BoardObject {
  const half = BOARD_SIZE / 2;
  const shape = new THREE.Shape();
  const r = 0.004;
  shape.moveTo(-half + r, -half);
  shape.lineTo(half - r, -half);
  shape.quadraticCurveTo(half, -half, half, -half + r);
  shape.lineTo(half, half - r);
  shape.quadraticCurveTo(half, half, half - r, half);
  shape.lineTo(-half + r, half);
  shape.quadraticCurveTo(-half, half, -half, half - r);
  shape.lineTo(-half, -half + r);
  shape.quadraticCurveTo(-half, -half, -half + r, -half);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: BOARD_THICKNESS - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    // Offset 0: the flat top cap is exactly the 1.0 × 1.0 print; the bevel adds 1.6 mm outside it.
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 4,
  });
  // Extrusion runs along +Z; stand it up so the extrusion axis is +Y and the top face is up.
  geo.translate(0, 0, BEVEL);
  geo.rotateX(-Math.PI / 2);

  // Re-map UVs: caps get board-face UVs from world x/z, side walls get v = height.
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(nrm.getY(i)) > 0.999) uv.setXY(i, ...boardUV(x, z));
    else uv.setXY(i, (x + z) * 4, y / BOARD_THICKNESS);
  }
  uv.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(largeScaleRoughnessCanvas(7, 256, 0.1));
  const faceMaterial = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.6,
    roughnessMap,
    metalness: 0,
    envMapIntensity: 0.55,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({ map: edgeTexture(), roughness: 0.75, metalness: 0 });
  // ExtrudeGeometry groups: 0 = caps, 1 = side walls.
  const mesh = new THREE.Mesh(geo, [faceMaterial, edgeMaterial]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'board';
  return {
    mesh,
    faceMaterial,
    setFaceTexture(tex) {
      const old = faceMaterial.map;
      faceMaterial.map = tex;
      faceMaterial.needsUpdate = true;
      if (old && old !== tex) old.dispose();
    },
  };
}
