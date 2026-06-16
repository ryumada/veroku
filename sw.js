const CACHE_NAME = 'veroku-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/db.js',
  './js/engine.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json'
];

// Install Event - cache core shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clear old cache versions
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - network first fallback to cache strategy for offline robustness
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).then((response) => {
      // Clone response and cache it if it's a valid local shell asset
      if (response && response.status === 200 && response.type === 'basic') {
        const cacheCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, cacheCopy);
        });
      }
      return response;
    }).catch(() => {
      return caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        // Fallback for document requests to main shell
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
