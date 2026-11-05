/* =========================================================
   Built For Life — app features shared by the portal and coach panel
   • registers the service worker (installable app + works offline)
   • "Install the app" button / iPhone Add to Home Screen help
   • push notifications (live site only)
   ========================================================= */
(function () {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let deferred = null, reg = null;
  const listeners = [];

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    addEventListener("load", () => { navigator.serviceWorker.register("sw.js").then(r => { reg = r; }).catch(() => {}); });
  }
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; listeners.forEach(f => f()); });
  addEventListener("appinstalled", () => { deferred = null; listeners.forEach(f => f()); });

  const b64ToBytes = s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  /* play a demo or form-check video: our own files, YouTube and Vimeo play in a pop-up; anything else opens in a new tab */
  function embedOf(u) {
    const y = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/.exec(u); if (y) return `https://www.youtube-nocookie.com/embed/${y[1]}?autoplay=1&playsinline=1&rel=0`;
    const v = /vimeo\.com\/(\d+)/.exec(u); if (v) return `https://player.vimeo.com/video/${v[1]}?autoplay=1`;
    return null;
  }
  function video(url, title) {
    if (!url) return;
    const own = /^\/api\/img\//.test(url) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url), em = own ? null : embedOf(url);
    if (!own && !em) { open(url, "_blank", "noopener"); return; }
    const d = document.createElement("div"); d.className = "vid-modal"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", title || "Video");
    d.innerHTML = `<div class="vm-in"><div class="vm-h"><b></b><button type="button" aria-label="Close">✕</button></div>${own ? `<video src="${url.replace(/"/g, "")}" controls playsinline autoplay preload="metadata"></video>` : `<iframe src="${em}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`}</div>`;
    d.querySelector("b").textContent = title || "";
    const close = () => { d.remove(); removeEventListener("keydown", esc); }, esc = e => { if (e.key === "Escape") close(); };
    d.onclick = e => { if (e.target === d || e.target.closest(".vm-h button")) close(); }; addEventListener("keydown", esc);
    document.body.append(d);
    if (!document.getElementById("vmCss")) { const st = document.createElement("style"); st.id = "vmCss"; st.textContent = `.vid-modal{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.82);display:grid;place-items:center;padding:16px}.vm-in{width:min(900px,100%);background:#111;border-top:3px solid #E3242B}.vm-h{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;color:#F2F0EB;font:600 15px/1.3 system-ui,sans-serif}.vm-h button{background:none;border:0;color:#F2F0EB;font-size:18px;cursor:pointer}.vid-modal video,.vid-modal iframe{display:block;width:100%;max-height:78vh;aspect-ratio:16/9;background:#000;border:0}.vid-modal video{aspect-ratio:auto}`; document.head.append(st); }
  }

  window.BFLApp = {
    isIOS, standalone, video,
    onChange: f => listeners.push(f),
    /* can we show an "Install" button (Android / desktop Chrome / Edge)? */
    canInstall: () => !!deferred && !standalone(),
    /* iPhone/iPad Safari: no install button, show the Share → Add to Home Screen steps */
    needsIOSHelp: () => isIOS && !standalone(),
    async install() { if (!deferred) return false; deferred.prompt(); const c = await deferred.userChoice.catch(() => ({})); deferred = null; listeners.forEach(f => f()); return c.outcome === "accepted"; },

    /* push notifications: "on" | "off" | "denied" | "ios-install" | "unsupported" */
    async pushState() {
      const B = window.BFL;
      if (!B || !B.live || !B.cfg.push) return "unsupported";
      if (isIOS && !standalone()) return "ios-install";
      if (!pushSupported()) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      try { const r = reg || await navigator.serviceWorker.ready; const s = await r.pushManager.getSubscription(); return s && Notification.permission === "granted" ? "on" : "off"; } catch (e) { return "off"; }
    },
    async enablePush() {
      const B = window.BFL;
      if (!pushSupported() || !B.live || !B.cfg.pushKey) throw new Error("Notifications aren't available on this device.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notifications weren't allowed. You can turn them on in your browser settings.");
      const r = reg || await navigator.serviceWorker.ready;
      let s = await r.pushManager.getSubscription();
      if (!s) s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(B.cfg.pushKey) });
      await B.api("POST", "/api/push/subscribe", { sub: s.toJSON() });
      B.api("POST", "/api/push/test", {}).catch(() => {});
      return true;
    },
    async disablePush() {
      try { const r = reg || await navigator.serviceWorker.ready; const s = await r.pushManager.getSubscription(); if (s) { await window.BFL.api("POST", "/api/push/unsubscribe", { endpoint: s.endpoint }).catch(() => {}); await s.unsubscribe(); } } catch (e) {}
    }
  };
})();
