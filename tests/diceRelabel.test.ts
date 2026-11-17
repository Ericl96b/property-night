// SPEC §11: displayed faces always equal the engine's values across 10,000 simulated throws.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng, rollDie, seedRng } from '../src/engine/rng';
import {
  ARENA_HALF,
  DIE_SIZE,
  FACE_AXES,
  FACE_VALUES,
  placeFlat,
  relabelRotation,
  shownValue,
  simulateThrow,
  topFace,
} from '../src/render/diceSim';

const FLOOR = 0.012;
const SIDES = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

function finalQuat(frames: Float32Array, steps: number): THREE.Quaternion {
  const i = (steps - 1) * 7;
  return new THREE.Quaternion(frames[i + 3], frames[i + 4], frames[i + 5], frames[i + 6]).normalize();
}

describe('dice face layout', () => {
  it('opposite faces sum to 7', () => {
    for (let i = 0; i < 6; i += 2) expect(FACE_VALUES[i] + FACE_VALUES[i + 1]).toBe(7);
  });

  it('relabel rotations are cube rotations that put the value on the top axis', () => {
    for (let axis = 0; axis < 6; axis++) {
      for (let v = 1; v <= 6; v++) {
        const r = relabelRotation(axis, v);
        const moved = FACE_AXES[FACE_VALUES.indexOf(v)].clone().applyQuaternion(r);
        expect(moved.distanceTo(FACE_AXES[axis])).toBeLessThan(1e-6);
        for (const a of FACE_AXES) {
          const m = a.clone().applyQuaternion(r);
          expect(FACE_AXES.some((b) => b.distanceTo(m) < 1e-6)).toBe(true);
        }
      }
    }
  });
});

describe('dice throw pipeline', () => {
  it('shows the engine values on 10,000 simulated throws; dice rest flat inside the arena', () => {
    const engine = seedRng(2026);
    const cosmetic = new Rng(99);
    let rethrows = 0;
    let flat = 0;
    let maxSteps = 0;
    for (let n = 0; n < 10_000; n++) {
      const values: [number, number] = [rollDie(engine), rollDie(engine)];
      const th = simulateThrow(values, cosmetic, { sideYaw: SIDES[n % 4], floorY: FLOOR });
      rethrows += th.attempts - 1;
      maxSteps = Math.max(maxSteps, th.steps);
      if (th.placedFlat) flat++;
      for (let d = 0; d < 2; d++) {
        const q = finalQuat(th.frames[d], th.steps);
        expect(shownValue(q, th.relabel[d])).toBe(values[d]);
        // The face on the bottom shows 7 − value.
        const world = q.clone().multiply(th.relabel[d]);
        const down = FACE_AXES.findIndex((a) => a.clone().applyQuaternion(world).y < -0.9);
        expect(FACE_VALUES[down]).toBe(7 - values[d]);
        // Resting flat (≤ 10° off vertical).
        expect(topFace(q).cos).toBeGreaterThanOrEqual(Math.cos((10 * Math.PI) / 180) - 1e-6);
        // Never covers tiles: the die stays inside the center arena (tiles start at ±0.368).
        const i = (th.steps - 1) * 7;
        const reach = ARENA_HALF + DIE_SIZE * 0.25;
        expect(Math.abs(th.frames[d][i])).toBeLessThanOrEqual(reach);
        expect(Math.abs(th.frames[d][i + 2])).toBeLessThanOrEqual(reach);
      }
    }
    // Re-throws are invisible to the player but should be rare.
    console.info(`10,000 throws: ${rethrows} re-throws, ${flat} placed flat, longest ${maxSteps} steps`);
    expect(rethrows).toBeLessThan(500);
    expect(flat).toBeLessThan(10);
  }, 600_000);

  it('instant speed places the dice flat showing the values', () => {
    const cosmetic = new Rng(5);
    for (let v1 = 1; v1 <= 6; v1++) {
      for (let v2 = 1; v2 <= 6; v2++) {
        const th = placeFlat([v1, v2], cosmetic, { sideYaw: SIDES[v1 % 4], floorY: FLOOR });
        expect(shownValue(finalQuat(th.frames[0], 1), th.relabel[0])).toBe(v1);
        expect(shownValue(finalQuat(th.frames[1], 1), th.relabel[1])).toBe(v2);
      }
    }
  });
});
