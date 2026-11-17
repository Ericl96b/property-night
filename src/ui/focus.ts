// D-pad / stick navigation (SPEC §4): spatial focus movement between the focusable controls
// of the topmost overlay panel.

export type Dir = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled])';

export function focusables(container: Element): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/** Pick the next element from `from` in direction `dir` (nearest along the axis, then across). */
export function pickNext(rects: { el: HTMLElement; x: number; y: number }[], from: { x: number; y: number } | null, dir: Dir) {
  if (!rects.length) return null;
  if (!from) return rects[0].el;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const r of rects) {
    const dx = r.x - from.x;
    const dy = r.y - from.y;
    const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (along <= 4) continue;
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = r.el;
    }
  }
  return best;
}

/** Move focus inside `container`; returns the newly focused element. */
export function moveFocus(container: Element, dir: Dir): HTMLElement | null {
  const els = focusables(container);
  const rects = els.map((el) => {
    const r = el.getBoundingClientRect();
    return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const active = document.activeElement as HTMLElement | null;
  const cur = active && container.contains(active) ? rects.find((r) => r.el === active) ?? null : null;
  const next = pickNext(rects, cur, dir) ?? (cur ? null : rects[0]?.el ?? null);
  if (next) (next as HTMLElement & { focus(o?: { focusVisible?: boolean }): void }).focus({ focusVisible: true } as FocusOptions);
  return next ?? null;
}
