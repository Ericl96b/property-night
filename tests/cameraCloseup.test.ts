// Stage 2 close-up camera: safe area, minimum height and building boxes, corner continuity,
// travel-direction yaw, Instant / skip, reduce motion, peek and the dice gate.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CLASSIC_BOARD } from '../src/data/classicBoard';
import { CLOSEUP, CameraDirector, type ShotPose } from '../src/render/cameraDirector';
import { bandBox, framingPoints, framingTiles, occludedFraction, projectBounds, ringPoint } from '../src/render/framing';
import { BOARD_TOP, IN_JAIL, type Side, deckFrames, DECK_STACK, sideOfTile, tokenSpots } from '../src/render/layout';
import { boardMaxNdcX, safeAreaNdc } from '../src/ui/stage';

const W = 1920;
const H = 1080;
const TOKEN_H = 0.045;

/** Worst case: a hotel (generous box) on every street, plus the two card decks. */
function worstBoxes(): THREE.Box3[] {
  const boxes: THREE.Box3[] = [];
  CLASSIC_BOARD.tiles.forEach((t, i) => {
    if (t.type === 'street') boxes.push(bandBox(i, 0.07, 0.04, CLOSEUP.buildingTop));
  });
  for (const d of deckFrames()) {
    const r = Math.hypot(DECK_STACK.w, DECK_STACK.d) / 2;
    boxes.push(new THREE.Box3(new THREE.Vector3(d.x - r, BOARD_TOP, d.z - r), new THREE.Vector3(d.x + r, BOARD_TOP + DECK_STACK.h, d.z + r)));
  }
  return boxes;
}

function makeCam(speed = 0.6): CameraDirector {
  const cam = new CameraDirector();
  cam.board = CLASSIC_BOARD;
  cam.speed = speed;
  cam.settings.style = 'closeup';
  const boxes = worstBoxes();
  cam.obstacles = () => boxes;
  cam.setViewport(W, H, boardMaxNdcX(W, H), safeAreaNdc(W, H));
  return cam;
}

function inside(b: { xMin: number; xMax: number; yMin: number; yMax: number } | null, s: { xMin: number; xMax: number; yMin: number; yMax: number }, eps = 1e-6): boolean {
  return !!b && b.xMin >= s.xMin - eps && b.xMax <= s.xMax + eps && b.yMin >= s.yMin - eps && b.yMax <= s.yMax + eps;
}

const focusOf = (p: ShotPose) => new THREE.Vector3(p.fx, BOARD_TOP, p.fz);

function tokenAt(tile: number): THREE.Vector3 {
  const [x, z] = tokenSpots(tile, 1)[0];
  return new THREE.Vector3(x, BOARD_TOP, z);
}

describe('close-up safe area (16:9, standard panels)', () => {
  const safe = safeAreaNdc(W, H);
  const cam = makeCam();
  const tiles = [...Array.from({ length: 40 }, (_, i) => i), IN_JAIL];

  it('Home / Landed: the framed tiles (with building tops) and the token stay in the safe area', () => {
    for (const t of tiles) {
      const p = cam.homePose(t);
      const pts = [...framingPoints(framingTiles(CLASSIC_BOARD, t === IN_JAIL ? 10 : t), CLOSEUP.buildingTop), tokenAt(t)];
      const b = projectBounds(pts, focusOf(p), p.yaw, p.pitch, p.distance, p.fov, W / H);
      expect(inside(b, safe), `tile ${t}`).toBe(true);
    }
  });

  it('Chase: the token stays in the safe area on every tile, forwards and backwards', () => {
    for (let t = 0; t < 40; t++) {
      for (const dir of [1, -1] as const) {
        const tok = tokenAt(t);
        const p = cam.chasePose({ s: t, dir, token: tok });
        const b = projectBounds([tok, tok.clone().setY(BOARD_TOP + TOKEN_H)], focusOf(p), p.yaw, p.pitch, p.distance, p.fov, W / H);
        expect(inside(b, safe), `tile ${t} dir ${dir}`).toBe(true);
      }
    }
  });

  it('Dice: the dice area and the active token are on screen between the panels', () => {
    const maxX = boardMaxNdcX(W, H);
    for (let t = 0; t < 40; t++) {
      const p = cam.dicePose(sideOfTile(t), t);
      const dice = [-0.15, 0.15].flatMap((x) => [-0.15, 0.15].map((z) => new THREE.Vector3(x, BOARD_TOP, z)));
      const b = projectBounds([...dice, tokenAt(t)], focusOf(p), p.yaw, p.pitch, p.distance, p.fov, W / H);
      expect(inside(b, { xMin: -maxX, xMax: maxX, yMin: -1, yMax: 1 }), `tile ${t}`).toBe(true);
    }
  });
});

describe('close-up chase lap (all hotels)', () => {
  function lap(dir: 1 | -1) {
    const cam = makeCam(0.6);
    const hopTime = 0.14 / 0.6;
    const dt = 1 / 60;
    cam.shot(cam.homePose(0), CLOSEUP.shotSmooth, true);
    let minY = Infinity;
    let inBox = 0;
    let maxStep = 0;
    let hidden = 0;
    let prevYaw = cam.viewYaw;
    const boxes = worstBoxes();
    for (let t = 0; t <= 40 * hopTime + 1; t += dt) {
      const s = dir * Math.min(40, t / hopTime);
      const [x, z] = ringPoint(s);
      const tok = new THREE.Vector3(x, BOARD_TOP, z);
      cam.chase({ s, dir, token: tok });
      cam.update(dt);
      const pos = cam.camera.position;
      minY = Math.min(minY, pos.y);
      if (boxes.some((b) => b.containsPoint(pos))) inBox++;
      maxStep = Math.max(maxStep, Math.abs(cam.viewYaw - prevYaw));
      prevYaw = cam.viewYaw;
      if (occludedFraction(pos, tok, TOKEN_H, boxes) > 0.5) hidden++;
    }
    return { minY, inBox, maxStepDeg: (maxStep * 180) / Math.PI, hidden };
  }

  for (const dir of [1, -1] as const) {
    it(`${dir > 0 ? 'forwards' : 'backwards'}: above the minimum height, never inside a box, smooth corners, token never hidden`, () => {
      const r = lap(dir);
      expect(r.minY).toBeGreaterThanOrEqual(BOARD_TOP + CLOSEUP.minHeight - 1e-9);
      expect(r.inBox).toBe(0);
      expect(r.maxStepDeg).toBeLessThanOrEqual(3);
      expect(r.hidden).toBe(0);
    });
  }
});

describe('close-up yaw follows the direction of travel', () => {
  it('the camera looks along the travel direction (forwards and backwards) on every side', () => {
    const cam = makeCam();
    for (const t of [3, 15, 25, 35]) {
      for (const dir of [1, -1] as const) {
        const p = cam.chasePose({ s: t, dir }, 0);
        const [ax, az] = ringPoint(t);
        const [bx, bz] = ringPoint(t + dir);
        const travel = new THREE.Vector2(bx - ax, bz - az).normalize();
        // Camera looks opposite its offset direction (sin yaw, cos yaw).
        const look = new THREE.Vector2(-Math.sin(p.yaw), -Math.cos(p.yaw));
        expect(look.dot(travel), `tile ${t} dir ${dir}`).toBeGreaterThan(0.3);
      }
    }
  });
});

describe('close-up Instant and skip', () => {
  it('Instant speed snaps each shot', () => {
    const cam = makeCam(Infinity);
    cam.shot(cam.homePose(5));
    const goal = cam.homePose(23);
    cam.shot(goal);
    expect(cam.progress()).toBe(1);
    const c = cam.currentPose;
    for (const k of ['fx', 'fz', 'pitch', 'distance', 'fov'] as const) expect(c[k]).toBe(goal[k]);
  });

  it('settle() (skip) lands exactly on the goal', () => {
    const cam = makeCam(0.6);
    cam.shot(cam.homePose(5), CLOSEUP.shotSmooth, true);
    cam.toSide(2);
    cam.shot(cam.homePose(23));
    cam.update(1 / 60);
    expect(cam.progress()).toBeLessThan(1);
    cam.settle();
    const c = cam.currentPose;
    const g = cam.goalPose;
    for (const k of ['fx', 'fz', 'yaw', 'pitch', 'distance', 'fov'] as const) expect(c[k]).toBe(g[k]);
    expect(cam.rotating).toBe(false);
    expect(cam.sideYaw).toBeCloseTo(Math.PI, 9);
  });

  it('the turn handoff arrives in ≈1.4 s at factor 1 and scales with speed', () => {
    for (const speed of [1, 0.6]) {
      const cam = makeCam(speed);
      cam.shot(cam.homePose(5), CLOSEUP.shotSmooth, true);
      cam.shot(cam.homePose(23), CLOSEUP.handoffSmooth);
      let t = 0;
      while (cam.progress() < 0.99 && t < 10) {
        cam.update(1 / 60);
        t += 1 / 60;
      }
      expect(t * speed).toBeGreaterThan(1.1);
      expect(t * speed).toBeLessThan(1.7);
    }
  });
});

describe('close-up settings', () => {
  it('reduce motion overrides close-up: fixed overhead, no shots, peek or orbit', () => {
    const cam = makeCam();
    cam.settings.reduceMotion = true;
    cam.apply();
    const pos = cam.camera.position.clone();
    cam.toSide(2);
    cam.setPeek(true);
    cam.setNudge(1, 1);
    cam.pushIn(new THREE.Vector3(0.3, 0, 0.3));
    for (let i = 0; i < 120; i++) cam.update(1 / 60);
    expect(cam.camera.position.distanceTo(pos)).toBeLessThan(1e-6);
    const dir = new THREE.Vector3();
    cam.camera.getWorldDirection(dir);
    expect(dir.y).toBeLessThan(-0.99);
  });

  it('push-in does nothing to the camera in close-up', () => {
    const cam = makeCam();
    cam.shot(cam.homePose(12), CLOSEUP.shotSmooth, true);
    const pos = cam.camera.position.clone();
    cam.pushIn(new THREE.Vector3(0.3, 0, 0.3));
    for (let i = 0; i < 60; i++) cam.update(1 / 60);
    expect(cam.camera.position.distanceTo(pos)).toBeLessThan(1e-9);
  });

  it('the light rig follows the side yaw only (not the shot offset or orbit)', () => {
    const cam = makeCam();
    cam.toSide(1, true);
    cam.shot(cam.homePose(15), CLOSEUP.shotSmooth, true);
    cam.setNudge(1, 0);
    for (let i = 0; i < 120; i++) cam.update(1 / 60);
    expect(cam.lightRig.rotation.y).toBeCloseTo(-Math.PI / 2, 9);
    expect(Math.abs(cam.viewYaw - cam.lightRig.rotation.y)).toBeGreaterThan(0.3);
  });
});

describe('close-up peek', () => {
  it('hold → Table rest view on the current side; release → back to the shot', () => {
    const cam = makeCam(0.6);
    const side: Side = 1;
    cam.toSide(side, true);
    cam.shot(cam.homePose(15), CLOSEUP.shotSmooth, true);
    const shotPos = cam.camera.position.clone();
    const rest = cam.restPose(cam.sideYaw, 1);
    const restPos = focusOf(rest).add(new THREE.Vector3(0, Math.sin(rest.pitch), Math.cos(rest.pitch)).applyAxisAngle(new THREE.Vector3(0, 1, 0), rest.yaw).multiplyScalar(rest.distance));
    cam.setPeek(true);
    for (let i = 0; i < 240; i++) cam.update(1 / 60);
    expect(cam.camera.position.distanceTo(restPos)).toBeLessThan(1e-3);
    cam.setPeek(false);
    for (let i = 0; i < 240; i++) cam.update(1 / 60);
    expect(cam.camera.position.distanceTo(shotPos)).toBeLessThan(1e-3);
  });
});

describe('close-up dice gate', () => {
  it('progress passes the gate before the camera fully settles', () => {
    const cam = makeCam(0.6);
    cam.shot(cam.homePose(7), CLOSEUP.shotSmooth, true);
    cam.shot(cam.dicePose(0));
    let gateT = -1;
    let t = 0;
    while (cam.update(1 / 60) && t < 10) {
      t += 1 / 60;
      if (gateT < 0 && cam.progress() >= CLOSEUP.diceGate) gateT = t;
    }
    expect(gateT).toBeGreaterThan(0);
    expect(gateT).toBeLessThan(t * 0.7);
  });
});
