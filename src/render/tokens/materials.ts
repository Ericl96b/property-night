import * as THREE from 'three';

/** Shared brass (SPEC §10.4). One instance per roughness variant keeps draw-state changes low. */
const brassCache = new Map<number, THREE.MeshPhysicalMaterial>();
export function brass(roughness = 0.28): THREE.MeshPhysicalMaterial {
  let m = brassCache.get(roughness);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color: 0xc9a055,
      metalness: 1,
      roughness,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
    });
    brassCache.set(roughness, m);
  }
  return m;
}

let engraving: THREE.MeshPhysicalMaterial | undefined;
/** Darkened brass for engraved lines on medallions. */
export function engraved(): THREE.MeshPhysicalMaterial {
  engraving ??= new THREE.MeshPhysicalMaterial({ color: 0x5a4018, metalness: 1, roughness: 0.55 });
  return engraving;
}

const enamelCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** Glossy enamel (player rings, jewels). */
export function enamel(color: THREE.ColorRepresentation): THREE.MeshPhysicalMaterial {
  const key = new THREE.Color(color).getHexString();
  let m = enamelCache.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    enamelCache.set(key, m);
  }
  return m;
}

let glass: THREE.MeshPhysicalMaterial | undefined;
export function darkGlass(): THREE.MeshPhysicalMaterial {
  glass ??= new THREE.MeshPhysicalMaterial({ color: 0x1d2730, metalness: 0.1, roughness: 0.05, clearcoat: 1 });
  return glass;
}
