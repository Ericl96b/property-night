// M0 overlay: seat cards on the left, context panel on the right (SPEC §10.8 layout), on a
// fixed 1920 × 1080 logical stage scaled to fit. Plain DOM for the prototype.
import { symbolUrl, type SymbolName } from '../render/symbols';
import type { Speed } from '../director/queue';
import type { QualitySetting } from '../render/quality';

export interface SeatView {
  name: string;
  color: string;
  side: string;
  cash: number;
}

export interface HudHandlers {
  roll(): void;
  build(): void;
  sell(): void;
  rotate(dir: -1 | 1): void;
  nextPlayer(): void;
  fullscreen(): void;
  quality(q: QualitySetting): void;
  speed(s: Speed): void;
  rotation(on: boolean): void;
  follow(on: boolean): void;
  reduceMotion(on: boolean): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

function button(label: string, glyph: SymbolName | string, hint: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = el('button', `btn${primary ? ' primary' : ''}`);
  if (glyph.startsWith('button-')) {
    const img = el('img');
    img.src = symbolUrl(glyph as SymbolName);
    img.alt = '';
    b.append(img);
  } else {
    b.append(el('span', 'chip', glyph));
  }
  b.append(el('span', 'label', label), el('span', 'hint', hint));
  b.addEventListener('click', onClick);
  return b;
}

export class Hud {
  readonly stage = el('div', 'stage');
  private seatsEl = el('div', 'panel seats');
  private rollEl = el('div', 'roll', '&nbsp;');
  private statsEl = el('div', 'stats');
  private logEl = el('div', 'log');
  private busyEl = el('div', 'panel busy', 'Generating textures…');
  private logLines: string[] = [];

  constructor(root: HTMLElement, h: HudHandlers, initial: { quality: QualitySetting; speed: Speed }) {
    root.append(el('div', 'vignette'), this.stage);
    const ctx = el('div', 'panel context');
    ctx.append(el('div', 'eyebrow', 'Milestone 0 · Prototype'), el('h1', 'title', 'Property Night'));

    const actions = el('div', 'actions');
    actions.append(
      button('Roll dice', 'button-cross', 'Space', h.roll, true),
      button('Build on current tile', 'button-square', 'B', h.build),
      button('Sell a building', 'button-triangle', 'V', h.sell),
    );
    const rot = el('div', 'row');
    rot.append(button('Side', 'L1', 'Q', () => h.rotate(-1)), button('Side', 'R1', 'E', () => h.rotate(1)));
    actions.append(rot, button('Next player', '▶', 'N · D-pad →', h.nextPlayer), button('Fullscreen', 'button-options', 'F', h.fullscreen));
    ctx.append(actions, this.rollEl);

    const settings = el('div', 'settings');
    const select = <T extends string>(label: string, opts: [T, string][], value: T, on: (v: T) => void) => {
      const s = el('select');
      for (const [v, t] of opts) {
        const o = el('option', undefined, t);
        o.value = v;
        s.append(o);
      }
      s.value = value;
      s.addEventListener('change', () => {
        on(s.value as T);
        s.blur();
      });
      settings.append(el('label', undefined, label), s);
    };
    const check = (label: string, value: boolean, on: (v: boolean) => void) => {
      const c = el('input');
      c.type = 'checkbox';
      c.checked = value;
      c.addEventListener('change', () => {
        on(c.checked);
        c.blur();
      });
      settings.append(el('label', undefined, label), c);
    };
    select<QualitySetting>('Quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']], initial.quality, h.quality);
    select<Speed>('Speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']], initial.speed, h.speed);
    check('Board rotation', true, h.rotation);
    check('Camera follow', true, h.follow);
    check('Reduce motion', false, h.reduceMotion);
    ctx.append(settings, this.logEl, this.statsEl);

    this.stage.append(this.seatsEl, ctx, this.busyEl);
    window.addEventListener('resize', () => this.fit());
    this.fit();
  }

  fit(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const k = Math.min(w / 1920, h / 1080);
    this.stage.style.transform = `translate(${(w - 1920 * k) / 2}px, ${(h - 1080 * k) / 2}px) scale(${k})`;
  }

  toggle(): void {
    this.stage.classList.toggle('hidden');
  }

  setSeats(seats: SeatView[], active: number): void {
    this.seatsEl.replaceChildren(
      ...seats.map((s, i) => {
        const card = el('div', `seat${i === active ? ' active' : ''}`);
        card.style.setProperty('--seat-color', s.color);
        const info = el('div');
        info.append(el('div', 'seat-name', s.name), el('div', 'seat-side', `${s.side} side`));
        card.append(el('div', 'seat-ring'), info, el('div', 'seat-cash', `$${s.cash.toLocaleString('en-US')}`));
        return card;
      }),
    );
  }

  setRoll(a: number, b: number, note: string): void {
    this.rollEl.innerHTML = `<span>${a} + ${b} = ${a + b}</span><small>${note}</small>`;
  }

  log(line: string): void {
    this.logLines.unshift(line);
    this.logLines = this.logLines.slice(0, 4);
    this.logEl.innerHTML = this.logLines.map((l, i) => `<div style="opacity:${1 - i * 0.22}">${l}</div>`).join('');
  }

  setBusy(text: string | null): void {
    this.busyEl.textContent = text ?? '';
    this.busyEl.classList.toggle('show', !!text);
  }

  setStats(html: string): void {
    this.statsEl.innerHTML = html;
  }
}
