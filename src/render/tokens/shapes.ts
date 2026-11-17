// 2D shape helpers in reference-art space (token-reference SVG coordinates, y down),
// plus extrusion into token-local 3D space.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { BASE_HEIGHT, REF_BASE_TOP_Y, REF_CENTER_X, REF_SCALE } from './base';

export function pathShapes(d: string): THREE.Shape[] {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  return data.paths.flatMap((p) => SVGLoader.createShapes(p));
}

export function rect(x: number, y: number, w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x, y);
  s.lineTo(x + w, y);
  s.lineTo(x + w, y + h);
  s.lineTo(x, y + h);
  s.closePath();
  return s;
}

export function poly(pts: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  s.closePath();
  return s;
}

export function circle(cx: number, cy: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return s;
}

export function ring(cx: number, cy: number, ro: number, ri: number): THREE.Shape {
  const s = circle(cx, cy, ro);
  const h = new THREE.Path();
  h.absarc(cx, cy, ri, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}

export function ellipseRing(
  cx: number,
  cy: number,
  ao: number,
  bo: number,
  ai: number,
  bi: number,
  rotation: number,
): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, ao, bo, 0, Math.PI * 2, false, rotation);
  const h = new THREE.Path();
  h.absellipse(cx, cy, ai, bi, 0, Math.PI * 2, true, rotation);
  s.holes.push(h);
  return s;
}

/** Round-capped line segment of width w. */
export function capsule(x1: number, y1: number, x2: number, y2: number, w: number): THREE.Shape {
  const r = w / 2;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const s = new THREE.Shape();
  const nx = -Math.sin(a) * r;
  const ny = Math.cos(a) * r;
  s.moveTo(x1 + nx, y1 + ny);
  s.lineTo(x2 + nx, y2 + ny);
  s.absarc(x2, y2, r, a + Math.PI / 2, a - Math.PI / 2, true);
  s.lineTo(x1 - nx, y1 - ny);
  s.absarc(x1, y1, r, a - Math.PI / 2, a - (3 * Math.PI) / 2, true);
  return s;
}

/** Stroke a polyline (e.g. a sampled curve) with round end caps. Returns several shapes. */
export function stroke(points: [number, number][], w: number): THREE.Shape[] {
  const out: THREE.Shape[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    out.push(capsule(x1, y1, x2, y2, w));
  }
  return out;
}

export function cubicPoints(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  n = 14,
): [number, number][] {
  const c = new THREE.CubicBezierCurve(
    new THREE.Vector2(...p0),
    new THREE.Vector2(...p1),
    new THREE.Vector2(...p2),
    new THREE.Vector2(...p3),
  );
  return c.getPoints(n).map((v) => [v.x, v.y]);
}

/** Medallion thickness (SPEC §10.4): depth ≈ 0.004, bevel ≈ 0.0008, 3 segments. */
export const MEDALLION_DEPTH = 0.004 / REF_SCALE;
export const MEDALLION_BEVEL = 0.0008 / REF_SCALE;

export interface ExtrudePart {
  shapes: THREE.Shape[];
  /** Bevel size in reference units; defaults to the medallion bevel. Thin parts use less. */
  bevel?: number;
  /** Extra thickness in reference units (engraving ridges sit proud of the faces). */
  depth?: number;
}

/**
 * Extrude parts in reference space and convert to token-local space (centered on the token
 * axis, standing on the base, medallion faces toward ±Z).
 */
export function extrudeParts(parts: ExtrudePart[]): THREE.BufferGeometry[] {
  return parts.map((p) => {
    const bevel = p.bevel ?? MEDALLION_BEVEL;
    const depth = p.depth ?? MEDALLION_DEPTH;
    const g = new THREE.ExtrudeGeometry(p.shapes, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: -bevel,
      bevelSegments: 3,
      curveSegments: 10,
    });
    g.translate(-REF_CENTER_X, -REF_BASE_TOP_Y, -depth / 2);
    // (x, y, z) → (s·x, −s·y, −s·z): a proper rotation (π about X) plus uniform scale,
    // so triangle winding stays correct.
    g.scale(REF_SCALE, -REF_SCALE, -REF_SCALE);
    g.translate(0, BASE_HEIGHT, 0);
    return g;
  });
}

/** Lathe a (radius, refY) profile into token-local space. */
export function latheRef(profile: [number, number][], segments = 48): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r * REF_SCALE), BASE_HEIGHT + (REF_BASE_TOP_Y - y) * REF_SCALE)),
    segments,
  );
}

export function toWorldY(refY: number): number {
  return BASE_HEIGHT + (REF_BASE_TOP_Y - refY) * REF_SCALE;
}

export function toWorldX(refX: number): number {
  return (refX - REF_CENTER_X) * REF_SCALE;
}
