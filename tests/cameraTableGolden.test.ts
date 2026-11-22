// Stage 2: Table style must look exactly like the pre-Stage-2 camera. This replays a scripted
// sequence of camera calls and compares every sampled pose with poses recorded from the old
// implementation (tests/fixtures/camera-table-golden.json). Regenerate only on purpose:
//   GOLDEN_WRITE=1 npx vitest run tests/cameraTableGolden.test.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraDirector } from '../src/render/cameraDirector';

const FIXTURE = resolve(__dirname, 'fixtures/camera-table-golden.json');

type Sample = number[];

function sample(cam: CameraDirector): Sample {
  const p = cam.camera.position;
  const q = cam.camera.quaternion;
  return [p.x, p.y, p.z, q.x, q.y, q.z, q.w, cam.lightRig.rotation.y, cam.viewYaw, cam.camera.fov];
}

function run(): Sample[] {
  const out: Sample[] = [];
  const cam = new CameraDirector();
  // The style flag is new in Stage 2; older code simply ignores the extra field.
  (cam.settings as unknown as Record<string, unknown>).style = 'table';
  const frames = (n: number) => {
    for (let i = 0; i < n; i++) {
      cam.update(1 / 60);
      if (i % 5 === 0) out.push(sample(cam));
    }
    out.push(sample(cam));
  };
  cam.setViewport(1920, 1080, 0.58);
  out.push(sample(cam));
  for (const speed of [0.6, 1, 0.45]) {
    cam.speed = speed;
    cam.toSide(1);
    frames(60);
    cam.toSide(3);
    frames(140);
    cam.toSide(2);
    frames(40);
    cam.toSide(0);
    frames(160);
  }
  cam.speed = 0.6;
  // Follow a token hopping along side 0 toward a destination.
  const dest = new THREE.Vector3(-0.3, 0.012, 0.43);
  for (let k = 0; k < 30; k++) {
    cam.setFollow(new THREE.Vector3(0.4 - k * 0.025, 0.012 + 0.01 * Math.sin(k), 0.43), dest);
    frames(3);
  }
  cam.setFollow(null);
  frames(90);
  cam.pushIn(new THREE.Vector3(0.2, 0.012, -0.4));
  frames(60);
  cam.pushIn(null);
  frames(90);
  cam.setNudge(0.7, -0.4);
  frames(30);
  cam.setNudge(0, 0);
  frames(60);
  cam.frame(0.1, -0.2, 0.8);
  out.push(sample(cam));
  cam.setFollow(null);
  frames(80);
  cam.toSide(2, true);
  out.push(sample(cam));
  cam.setViewport(1280, 1024, 0.7);
  out.push(sample(cam));
  cam.setViewport(2560, 1080, 0.5);
  out.push(sample(cam));
  // Rotation and follow switched off.
  cam.settings.rotation = false;
  cam.settings.follow = false;
  cam.toSide(1);
  cam.setFollow(new THREE.Vector3(0.3, 0.012, 0.3));
  frames(40);
  cam.settings.rotation = true;
  cam.settings.follow = true;
  cam.speed = Infinity;
  cam.toSide(3);
  frames(5);
  cam.speed = 0.6;
  // Reduce motion.
  cam.settings.reduceMotion = true;
  cam.apply();
  out.push(sample(cam));
  cam.setNudge(1, 1);
  frames(20);
  cam.settings.reduceMotion = false;
  cam.setNudge(0, 0);
  cam.apply();
  frames(60);
  return out;
}

describe('Table style is unchanged by Stage 2', () => {
  it('replays the recorded pre-Stage-2 poses', () => {
    const got = run();
    if (process.env.GOLDEN_WRITE || !existsSync(FIXTURE)) {
      mkdirSync(dirname(FIXTURE), { recursive: true });
      writeFileSync(FIXTURE, JSON.stringify(got));
      if (!process.env.GOLDEN_WRITE) throw new Error('golden fixture was missing; written now, re-run');
      return;
    }
    const want: Sample[] = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    expect(got.length).toBe(want.length);
    for (let i = 0; i < want.length; i++) {
      for (let j = 0; j < want[i].length; j++) {
        if (Math.abs(got[i][j] - want[i][j]) > 1e-9) throw new Error(`sample ${i} field ${j}: got ${got[i][j]}, want ${want[i][j]}`);
      }
    }
  });
});
