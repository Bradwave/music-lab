const CACHE_NAME = 'dust-pwa-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/main.css?v=3',
  './fonts/silkscreen-400.woff2',
  './fonts/silkscreen-700.woff2',
  './icons/icon.svg',
  './src/main.js?v=3',
  './src/state/scales.js',
  './src/state/presets.js',
  './src/state/store.js',
  './src/engine/platterPhysics.js',
  './src/engine/waxPressing.js',
  './src/engine/grooveGen.js',
  './src/audio/engine.js',
  './src/audio/synths.js',
  './src/audio/scheduler.js',
  './src/audio/wavRecorder.js',
  './src/ui/platterCanvas.js',
  './src/ui/gestures.js',
  './src/ui/sleeveMenu.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(new Request(url, { cache: 'reload' }))
            .then((res) => (res.ok ? cache.put(url, res) : undefined))
            .catch(() => undefined)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('dust-pwa-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
