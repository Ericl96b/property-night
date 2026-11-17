// Common turned brass base (SPEC §10.4): short lathe cylinder with a rounded top lip,
// ≈0.030 diameter × 0.006 tall, and an inset enamel ring in the player's color.
import * as THREE from 'three';

export const BASE_RADIUS = 0.015;
export const BASE_HEIGHT = 0.006;
/** Reference-art units → world units (reference token: base top at y=106, overall ≈102 tall). */
export const REF_SCALE = 0.000442;
export const REF_BASE_TOP_Y = 106;
export const REF_CENTER_X = 60;

/** Convert reference-art (x, y) to token-local (x, y) above the base. */
export function ref(x: number, y: number): [number, number] {
  return [(x - REF_CENTER_X) * REF_SCALE, BASE_HEIGHT + (REF_BASE_TOP_Y - y) * REF_SCALE];
}

let baseGeo: THREE.LatheGeometry | undefined;
export function baseGeometry(): THREE.LatheGeometry {
  if (baseGeo) return baseGeo;
  const R = BASE_RADIUS;
  const H = BASE_HEIGHT;
  const groove = 0.0007;
  const pts: [number, number][] = [
    [0, 0],
    [R - 0.0004, 0],
    [R, 0.0004],
    [R, H * 0.3],
    [R - groove, H * 0.36], // groove for the enamel ring
    [R - groove, H * 0.6],
    [R, H * 0.66],
    [R, H - 0.0014],
  ];
  // Rounded top lip.
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push([R - 0.0014 + Math.cos(a) * 0.0014, H - 0.0014 + Math.sin(a) * 0.0014]);
  }
  pts.push([R * 0.7, H], [R * 0.68, H - 0.0003], [0, H - 0.0003]);
  baseGeo = new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    48,
  );
  return baseGeo;
}

let ringGeo: THREE.TorusGeometry | undefined;
export function ringGeometry(): THREE.TorusGeometry {
  ringGeo ??= (() => {
    const g = new THREE.TorusGeometry(BASE_RADIUS - 0.00045, 0.00072, 10, 56);
    g.rotateX(Math.PI / 2);
    g.translate(0, BASE_HEIGHT * 0.48, 0);
    return g;
  })();
  return ringGeo;
}
