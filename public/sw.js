/* UCA Sandbox service worker.
 *
 * Three jobs:
 *  1. Precache an offline shell (offline page, icons, logo) so the app opens
 *     with brand chrome even with no connection.
 *  2. Serve a network-first navigation strategy with an offline fallback.
 *  3. Receive web push messages and show them as system notifications.
 *
 * Kept dependency-free. Bump SW_VERSION to invalidate every cache on deploy.
 */

const SW_VERSION = "uca-sw-v4";
const SHELL_CACHE = `${SW_VERSION}-shell`;
const ASSET_CACHE = `${SW_VERSION}-assets`;
const OFFLINE_URL = "/offline";

/* The offline shell: everything needed to render a branded offline screen. */
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/uca-logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  // In-app notification chime, so it's ready the moment a push arrives.
  "/sounds/notification.wav",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One missing asset must not fail the whole install, so each fetch is
      // added individually and failures are tolerated.
      .then((cache) =>
        Promise.all(SHELL_ASSETS.map((url) => cache.add(url).catch(() => null)))
      )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(SW_VERSION)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Cache-first for immutable build assets; the network is only a fallback. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first for navigations, falling back to the cached offline shell. */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ??
      new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses or auth-gated portal HTML — stale academy data
  // is worse than a clean failure.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Next.js build output, fonts, icons and images are content-hashed or
  // effectively static, so cache-first is safe and makes repeat opens instant.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/splash/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "UCA Sandbox", body: "", url: "/student/notifications" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    (async () => {
      // If a window is currently in front of the user, the branded in-app
      // chime plays instead of the OS tone — otherwise the two would sound at
      // once. Backgrounded, the system notification carries the sound.
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clients.filter((c) => c.focused && c.visibilityState === "visible");

      focused.forEach((c) => c.postMessage({ type: "uca-push", payload }));

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        image: payload.image || undefined,
        data: { url: payload.url || "/student/notifications" },
        tag: payload.tag || undefined,
        // `sound` is not honoured by any browser, so when the app isn't in
        // front we rely on the OS default tone plus vibration. Setting
        // silent:true suppresses both, which is what we want when the chime
        // is already playing in the foreground app.
        silent: focused.length > 0,
        vibrate: focused.length > 0 ? [] : [180, 90, 180],
        requireInteraction: false,
        timestamp: payload.timestamp || Date.now(),
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/student";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
