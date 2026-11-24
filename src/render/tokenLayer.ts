// Token placement and movement (SPEC §10.4): tokens stand in the tile body, fan out in a small
// arc when sharing a tile, always face the camera's yaw, and hop tile to tile
// (arc ≈ 0.02 high, 140 ms per tile at Normal speed) with a small settle bounce.
// Tile 40 (IN_JAIL) is the spot inside the jail square.
import * as THREE from 'three';
import { BOARD_TOP, tokenSpots } from './layout';
import { type TokenId, type TokenObject, buildToken } from './tokens/tokens';
import type { Animation } from '../director/queue';

const HOP_TIME = 0.14;
const HOP_HEIGHT = 0.02;
const SETTLE_TIME = 0.14;
const GLIDE_TIME = 0.5;

export interface PlacedToken {
  token: TokenObject;
  tile: number;
}

/**
 * Camera follow callback. `hops` (travel only) is how far along the path the token is, in tiles
 * (0 at the start, path.length on arrival); the close-up chase camera uses it.
 */
export type FollowFn = (token: THREE.Vector3 | null, destination?: THREE.Vector3, hops?: number) => void;
/** Called on each hop: its index on the path, and whether it is the landing tile. */
export type StepFn = (index: number, last: boolean) => void;

export class TokenLayer {
  readonly group = new THREE.Group();
  readonly tokens = new Map<TokenId, PlacedToken>();
  /** Tokens currently moving (excluded from fan-out). */
  private moving = new Set<TokenId>();

  constructor() {
    this.group.name = 'tokens';
  }

  add(id: TokenId, color: string, tile: number): void {
    if (this.tokens.has(id)) this.remove(id);
    const token = buildToken(id, color);
    this.group.add(token.group);
    this.tokens.set(id, { token, tile });
    this.layoutTile(tile);
  }

  remove(id: TokenId): void {
    const p = this.tokens.get(id);
    if (!p) return;
    this.group.remove(p.token.group);
    this.tokens.delete(id);
    this.layoutTile(p.tile);
  }

  clear(): void {
    for (const id of [...this.tokens.keys()]) this.remove(id);
  }

  /** Face every token toward the camera's yaw (medallions read clearly). */
  faceYaw(yaw: number): void {
    for (const { token } of this.tokens.values()) token.group.rotation.y = yaw;
  }

  private onTile(tile: number): TokenId[] {
    return [...this.tokens.entries()].filter(([id, p]) => p.tile === tile && !this.moving.has(id)).map(([id]) => id);
  }

  /** Spot a token would occupy on `tile` if it joined the tokens already there. */
  private spotFor(tile: number, id: TokenId): THREE.Vector3 {
    const ids = this.onTile(tile).filter((t) => t !== id);
    ids.push(id);
    const spots = tokenSpots(tile, ids.length);
    const [x, z] = spots[ids.length - 1];
    return new THREE.Vector3(x, BOARD_TOP, z);
  }

  layoutTile(tile: number): void {
    const ids = this.onTile(tile);
    const spots = tokenSpots(tile, ids.length);
    ids.forEach((id, i) => {
      const g = this.tokens.get(id)!.token.group;
      g.position.set(spots[i][0], BOARD_TOP, spots[i][1]);
      g.scale.set(1, 1, 1);
    });
  }

  tileOf(id: TokenId): number | undefined {
    return this.tokens.get(id)?.tile;
  }

  position(id: TokenId): THREE.Vector3 {
    return this.tokens.get(id)!.token.group.position.clone();
  }

  /** Put a token on a tile instantly (load, skip, sync). */
  place(id: TokenId, tile: number): void {
    const p = this.tokens.get(id);
    if (!p || (p.tile === tile && !this.moving.has(id))) return;
    const from = p.tile;
    this.moving.delete(id);
    p.tile = tile;
    this.layoutTile(from);
    this.layoutTile(tile);
  }

  /** Hop `steps` tiles forward (legacy helper used by review tools). */
  hop(id: TokenId, steps: number, speed: () => number, follow?: FollowFn, onStep?: StepFn): Animation {
    const from = this.tokens.get(id)!.tile;
    const path = Array.from({ length: steps }, (_, k) => (from + k + 1) % 40);
    return this.travel(id, path, speed, follow, onStep);
  }

  /**
   * Hop along `path` (tile indices visited in order; the last is the destination). Works
   * forwards and backwards. Returns an Animation for the queue.
   */
  travel(id: TokenId, path: number[], speed: () => number, follow?: FollowFn, onStep?: StepFn): Animation {
    const placed = this.tokens.get(id)!;
    const g = placed.token.group;
    const to = path.length ? path[path.length - 1] : placed.tile;
    let from = placed.tile;
    const finish = () => {
      this.moving.delete(id);
      placed.tile = to;
      this.layoutTile(from);
      this.layoutTile(to);
      follow?.(null);
    };
    return {
      label: `travel ${id}`,
      finish,
      start: () => {
        from = placed.tile;
        if (!path.length) return;
        this.moving.add(id);
        this.layoutTile(from);
        const pts: THREE.Vector3[] = [g.position.clone()];
        for (let k = 0; k < path.length - 1; k++) {
          const [x, z] = tokenSpots(path[k], 1)[0];
          pts.push(new THREE.Vector3(x, BOARD_TOP, z));
        }
        const dest = this.spotFor(to, id);
        pts.push(dest);
        let seg = 0;
        let t = 0;
        let settle = -1;
        return (dt) => {
          const s = speed();
          if (settle >= 0) {
            settle += (dt * s) / SETTLE_TIME;
            const k = Math.min(1, settle);
            const squash = 1 - 0.07 * Math.sin(k * Math.PI);
            g.scale.set(1 + (1 - squash) * 0.5, squash, 1 + (1 - squash) * 0.5);
            if (k >= 1) {
              finish();
              return false;
            }
            return true;
          }
          t += (dt * s) / HOP_TIME;
          while (t >= 1 && seg < pts.length - 1) {
            t -= 1;
            seg++;
            onStep?.(seg - 1, seg === pts.length - 1);
            if (seg === pts.length - 1) break;
          }
          if (seg >= pts.length - 1) {
            g.position.copy(dest);
            settle = 0;
            return true;
          }
          g.position.lerpVectors(pts[seg], pts[seg + 1], t);
          g.position.y = BOARD_TOP + HOP_HEIGHT * 4 * t * (1 - t);
          follow?.(g.position, dest, seg + t);
          return true;
        };
      },
    };
  }

  /** Lift and glide straight to a tile (Go to Jail, direct moves). */
  glide(id: TokenId, tile: number, speed: () => number, follow?: FollowFn): Animation {
    const placed = this.tokens.get(id)!;
    const g = placed.token.group;
    let from = placed.tile;
    const finish = () => {
      this.moving.delete(id);
      placed.tile = tile;
      this.layoutTile(from);
      this.layoutTile(tile);
      follow?.(null);
    };
    return {
      label: `glide ${id}`,
      finish,
      start: () => {
        from = placed.tile;
        if (from === tile) return;
        this.moving.add(id);
        this.layoutTile(from);
        const a = g.position.clone();
        const b = this.spotFor(tile, id);
        let t = 0;
        return (dt) => {
          t = Math.min(1, t + (dt * speed()) / GLIDE_TIME);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          g.position.lerpVectors(a, b, e);
          g.position.y = BOARD_TOP + 0.05 * Math.sin(Math.PI * t);
          follow?.(g.position, b);
          if (t >= 1) {
            finish();
            return false;
          }
          return true;
        };
      },
    };
  }
}
