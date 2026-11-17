// Lighting (SPEC §10.3): warm key light with soft shadows fitted to the board, warm/dark
// hemisphere fill, and a procedural RoomEnvironment for brass reflections.
// The key light lives in the camera rig so the board looks identical from every side.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface LightRig {
  key: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  setShadowSize(size: number): void;
}

export function createLighting(scene: THREE.Scene, rig: THREE.Object3D, renderer: THREE.WebGLRenderer): LightRig {
  // Key: ≈3200 K, above-front-left of the viewer (rig-local: −x is left, +z is toward the viewer).
  const key = new THREE.DirectionalLight(0xffd9a8, 3.1);
  key.position.set(-0.75, 1.55, 0.6);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  const cam = key.shadow.camera;
  // Fitted tightly around the board (diagonal ≈ 1.42) for any rig rotation.
  cam.left = -0.76;
  cam.right = 0.76;
  cam.top = 0.76;
  cam.bottom = -0.76;
  cam.near = 0.5;
  cam.far = 3.2;
  key.shadow.bias = -0.00012;
  key.shadow.normalBias = 0.0008;
  key.shadow.radius = 3;
  rig.add(key);
  rig.add(key.target);

  const hemi = new THREE.HemisphereLight(0xffe6c4, 0x3b2619, 0.42);
  scene.add(hemi);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();

  return {
    key,
    hemi,
    setShadowSize(size) {
      key.shadow.mapSize.set(size, size);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    },
  };
}
