/* B3A Live service worker: app shell cache + offline ETA snapshots. */

const VERSION = "b3a-live-v2";
const SHELL = [
  "./",
  "index.html",
  "css/app.css",
  "js/app.js",
  "js/api.js",
  "js/core.js",
  "js/i18n.js",
  "js/store.js",
  "js/ui.js",
  "data/stops.json",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Live ETAs: network first, cached response when the network is down.
  if (url.hostname === "rt.data.gov.hk") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const cache = await caches.open(VERSION);
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App shell: serve cache immediately, refresh it in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) return cached;
      const fresh = await network;
      return fresh || Response.error();
    })()
  );
});
