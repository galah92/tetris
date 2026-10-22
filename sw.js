// Cache-first app shell. The deploy workflow stamps VERSION with the commit, so every
// deploy installs a new worker; the page then offers a one-tap refresh.
const VERSION = '__VERSION__';
const CACHE = 'tetris-' + VERSION;
const ASSETS = [
  './', 'index.html', 'style.css', 'game.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
    // The first release ('tetris-v1') had no refresh prompt, so take over from it right away.
    if (await caches.has('tetris-v1')) await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tetris-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' && await cache.match('./'));
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
