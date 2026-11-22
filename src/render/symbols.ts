// Approved symbol set (SPEC §0, handoff assets/symbols). Loaded straight from the handoff folder.
// SVG images drawn into a canvas cannot use web fonts, so <text> elements are stripped out of
// each symbol and re-drawn with Canvas text in the self-hosted fonts (SPEC §10.2).

const RAW = import.meta.glob('../../couch-monopoly-handoff/assets/symbols/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const URLS = import.meta.glob('../../couch-monopoly-handoff/assets/symbols/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export type SymbolName =
  | 'chance'
  | 'community-chest'
  | 'free-parking'
  | 'go-arrow'
  | 'go-to-jail'
  | 'income-tax'
  | 'jail'
  | 'luxury-tax'
  | 'railroad'
  | 'utility-power'
  | 'utility-water'
  | 'button-cross'
  | 'button-circle'
  | 'button-square'
  | 'button-triangle'
  | 'button-options'
  | 'button-switch-a'
  | 'button-switch-b'
  | 'button-dpad'
  | 'button-dpad-lr'
  | 'button-dpad-ud'
  | 'ui-menu'
  | 'ui-log'
  | 'ui-manage'
  | 'ui-trade'
  | 'ui-auction'
  | 'ui-loan';

function keyFor(name: string): string {
  const k = Object.keys(RAW).find((p) => p.endsWith(`/${name}.svg`));
  if (!k) throw new Error(`Missing symbol ${name}`);
  return k;
}

export function symbolUrl(name: SymbolName): string {
  return URLS[keyFor(name)];
}

export function symbolSvg(name: SymbolName): string {
  return RAW[keyFor(name)];
}

export interface SymbolText {
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
  family: string;
  weight: string;
  size: number;
  fill: string;
}

export interface CanvasSymbol {
  image: HTMLImageElement;
  /** viewBox size of the source symbol. */
  viewBox: [number, number, number, number];
  texts: SymbolText[];
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** Load a symbol as an image sized for `pixelSize`, with its text pulled out. */
export async function loadCanvasSymbol(name: SymbolName, pixelSize: number): Promise<CanvasSymbol> {
  let svg = symbolSvg(name);
  const texts: SymbolText[] = [];
  svg = svg.replace(/<text([^>]*)>([^<]*)<\/text>/g, (_m, attrs: string, body: string) => {
    const tag = ` ${attrs}`;
    texts.push({
      x: Number(attr(tag, 'x') ?? 0),
      y: Number(attr(tag, 'y') ?? 0),
      text: body,
      anchor: (attr(tag, 'text-anchor') as SymbolText['anchor']) ?? 'start',
      family: (attr(tag, 'font-family') ?? 'Fraunces').split(',')[0].trim(),
      weight: attr(tag, 'font-weight') ?? '400',
      size: Number(attr(tag, 'font-size') ?? 16),
      fill: attr(tag, 'fill') ?? '#000',
    });
    return '';
  });
  const vb = (attr(svg, 'viewBox') ?? '0 0 64 64').split(/\s+/).map(Number) as [number, number, number, number];
  const px = Math.max(8, Math.round(pixelSize));
  svg = svg
    .replace(/\swidth="[^"]*"/, ` width="${px}"`)
    .replace(/\sheight="[^"]*"/, ` height="${px}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  return { image, viewBox: vb, texts };
}

/** Draw a loaded symbol into a box at (x, y) of size `size` in the current canvas space. */
export function drawCanvasSymbol(
  ctx: CanvasRenderingContext2D,
  sym: CanvasSymbol,
  x: number,
  y: number,
  size: number,
): void {
  ctx.drawImage(sym.image, x, y, size, size);
  if (!sym.texts.length) return;
  const k = size / sym.viewBox[2];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  for (const t of sym.texts) {
    ctx.font = `${t.weight} ${t.size}px ${quoteFamily(t.family)}`;
    ctx.letterSpacing = '0px';
    ctx.fillStyle = t.fill;
    ctx.textAlign = t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

export function quoteFamily(f: string): string {
  return f.includes(' ') ? `'${f}'` : f;
}
