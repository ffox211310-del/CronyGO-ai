const CACHE = "cronygo-shell-v10";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json", "./assets/CronyGOicon.png"];

self.addEventListener("install", e => {
  console.log("[SW] install v08");
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", e => {
  console.log("[SW] activate v08");
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = e.request.url;
  if (url.includes("huggingface.co") || url.includes("mlc-ai") || url.includes("esm.run")) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
