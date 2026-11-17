// The nine code-built tokens (SPEC §10.4): four turned/assembled pieces (teacup, rocket,
// umbrella, crown) and five die-cut medallions (key, bicycle, cat, sailboat, gramophone).
// Proportions follow assets/token-reference/*.svg. Per token, all brass is merged into one
// geometry so a token costs only a few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BASE_HEIGHT, REF_SCALE, baseGeometry, ringGeometry } from './base';
import { brass, darkGlass, enamel, engraved } from './materials';
import {
  MEDALLION_DEPTH,
  type ExtrudePart,
  capsule,
  circle,
  cubicPoints,
  ellipseRing,
  extrudeParts,
  latheRef,
  pathShapes,
  poly,
  rect,
  ring,
  stroke,
  toWorldX,
  toWorldY,
} from './shapes';

export type TokenId =
  | 'teacup'
  | 'key'
  | 'bicycle'
  | 'cat'
  | 'rocket'
  | 'crown'
  | 'sailboat'
  | 'umbrella'
  | 'gramophone';

export const TOKEN_IDS: TokenId[] = ['teacup', 'key', 'bicycle', 'cat', 'rocket', 'crown', 'sailboat', 'umbrella', 'gramophone'];

interface TokenParts {
  brass: THREE.BufferGeometry[];
  engraved?: THREE.BufferGeometry[];
  extras?: { geometry: THREE.BufferGeometry; material: THREE.Material }[];
}

const ENGRAVE = MEDALLION_DEPTH + 2 * 1.81 + 0.6; // proud of both faces by ≈0.3 ref units
const engrave = (shapes: THREE.Shape[]): ExtrudePart => ({ shapes, bevel: 0, depth: ENGRAVE });

function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(name)) ng.deleteAttribute(name);
    ng.clearGroups();
    return ng;
  });
  const merged = mergeGeometries(flat, false);
  if (!merged) throw new Error('token merge failed');
  return merged;
}

// ---- medallions --------------------------------------------------------------------------

function key(): TokenParts {
  const bow = ring(60, 33, 19, 7.5);
  return {
    brass: extrudeParts([
      { shapes: [rect(55, 50, 10, 56.5)] },
      { shapes: [poly([[65, 76], [78, 76], [78, 83], [72, 83], [72, 88], [78, 88], [78, 95], [65, 95]])] },
      { shapes: [rect(50, 52, 20, 7)] },
      { shapes: [bow] },
    ]),
    engraved: extrudeParts([engrave([ring(60, 33, 12.5, 11.6)]), engrave([rect(59.6, 62, 0.9, 36)])]),
  };
}

function bicycle(): TokenParts {
  const frame: [number, number, number, number][] = [
    [36, 88, 54, 64],
    [54, 64, 78, 64],
    [78, 64, 84, 88],
    [54, 64, 62, 88],
    [62, 88, 36, 88],
    [62, 88, 78, 64],
    [52, 57, 54, 64],
    [47, 56, 58, 56],
    [78, 64, 76, 52],
    [71, 52, 81, 52],
  ];
  const spokes: [number, number, number, number][] = [
    [36, 71, 36, 105],
    [19, 88, 53, 88],
    [84, 71, 84, 105],
    [67, 88, 101, 88],
  ];
  return {
    brass: extrudeParts([
      { shapes: [ring(36, 88, 19.4, 14.8), ring(84, 88, 19.4, 14.8)] },
      { shapes: frame.map(([a, b, c, d]) => capsule(a, b, c, d, 3.8)), bevel: 0.8 },
      { shapes: spokes.map(([a, b, c, d]) => capsule(a, b, c, d, 1.6)), bevel: 0.35 },
      { shapes: [circle(36, 88, 3.4), circle(84, 88, 3.4), circle(62, 88, 4.6)], bevel: 0.9 },
      // Wheels stand on a short brass foot so the medallion is anchored to the base.
      { shapes: [rect(30, 104, 60, 3)], bevel: 0.6 },
    ]),
    engraved: extrudeParts([engrave([ring(36, 88, 17.4, 16.8), ring(84, 88, 17.4, 16.8)])]),
  };
}

function cat(): TokenParts {
  const [body] = pathShapes(
    'M42 103C35 86 39 68 52 60C47 55 46 47 48 41L45 23L58 32C60 31 66 31 68 32L81 23L78 41C80 47 79 55 74 60C86 68 90 86 82 103Z',
  );
  // Eyes are cut through the medallion.
  for (const d of ['M52.5 44c2-2.2 5-2.2 7 0c-2 2.2-5 2.2-7 0z', 'M66.5 44c2-2.2 5-2.2 7 0c-2 2.2-5 2.2-7 0z']) {
    const [eye] = pathShapes(d);
    body.holes.push(new THREE.Path(eye.getPoints(12)));
  }
  const tail = stroke(cubicPoints([84, 101], [101, 101], [104, 84], [94, 76], 16), 5.4);
  return {
    brass: extrudeParts([
      { shapes: [body] },
      { shapes: tail, bevel: 1.2 },
      { shapes: [rect(44, 100, 38, 6.5)], bevel: 1 },
    ]),
    engraved: extrudeParts([
      engrave([
        capsule(50, 23.5, 55, 31, 0.9),
        capsule(76, 23.5, 71, 31, 0.9),
        poly([[61, 50], [65, 50], [63, 52.4]]),
        capsule(57, 52, 47, 50.4, 0.6),
        capsule(57, 54, 47, 55.6, 0.6),
        capsule(69, 52, 79, 50.4, 0.6),
        capsule(69, 54, 79, 55.6, 0.6),
        ...stroke(cubicPoints([54, 103], [54, 97], [57, 94], [60, 94], 6), 1),
        ...stroke(cubicPoints([72, 103], [72, 97], [69, 94], [66, 94], 6), 1),
      ]),
    ]),
  };
}

function sailboat(): TokenParts {
  return {
    brass: extrudeParts([
      { shapes: [poly([[26, 84], [94, 84], [83, 102], [37, 102]])] },
      { shapes: [rect(40, 100, 40, 6.5)], bevel: 1 },
      { shapes: [rect(58.5, 16, 3.4, 68)], bevel: 0.7 },
      { shapes: pathShapes('M57 24v56H30c7-18 15-38 27-56z') },
      { shapes: pathShapes('M63.5 30v50h24c-6-16-14-34-24-50z') },
      { shapes: [poly([[61.9, 16], [72.9, 19.4], [61.9, 22.8]])], bevel: 0.6 },
    ]),
    engraved: extrudeParts([
      engrave([
        capsule(30, 88, 90, 88, 0.9),
        capsule(44, 52, 56, 52, 0.8),
        capsule(38, 66, 56, 66, 0.8),
        capsule(64.5, 52, 74.5, 52, 0.8),
        capsule(64.5, 66, 80.5, 66, 0.8),
      ]),
    ]),
  };
}

function gramophone(): TokenParts {
  const rot = (-48 * Math.PI) / 180;
  const u = [Math.cos(rot), Math.sin(rot)];
  const v = [-Math.sin(rot), Math.cos(rot)];
  const [cx, cy, ai, bi] = [95, 21, 12.6, 6.1];
  const ellipsePt = (t: number): [number, number] => [
    cx + ai * Math.cos(t) * u[0] + bi * Math.sin(t) * v[0],
    cy + ai * Math.cos(t) * u[1] + bi * Math.sin(t) * v[1],
  ];
  // Horn: body up to the mouth, ending on the mouth's inner rim so the mouth stays open.
  const horn = new THREE.Shape();
  horn.moveTo(70, 70);
  horn.lineTo(75, 70);
  const start = ellipsePt(Math.PI / 2);
  horn.bezierCurveTo(79, 54, 88, 42, start[0], start[1]);
  for (let i = 1; i <= 16; i++) {
    const [x, y] = ellipsePt(Math.PI / 2 + (i / 16) * Math.PI);
    horn.lineTo(x, y);
  }
  horn.bezierCurveTo(80, 32, 71, 50, 70, 70);
  return {
    brass: extrudeParts([
      { shapes: [(() => { const s = new THREE.Shape(); s.moveTo(36, 80); s.lineTo(78, 80); s.quadraticCurveTo(80, 80, 80, 82); s.lineTo(80, 100); s.quadraticCurveTo(80, 102, 78, 102); s.lineTo(36, 102); s.quadraticCurveTo(34, 102, 34, 100); s.lineTo(34, 82); s.quadraticCurveTo(34, 80, 36, 80); return s; })()] },
      { shapes: [rect(38, 100, 38, 6.5)], bevel: 1 },
      { shapes: [capsule(34, 92, 26, 92, 3), capsule(26, 92, 26, 100, 3)], bevel: 0.6 },
      { shapes: [(() => { const s = new THREE.Shape(); s.absellipse(52, 80, 15, 3.6, 0, Math.PI * 2, false, 0); return s; })()], bevel: 0.8 },
      { shapes: [capsule(72, 80, 72, 68, 3.4)], bevel: 0.7 },
      { shapes: [horn] },
      { shapes: [ellipseRing(cx, cy, 15.8, 9.2, ai, bi, rot)], bevel: 1.1 },
    ]),
    engraved: extrudeParts([
      engrave([
        ...[
          [39, 85, 75, 85],
          [75, 85, 75, 97],
          [75, 97, 39, 97],
          [39, 97, 39, 85],
        ].map(([a, b, c, d]) => capsule(a, b, c, d, 0.9)),
        ...stroke(cubicPoints([74, 64], [77, 50], [83, 36], [91, 26], 10), 0.8),
      ]),
    ]),
  };
}

// ---- turned / assembled ------------------------------------------------------------------

function bezierProfile(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  n = 16,
): [number, number][] {
  return cubicPoints(p0, p1, p2, p3, n);
}

function teacup(): TokenParts {
  // Outer wall from the rim (r 26, y 56) down to the bottom center (y 94), then back up inside.
  const outer = bezierProfile([0, 94], [17, 94], [26, 78], [26, 56], 18);
  const inner = bezierProfile([23.8, 57.5], [23.8, 76], [15.5, 91.3], [0, 91.3], 16);
  const cup = latheRef([[0, 96.5], [9, 96.5], [10, 95], ...outer.slice(1), [26.2, 55.6], [25, 55.2], [24, 56.2], ...inner]);
  const saucer = latheRef([
    [0, 101.8],
    [18, 101.8],
    [27, 100.6],
    [31, 98.6],
    [31.2, 97.8],
    [30.2, 97.6],
    [26, 99.2],
    [14, 99.9],
    [0, 99.9],
  ]);
  const foot = latheRef([[0, 106.4], [13, 106.4], [12, 104], [9, 101.7], [0, 101.7]]);
  // Handle: torus segment on the +X side, opening toward the cup.
  const handle = new THREE.TorusGeometry(9 * REF_SCALE, 2.2 * REF_SCALE, 10, 24, Math.PI * 1.25);
  handle.rotateZ(-Math.PI * 0.625);
  handle.translate(toWorldX(60 + 24.5), toWorldY(76), 0);
  return { brass: [cup, saucer, foot, handle] };
}

function rocket(): TokenParts {
  const body = latheRef([
    ...bezierProfile([0, 12], [14, 26], [18, 46], [15, 80], 22),
    [14, 80],
    [14, 87],
    [3.2, 87],
    [3.2, 96],
    [5.5, 106.4],
    [0, 106.4],
  ]);
  // Three fins, radial, 120° apart.
  const finShape = poly([[13, 66], [28, 90], [28, 102], [13, 89]]);
  const fins: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.ExtrudeGeometry(finShape, {
      depth: 2.2,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelOffset: -0.5,
      bevelSegments: 2,
    });
    g.translate(0, 0, -1.1);
    g.scale(REF_SCALE, -REF_SCALE, -REF_SCALE);
    g.translate(0, BASE_HEIGHT + 106 * REF_SCALE, 0);
    g.rotateY(Math.PI / 2 + (i * 2 * Math.PI) / 3 + Math.PI / 6);
    fins.push(g);
  }
  // Porthole: brass bezel + dark glass, facing +Z.
  const rBody = 16.3 * REF_SCALE;
  const bezel = new THREE.TorusGeometry(10 * REF_SCALE, 1.8 * REF_SCALE, 10, 32);
  bezel.translate(0, toWorldY(46), rBody - 1.2 * REF_SCALE);
  const glassGeo = new THREE.CylinderGeometry(8.6 * REF_SCALE, 8.6 * REF_SCALE, 2 * REF_SCALE, 32);
  glassGeo.rotateX(Math.PI / 2);
  glassGeo.translate(0, toWorldY(46), rBody - 1.6 * REF_SCALE);
  return {
    brass: [body, ...fins, bezel],
    extras: [{ geometry: glassGeo, material: darkGlass() }],
  };
}

function umbrella(): TokenParts {
  const t = 1.6;
  const outer = bezierProfile([0, 20], [16, 20], [32, 32], [34, 54], 20);
  const inner = bezierProfile([34 - t, 54 - 0.4], [30.5, 34], [15.5, 20 + t], [0, 20 + t], 18);
  const canopy = latheRef([...outer, [34.2, 54.6], ...inner], 64);
  // Scalloped rim: lift the rim between 8 ribs.
  const pos = canopy.attributes.position;
  const rimY = toWorldY(54);
  const topY = toWorldY(20);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h = (y - rimY) / (topY - rimY); // 0 at rim, 1 at top
    const w = Math.max(0, 1 - h / 0.35) ** 2;
    if (w <= 0) continue;
    const theta = Math.atan2(z, x);
    const lift = 4.2 * REF_SCALE * w * (1 - Math.abs(Math.cos(4 * theta)));
    pos.setY(i, y + lift);
  }
  canopy.computeVertexNormals();
  // Eight raised ribs from the tip to the scallop points, so the canopy reads as an umbrella.
  const ribs: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4;
    const pts = outer.map(([r, y]) => {
      const rr = (r + 0.7) * REF_SCALE;
      return new THREE.Vector3(Math.cos(th) * rr, toWorldY(y) + 0.3 * REF_SCALE, Math.sin(th) * rr);
    });
    ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.75 * REF_SCALE, 5, false));
  }
  const shaft = new THREE.CylinderGeometry(2.1 * REF_SCALE, 2.1 * REF_SCALE, (96 - 20) * REF_SCALE, 12);
  shaft.translate(0, (toWorldY(20) + toWorldY(96)) / 2, 0);
  const hook = new THREE.TorusGeometry(5 * REF_SCALE, 2.1 * REF_SCALE, 10, 20, Math.PI);
  hook.rotateZ(Math.PI);
  hook.translate(toWorldX(65), toWorldY(96), 0);
  const stub = new THREE.CylinderGeometry(2 * REF_SCALE, 3 * REF_SCALE, 6 * REF_SCALE, 12);
  stub.translate(toWorldX(65), toWorldY(103.5), 0);
  const finial = new THREE.CylinderGeometry(1.6 * REF_SCALE, 2 * REF_SCALE, 9 * REF_SCALE, 12);
  finial.translate(0, toWorldY(16.5), 0);
  const knob = new THREE.SphereGeometry(2.4 * REF_SCALE, 12, 8);
  knob.translate(0, toWorldY(12), 0);
  return { brass: [canopy, ...ribs, shaft, hook, stub, finial, knob] };
}

function crown(): TokenParts {
  // Band: a turned ring, slightly tapered, open at the top.
  const band = latheRef([
    [22, 100],
    [26, 100],
    [27, 80],
    [26.2, 79.4],
    [24.6, 80.4],
    [23.6, 99],
    [22, 99],
  ]);
  const foot = latheRef([[0, 106.4], [21, 106.4], [20, 103], [22.5, 100], [0, 100]]);
  const parts: THREE.BufferGeometry[] = [band, foot];
  const tipYs = [32, 44, 32, 44, 38];
  const r = 25.6;
  for (let i = 0; i < 5; i++) {
    const tip = tipYs[i];
    const shape = poly([[-10, 81], [10, 81], [0, tip]]);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 2.4,
      bevelEnabled: true,
      bevelThickness: 0.6,
      bevelSize: 0.6,
      bevelOffset: -0.6,
      bevelSegments: 2,
    });
    g.translate(0, 0, -1.2);
    g.scale(REF_SCALE, -REF_SCALE, -REF_SCALE);
    g.translate(0, BASE_HEIGHT + 106 * REF_SCALE, r * REF_SCALE);
    const angle = (i * 2 * Math.PI) / 5;
    g.rotateY(angle);
    parts.push(g);
    const sphere = new THREE.SphereGeometry(4.3 * REF_SCALE, 14, 10);
    sphere.translate(Math.sin(angle) * r * REF_SCALE, toWorldY(tip - 2), Math.cos(angle) * r * REF_SCALE);
    parts.push(sphere);
  }
  // Three enamel jewels on the band front.
  const jewels: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  const jewel = (angleDeg: number, color: number, diamond: boolean) => {
    const a = (angleDeg * Math.PI) / 180;
    const g = diamond ? new THREE.OctahedronGeometry(4.6 * REF_SCALE) : new THREE.SphereGeometry(4.1 * REF_SCALE, 14, 10);
    g.scale(1, 1, 0.55);
    if (diamond) g.rotateZ(0);
    g.rotateY(a);
    const rr = 26.4 * REF_SCALE;
    g.translate(Math.sin(a) * rr, toWorldY(90), Math.cos(a) * rr);
    jewels.push({ geometry: g, material: enamel(color) });
  };
  jewel(-31, 0xa3302a, false);
  jewel(0, 0x2e7d4f, true);
  jewel(31, 0x2f5f9e, false);
  return { brass: parts, extras: jewels };
}

const BUILDERS: Record<TokenId, () => TokenParts> = {
  teacup,
  key,
  bicycle,
  cat,
  rocket,
  crown,
  sailboat,
  umbrella,
  gramophone,
};

export interface TokenObject {
  id: TokenId;
  group: THREE.Group;
  /** The figure (everything above the base), for hop squash/settle. */
  setColor(color: string): void;
}

const figureCache = new Map<TokenId, TokenParts & { brassMerged: THREE.BufferGeometry; engravedMerged?: THREE.BufferGeometry }>();

export function buildToken(id: TokenId, color: string): TokenObject {
  let cached = figureCache.get(id);
  if (!cached) {
    const parts = BUILDERS[id]();
    cached = {
      ...parts,
      brassMerged: merge(parts.brass),
      engravedMerged: parts.engraved ? merge(parts.engraved) : undefined,
    };
    figureCache.set(id, cached);
  }
  const group = new THREE.Group();
  group.name = `token-${id}`;
  const figure = new THREE.Mesh(merge([cached.brassMerged, baseGeometry()]), brass(id === 'cat' || id === 'key' ? 0.3 : 0.27));
  figure.castShadow = true;
  figure.receiveShadow = true;
  group.add(figure);
  if (cached.engravedMerged) {
    const e = new THREE.Mesh(cached.engravedMerged, engraved());
    e.castShadow = false;
    group.add(e);
  }
  for (const x of cached.extras ?? []) {
    const m = new THREE.Mesh(x.geometry, x.material);
    m.castShadow = true;
    group.add(m);
  }
  const ringMesh = new THREE.Mesh(ringGeometry(), enamel(color));
  group.add(ringMesh);
  return {
    id,
    group,
    setColor(c) {
      ringMesh.material = enamel(c);
    },
  };
}
