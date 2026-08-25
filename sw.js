// CronyGO v0.5 minimal SW - shell only
const CACHE = "cronygo-shell-v05";
const SHELL = ["./", "./index.html", "./style.css", "./app.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // モデルは触らない
  if (e.request.url.includes("huggingface") || e.request.url.includes("mlc-ai")) return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
