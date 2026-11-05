/* =========================================================
   Built For Life — site behaviour (no libraries)
   ========================================================= */

/* ---------- THE SCROLL FILM ----------
   Scroll down = the film plays forwards. Scroll up = it plays backwards.

   Two segments from Jory's own footage, joined with a quick red flash:
     1. Cable flys (his IMG_4429 clip, trimmed to the steady reps)
     2. Jory smiling at the camera (from his welcome video), slowed so it holds
   "share" = how much of the scroll each segment gets (they add up to 1).
   "start"/"end" = which seconds of each file are used (null = to the end).
   To swap in a new clip, run tools/make-scroll-film.sh on it. */
const FILM = {
  frames: null,            // optional image sequence, e.g. { path: "assets/film/frame_", digits: 4, ext: ".jpg", count: 150 }
  mobileFrames: null,
  segments: [
    {
      share: .8,           // Jory's cable flys
      videos: ["assets/film.mp4"],
      mobileVideos: ["assets/film-mobile.mp4"],
      start: 0, end: null
    },
    {
      share: .2,           // red flash, then Jory smiling at the camera
      videos: ["assets/smile.mp4"],
      mobileVideos: ["assets/smile-mobile.mp4"],
      start: 0, end: null
    }
  ],
  reps: 4                  // reps shown in the film (for the REP counter)
};

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COARSE = matchMedia("(pointer:coarse)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const isPhone = () => innerWidth < 760;
  $("#yr").textContent = new Date().getFullYear();

  /* =========================================================
     FILM PLAYER (video or image sequence), scrubbed by scroll
     ========================================================= */
  const film = $("#film"), video = $("#filmVideo"), canvas = $("#filmCanvas"), poster = $("#filmPoster");
  const player = { ready: false, duration: 0, set() {} };

  function startFrames(cfg) {
    const ctx = canvas.getContext("2d"), imgs = new Array(cfg.count), loaded = new Array(cfg.count).fill(false);
    const url = i => cfg.path + String(i + 1).padStart(cfg.digits || 4, "0") + (cfg.ext || ".jpg");
    // load the first frame, then a spread of frames, then fill the gaps, so scrubbing works early
    const order = []; const seen = new Set();
    for (const step of [cfg.count, 16, 8, 4, 2, 1]) for (let i = 0; i < cfg.count; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    let active = 0;
    const next = () => { while (active < 6 && order.length) { const i = order.shift(); active++; const im = new Image(); im.decoding = "async";
      im.onload = () => { loaded[i] = true; imgs[i] = im; active--; if (i === 0) { player.ready = true; canvas.classList.add("on"); film.classList.add("ready"); draw(lastIdx, true); } next(); };
      im.onerror = () => { active--; next(); }; im.src = url(i); } };
    let lastIdx = -1, cw = 0, ch = 0;
    function size() { const dpr = Math.min(devicePixelRatio || 1, 2); cw = canvas.width = Math.round(canvas.clientWidth * dpr); ch = canvas.height = Math.round(canvas.clientHeight * dpr); draw(lastIdx, true); }
    function nearest(i) { for (let d = 0; d < cfg.count; d++) { if (loaded[i - d]) return i - d; if (loaded[i + d]) return i + d; } return -1; }
    function draw(i, force) {
      if (i < 0) i = 0; const n = nearest(i); if (n < 0 || (!force && n === lastIdx)) return; lastIdx = n;
      const im = imgs[n], s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    }
    addEventListener("resize", size); size(); next();
    player.duration = cfg.count / 25;
    player.set = p => draw(Math.round(p * (cfg.count - 1)));
  }

  function startVideos(segs) {
    const flash = document.createElement("div"); flash.className = "film-flash"; video.after(flash);
    const live = segs.map((seg, n) => {
      const el = n === 0 ? video : video.cloneNode(false);
      if (n) { el.removeAttribute("id"); video.parentNode.insertBefore(el, flash); }
      if (seg.grade) el.classList.add("graded");
      const S = { seg, el, ready: false, dur: 0, want: seg.start || 0 };
      const list = [...(isPhone() && seg.mobileVideos ? seg.mobileVideos : []), ...seg.videos];
      let k = 0;
      const tryNext = () => {
        if (k >= list.length) return;
        const src = list[k++];
        const sameSite = !/^https?:/i.test(src) || src.startsWith(location.origin);
        if (sameSite && location.protocol.startsWith("http") && window.fetch) {
          // download local clips whole, so seeking is instant in both directions on any host
          fetch(src).then(r => { if (!r.ok) throw 0; return r.blob(); }).then(bl => { el.src = URL.createObjectURL(bl); el.load(); }).catch(tryNext);
        } else if (sameSite) { el.src = src; el.load(); } // opened straight from the folder
        else { el.src = src; el.load(); }
      };
      el.addEventListener("error", () => tryNext());
      el.addEventListener("loadedmetadata", () => {
        const end = Math.min(seg.end ?? el.duration, el.duration);
        S.dur = Math.max(.1, end - (seg.start || 0));
        el.currentTime = (seg.start || 0) + .001;
        const p = el.play(); if (p && p.then) p.then(() => el.pause()).catch(() => {});
      });
      el.addEventListener("loadeddata", () => { S.ready = true; if (n === 0) film.classList.add("ready"); }, { once: true });
      tryNext();
      return S;
    });
    addEventListener("touchstart", () => live.forEach(S => { const p = S.el.play(); if (p && p.then) p.then(() => S.el.pause()).catch(() => {}); }), { once: true, passive: true });

    const total = segs.reduce((a, s) => a + s.share, 0);
    let active = -1;
    player.duration = 0;
    player.set = p => {
      let a = 0;
      live.forEach((S, i) => {
        const share = S.seg.share / total, b = a + share, last = i === live.length - 1;
        const inSeg = p >= a && (p < b || last);
        if (inSeg) {
          S.want = (S.seg.start || 0) + clamp((p - a) / share) * S.dur;
          if (active !== i) { active = i; live.forEach((x, j) => x.el.classList.toggle("on", j === i)); }
        }
        if (!last) {
          // red flash right on the cut
          const d = Math.abs(p - b);
          if (d < .03) flash.style.opacity = (1 - d / .03) * .9;
          else if (active === i || active === i + 1) flash.style.opacity = 0;
        }
        a = b;
      });
      player.duration = live.reduce((x, S) => x + S.dur, 0);
    };
    (function seekLoop() {
      live.forEach(S => { if (S.ready && !S.el.seeking && Math.abs(S.el.currentTime - S.want) > 1 / 50) { try { S.el.currentTime = S.want; } catch (e) {} } });
      requestAnimationFrame(seekLoop);
    })();
  }

  const frameCfg = isPhone() && FILM.mobileFrames ? FILM.mobileFrames : FILM.frames;
  if (frameCfg) startFrames(frameCfg);
  else startVideos(FILM.segments);

  /* ---------- menu + anchors ---------- */
  const menuBtn = $("#menuBtn"), menu = $("#menu");
  function setMenu(open) { menu.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open); menu.setAttribute("aria-hidden", !open); document.body.style.overflow = open ? "hidden" : ""; }
  menuBtn.onclick = () => setMenu(!menu.classList.contains("open"));
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const h = a.getAttribute("href"); if (h.length < 2) return;
    const el = $(h); if (!el) return;
    e.preventDefault(); setMenu(false);
    const pinned = ["#how"].includes(h);
    scrollTo({ top: el.getBoundingClientRect().top + scrollY + (pinned ? 2 : -60), behavior: reduce ? "auto" : "smooth" });
    if (a.dataset.pick) { const r = $(`#pills input[value="${a.dataset.pick}"]`); if (r) r.checked = true; }
  });

  /* ---------- split headings + statement words ---------- */
  function wrapWords(el, make) {
    Array.from(el.childNodes).forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(part => { if (part) el.insertBefore(/^\s+$/.test(part) ? document.createTextNode(" ") : make(document.createTextNode(part)), n); });
        el.removeChild(n);
      } else if (n.nodeType === 1 && (n.tagName === "EM" && el.id === "statement")) wrapWords(n, make);
      else if (n.nodeType === 1 && n.tagName === "EM") wrapWords(n, make);
      else if (n.nodeType === 1 && n.tagName !== "BR") el.replaceChild(make(n.cloneNode(true)), n);
    });
  }
  $$(".split").forEach(h => {
    wrapWords(h, node => { const o = document.createElement("span"), i = document.createElement("span"); o.className = "wd"; i.appendChild(node); o.appendChild(i); return o; });
    $$(".wd>span", h).forEach((s, i) => s.style.transitionDelay = i * 60 + "ms");
  });
  const stEl = $("#statement");
  wrapWords(stEl, node => { const s = document.createElement("span"); s.className = "sw"; s.appendChild(node); return s; });
  const stWords = $$(".sw", stEl);

  /* ---------- reveal on enter ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -10% 0px" });
    $$(".reveal,.split").forEach(el => io.observe(el));
    $$(".rs").forEach((el, i) => { el.style.transitionDelay = (i % 3) * 110 + "ms"; io.observe(el); });
  } else $$(".reveal,.split,.rs").forEach(el => el.classList.add("in"));


  /* ---------- ADVERT: Jory's welcome video ----------
     Plays muted on a loop when it scrolls into view and pauses when it leaves.
     "Watch with sound" restarts it from the top with sound; at the end it shows a call to action. */
  const adCard = $("#adCard"), adVid = $("#adVideo");
  if (adCard && adVid) {
    const adBar = $("#adBar"), adTime = $("#adTime"), adEnd = $("#adEnd"), adPlayIcon = $("#adPlayIcon"), adWaves = $("#adMuteWaves");
    const fmt = t => Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
    let inView = false, userPaused = false;
    const setIcons = () => {
      adPlayIcon.setAttribute("d", adVid.paused ? "M8 5l11 7-11 7z" : "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z");
      $("#adPlay").setAttribute("aria-label", adVid.paused ? "Play" : "Pause");
      adWaves.style.display = adVid.muted ? "none" : "";
      $("#adMute").setAttribute("aria-label", adVid.muted ? "Unmute" : "Mute");
    };
    const tryPlay = () => { const p = adVid.play(); if (p && p.catch) p.catch(() => {}); };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(es => es.forEach(en => {
        inView = en.intersectionRatio > .45;
        if (inView && !userPaused && adEnd.hidden) tryPlay(); else if (!inView) adVid.pause();
      }), { threshold: [0, .45, .8] }).observe(adCard);
    }
    function withSound() {
      adVid.muted = false; adVid.loop = false; adVid.currentTime = 0; adEnd.hidden = true; userPaused = false; adCard.classList.remove("ended");
      adCard.classList.add("on"); tryPlay(); setIcons();
    }
    $("#adSound").onclick = withSound;
    $("#adReplay").onclick = withSound;
    $("#adPlay").onclick = () => { if (adVid.paused) { userPaused = false; tryPlay(); } else { userPaused = true; adVid.pause(); } };
    $("#adMute").onclick = () => { if (adVid.muted && !adCard.classList.contains("on")) return withSound(); adVid.muted = !adVid.muted; setIcons(); };
    adVid.addEventListener("click", () => { if (!adCard.classList.contains("on")) return withSound(); $("#adPlay").click(); });
    $("#adBarWrap").addEventListener("click", e => { const r = e.currentTarget.getBoundingClientRect(); if (adVid.duration) adVid.currentTime = (e.clientX - r.left) / r.width * adVid.duration; });
    adVid.addEventListener("timeupdate", () => { const d = adVid.duration || 48; adBar.style.transform = `scaleX(${adVid.currentTime / d})`; adTime.textContent = fmt(adVid.currentTime) + " / " + fmt(d); });
    ["play", "pause", "volumechange"].forEach(ev => adVid.addEventListener(ev, setIcons));
    adVid.addEventListener("ended", () => { if (!adVid.loop) { adEnd.hidden = false; adCard.classList.remove("on"); adCard.classList.add("ended"); } });
    setIcons();
  }

  /* ---------- arriving from a programme page: pre-select it in the form ---------- */
  try { const pick = new URLSearchParams(location.search).get("pick"); if (pick) { const r = $(`#pills input[value="${pick.replace(/"/g, "")}"]`); if (r) r.checked = true; } } catch (e) {}

  /* ---------- form → WhatsApp / email ---------- */
  const form = $("#form"), err = $("#err");
  function message() {
    const goal = (form.querySelector('input[name="goal"]:checked') || {}).value || "Not sure yet";
    const lines = [`Hi Jory, I'd like a free consultation.`, ``, `Name: ${$("#fName").value.trim()}`, `Mobile: ${$("#fPhone").value.trim()}`];
    if ($("#fEmail").value.trim()) lines.push(`Email: ${$("#fEmail").value.trim()}`);
    lines.push(`Interested in: ${goal}`);
    if ($("#fMsg").value.trim()) lines.push(``, $("#fMsg").value.trim());
    return lines.join("\n");
  }
  function valid() {
    err.textContent = ""; $$(".f", form).forEach(f => f.classList.remove("bad"));
    const bad = [];
    if ($("#fName").value.trim().length < 2) bad.push("#fName");
    if ($("#fPhone").value.replace(/\D/g, "").length < 10) bad.push("#fPhone");
    const em = $("#fEmail").value.trim(); if (em && !/^\S+@\S+\.\S+$/.test(em)) bad.push("#fEmail");
    bad.forEach(id => $(id).parentElement.classList.add("bad"));
    if (bad.length) { err.textContent = "Please add your name and a mobile number we can reach you on."; $(bad[0]).focus(); return false; }
    return true;
  }
  function openLink(href) { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
  form.addEventListener("submit", e => {
    e.preventDefault(); if (!valid()) return;
    openLink("https://wa.me/447734432205?text=" + encodeURIComponent(message()));
    $("#sent").hidden = false;
  });
  $("#mailLink").addEventListener("click", e => {
    e.preventDefault(); if (!valid()) return;
    location.href = "mailto:hello@builtforlife.uk?subject=" + encodeURIComponent("Free consultation") + "&body=" + encodeURIComponent(message());
  });

  /* =========================================================
     SCROLL ENGINE: each scene gets a 0→1 progress, eased per frame
     ========================================================= */
  const scenes = [];
  const scene = (el, kind, fn) => el && scenes.push({ el, kind, fn, cur: null, tgt: 0 });
  const vh = () => innerHeight;

  // FILM
  const phases = $$(".phase"), shade = $("#filmShade"), hudRep = $("#hudRep"), hudBar = $("#hudBar"), hudTime = $("#hudTime"), rewind = $("#rewind"), cue = $("#cue");
  let filmDir = 1, rewindTimer = 0;
  scene(film, "pin", p => {
    player.set(p);
    phases.forEach(ph => {
      const a = +ph.dataset.from, b = +ph.dataset.to, w = (b - a) * .28;
      const inK = a === 0 ? 1 : ease(range(p, a, a + w)), outK = b > 1 ? 0 : range(p, b - w, b);
      const o = Math.min(inK, 1 - outK);
      ph.style.opacity = o;
      ph.style.transform = `translate3d(0,${(1 - inK) * 70 - outK * 70}px,0)`;
      ph.classList.toggle("live-on", o > .6);
    });
    shade.style.opacity = 1 - range(p, .1, .3) * .25 + range(p, .82, .95) * .25;
    const repSpan = FILM.segments && FILM.segments.length > 1 && !FILM.frames ? FILM.segments[0].share / FILM.segments.reduce((a, x) => a + x.share, 0) : 1;
    hudRep.textContent = String(Math.min(FILM.reps, Math.floor(p / repSpan * FILM.reps + (p > .02 ? 1 : 0)))).padStart(2, "0");
    hudBar.style.transform = `scaleX(${p})`;
    const t = p * (player.duration || 0); hudTime.textContent = "00:" + (t < 10 ? "0" : "") + t.toFixed(1);
    if (cue) cue.style.opacity = 1 - range(p, 0, .06);
  });

  // ADVERT: the video card pops up from small as it scrolls in
  const adCardEl = $("#adCard");
  scene($("#advert"), "flow", p => {
    if (!adCardEl) return;
    const k = ease(range(p, .05, .38));
    adCardEl.style.transform = `translate3d(0,${(1 - k) * 80}px,0) scale(${.72 + k * .28}) rotate(${(1 - k) * -2.5}deg)`;
    adCardEl.style.opacity = .25 + k * .75;
    adCardEl.style.clipPath = `inset(${(1 - k) * 8}% ${(1 - k) * 8}% ${(1 - k) * 8}% ${(1 - k) * 8}% round ${(1 - k) * 28}px)`;
  });

  // STATEMENT
  scene($("#statementSec"), "flow", p => { const n = Math.round(range(p, .2, .62) * stWords.length); stWords.forEach((w, i) => w.classList.toggle("lit", i < n)); });

  // ABOUT
  const aboutClip = $("#aboutClip"), aboutImg = $("#aboutImg");
  scene($("#about"), "flow", p => {
    const k = ease(range(p, .05, .45)), i = (1 - k) * 15;
    aboutClip.style.clipPath = `polygon(${i}% ${i}%,${100 - i}% ${i}%,${100 - i}% ${100 - i}%,${i}% ${100 - i}%)`;
    aboutImg.style.transform = `translate3d(0,${(p - .5) * -16}%,0)`;
  });

  // PROGRAMMES: card photos drift inside their frames
  const pgImgs = $$(".pg-img img");
  scene($("#programmes"), "flow", p => pgImgs.forEach((im, i) => im.style.transform = `translate3d(0,${(p - .5) * -(10 + i * 4)}%,0)`));

  // RESULTS parallax
  const rsImgs = $$(".rs img");
  scene($("#results"), "flow", p => rsImgs.forEach((im, i) => im.style.transform = `translate3d(0,${(p - .5) * -(8 + (i % 3) * 5)}%,0)`));

  // HOW IT WORKS
  const howItems = $$("#howList li"), howNum = $("#howNum"), howBar = $("#howBar");
  scene($("#how"), "pin", p => {
    const idx = Math.min(howItems.length - 1, Math.floor(p * howItems.length * .999));
    howItems.forEach((li, i) => { li.classList.toggle("on", i === idx); li.classList.toggle("done", i < idx); });
    howNum.textContent = String(idx + 1).padStart(2, "0");
    howBar.style.transform = `scaleX(${p})`;
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
    const y = scrollY, dy = y - lastY, h = vh();
    const k = reduce ? 1 : (COARSE ? .38 : .24);
    scenes.forEach(s => {
      const r = s.el.getBoundingClientRect();
      s.tgt = s.kind === "pin" ? clamp(-r.top / Math.max(1, r.height - h)) : clamp((h - r.top) / (h + r.height));
      const vis = r.bottom > -h * .5 && r.top < h * 1.5;
      if (s.cur === null) s.cur = s.tgt;
      const d = s.tgt - s.cur; s.cur = Math.abs(d) < .0003 ? s.tgt : s.cur + d * k;
      if (s.cur !== s.last && (vis || s.last === undefined || Math.abs(s.cur - s.last) > .001)) { s.fn(s.cur); s.last = s.cur; }
    });
    // rewind badge while scrolling up through the film
    const fr = film.getBoundingClientRect();
    if (dy < -1 && fr.top <= 0 && fr.bottom > h) { rewind.classList.add("on"); clearTimeout(rewindTimer); rewindTimer = setTimeout(() => rewind.classList.remove("on"), 280); }
    nav.classList.toggle("solid", y > 60);
    if (Math.abs(dy) > 2) nav.classList.toggle("hide", dy > 0 && y > 500 && !menu.classList.contains("open"));
    const max = document.documentElement.scrollHeight - h;
    prog.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    wa.classList.toggle("show", y > fr.height - h);
    if (dy) { mqDir = dy > 0 ? -1 : 1; mqBoost = Math.min(Math.abs(dy) * .5, 22); }
    mqBoost *= .92;
    if (!reduce && mq.scrollWidth) { const half = mq.scrollWidth / 2; mqX += mqDir * (1 + mqBoost); if (mqX <= -half) mqX += half; if (mqX > 0) mqX -= half; mq.style.transform = `translate3d(${mqX}px,0,0)`; }
    lastY = y;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
