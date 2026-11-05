/* =========================================================
   Built For Life — service worker
   • makes the portal and coach panel installable ("Add to Home Screen")
   • keeps a copy of the app so it opens with no signal (gym basements)
   • shows push notifications (new messages, bookings, payments)
   ========================================================= */
const CACHE = "bfl-v2";
const SHELL = ["portal.html", "admin.html", "css/style.css", "css/portal.css", "css/admin.css", "js/store.js", "js/morph.js", "js/portal.js", "js/admin.js", "js/risk.js", "js/app.js", "js/slots.js", "js/community.js", "icons/icon-192.png", "icons/badge-96.png", "assets/coaching.jpg"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

// the site: network first (so updates show straight away), the saved copy when offline. Never cache the API.
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/__")) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (r.type === "basic" || r.type === "default")) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === "navigate" ? caches.match(u.pathname.includes("admin") ? "admin.html" : "portal.html") : Response.error()))));
});

// push notifications from the server
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "Built For Life", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    // already looking at that screen? don't double up
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (d.skipIfOpen && wins.some(w => w.focused && w.url.includes(d.skipIfOpen))) return;
    await self.registration.showNotification(d.title || "Built For Life", { body: d.body || "", icon: "icons/icon-192.png", badge: "icons/badge-96.png", tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "portal.html" } });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "portal.html", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const same = wins.find(w => w.url.split("#")[0] === url.split("#")[0]);
    if (same) { await same.focus(); return same.navigate ? same.navigate(url) : null; }
    return self.clients.openWindow(url);
  })());
});
