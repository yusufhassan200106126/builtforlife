/* =========================================================
   Built For Life — programme pages (Bridal Bootcamp, Daily Wins)
   Same scroll engine as the homepage (js/main.js), no libraries.
   ========================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COARSE = matchMedia("(pointer:coarse)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- menu + in-page anchors ---------- */
  const menuBtn = $("#menuBtn"), menu = $("#menu");
  function setMenu(open) { menu.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open); menu.setAttribute("aria-hidden", !open); document.body.style.overflow = open ? "hidden" : ""; }
  menuBtn.onclick = () => setMenu(!menu.classList.contains("open"));
  $$("#menu a").forEach(a => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const h = a.getAttribute("href"); if (h.length < 2) return;
    const el = $(h); if (!el) return;
    e.preventDefault(); setMenu(false);
    const pinned = h === "#how";
    scrollTo({ top: el.getBoundingClientRect().top + scrollY + (pinned ? 2 : -60), behavior: reduce ? "auto" : "smooth" });
  });

  /* ---------- split headings + statement words ---------- */
  function wrapWords(el, make) {
    Array.from(el.childNodes).forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(part => { if (part) el.insertBefore(/^\s+$/.test(part) ? document.createTextNode(" ") : make(document.createTextNode(part)), n); });
        el.removeChild(n);
      } else if (n.nodeType === 1 && n.tagName === "EM") wrapWords(n, make);
      else if (n.nodeType === 1 && n.tagName !== "BR") el.replaceChild(make(n.cloneNode(true)), n);
    });
  }
  $$(".split").forEach(h => {
    wrapWords(h, node => { const o = document.createElement("span"), i = document.createElement("span"); o.className = "wd"; i.appendChild(node); o.appendChild(i); return o; });
    $$(".wd>span", h).forEach((s, i) => s.style.transitionDelay = i * 60 + "ms");
  });
  const stEl = $("#statement"); let stWords = [];
  if (stEl) { wrapWords(stEl, node => { const s = document.createElement("span"); s.className = "sw"; s.appendChild(node); return s; }); stWords = $$(".sw", stEl); }
  $$(".checks li").forEach((li, i) => li.style.transitionDelay = (i % 8) * 70 + "ms");

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -10% 0px" });
    $$(".reveal,.split,.checks li").forEach(el => io.observe(el));
  } else $$(".reveal,.split,.checks li").forEach(el => el.classList.add("in"));

  /* ---------- hero video: plays if Jory's file is in assets/, otherwise the photo stays ---------- */
  const film = $("#film"), vid = $("#pVideo"), snd = $("#pSound"), img = $("#phImg");
  if (vid) {
    const fail = () => { vid.remove(); if (snd) snd.remove(); };
    const srcEl = vid.querySelector("source"); if (srcEl) srcEl.addEventListener("error", fail);
    vid.addEventListener("error", fail);
    vid.addEventListener("loadeddata", () => {
      vid.hidden = false; film.classList.add("has-video"); if (snd) snd.hidden = false;
      const p = vid.play(); if (p && p.catch) p.catch(() => {});
    });
    if (snd) snd.onclick = () => {
      vid.muted = !vid.muted; if (!vid.muted) { vid.currentTime = 0; const p = vid.play(); if (p && p.catch) p.catch(() => {}); }
      $("span", snd).textContent = vid.muted ? "Sound on" : "Sound off";
    };
  }

  /* ---------- wedding date → weeks to go → suggested plan ---------- */
  const date = $("#wedDate");
  if (date) {
    const out = $("#plannerOut"), today = new Date(); today.setHours(0, 0, 0, 0);
    date.min = today.toISOString().slice(0, 10);
    const plans = [{ max: 11, id: "plan-6w", name: "6 Week Bridal Reset" }, { max: 20, id: "plan-12w", name: "12 Week Transformation" }, { max: 44, id: "plan-6m", name: "6 Month Bridal Experience" }, { max: 1e9, id: "plan-12m", name: "12 Month Bridal Journey" }];
    date.addEventListener("input", () => {
      $$(".plan").forEach(p => p.classList.remove("pick"));
      if (!date.value) { out.innerHTML = "Pick your date<span>We'll show you how long you've got and which plan fits.</span>"; return; }
      const days = Math.round((new Date(date.value + "T00:00:00") - today) / 864e5);
      if (days < 0) { out.innerHTML = "That date has passed<span>Choose your wedding date to see which plan fits.</span>"; return; }
      const weeks = Math.floor(days / 7), plan = plans.find(p => weeks <= p.max), el = $("#" + plan.id);
      if (el) el.classList.add("pick");
      const short = weeks < 6 ? " It's tight, so message Jory and he'll build a plan around the time you have." : "";
      out.innerHTML = `<b>${weeks}</b> week${weeks === 1 ? "" : "s"} to go<span>The ${plan.name} fits your date best.${short}</span>`;
    });
  }

  /* =========================================================
     SCROLL ENGINE: each scene gets a 0→1 progress, eased per frame
     ========================================================= */
  const scenes = [];
  const scene = (el, kind, fn) => el && scenes.push({ el, kind, fn, cur: null });

  // HERO: photo/video slowly pushes in, big words step through, HUD tracks progress
  const phases = $$(".phase"), shade = $("#filmShade"), media = $("#phMedia"), hudNum = $("#hudNum"), hudBar = $("#hudBar"), cue = $("#cue");
  const steps = phases.length;
  scene(film, "pin", p => {
    phases.forEach(ph => {
      const a = +ph.dataset.from, b = +ph.dataset.to, w = (b - a) * .28;
      const inK = a === 0 ? 1 : ease(range(p, a, a + w)), outK = b > 1 ? 0 : range(p, b - w, b);
      const o = Math.min(inK, 1 - outK);
      ph.style.opacity = o;
      ph.style.transform = `translate3d(0,${(1 - inK) * 70 - outK * 70}px,0)`;
      ph.classList.toggle("live-on", o > .6);
    });
    if (media) media.style.transform = `scale(${1.18 - p * .18}) translate3d(${(p - .5) * -3}%,0,0)`;
    if (img) img.classList.toggle("colour", p > .78);
    shade.style.opacity = 1 - range(p, .1, .3) * .25 + range(p, .82, .95) * .25;
    let idx = phases.findIndex(ph => p < +ph.dataset.to); if (idx < 0) idx = steps - 1;
    hudNum.textContent = String(idx + 1).padStart(2, "0") + "/" + String(steps).padStart(2, "0");
    hudBar.style.transform = `scaleX(${p})`;
    if (cue) cue.style.opacity = 1 - range(p, 0, .06);
  });

  // STATEMENT: words light up as you read
  scene($("#statementSec"), "flow", p => { const n = Math.round(range(p, .2, .62) * stWords.length); stWords.forEach((w, i) => w.classList.toggle("lit", i < n)); });

  // PAIN POINTS (Daily Wins): tick in one by one with scroll
  const pains = $$(".pains li");
  scene($(".p-state"), "flow", p => { const n = Math.round(range(p, .2, .55) * pains.length); pains.forEach((li, i) => li.classList.toggle("on", i < n)); });

  // PLANS: cards rise in a wave
  const planEls = $$(".plan");
  scene($("#plans"), "flow", p => planEls.forEach((c, i) => {
    const k = ease(range(p, .08 + i * .04, .3 + i * .04));
    c.style.transform = `translate3d(0,${(1 - k) * 90}px,0) rotate(${(1 - k) * (i % 2 ? 2 : -2)}deg)`;
    c.style.opacity = .15 + k * .85;
  }));

  // WHAT'S INCLUDED: pins and steps through 01 → 03
  const howItems = $$("#howList li"), howNum = $("#howNum"), howBar = $("#howBar"), howImg = $("#howImg");
  scene($("#how"), "pin", p => {
    const idx = Math.min(howItems.length - 1, Math.floor(p * howItems.length * .999));
    howItems.forEach((li, i) => { li.classList.toggle("on", i === idx); li.classList.toggle("done", i < idx); });
    howNum.textContent = String(idx + 1).padStart(2, "0");
    howBar.style.transform = `scaleX(${p})`;
    if (howImg) howImg.style.transform = `scale(${1.15 - p * .15})`;
  });

  // QUOTE + CLOSING
  const quoteBg = $("#quoteBg");
  scene($(".quote"), "flow", p => quoteBg.style.transform = `translate3d(0,${(p - .5) * 22}%,0)`);
  const closing = $$("#closingT span");
  scene($("#closing"), "flow", p => closing.forEach((s, i) => s.style.transform = `translate3d(${(i % 2 ? 1 : -1) * (p - .55) * 30}vw,0,0)`));

  /* frame loop */
  const nav = $("#nav"), prog = $("#progress"), wa = $("#wa"), mq = $("#mq");
  let lastY = scrollY, mqX = 0, mqDir = -1, mqBoost = 0;
  function frame() {
    const y = scrollY, dy = y - lastY, h = innerHeight;
    const k = reduce ? 1 : (COARSE ? .38 : .24);
    scenes.forEach(s => {
      const r = s.el.getBoundingClientRect();
      const tgt = s.kind === "pin" ? clamp(-r.top / Math.max(1, r.height - h)) : clamp((h - r.top) / (h + r.height));
      const vis = r.bottom > -h * .5 && r.top < h * 1.5;
      if (s.cur === null) s.cur = tgt;
      const d = tgt - s.cur; s.cur = Math.abs(d) < .0003 ? tgt : s.cur + d * k;
      if (s.cur !== s.last && (vis || s.last === undefined || Math.abs(s.cur - s.last) > .001)) { s.fn(s.cur); s.last = s.cur; }
    });
    nav.classList.toggle("solid", y > 60);
    if (Math.abs(dy) > 2) nav.classList.toggle("hide", dy > 0 && y > 500 && !menu.classList.contains("open"));
    const max = document.documentElement.scrollHeight - h;
    prog.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (wa) wa.classList.toggle("show", y > film.offsetHeight - h);
    if (dy) { mqDir = dy > 0 ? -1 : 1; mqBoost = Math.min(Math.abs(dy) * .5, 22); }
    mqBoost *= .92;
    if (!reduce && mq && mq.scrollWidth) { const half = mq.scrollWidth / 2; mqX += mqDir * (1 + mqBoost); if (mqX <= -half) mqX += half; if (mqX > 0) mqX -= half; mq.style.transform = `translate3d(${mqX}px,0,0)`; }
    lastY = y;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
