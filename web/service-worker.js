const SHELL_CACHE = "weekly-groovebox-shell-dev";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles.css?v=dev",
  "./app.mjs?v=dev",
  "./audio-engine.mjs?v=dev",
  "./bootstrap.mjs?v=dev",
  "./demo-projects.mjs?v=dev",
  "./install-mode.mjs?v=dev",
  "./keyboard.mjs?v=dev",
  "./layout.mjs?v=dev",
  "./pack-delivery.mjs?v=dev",
  "./pack-transfer.mjs?v=dev",
  "./pwa.mjs?v=dev",
  "./sequencer.mjs?v=dev",
  "./state.mjs?v=dev",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./assets/barnestorm-install-logo.png",
  "./assets/packs/2026-week-32-pumpin-techno/demo-project.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("weekly-groovebox-shell-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  const isDemoProject = url.pathname.endsWith("/demo-project.json");
  if (["script", "style", "image"].includes(request.destination) || isDemoProject) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
