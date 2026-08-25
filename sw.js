const CACHE_NAME = "cronygo-v25";

const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./CronyGOicon_192.png",
  "./CronyGOicon_512.png"
];

/* インストール - Solpon方式 */
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

/* 有効化 - 古いキャッシュ削除 */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if(key !== CACHE_NAME){
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/* 通信 - ネットワーク優先、失敗時キャッシュ */
self.addEventListener("fetch", e => {
  // AIモデルはキャッシュしない
  if(
    e.request.url.includes("huggingface") ||
    e.request.url.includes("mlc-ai") ||
    e.request.url.includes("esm.run")
  ){
    return;
  }

  e.respondWith(
    fetch(e.request)
    .then(response => {
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(e.request, responseClone);
      });
      return response;
    })
    .catch(() => {
      return caches.match(e.request);
    })
  );
});
