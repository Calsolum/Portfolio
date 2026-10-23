/*
 * Service worker for the Smash Up Base Tracker, scoped to /smash-up. It lets
 * the page open with no signal once it has been opened online: the page is
 * fetched from the network first (so a new deploy shows at once) and from the
 * stored copy only when the network fails; the build files it needs are kept
 * alongside. Sharing still needs a connection, and the API is never cached.
 *
 * To retire it, replace this file with one that calls
 * self.registration.unregister() and deletes the caches.
 */

const CACHE = "smash-up-v1";
const PAGE = "/smash-up";

/** Stores the page and every build file it names, and drops build files that an older version needed. */
async function storePage(response) {
  const page = response ?? (await fetch(PAGE, { cache: "no-store" }));
  if (!page.ok) return;
  const html = await page.clone().text();
  const files = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
  const cache = await caches.open(CACHE);
  await cache.put(PAGE, page);
  await Promise.all(
    files.map(async (file) => {
      if (await cache.match(file)) return;
      const fetched = await fetch(file);
      if (fetched.ok) await cache.put(file, fetched);
    }),
  );
  const wanted = new Set(files.map((file) => new URL(file, self.location.origin).href));
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/_next/static/") && !wanted.has(url.href)) await cache.delete(request);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    storePage()
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("smash-up-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === PAGE) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) event.waitUntil(storePage(response.clone()).catch(() => {}));
          return response;
        })
        .catch(() => caches.match(PAGE).then((stored) => stored ?? Response.error())),
    );
    return;
  }

  // Build files have a hash in their name and never change; the icons and manifest rarely do.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/smash-up/")) {
    event.respondWith(
      caches.match(request).then(
        (stored) =>
          stored ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
            }
            return response;
          }),
      ),
    );
  }
});
