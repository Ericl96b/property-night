// Token portraits for the overlay (player cards, payment moments): each code-built token is
// rendered once into a small transparent image with its own tiny renderer, so the 2D UI shows
// the same brass pieces as the board.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildToken, type TokenId } from './tokens/tokens';

const cache = new Map<string, string>();

export function portraitKey(token: string, color: string): string {
  return `${token}|${color}`;
}

export function getPortrait(token: string, color: string): string | undefined {
  return cache.get(portraitKey(token, color));
}

/** Render portraits for the given seats (skips ones already cached). */
export function renderPortraits(seats: { token: string; color: string }[], size = 192): void {
  const todo = seats.filter((s) => !cache.has(portraitKey(s.token, s.color)));
  if (!todo.length) return;
  let renderer: THREE.WebGLRenderer | undefined;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    const key = new THREE.DirectionalLight(0xffd9a8, 3);
    key.position.set(-0.6, 1.2, 1);
    scene.add(key, new THREE.HemisphereLight(0xffe6c4, 0x3b2619, 0.5));
    const cam = new THREE.OrthographicCamera(-0.03, 0.03, 0.03, -0.03, 0.001, 1);
    cam.position.set(0, 0.034, 0.25);
    cam.lookAt(0, 0.024, 0);
    for (const s of todo) {
      const t = buildToken(s.token as TokenId, s.color);
      t.group.rotation.y = 0;
      scene.add(t.group);
      renderer.render(scene, cam);
      cache.set(portraitKey(s.token, s.color), canvas.toDataURL('image/png'));
      scene.remove(t.group);
    }
    pmrem.dispose();
  } catch {
    /* WebGL unavailable: the UI falls back to a color ring */
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
