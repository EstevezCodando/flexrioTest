// Rio Flex Service Worker
const CACHE_NAME = 'rioflex-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache error (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass external maps embed or analytics
  if (url.origin !== self.location.origin) {
    return;
  }

  // NUNCA cachear a API: as respostas dependem do usuário da sessão (dados pessoais e de papel).
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first with cache fallback for HTML / navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status === 404) {
          return caches.match('/index.html') || caches.match('/') || networkResponse;
        }
        return networkResponse;
      }).catch(() => {
        return caches.match('/index.html') || caches.match('/') || caches.match('/app');
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets (images, fonts, scripts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
