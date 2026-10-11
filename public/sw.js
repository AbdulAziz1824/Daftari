/* Service Worker - فزعة (PWA)
   - ملفات _next/static والأيقونات والخطوط: كاش أولًا (اسمها يتغير مع كل نسخة)
   - الصفحات: الشبكة أولًا، وإذا انقطع الإنترنت تظهر صفحة offline
   - لا نخزّن أي طلبات لـ Supabase أو /api أبدًا (بيانات المستخدم) */
const VERSION = "fazaa-v1-05";
const STATIC_CACHE = VERSION + "-static";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/logo.png", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // Supabase وغيره: مباشرة من الشبكة
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2)$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
