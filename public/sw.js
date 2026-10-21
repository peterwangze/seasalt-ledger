const CACHE_NAME = 'seasalt-ledger-v2';
const ROOT = new URL('./', self.location.href).href;
const CORE_ASSETS = [
  ROOT,
  new URL('index.html', self.location.href).href,
  new URL('manifest.webmanifest', self.location.href).href,
  new URL('icons/icon.svg', self.location.href).href,
  new URL('icons/icon-192.png', self.location.href).href,
  new URL('icons/icon-512.png', self.location.href).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(ROOT, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(ROOT)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
