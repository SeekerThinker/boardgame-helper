// CACHE_NAME is rewritten on every build by scripts/build-static.js so the
// deployed cache version always matches the exact content being shipped.
const CACHE_NAME = 'board-game-assistant-dev';
const APP_SCOPE = self.registration.scope;
const appUrl = relative => new URL(relative, APP_SCOPE).href;
const APP_SHELL = [
  '', 'index.html', 'privacy.html', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'src/app.js', 'src/core.js', 'src/i18n.js', 'src/native.js', 'src/audio.js', 'src/archive.js', 'src/style.css',
  'src/tabletop-event-boundary.js', 'src/tabletop.js', 'src/tabletop-core.js', 'src/tabletop.css',
  'src/tabletop-companion.js', 'src/tabletop-companion.css', 'src/tabletop-archive-bridge.js'
].map(appUrl);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || !event.request.url.startsWith(APP_SCOPE)) return;
  const isNavigation = event.request.mode === 'navigate';
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        return response;
      });
      if (isNavigation) return network.catch(() => cached || caches.match(appUrl('index.html')));
      return cached || network;
    })
  );
});
