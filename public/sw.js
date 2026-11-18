// Property Night service worker (SPEC §2: installable, works offline after the first visit).
// - Pages (navigations): network first, falling back to the cached app shell.
// - Hashed build assets, fonts and icons: cache first (they never change under one name).
// - The page posts the URLs it loaded on first run, so the first visit is cached too.
const CACHE = 'property-night-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // The shell names the hashed entry script and stylesheet: cache them now.
      const html = await (await fetch('./', { cache: 'no-cache' })).text();
      const urls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => new URL(m[1], self.registration.scope).href);
      await cache.addAll(urls);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'cache' || !Array.isArray(msg.urls)) return;
  const scope = self.registration.scope;
  const urls = msg.urls.filter((u) => typeof u === 'string' && u.startsWith(scope));
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(urls.map((u) => cache.match(u).then((hit) => hit || cache.add(u).catch(() => {})))),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put('./index.html', res.clone());
          return res;
        } catch {
          return (await caches.match('./index.html')) ?? (await caches.match('./')) ?? Response.error();
        }
      })(),
    );
    return;
  }
  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});
