// Chance and Community Chest card stacks lying on the printed deck outlines (owner request,
// 2026-11-18). Purely visual: cards are not removed; the drawn-card overlay still flips in from
// the deck's screen position. Each stack is a layered card-stock body plus the top card's back.
import * as THREE from 'three';
import { BOARD_TOP, DECK_STACK, deckFrames } from './layout';
import { makeCanvas } from './noise';
import { drawCanvasSymbol, loadCanvasSymbol, quoteFamily } from './symbols';

const PAPER_HI = '#FBF6EA';
const COLORS = { chance: '#8E2F23', chest: '#2F5D46' } as const;
const LABEL = { chance: 'Chance', chest: 'Community Chest' } as const;

/** Layered card edges: cream with faint darker lines (one per card). */
function edgeTexture(): THREE.CanvasTexture {
  const c = makeCanvas(64, 128);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#F1E6CC';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = 'rgba(120, 96, 64, 0.35)';
  for (let y = 0; y < 128; y += 8) ctx.fillRect(0, y, 64, 1.5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The top card's back, in the cards.html style: double border, corner diamonds, symbol, name. */
async function backTexture(deck: 'chance' | 'chest', maxAnisotropy: number): Promise<THREE.CanvasTexture> {
  const W = 1024;
  const H = Math.round((W * DECK_STACK.d) / DECK_STACK.w);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const col = COLORS[deck];
  const k = W / 440; // reference card is 440 × 250
  ctx.fillStyle = PAPER_HI;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 9 * k);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.roundRect(9 * k, 9 * k, W - 18 * k, H - 18 * k, 4 * k);
  ctx.stroke();
  ctx.lineWidth = 0.8 * k;
  ctx.beginPath();
  ctx.roundRect(14.5 * k, 14.5 * k, W - 29 * k, H - 29 * k, 2 * k);
  ctx.stroke();
  ctx.fillStyle = col;
  for (const [x, y] of [
    [17, 17],
    [W / k - 17, 17],
    [17, H / k - 17],
    [W / k - 17, H / k - 17],
  ]) {
    ctx.save();
    ctx.translate(x * k, y * k);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4 * k, -4 * k, 8 * k, 8 * k);
    ctx.restore();
  }
  const iconSize = (deck === 'chance' ? 96 : 84) * k;
  const sym = await loadCanvasSymbol(deck === 'chance' ? 'chance' : 'community-chest', iconSize);
  ctx.font = `800 ${26 * k}px ${quoteFamily('Fraunces')}`;
  ctx.letterSpacing = `${2.5 * k}px`;
  const words = LABEL[deck].toUpperCase().split(' ');
  const textW = Math.max(...words.map((w) => ctx.measureText(w).width));
  const gap = 22 * k;
  const left = (W - (iconSize + gap + textW)) / 2;
  drawCanvasSymbol(ctx, sym, left, (H - iconSize) / 2, iconSize);
  ctx.fillStyle = col;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lh = 30 * k;
  words.forEach((w, i) => ctx.fillText(w, left + iconSize + gap, H / 2 + (i - (words.length - 1) / 2) * lh));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAnisotropy;
  return t;
}

export async function createDecks(maxAnisotropy: number): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'card-decks';
  const bodyMat = new THREE.MeshStandardMaterial({ map: edgeTexture(), roughness: 0.75 });
  const bodyGeo = new THREE.BoxGeometry(DECK_STACK.w, DECK_STACK.h, DECK_STACK.d);
  bodyGeo.translate(0, DECK_STACK.h / 2, 0);
  for (const f of deckFrames()) {
    const stack = new THREE.Group();
    stack.position.set(f.x, BOARD_TOP, f.z);
    stack.rotation.y = f.yaw;
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    const topMat = new THREE.MeshStandardMaterial({ map: await backTexture(f.deck, maxAnisotropy), roughness: 0.6 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(DECK_STACK.w, DECK_STACK.d), topMat);
    top.rotation.x = -Math.PI / 2;
    // The top card sits a hair proud and slightly askew, like a real stack.
    top.rotation.z = 0.025;
    top.position.y = DECK_STACK.h + 0.0004;
    top.receiveShadow = true;
    stack.add(body, top);
    group.add(stack);
  }
  return group;
}
