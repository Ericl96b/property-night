// PWA check on the deployed build: manifest, service worker control, offline reload.
const base = process.env.PN_URL ?? 'https://ericl96b.github.io/property-night/';

export default {
  url: `${base}?quality=low`,
  loadWait: 4000,
  steps: [
    { until: () => !!window.__pn?.scene, label: 'booted', timeout: 30000 },
    {
      eval: async () => {
        const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
        const reg = await navigator.serviceWorker.ready;
        return { manifest: m.name, icons: m.icons.length, sw: !!reg.active, scope: reg.scope };
      },
      label: 'manifest + worker',
    },
    { wait: 2500 },
    { eval: () => (location.reload(), true), label: 'reload (now controlled)' },
    { wait: 4000 },
    { until: () => !!navigator.serviceWorker.controller && !!window.__pn?.scene, label: 'controlled', timeout: 20000 },
    { wait: 2000 },
    { eval: async () => (await caches.keys()).length && (await (await caches.open((await caches.keys())[0])).keys()).length, label: 'cached entries' },
    { cdp: 'Network.enable' },
    { cdp: 'Network.emulateNetworkConditions', params: { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } },
    { eval: () => (location.reload(), true), label: 'reload offline' },
    { wait: 5000 },
    { until: () => !!window.__pn?.scene && !!document.querySelector('.menu h1'), label: 'menu works offline', timeout: 20000 },
    { shot: 'pwa-offline' },
  ],
};
