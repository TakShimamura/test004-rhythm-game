// @ts-nocheck
// Service Worker for Rhythm Game — vanilla JS (runs outside the bundle)

const CACHE_NAME = 'rhythm-game-v1';
const STATIC_CACHE = 'rhythm-static-v1';
const AUDIO_CACHE = 'rhythm-audio-v1';
const CHART_CACHE = 'rhythm-charts-v1';

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon.svg',
];

// Install — pre-cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  const keepCaches = new Set([STATIC_CACHE, AUDIO_CACHE, CHART_CACHE]);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => !keepCaches.has(name))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls — network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    // Cache chart data responses
    if (url.pathname.startsWith('/api/charts/')) {
      event.respondWith(networkFirstWithCache(request, CHART_CACHE));
      return;
    }
    // Other API calls — network only (scores, auth, etc.)
    return;
  }

  // Audio files — cache when first played
  if (
    url.pathname.startsWith('/uploads/') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.ogg') ||
    url.pathname.endsWith('.wav')
  ) {
    event.respondWith(cacheFirstWithNetwork(request, AUDIO_CACHE));
    return;
  }

  // Static assets (JS, CSS, images, fonts) — cache first
  if (
    url.pathname.startsWith('/_app/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // Navigation requests — network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match('/').then((root) => root || offlineFallback())
          )
        )
    );
    return;
  }
});

/**
 * Network first: try network, fall back to cache, update cache on success.
 */
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Cache first: serve from cache if available, otherwise fetch and cache.
 */
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Minimal offline fallback page.
 */
function offlineFallback() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rhythm Game — Offline</title>
  <style>
    body {
      background: #0a0a0f;
      color: #fff;
      font-family: monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
    h1 { font-size: 48px; letter-spacing: 8px; color: #4488ff; margin-bottom: 16px; }
    p { color: #888; font-size: 16px; }
    button {
      margin-top: 24px;
      padding: 12px 32px;
      background: transparent;
      border: 2px solid #4488ff;
      color: #4488ff;
      font-family: monospace;
      font-size: 16px;
      cursor: pointer;
      letter-spacing: 2px;
    }
    button:hover { background: rgba(68, 136, 255, 0.15); }
  </style>
</head>
<body>
  <h1>OFFLINE</h1>
  <p>You appear to be offline.</p>
  <p>Check your connection and try again.</p>
  <button onclick="location.reload()">RETRY</button>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html' },
  });
}
