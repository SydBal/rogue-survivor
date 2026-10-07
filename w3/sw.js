// Rogue Survivor w3 service worker: cache the game shell for offline play
// and Add to Home Screen installability.
// Bump CACHE when shipping a new w3 build so clients pick it up.
const CACHE = 'rogue-survivor-w3-v1'
const ASSETS = [
  './',
  './index.html',
  './index.js',
  './survivor-ui.js',
  './styles.css',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)))
})
