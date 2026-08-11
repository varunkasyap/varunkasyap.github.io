const HEADSHOT_CACHE = "headshot-v1";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== HEADSHOT_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith("/headshot.jpeg") && !url.pathname.endsWith("headshot.jpeg")) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(HEADSHOT_CACHE);
    const cached = await cache.match(event.request);
    if (cached) {
      return cached;
    }

    const response = await fetch(event.request);
    if (response.ok) {
      cache.put(event.request, response.clone());
    }
    return response;
  })());
});
