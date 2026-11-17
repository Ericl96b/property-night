// Token placement and movement (SPEC §10.4): tokens stand in the tile body, fan out in a small
// arc when sharing a tile, always face the camera's yaw, and hop tile to tile
// (arc ≈ 0.02 high, 140 ms per tile at Normal speed) with a small settle bounce.
import * as THREE from 'three';
import { BOARD_TOP, tokenSpots } from './layout';
import { type TokenId, type TokenObject, buildToken } from './tokens/tokens';
import type { Animation } from '../director/queue';

const HOP_TIME = 0.14;
const HOP_HEIGHT = 0.02;
const SETTLE_TIME = 0.14;

export interface PlacedToken {
  token: TokenObject;
  tile: number;
}

export class TokenLayer {
  readonly group = new THREE.Group();
  readonly tokens = new Map<TokenId, PlacedToken>();
  /** Tokens currently mid-hop (excluded from fan-out). */
  private moving = new Set<TokenId>();

  constructor() {
    this.group.name = 'tokens';
  }

  add(id: TokenId, color: string, tile: number): void {
    const token = buildToken(id, color);
    this.group.add(token.group);
    this.tokens.set(id, { token, tile });
    this.layoutTile(tile);
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

  position(id: TokenId): THREE.Vector3 {
    return this.tokens.get(id)!.token.group.position.clone();
  }

  /**
   * Hop `steps` tiles forward. Returns an Animation for the queue. `onStep` is called on every
   * landing (tap sound hook); `follow` receives the token and destination positions each frame.
   */
  hop(
    id: TokenId,
    steps: number,
    speed: () => number,
    follow?: (token: THREE.Vector3 | null, destination?: THREE.Vector3) => void,
    onStep?: () => void,
  ): Animation {
    const placed = this.tokens.get(id)!;
    const g = placed.token.group;
    const from = placed.tile;
    const to = (from + steps) % 40;
    const finish = () => {
      this.moving.delete(id);
      placed.tile = to;
      this.layoutTile(from);
      this.layoutTile(to);
      follow?.(null);
    };
    return {
      label: `hop ${id} ${steps}`,
      finish,
      start: () => {
        if (steps <= 0) return;
        this.moving.add(id);
        this.layoutTile(from);
        // Path: centers of intermediate tiles, then this token's fan spot on the destination.
        const pts: THREE.Vector3[] = [g.position.clone()];
        for (let k = 1; k < steps; k++) {
          const [x, z] = tokenSpots((from + k) % 40, 1)[0];
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
              g.scale.set(1, 1, 1);
              finish();
              return false;
            }
            return true;
          }
          t += (dt * s) / HOP_TIME;
          while (t >= 1 && seg < pts.length - 1) {
            t -= 1;
            seg++;
            onStep?.();
            if (seg === pts.length - 1) break;
          }
          if (seg >= pts.length - 1) {
            g.position.copy(dest);
            settle = 0;
            return true;
          }
          const a = pts[seg];
          const b = pts[seg + 1];
          g.position.lerpVectors(a, b, t);
          g.position.y = BOARD_TOP + HOP_HEIGHT * 4 * t * (1 - t);
          follow?.(g.position, dest);
          return true;
        };
      },
    };
  }
}
