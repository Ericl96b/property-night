// Board face texture (SPEC §10.2): drawn at runtime from board data with the Canvas 2D API,
// reproducing reference/board-face.html. All drawing happens in the reference's 1000 px space
// and is scaled to the output size. No paper grain: the face is clean print.
import * as THREE from 'three';
import type { BoardData, Tile } from '../data/classicBoard';
import { BAND_PX, BOARD_PX, CORNER_PX, TILE_H_PX, TILE_W_PX, tileFrame } from './layout';
import { type CanvasSymbol, type SymbolName, drawCanvasSymbol, loadCanvasSymbol, quoteFamily } from './symbols';
import { makeCanvas } from './noise';

export const INK = '#2B2119';
export const INK_2 = '#5E4C3B';
export const PAPER = '#F3EAD6';
export const PAPER_HI = '#FBF6EA';
export const OXBLOOD = '#8E2F23';
export const FOREST = '#2F5D46';
const LIGHT_BAND_TEXT = '#FFF8EC';
const JAIL_ORANGE = '#E3A445';
const CENTER_TINT = 'rgba(214,226,204,.55)';

const FRAUNCES = 'Fraunces';
const SANS = 'Source Sans 3';

interface TextStyle {
  family: string;
  weight: number;
  size: number;
  lineHeight: number; // multiplier
  letterSpacing: number; // px
  color: string;
  upper?: boolean;
}

function setFont(ctx: CanvasRenderingContext2D, s: TextStyle): void {
  // Canvas text is shaped at the nominal size (the context transform scales it), so the
  // variable font's automatic optical sizing tracks the print size, like the reference.
  ctx.font = `${s.weight} ${s.size}px ${quoteFamily(s.family)}`;
  ctx.letterSpacing = `${s.letterSpacing}px`;
  ctx.fillStyle = s.color;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

interface Block {
  lines: string[];
  height: number;
  style: TextStyle;
}

function layoutText(ctx: CanvasRenderingContext2D, raw: string, s: TextStyle, maxWidth = Infinity): Block {
  setFont(ctx, s);
  const text = s.upper ? raw.toUpperCase() : raw;
  const lines = maxWidth === Infinity ? [text] : wrap(ctx, text, maxWidth);
  return { lines, height: lines.length * s.size * s.lineHeight, style: s };
}

/** Draw a text block, lines centered on `cx`, starting at line-box top `top` (CSS line boxes). */
function drawBlock(ctx: CanvasRenderingContext2D, b: Block, cx: number, top: number, align: 'center' | 'left' = 'center'): void {
  setFont(ctx, b.style);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const lh = b.style.size * b.style.lineHeight;
  b.lines.forEach((line, i) => {
    const m = ctx.measureText(line);
    const asc = m.fontBoundingBoxAscent;
    const desc = m.fontBoundingBoxDescent;
    const baseline = top + i * lh + (lh - (asc + desc)) / 2 + asc;
    // CSS centers text including trailing letter-spacing; canvas measures it the same way.
    const x = align === 'center' ? cx + b.style.letterSpacing / 2 : cx;
    ctx.fillText(line, x, baseline);
  });
}

function insetStroke(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, width: number, color = INK): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
}

// ---- styles from the reference -------------------------------------------------------

const NAME: TextStyle = { family: FRAUNCES, weight: 700, size: 10.6, lineHeight: 1.1, letterSpacing: 0.45, color: INK, upper: true };
const PRICE: TextStyle = { family: FRAUNCES, weight: 600, size: 12.5, lineHeight: 1.2, letterSpacing: 0, color: INK };
const CORNER_WORD = (size: number): TextStyle => ({ family: FRAUNCES, weight: 900, size, lineHeight: 0.95, letterSpacing: 0, color: INK, upper: true });
const SMALL_CAPS: TextStyle = { family: SANS, weight: 700, size: 9, lineHeight: 1.25, letterSpacing: 1.2, color: INK, upper: true };
const STRIP_WORD: TextStyle = { family: SANS, weight: 700, size: 11, lineHeight: 1.25, letterSpacing: 3, color: INK, upper: true };

interface Symbols {
  [k: string]: CanvasSymbol;
}

const ICON: Record<string, { name: SymbolName; size: number; top: number }> = {
  chest: { name: 'community-chest', size: 44, top: 54 },
  income: { name: 'income-tax', size: 40, top: 54 },
  luxury: { name: 'luxury-tax', size: 40, top: 54 },
  railroad: { name: 'railroad', size: 44, top: 54 },
  power: { name: 'utility-power', size: 42, top: 54 },
  water: { name: 'utility-water', size: 42, top: 54 },
  chance: { name: 'chance', size: 56, top: 44 },
};

function iconKey(t: Tile): string | undefined {
  switch (t.type) {
    case 'chest':
      return 'chest';
    case 'chance':
      return 'chance';
    case 'railroad':
      return 'railroad';
    case 'utility':
      return t.utility;
    case 'tax':
      return t.tax;
    default:
      return undefined;
  }
}

// ---- tiles -----------------------------------------------------------------------------

function drawTile(ctx: CanvasRenderingContext2D, board: BoardData, t: Tile, syms: Symbols): void {
  const f = tileFrame(t.index);
  const w = TILE_W_PX;
  const h = TILE_H_PX;
  ctx.save();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(f.angle);
  ctx.translate(-w / 2, -h / 2);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  if (t.type === 'street' && t.group) {
    const g = board.groups[t.group];
    ctx.fillStyle = g.color;
    ctx.fillRect(0, 0, w, BAND_PX);
    // Band bottom rule (inset 0 -1px) and band outline.
    ctx.fillStyle = INK;
    ctx.fillRect(0, BAND_PX - 1, w, 1);
    insetStroke(ctx, 0, 0, w, BAND_PX, 0.6);
    const b = layoutText(ctx, t.name, { ...NAME, color: g.lightText ? LIGHT_BAND_TEXT : INK }, w - 8);
    drawBlock(ctx, b, w / 2, (BAND_PX - b.height) / 2);
  } else {
    const b = layoutText(ctx, t.name, NAME, w - 8);
    drawBlock(ctx, b, w / 2, 9);
    const key = iconKey(t);
    if (key) {
      const ic = ICON[key];
      drawCanvasSymbol(ctx, syms[key], (w - ic.size) / 2, ic.top, ic.size);
    }
  }

  // Price / amount line at the outer edge.
  let price: string | undefined;
  if (t.type === 'tax') price = `Pay $${t.taxAmount}`;
  else if (t.price !== undefined) price = `$${t.price}`;
  if (price) {
    setFont(ctx, PRICE);
    const m = ctx.measureText(price);
    const desc = m.fontBoundingBoxDescent;
    const asc = m.fontBoundingBoxAscent;
    const boxBottom = h - 8;
    const baseline = boxBottom - desc - (PRICE.size * PRICE.lineHeight - (asc + desc)) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(price, w / 2, baseline);
  }

  ctx.restore();
  ctx.save();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(f.angle);
  insetStroke(ctx, -w / 2, -h / 2, w, h, 0.6);
  ctx.restore();
}

/** Stack items vertically (flex column, centered), each item drawn with its top-center. */
interface StackItem {
  height: number;
  draw: (cx: number, top: number) => void;
}

function drawStack(items: StackItem[], gap: number, cx: number, cy: number, extraShiftY = 0): number {
  const total = items.reduce((s, i) => s + i.height, 0) + gap * (items.length - 1);
  let top = cy - total / 2 + extraShiftY * total;
  for (const it of items) {
    it.draw(cx, top);
    top += it.height + gap;
  }
  return total;
}

function textItem(ctx: CanvasRenderingContext2D, text: string, s: TextStyle, maxWidth = Infinity): StackItem {
  const b = layoutText(ctx, text, s, maxWidth);
  return { height: b.height, draw: (cx, top) => drawBlock(ctx, b, cx, top) };
}

function iconItem(ctx: CanvasRenderingContext2D, sym: CanvasSymbol, size: number): StackItem {
  return { height: size, draw: (cx, top) => drawCanvasSymbol(ctx, sym, cx - size / 2, top, size) };
}

function drawCorners(ctx: CanvasRenderingContext2D, board: BoardData, syms: Symbols): void {
  const c = CORNER_PX;
  const far = BOARD_PX - c;
  const deg = Math.PI / 180;

  // GO (bottom right).
  ctx.save();
  ctx.translate(far, far);
  {
    const items = [
      textItem(ctx, `Collect $${board.goSalary} salary as you pass`, SMALL_CAPS, 120),
      textItem(ctx, 'GO', { ...CORNER_WORD(58), color: OXBLOOD, letterSpacing: 2 }),
    ];
    const total = items.reduce((s, i) => s + i.height, 0) + 6;
    ctx.save();
    ctx.translate(c / 2, c / 2 - 0.12 * total);
    ctx.rotate(-45 * deg);
    drawStack(items, 6, 0, 0);
    ctx.restore();
    // Direction arrow (go-arrow path from the reference, 112 × 26 at left 10, bottom 9).
    ctx.save();
    ctx.translate(10, c - 9 - 26);
    ctx.fillStyle = OXBLOOD;
    ctx.fill(new Path2D('M110 9H28V1L2 13l26 12v-8h82z'));
    ctx.restore();
  }
  insetStroke(ctx, 0, 0, c, c, 0.6);
  ctx.restore();

  // Jail / Just Visiting (bottom left).
  ctx.save();
  ctx.translate(0, far);
  {
    const sq = 94;
    ctx.fillStyle = JAIL_ORANGE;
    ctx.fillRect(c - sq, 0, sq, sq);
    insetStroke(ctx, c - sq, 0, sq, sq, 1);
    ctx.save();
    ctx.translate(c - sq / 2, sq / 2);
    ctx.rotate(45 * deg);
    drawStack([textItem(ctx, 'In', CORNER_WORD(13)), iconItem(ctx, syms.jail, 40), textItem(ctx, 'Jail', CORNER_WORD(13))], 2, 0, 0);
    ctx.restore();
    const just = layoutText(ctx, 'Just', STRIP_WORD);
    ctx.save();
    ctx.translate(19, sq / 2);
    ctx.rotate(90 * deg);
    drawBlock(ctx, just, 0, -just.height / 2);
    ctx.restore();
    const visiting = layoutText(ctx, 'Visiting', STRIP_WORD);
    drawBlock(ctx, visiting, 38 + (c - 38) / 2, sq + (c - sq - visiting.height) / 2);
  }
  insetStroke(ctx, 0, 0, c, c, 0.6);
  ctx.restore();

  // Free Parking (top left).
  ctx.save();
  {
    ctx.save();
    ctx.translate(c / 2, c / 2);
    ctx.rotate(135 * deg);
    drawStack([textItem(ctx, 'Free', CORNER_WORD(17)), iconItem(ctx, syms.freeParking, 52), textItem(ctx, 'Parking', CORNER_WORD(17))], 6, 0, 0);
    ctx.restore();
  }
  insetStroke(ctx, 0, 0, c, c, 0.6);
  ctx.restore();

  // Go to Jail (top right).
  ctx.save();
  ctx.translate(far, 0);
  {
    ctx.save();
    ctx.translate(c / 2, c / 2);
    ctx.rotate(-135 * deg);
    drawStack([textItem(ctx, 'Go to', CORNER_WORD(17)), iconItem(ctx, syms.goToJail, 48), textItem(ctx, 'Jail', CORNER_WORD(17))], 6, 0, 0);
    ctx.restore();
  }
  insetStroke(ctx, 0, 0, c, c, 0.6);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawDeck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  sym: CanvasSymbol,
  iconSize: number,
  label: string,
): void {
  // Content box 176 × 112 plus a 1.5 px border, rotated −45° about its center.
  const w = 176 + 3;
  const h = 112 + 3;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  roundRect(ctx, -w / 2 + 0.75, -h / 2 + 0.75, w - 1.5, h - 1.5, 6);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  roundRect(ctx, -w / 2 + 6.4, -h / 2 + 6.4, w - 12.8, h - 12.8, 2);
  ctx.stroke();
  const text = layoutText(
    ctx,
    label,
    { family: FRAUNCES, weight: 800, size: 15, lineHeight: 1.1, letterSpacing: 1.2, color, upper: true },
    80,
  );
  const rowW = iconSize + 10 + 80;
  const left = -rowW / 2;
  drawCanvasSymbol(ctx, sym, left, -iconSize / 2, iconSize);
  drawBlock(ctx, text, left + iconSize + 10, -text.height / 2, 'left');
  ctx.restore();
}

function drawRule(ctx: CanvasRenderingContext2D, cx: number, top: number): void {
  const y = top + 3.5;
  ctx.fillStyle = INK;
  ctx.fillRect(cx - 3.5 - 10 - 70, y - 0.5, 70, 1);
  ctx.fillRect(cx + 3.5 + 10, y - 0.5, 70, 1);
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = OXBLOOD;
  ctx.fillRect(-3.5, -3.5, 7, 7);
  ctx.restore();
}

function drawCenter(ctx: CanvasRenderingContext2D, board: BoardData, syms: Symbols): void {
  const c = CORNER_PX;
  const size = BOARD_PX - 2 * c;
  ctx.fillStyle = CENTER_TINT;
  ctx.fillRect(c, c, size, size);
  // 1.4 px outline outside the center square.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(c - 0.7, c - 0.7, size + 1.4, size + 1.4);

  drawDeck(ctx, c + 46, c + 92, OXBLOOD, syms.chance, 46, 'Chance');
  drawDeck(ctx, c + 514, c + 532, FOREST, syms.chestDeck, 40, 'Community Chest');

  const title = layoutText(ctx, board.title, { family: FRAUNCES, weight: 800, size: 64, lineHeight: 1, letterSpacing: -0.5, color: INK });
  const sub = layoutText(ctx, board.subtitle, { family: SANS, weight: 700, size: 12, lineHeight: 1, letterSpacing: 4, color: INK_2, upper: true });
  const rule: StackItem = { height: 7, draw: (cx, top) => drawRule(ctx, cx, top) };
  drawStack(
    [rule, { height: title.height, draw: (cx, top) => drawBlock(ctx, title, cx, top) }, { height: sub.height, draw: (cx, top) => drawBlock(ctx, sub, cx, top) }, rule],
    10,
    BOARD_PX / 2,
    BOARD_PX / 2,
  );
}

// ---- entry points ----------------------------------------------------------------------

let fontsPromise: Promise<unknown> | undefined;
export function loadBoardFonts(): Promise<unknown> {
  fontsPromise ??= Promise.all([
    ...[600, 700, 800, 900].map((w) => document.fonts.load(`${w} 20px Fraunces`)),
    document.fonts.load(`700 12px 'Source Sans 3'`),
    document.fonts.load(`600 12px 'Source Sans 3'`),
    document.fonts.load(`400 12px 'Source Sans 3'`),
  ]).then(() => document.fonts.ready);
  return fontsPromise;
}

/** Draw the full board face into a new canvas of `size` × `size` pixels. */
export async function drawBoardFace(board: BoardData, size: number): Promise<HTMLCanvasElement> {
  await loadBoardFonts();
  const k = size / BOARD_PX;
  const sym = (name: SymbolName, px: number) => loadCanvasSymbol(name, px * k);
  const [chest, chestDeck, chance, income, luxury, railroad, power, water, jail, freeParking, goToJail] = await Promise.all([
    sym('community-chest', 44),
    sym('community-chest', 40),
    sym('chance', 56),
    sym('income-tax', 40),
    sym('luxury-tax', 40),
    sym('railroad', 44),
    sym('utility-power', 42),
    sym('utility-water', 42),
    sym('jail', 40),
    sym('free-parking', 52),
    sym('go-to-jail', 48),
  ]);
  const syms: Symbols = { chest, chestDeck, chance, income, luxury, railroad, power, water, jail, freeParking, goToJail };

  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);

  drawCenter(ctx, board, syms);
  for (const t of board.tiles) if (t.index % 10 !== 0) drawTile(ctx, board, t, syms);
  drawCorners(ctx, board, syms);

  // Outer board rule.
  insetStroke(ctx, 0, 0, BOARD_PX, BOARD_PX, 1.4);
  return canvas;
}

export interface BoardTextureResult {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  ms: number;
}

export async function createBoardTexture(board: BoardData, size: number, maxAnisotropy: number): Promise<BoardTextureResult> {
  const t0 = performance.now();
  const canvas = await drawBoardFace(board, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return { texture, canvas, ms: performance.now() - t0 };
}
