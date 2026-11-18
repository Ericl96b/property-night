// SPEC §9/§10.7: camera turns follow the speed setting; reduce motion gives a fixed overhead view.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraDirector } from '../src/render/cameraDirector';

function rotationTime(speed: number): number {
  const cam = new CameraDirector();
  cam.speed = speed;
  cam.toSide(2);
  let t = 0;
  while (cam.rotating && t < 20) {
    cam.update(1 / 60);
    t += 1 / 60;
  }
  return t;
}

describe('camera speed and reduce motion', () => {
  it('a side turn takes 1.4 s at Normal and scales with speed; Instant snaps', () => {
    expect(rotationTime(1)).toBeCloseTo(1.4, 1);
    expect(rotationTime(0.6)).toBeCloseTo(1.4 / 0.6, 1);
    expect(rotationTime(2)).toBeCloseTo(0.7, 1);
    expect(rotationTime(Infinity)).toBe(0);
  });

  it('reduce motion: fixed overhead view, no rotation, no follow, no push-in, no nudge', () => {
    const cam = new CameraDirector();
    cam.settings.reduceMotion = true;
    cam.apply();
    const pos = cam.camera.position.clone();
    cam.toSide(2);
    expect(cam.rotating).toBe(false);
    cam.setFollow(new THREE.Vector3(1, 0, 1), new THREE.Vector3(1.2, 0, 1));
    cam.pushIn(new THREE.Vector3(1, 0, 1));
    cam.setNudge(1, 1);
    for (let i = 0; i < 120; i++) cam.update(1 / 60);
    expect(cam.camera.position.distanceTo(pos)).toBeLessThan(1e-6);
    // Looking almost straight down.
    const dir = new THREE.Vector3();
    cam.camera.getWorldDirection(dir);
    expect(dir.y).toBeLessThan(-0.99);
  });
});
