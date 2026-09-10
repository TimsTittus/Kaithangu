/*
 * Kaithangu service worker (hand-written, AGENTS.md 3).
 * - App shell (manifest, icons), Next static assets (JS, CSS, fonts) and the
 *   active locale's audio labels: cache-first.
 * - /api/*: network-first, falling back to the last cached response.
 * - Page navigations: network-first, falling back to the cached page or /app.
 * Only same-origin GET requests are handled; map tiles go straight to the network.
 * Pages and API responses are private: LogoutButton deletes kt-pages-* and kt-api-*.
 */
const VERSION = 'v1';
const SHELL_CACHE = `kt-shell-${VERSION}`;
const STATIC_CACHE = `kt-static-${VERSION}`;
const AUDIO_CACHE = `kt-audio-${VERSION}`;
const PAGES_CACHE = `kt-pages-${VERSION}`;
const API_CACHE = `kt-api-${VERSION}`;
const CURRENT = [SHELL_CACHE, STATIC_CACHE, AUDIO_CACHE, PAGES_CACHE, API_CACHE];

const SHELL = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const LOCALES = ['en', 'ml', 'hi', 'ta'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('kt-') && !CURRENT.includes(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Cache the audio labels of one locale and drop the others. */
async function precacheAudio(locale) {
  if (!LOCALES.includes(locale)) return;
  const response = await fetch(`/audio/${locale}/index.json`);
  if (!response.ok) return;
  const keys = await response.json();
  if (!Array.isArray(keys)) return;
  const cache = await caches.open(AUDIO_CACHE);
  const wanted = keys
    .filter((key) => typeof key === 'string' && /^[a-z0-9_.]+$/.test(key))
    .map((key) => `/audio/${locale}/${key}.mp3`);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith(`/audio/${locale}/`)) await cache.delete(request);
  }
  await cache.addAll(wanted);
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'precache-audio' && typeof data.locale === 'string') {
    event.waitUntil(precacheAudio(data.locale).catch(() => undefined));
  }
});

function cacheable(response) {
  return response.ok && response.type === 'basic' && !response.redirected;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached =
      (await cache.match(request)) || (fallbackPath ? await cache.match(fallbackPath) : undefined);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
  } else if (url.pathname.startsWith('/audio/')) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE));
  } else if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, '/app'));
  }
});
