// Page-side helpers injected into plans (as source text).
export const H = `(() => {
  window.__h = {
    c: () => window.__pn.controller,
    buttons: (sel = '.context button') => [...document.querySelectorAll(sel)].map((b) => b.textContent.trim()),
    click(re, sel = 'button') {
      const b = [...document.querySelectorAll(sel)].find((x) => re.test(x.textContent) && !x.disabled);
      if (!b) return false;
      b.click();
      return true;
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
