/* Coach Muscu — service worker.
   Version = le ?v=N de l'URL d'enregistrement (sw.js?v=N, posé par app.js depuis le ?v= de son propre <script>) :
   on ne bumpe plus que les refs ?v= d'index.html, le nom du cache en découle.
   - Navigation / index.html : RÉSEAU D'ABORD (revalidation, 3 s max) puis cache -> toujours frais en ligne,
     lancement rapide même avec un réseau lent ou absent.
   - Tout le reste (JS/CSS/données/images) : CACHE D'ABORD + rafraîchissement en arrière-plan
     (même si un ?v= est oublié, la version fraîche arrive au lancement suivant). */
var V = (/[?&]v=(\d+)/.exec(self.location.search) || [])[1] || "0";
var CACHE = "coachmuscu-runtime-v" + V;
var NET_TIMEOUT = 3000;
var SHELL = ["./", "index.html", "style.css?v=" + V, "data.js?v=" + V, "sports.js?v=" + V, "app.js?v=" + V, "manifest.webmanifest", "base_aliments.json"];

function put(req, res) {
  if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
  return res;
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* précache du « shell » (best-effort : un échec réseau n'empêche pas l'installation) */
      return Promise.all(SHELL.map(function (u) {
        return fetch(u, { cache: "reload" }).then(function (r) { return r.ok ? c.put(u, r) : null; }).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(req, nav) {
  return caches.match(req, { ignoreSearch: true }).then(function (m) {
    return m || (nav ? caches.match("index.html", { ignoreSearch: true }) : undefined);
  });
}

/* Réseau d'abord avec délai : si le réseau répond avant 3 s on le sert (et on met le cache à jour), sinon cache. */
function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(function () {
      fromCache(req, true).then(function (m) { if (m && !settled) { settled = true; resolve(m); } });
    }, NET_TIMEOUT);
    fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(function (res) {
      put(req, res);
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      if (settled) return;
      fromCache(req, true).then(function (m) { settled = true; resolve(m || Response.error()); });
    });
  });
}

/* Cache d'abord + rafraîchissement silencieux. */
function staleWhileRevalidate(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (m) {
    var net = fetch(req).then(function (res) { return put(req, res); }).catch(function () { return m || Response.error(); });
    return m || net;
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; /* on ne gère que nos propres fichiers */
  var isNav = req.mode === "navigate" || /\/(index\.html)?$/.test(url.pathname);
  e.respondWith(isNav ? networkFirst(req) : staleWhileRevalidate(req));
});
