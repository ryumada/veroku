/**
 * @file sw.js
 * @category Service
 * @description Service worker caching engine providing full offline application shell and asset fallback.
 * @requires CacheStorage, ServiceWorkerGlobalScope
 */

const CACHE_NAME = 'veroku-cache-v1.7';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/db.js',
  './js/engine.js',
  './js/ui.js',
  './js/sync.js',
  './js/notifications.js',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './fonts/dm-sans-400.woff2',
  './fonts/dm-sans-500.woff2',
  './fonts/rajdhani-400.woff2',
  './fonts/rajdhani-600.woff2',
  './fonts/rajdhani-700.woff2'
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

// Notification Click Event - focus existing window or open app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const targetUrl = new URL('./index.html', self.location.origin).href;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('index.html') || client.url === self.location.origin + '/' || client.url === targetUrl) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

