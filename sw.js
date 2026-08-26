const CACHE_NAME = "cronygo-v51";

// ★app.jsとindex.htmlとstyle.cssはここに入れないのがコツ
const urlsToCache = [
  "./",
  "./manifest.json",
  "./CronyGOicon_192.png",
  "./CronyGOicon_512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

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
    }).then(() => self.clients.claim()) // ★中に入れた
  );
});

self.addEventListener("fetch", e => {
  // AIモデルは触らない
  if(
    e.request.url.includes("huggingface") ||
    e.request.url.includes("mlc-ai") ||
    e.request.url.includes("esm.run")
  ){
    return;
  }

  // ★開発中の3ファイルは常にネットワーク優先 + キャッシュを汚さない
  const isDevFile = e.request.url.includes("app.js") || 
                    e.request.url.includes("index.html") || 
                    e.request.url.includes("style.css") ||
                    e.request.url.includes("voice.js");

  if (isDevFile) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }) // ★ブラウザキャッシュ無視
        .then(response => {
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // アイコンとかはキャッシュ優先でOK
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      });
    })
  );
});
