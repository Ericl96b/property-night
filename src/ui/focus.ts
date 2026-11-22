// D-pad / stick navigation (SPEC §4, Stage 1 §2): spatial focus movement between the focusable
// controls of the top menu-stack layer, plus one shared driver for every control type, so each
// screen gets controller support and the focus style without its own code.
//
// One focus: the DOM focus. The mouse moves it too (App hovers call `hoverFocus`), so the
// controller and the mouse can never highlight two different items.

export type Dir = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE =
  'button:not([disabled]):not([aria-disabled="true"]), select:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])';

type Focusable = HTMLElement & { focus(o?: FocusOptions & { focusVisible?: boolean }): void };

export function focusables(container: Element): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/** Focus an element as navigation focus (visible ring/fill) and keep it scrolled into view. */
export function focusEl(el: HTMLElement, scroll = true): void {
  (el as Focusable).focus({ focusVisible: true, preventScroll: true } as FocusOptions);
  if (scroll) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/** The sensible starting item of a layer: [data-autofocus], else its primary, else the first. */
export function defaultFocus(container: Element): HTMLElement | null {
  const els = focusables(container);
  return (
    els.find((e) => e.hasAttribute('data-autofocus')) ??
    els.find((e) => e.classList.contains('primary')) ??
    els[0] ??
    null
  );
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
  // Nothing focused yet: the first press lands on the layer's default item.
  const next = cur ? pickNext(rects, cur, dir) : defaultFocus(container);
  if (next) focusEl(next);
  return next ?? null;
}

/** Step focus through `container`'s controls in document order, wrapping (test board, Batch 4). */
export function cycleFocus(container: Element, step: 1 | -1): HTMLElement | null {
  const els = focusables(container);
  if (!els.length) return null;
  const active = document.activeElement as HTMLElement | null;
  const i = active ? els.indexOf(active) : -1;
  const next = els[i < 0 ? (step > 0 ? 0 : els.length - 1) : (i + step + els.length) % els.length];
  focusEl(next);
  return next;
}

function fire(el: HTMLElement) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** True for controls that respond to left/right (selects, number and range fields, steppers). */
export function isStepper(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return el.type === 'number' || el.type === 'range';
  return (el as HTMLElement).hasAttribute?.('data-stepper') ?? false;
}

/**
 * Left/right on a stepper-type control: change its value by one step. Returns false at the end
 * of its range, so left/right then moves focus on (a settings column is never a dead end).
 */
export function stepControl(el: HTMLElement, dir: 1 | -1): boolean {
  if (el instanceof HTMLSelectElement) {
    let i = el.selectedIndex + dir;
    while (i >= 0 && i < el.options.length && el.options[i].disabled) i += dir;
    if (i < 0 || i >= el.options.length) return false;
    el.selectedIndex = i;
    fire(el);
    return true;
  }
  if (el instanceof HTMLInputElement && (el.type === 'number' || el.type === 'range')) {
    const before = el.value;
    try {
      if (dir > 0) el.stepUp();
      else el.stepDown();
    } catch {
      return false;
    }
    if (el.value === before) return false;
    fire(el);
    return true;
  }
  if (el.hasAttribute('data-stepper')) {
    const ev = new CustomEvent('step', { detail: dir, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented; // the stepper calls preventDefault() when it moved
  }
  return false;
}

/** Confirm on the focused control: click buttons/toggles, cycle a select forward (wrapping). */
export function activate(el: HTMLElement): boolean {
  if (el instanceof HTMLButtonElement) {
    if (el.disabled) return false;
    el.click();
    return true;
  }
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    el.click();
    return true;
  }
  if (el instanceof HTMLSelectElement) {
    if (!stepControl(el, 1)) {
      el.selectedIndex = 0;
      fire(el);
    }
    return true;
  }
  if (el.hasAttribute('tabindex') && el.getAttribute('aria-disabled') !== 'true') {
    el.click();
    return true;
  }
  return false;
}

/** Mouse hover moves the one focus (never away from a text field being typed in). */
export function hoverFocus(target: EventTarget | null, scope: Element | null): void {
  if (!scope || !(target instanceof Element)) return;
  const el = target.closest<HTMLElement>(FOCUSABLE);
  if (!el || !scope.contains(el) || el === document.activeElement) return;
  const a = document.activeElement;
  if (a instanceof HTMLInputElement && (a.type === 'text' || a.type === 'search') && scope.contains(a)) return;
  if (a instanceof HTMLTextAreaElement) return;
  focusEl(el, false);
}
