// Page-side helpers injected into plans (as source text).
export const H = `(() => {
  window.__h = {
    c: () => window.__pn.controller,
    buttons: (sel = '.context button') => [...document.querySelectorAll(sel)].map((b) => b.textContent.trim()),
    click(re, sel = 'button') {
      const b = [...document.querySelectorAll(sel)].find((x) => re.test(x.textContent.trim()) && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    },
    /** Inventory (Stage 3): open each owned deed's action list and run its first enabled Build. */
    async invBuildAny() {
      const inv = () => document.querySelector('[data-screen=inventory]');
      for (const slot of [...inv().querySelectorAll('.slot[data-focus-key^="t"]')]) {
        slot.focus();
        slot.click();
        await new Promise((r) => setTimeout(r, 60));
        const b = [...inv().querySelectorAll('.acts button')].find((x) => /^Build a/.test(x.textContent.trim()) && x.getAttribute('aria-disabled') !== 'true');
        if (b) {
          b.click();
          return true;
        }
        window.__pn.app.intent('back', null);
        await new Promise((r) => setTimeout(r, 60));
      }
      return false;
    },
    async idle(ms = 15000) {
      const c = window.__pn.controller;
      const t0 = performance.now();
      while ((c.view.busy || c.view.card) && performance.now() - t0 < ms) await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 30));
    },
  };
  return true;
})()`;
