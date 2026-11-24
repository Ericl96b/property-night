// Interface sounds that every control shares (audio Phase 0 §5), from two document-level
// listeners instead of edits to each button: a pad's Confirm reaches buttons as `el.click()`
// (focus.ts `activate`), so one capture-phase click listener hears mouse and controller alike.
import { audio } from './index';

const CLICKABLE = 'button, [role="button"], [tabindex]';

function disabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true' || !!el.closest('[aria-disabled="true"]');
}

/** Install the confirm / toggle sounds; returns the cleanup. */
export function installUiSounds(doc: Document = document): () => void {
  const click = (e: Event) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t || t.closest('input, select, textarea, label')) return; // fields have their own sounds
    const el = t.closest(CLICKABLE);
    if (!el || disabled(el)) return;
    audio.play('ui.confirm');
  };
  const change = (e: Event) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') audio.play('ui.toggle');
  };
  doc.addEventListener('click', click, { capture: true });
  doc.addEventListener('change', change, { capture: true });
  return () => {
    doc.removeEventListener('click', click, { capture: true });
    doc.removeEventListener('change', change, { capture: true });
  };
}
