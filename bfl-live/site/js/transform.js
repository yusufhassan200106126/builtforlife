/* =========================================================
   Built For Life — "Future You"
   One question per screen → body scan → time machine result.
   Lead saving is unchanged (BFL.addLead) so the coach panel sees it.
   ========================================================= */
window.BFL.ready.then(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const B = window.BFL, M = window.BFLMorph;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COARSE = matchMedia("(pointer:coarse)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const val = n => ($(`input[name="${n}"]:checked`) || {}).value;
  const stone = kg => { const lb = Math.round(kg * 2.20462); return `${Math.floor(lb / 14)}st ${lb % 14}lb`; };
  const feet = cm => { const i = Math.round(cm / 2.54); return `${Math.floor(i / 12)}ft ${i % 12}in`; };
  const fmt = v => (Math.round(v * 10) / 10).toString();
  $("#yr").textContent = new Date().getFullYear();

  /* ---------- split headings into animated words ---------- */
  function wrapWords(root) {
    let n = 0;
    (function walk(el) {
      Array.from(el.childNodes).forEach(node => {
        if (node.nodeType === 3) {
          const parts = node.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span"); w.className = "w"; w.style.setProperty("--w", n++);
            const s = document.createElement("span"); s.textContent = p; w.appendChild(s); frag.appendChild(w);
          });
          node.replaceWith(frag);
        } else if (node.nodeType === 1 && !node.classList.contains("nm")) walk(node);
      });
    })(root);
  }
  $$(".sc .q").forEach(wrapWords);
  $$(".sc").forEach(sc => Array.from(sc.children).forEach((c, i) => c.style.setProperty("--i", i)));

  /* ---------- living background ---------- */
  const glow = $("#glow"); let gx = innerWidth / 2, gy = innerHeight * .4, tx = gx, ty = gy;
  addEventListener("pointermove", e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  if (!reduce) (function bg(now) {
    if (COARSE) { tx = innerWidth * (.5 + .3 * Math.sin(now / 3200)); ty = innerHeight * (.45 + .2 * Math.cos(now / 2700)); }
    gx += (tx - gx) * .06; gy += (ty - gy) * .06;
    glow.style.transform = `translate3d(${gx}px,${gy}px,0)`;
    requestAnimationFrame(bg);
  })(0);

  /* ---------- barbell progress ---------- */
  const PL = [{ w: 15, h: 72, c: "r", kg: 25 }, { w: 13, h: 64, c: "r", kg: 20 }, { w: 11, h: 52, c: "k", kg: 15 }, { w: 9, h: 40, c: "r", kg: 10 }, { w: 7, h: 30, c: "k", kg: 5 }];
  const platesG = $("#plates"), bbKg = $("#bbKg"); let kgShown = 20;
  function plateEl(i) {
    const side = i % 2, slot = i >> 1, p = PL[slot];
    let off = 2; for (let s = 0; s < slot; s++) off += PL[s].w + 2;
    const x = side ? 320 + off : 100 - off - p.w;
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", x); r.setAttribute("y", 40 - p.h / 2); r.setAttribute("width", p.w); r.setAttribute("height", p.h); r.setAttribute("rx", 2);
    r.setAttribute("class", "pl " + p.c); r.style.setProperty("--from", side ? "60px" : "-60px");
    return r;
  }
  function setPlates(n) {
    while (platesG.children.length > n) platesG.lastChild.remove();
    while (platesG.children.length < n) platesG.appendChild(plateEl(platesG.children.length));
    let kg = 20; for (let i = 0; i < n; i++) kg += PL[i >> 1].kg;
    const from = kgShown, t0 = performance.now(); kgShown = kg;
    (function f(now) { const p = Math.min(1, (now - t0) / 500); bbKg.textContent = Math.round(from + (kg - from) * easeOut(p)); if (p < 1) requestAnimationFrame(f); })(t0);
  }

  /* ---------- screens ---------- */
  let rH, rW, rT, rulers = [], lastDelta = null;
  const form = $("#fy"), scs = $$(".sc"), N = scs.length, err = $("#tfErr"), ghost = $("#ghost"), ctl = $("#fyCtl");
  let step = 0, photo = null, busy = false;
  function go(n, dir = 1) {
    if (n === step && scs[n].classList.contains("on")) return;
    const old = scs[step];
    old.classList.remove("on", "back"); old.classList.add("out"); old.classList.toggle("back", dir < 0);
    setTimeout(() => old.classList.remove("out", "back"), 460);
    step = n;
    const cur = scs[n]; cur.classList.toggle("back", dir < 0); cur.classList.add("on");
    ghost.classList.add("swap"); ghost.textContent = String(n).padStart(2, "0"); void ghost.offsetWidth; ghost.classList.remove("swap");
    ctl.classList.toggle("intro-mode", n === 0);
    $("#fyCount").innerHTML = n ? `<b>${String(n).padStart(2, "0")}</b> / ${N - 1}` : "";
    $("#tfBack").disabled = n <= 1;
    $("#tfNext span").textContent = n === N - 1 ? "Meet future me" : "Next";
    err.textContent = "";
    setPlates(Math.max(0, n - 1));
    if (n === 3) $(".nm").textContent = $("#fName").value.trim() ? ", " + $("#fName").value.trim().split(" ")[0] : "";
    if (n === 6) syncTarget(true);
    rulers.forEach(r => r.size());
    scrollTo(0, 0);
    const first = $("input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=range])", cur);
    if (first && !COARSE && n !== 4 && n !== 5 && n !== 6) setTimeout(() => first.focus({ preventScroll: true }), 420);
  }
  $("#tfBack").onclick = () => { if (step > 1) go(step - 1, -1); };

  // programme picks advance on their own
  const syncProg = () => { $("#wedWrap").hidden = val("programme") !== "Bridal Bootcamp"; };
  $$('input[name="programme"]').forEach(r => {
    r.addEventListener("change", syncProg);
    // tapping a card (even the one already picked) moves on
    r.addEventListener("click", () => { syncProg(); if (step === 1) { clearTimeout(progT); progT = setTimeout(() => step === 1 && go(2), 450); } });
  });
  let progT = 0;
  try { const pick = new URLSearchParams(location.search).get("programme"); if (pick) { const r = $(`input[name="programme"][value="${pick.replace(/"/g, "")}"]`); if (r) r.checked = true; } } catch (e) {}
  syncProg();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  $("#fWed").min = today.toISOString().slice(0, 10);

  // card tilt
  if (!COARSE && !reduce) $$(".prog").forEach(p => {
    const inn = $(".prog-in", p);
    p.addEventListener("pointermove", e => { const r = p.getBoundingClientRect(); inn.style.setProperty("--ry", ((e.clientX - r.left) / r.width - .5) * 14 + "deg"); inn.style.setProperty("--rx", -((e.clientY - r.top) / r.height - .5) * 14 + "deg"); });
    p.addEventListener("pointerleave", () => { inn.style.setProperty("--rx", "0deg"); inn.style.setProperty("--ry", "0deg"); });
  });

  // age stepper + sex default height/weight
  $$("[data-age]").forEach(b => b.onclick = () => { const a = $("#fAge"); a.value = clamp((+a.value || 35) + +b.dataset.age, 16, 90); });
  $$('input[name="sex"]').forEach(r => r.addEventListener("change", () => {
    if (!rulers[0].touched) rulers[0].set(r.value === "Male" ? 178 : 165, true);
    if (!rulers[1].touched) rulers[1].set(r.value === "Male" ? 88 : 72, true);
  }));

  // sleep
  const sleepSync = () => { const v = +$("#fSleep").value; $("#sleepOut").textContent = `${v} hrs`; $("#moonFill").style.transform = `scaleX(${(v - 4) / 6})`; };
  $("#fSleep").addEventListener("input", sleepSync); sleepSync();

  /* ---------- tape-measure rulers ---------- */
  function Ruler(wrap, opt) {
    const input = $("input", wrap), ruler = $(".ruler", wrap), tape = $(".tape", wrap);
    const R = { input, touched: false, min: opt.min, max: opt.max, lo: opt.min, hi: opt.max, px: opt.px, step: opt.step, shown: +input.value, target: +input.value };
    let html = "";
    for (let v = opt.min; v <= opt.max; v++) {
      const cls = v % 10 === 0 ? "m10" : v % 5 === 0 ? "m5" : "";
      html += `<i class="${cls}" style="left:${(v - opt.min) * opt.px}px"></i>`;
      if (v % 10 === 0) html += `<b style="left:${(v - opt.min) * opt.px}px">${v}</b>`;
    }
    tape.innerHTML = html;
    R.pos = v => (v - opt.min) * opt.px;
    R.size = () => {};
    R.render = () => { tape.style.transform = `translate3d(${-R.pos(R.shown)}px,0,0)`; };
    R.fit = () => { const s = input.value || ""; input.style.width = Math.max(2, s.replace(".", "").length + (s.includes(".") ? .4 : 0)) + .15 + "ch"; };
    input.addEventListener("input", R.fit);
    R.set = (v, fromCode) => {
      v = clamp(Math.round(v / opt.step) * opt.step, R.lo, R.hi);
      R.target = v; if (document.activeElement !== input || fromCode) { input.value = fmt(v); R.fit(); }
      if (fromCode === "snap") R.shown = v;
      wake(); opt.onChange && opt.onChange(v);
    };
    // drag with momentum
    let sx = 0, sv = 0, vel = 0, lx = 0, lt = 0, dragging = false;
    ruler.addEventListener("pointerdown", e => { dragging = true; R.touched = true; ruler.setPointerCapture(e.pointerId); ruler.classList.add("drag"); sx = lx = e.clientX; lt = performance.now(); sv = R.target; vel = 0; input.blur(); });
    ruler.addEventListener("pointermove", e => {
      if (!dragging) return;
      const now = performance.now(); vel = (e.clientX - lx) / Math.max(1, now - lt); lx = e.clientX; lt = now;
      R.set(sv - (e.clientX - sx) / opt.px); R.shown = R.target; R.render();
    });
    const up = () => {
      if (!dragging) return; dragging = false; ruler.classList.remove("drag");
      if (reduce) return;
      let v = vel * 16; (function coast() { v *= .92; if (Math.abs(v) < .2) return; R.set(R.target - v / opt.px); R.shown = R.target; R.render(); requestAnimationFrame(coast); })();
    };
    ruler.addEventListener("pointerup", up); ruler.addEventListener("pointercancel", up);
    ruler.addEventListener("wheel", e => { e.preventDefault(); R.touched = true; R.set(R.target + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / opt.px * .5); }, { passive: false });
    input.addEventListener("input", () => { const v = parseFloat(input.value); R.touched = true; if (v >= R.lo && v <= R.hi) R.set(v); });
    input.addEventListener("blur", () => { input.value = fmt(R.target); R.fit(); });
    R.render(); R.fit(); opt.onChange && opt.onChange(R.target);
    return R;
  }
  let raf = 0;
  function wake() { if (!raf) raf = requestAnimationFrame(tickRulers); }
  function tickRulers() {
    raf = 0; let moving = false;
    rulers.forEach(r => { const d = r.target - r.shown; if (Math.abs(d) > .01) { r.shown += d * (reduce ? 1 : .2); moving = true; } else r.shown = r.target; r.render(); });
    if (moving) raf = requestAnimationFrame(tickRulers);
  }
  rH = Ruler($('[data-for="fHeight"]'), { min: 120, max: 230, step: 1, px: 16, onChange: v => { $("#hAlt").textContent = feet(v); } });
  rW = Ruler($('[data-for="fWeight"]'), { min: 35, max: 250, step: .5, px: 14, onChange: v => { $("#wAlt").textContent = stone(v); } });
  rT = Ruler($('[data-for="fTarget"]'), { min: 35, max: 250, step: .5, px: 14, onChange: () => syncTarget() });
  rulers = [rH, rW, rT];
  rT.input.addEventListener("input", () => { rT.touched = true; });
  // the "now" marker lives on the target tape
  const nowMark = $("#nowMark"); $('[data-for="fTarget"] .tape').appendChild(nowMark); syncTarget();

  // healthy target range
  function syncTarget(enter) {
    if (!rT || !rW || !rH) return;
    const w = rW.target, h = rH.target / 100, help = $("#tgtHelp"), dEl = $("#tDelta");
    const minHealthy = Math.ceil(18.5 * h * h * 2) / 2;
    rT.lo = Math.min(w, Math.max(minHealthy, Math.round(w * .65 * 2) / 2)); rT.hi = Math.round((w + 10) * 2) / 2;
    nowMark.style.left = rT.pos(w) + "px";
    if (enter && !rT.touched) { rT.set(Math.max(rT.lo, Math.min(w, Math.round(Math.max(w * .9, 21.5 * h * h) * 2) / 2)), true); return; }
    if (rT.target < rT.lo || rT.target > rT.hi) { rT.set(rT.target); return; }
    const t = rT.target, diff = Math.round((w - t) * 10) / 10, bmi = t / (h * h);
    const txt = diff > 0 ? `−${diff} kg` : diff < 0 ? `+${-diff} kg` : "Same weight";
    if (txt !== lastDelta) { dEl.textContent = txt; dEl.classList.remove("pop"); void dEl.offsetWidth; dEl.classList.add("pop"); lastDelta = txt; }
    help.classList.toggle("warn", bmi < 20);
    help.textContent = diff > 0 ? `${stone(t)} · lose ${stone(diff).replace(/^0st /, "")}` : diff < 0 ? `${stone(t)} · build strength and muscle` : `${stone(t)} · same weight, more strength and definition`;
    if (bmi < 20) help.textContent += ". That's the lower end of healthy, so Jory will check it with you.";
  }

  // photo
  $("#fPhoto").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      photo = await M.compress(f, 720);
      const im = $("#photoPrev"); im.hidden = true; im.src = photo; void im.offsetWidth; im.hidden = false; $("#drop").classList.add("has");
      err.textContent = "";
    } catch (x) { err.textContent = "That photo couldn't be opened. Please try a JPG or PNG."; }
  });
  $("#skipPhoto").onclick = () => { photo = null; go(step + 1); };

  /* ---------- validation ---------- */
  function check(n) {
    const bad = (sel, msg) => { const el = $(sel); if (el) { const p = el.closest(".big-f,.f,.age-f,.read") || el.parentElement; p.classList.remove("bad"); void p.offsetWidth; p.classList.add("bad"); el.focus({ preventScroll: true }); } err.textContent = msg; return false; };
    $$(".bad", form).forEach(f => f.classList.remove("bad"));
    if (n === 2 && $("#fName").value.trim().length < 2) return bad("#fName", "Please add your first name.");
    if (n === 3) { const a = +$("#fAge").value; if (!(a >= 16 && a <= 90)) return bad("#fAge", "Please add your age (16 or over)."); }
    if (n === 4 && !(rH.target >= 120 && rH.target <= 230)) return bad("#fHeight", "Please add your height in centimetres.");
    if (n === 5 && !(rW.target >= 35 && rW.target <= 250)) return bad("#fWeight", "Please add your weight in kilograms.");
    if (n === 8 && val("programme") === "Bridal Bootcamp" && !$("#fWed").value) return bad("#fWed", "Please add your wedding date so we can plan around it.");
    if (n === 9 && !photo) { err.textContent = "Add a photo to see future you, or tap “Skip photo”."; return false; }
    if (n === 10) {
      if ($("#fPhone").value.replace(/\D/g, "").length < 10) return bad("#fPhone", "Please add a mobile number Jory can WhatsApp.");
      if (!/^\S+@\S+\.\S+$/.test($("#fEmail").value.trim())) return bad("#fEmail", "Please add a valid email address.");
      if (!$("#fConsent").checked) { err.textContent = "Please tick the box so we can save your plan."; return false; }
    }
    return true;
  }
  form.addEventListener("submit", e => {
    e.preventDefault(); if (busy) return;
    if (!check(step)) return;
    if (step < N - 1) go(step + 1); else finish();
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.shiftKey || busy) return;
    const t = e.target; if (t.closest && t.closest("button,a,textarea,#result")) return;
    if (form.hidden) return;
    e.preventDefault(); form.requestSubmit();
  });
  scs[0].classList.add("on"); ctl.classList.add("intro-mode"); setPlates(0); $("#tfBack").disabled = true; ghost.textContent = "00";

  /* =========================================================
     BUILD: body scan
     ========================================================= */
  const MILESTONES = [
    ["Foundation", "Reset habits, build consistency"],
    ["Activation", "Boost energy, build momentum"],
    ["Transformation", "Fat loss, strength building"],
    ["Definition", "Sculpt physique, increase performance"],
    ["Peak condition", "Peak conditioning"],
    ["Lifestyle", "Sustain results, live your best life"]
  ];
  const weekMarks = L => L <= 6 ? [1, 2, 3, 4, 5, 6] : L <= 12 ? [1, 2, 3, 4, 8, 12] : L <= 26 ? [1, 4, 8, 12, 20, 26] : [1, 8, 16, 26, 39, 52];
  const sleep = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));

  async function finish() {
    busy = true;
    const prog = val("programme"), w = rW.target, t = rT.target;
    const proj = B.project(w, t);
    let weeksAvail = null;
    if (prog === "Bridal Bootcamp") weeksAvail = Math.max(1, Math.floor((new Date($("#fWed").value + "T00:00:00") - today) / 6048e5));
    const plan = B.recommend(prog, proj.weeks, weeksAvail), L = plan.weeks;
    const lostByEnd = Math.min(proj.toLose, proj.perWeek * L), gainByEnd = Math.min(proj.toGain || 0, proj.perWeek * L);
    const endW = Math.round((proj.gain ? w + gainByEnd : w - lostByEnd) * 10) / 10;
    const lead = {
      id: "L" + Date.now().toString(36), created: new Date().toISOString(), status: "new", notes: "",
      name: $("#fName").value.trim(), phone: $("#fPhone").value.trim(), email: $("#fEmail").value.trim(),
      programme: prog, sex: (val("sex") || "").toLowerCase(), age: +$("#fAge").value, height: rH.target, weight: w, target: t,
      days: val("days"), experience: val("experience"), where: val("where"), diet: val("diet"), sleep: +$("#fSleep").value,
      weddingDate: prog === "Bridal Bootcamp" ? $("#fWed").value : null, goal: $("#fGoal").value.trim(),
      plan: plan.name, weeksNeeded: proj.weeks, photo: photo || B.silhouette(prog === "Bridal Bootcamp" ? 340 : 210), noPhoto: !photo
    };
    let aiP = null;
    if (B.live) {
      // live site: save the sign-up on the server (it lands in Jory's panel straight away)
      try {
        const r = await B.submitLead(Object.assign({}, lead, { consent: true }));
        lead.id = r.id; lead.token = r.token;
        try { localStorage.setItem("bfl:lastLead", JSON.stringify({ id: r.id, t: r.token, email: lead.email, at: Date.now() })); } catch (e) {}
      } catch (e) { busy = false; err.textContent = e.message || "We couldn't save your answers. Please check your connection and try again."; return; }
      // ask the AI for the real "future you" photo while the animation plays
      if (!lead.noPhoto && B.cfg.ai) aiP = B.future(lead.id, lead.token).then(r => M.loadImage(r.image)).catch(() => null);
    } else if (!B.addLead(Object.assign({}, lead))) { lead.photo = B.silhouette(10); B.addLead(lead); }
    if (!B.live) try { localStorage.setItem("bfl:lastLead", JSON.stringify({ id: lead.id, email: lead.email, at: Date.now() })); } catch (e) {}
    const img = await M.loadImage(lead.photo);
    const k = lead.noPhoto ? 0.12 : M.strength(w, t);

    // full bar, lift it
    setPlates(10); await sleep(500);
    $(".bb").classList.add("lift"); await sleep(700);
    form.hidden = true; $("#gen").hidden = false; document.body.classList.add("done"); scrollTo(0, 0);

    const gc = $("#genCanvas"), mc = $("#genMesh"), g = gc.getContext("2d"), m = mc.getContext("2d");
    M.draw(g, img, 360, 480, 0, 0);
    // a mesh of points over the body
    const pts = [];
    for (let i = 0; i < 70; i++) {
      const y = 40 + Math.random() * 420, yn = y / 480, band = .3 * (yn < .2 ? .45 : yn < .7 ? 1 : .8);
      pts.push({ x: 180 + (Math.random() * 2 - 1) * 360 * band, y, d: Math.random() });
    }
    pts.sort((a, b) => a.d - b.d);
    const links = pts.map((p, i) => pts.map((q, j) => [j, Math.hypot(p.x - q.x, p.y - q.y)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([j]) => j));
    const log = $("#genLog"), pct = $("#genPct");
    const lines = [
      ["Reading your answers", ""], ["Starting point", `${w} kg`], ["Healthy pace", `${fmt(proj.perWeek)} kg/wk`],
      ["Matching your plan", plan.name], [`Projecting week ${L}`, `${endW} kg`]
    ];
    const dur = reduce ? 300 : 4600, t0 = performance.now(); let shown = 0;
    await new Promise(res => {
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        const want = Math.min(lines.length, Math.floor(p * lines.length * 1.05) + 1);
        while (shown < want) {
          if (log.lastChild) log.lastChild.classList.add("ok");
          const li = document.createElement("li"); li.innerHTML = `<span>${lines[shown][0]}</span><b></b>`; log.appendChild(li);
          const b = $("b", li), v = lines[shown][1]; setTimeout(() => b.textContent = v, 350); shown++;
        }
        pct.textContent = Math.round(p * 100);
        // morph starts in the last third
        M.draw(g, img, 360, 480, easeIO(clamp((p - .62) / .38, 0, 1)), k);
        m.clearRect(0, 0, 360, 480);
        const vis = Math.floor(clamp(p * 1.6, 0, 1) * pts.length), fade = 1 - clamp((p - .85) / .15, 0, 1);
        m.strokeStyle = `rgba(227,36,43,${.55 * fade})`; m.fillStyle = `rgba(242,240,235,${.9 * fade})`; m.lineWidth = 1;
        m.beginPath();
        for (let i = 0; i < vis; i++) links[i].forEach(j => { if (j < vis) { m.moveTo(pts[i].x, pts[i].y); m.lineTo(pts[j].x, pts[j].y); } });
        m.stroke();
        for (let i = 0; i < vis; i++) { m.beginPath(); m.arc(pts[i].x, pts[i].y, 2.2, 0, 7); m.fill(); }
        p < 1 ? requestAnimationFrame(tick) : res();
      })(t0);
    });
    log.lastChild.classList.add("ok");
    if (aiP) {
      // wait for the AI photo (up to ~30s), with a line in the log so it doesn't feel stuck
      const li = document.createElement("li"); li.innerHTML = `<span>Rendering your future photo</span><b>…</b>`; log.appendChild(li);
      const t1 = performance.now(), dots = setInterval(() => { $("b", li).textContent = Math.round((performance.now() - t1) / 1000) + "s"; }, 500);
      const ai = await Promise.race([aiP, new Promise(r => setTimeout(() => r(null), 30000))]);
      clearInterval(dots);
      if (ai) { img.__after = ai; $("b", li).textContent = "Done"; } else $("b", li).textContent = "Preview";
      li.classList.add("ok");
    }
    if (B.live) { const note = $(".stage-note"); if (note) note.textContent = img.__after ? "AI preview of you at your target, made from your photo. It shows a goal, not a guaranteed result." : "Preview of your target. It shows a goal, not a guaranteed result."; }
    await sleep(500);
    const fl = $("#flash"); fl.classList.add("go"); await sleep(160);
    $("#gen").hidden = true; $("#result").hidden = false; $("#foot").hidden = false; scrollTo(0, 0);
    setTimeout(() => fl.classList.remove("go"), 1000);
    renderResult(lead, img, k, proj, plan, endW);
  }

  /* =========================================================
     RESULT: time machine
     ========================================================= */
  function countUp(el, to, dec = 0, dur = 1500) {
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now();
    (function f(n) { const p = Math.min(1, (n - t0) / dur); el.textContent = (to * easeOut(p)).toFixed(dec); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  function onSee(el, fn, th = .25) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { fn(); io.disconnect(); } }), { threshold: th });
    io.observe(el);
  }

  function renderResult(lead, img, k, proj, plan, endW) {
    const L = plan.weeks, w = lead.weight, gain = !!proj.gain, sign = gain ? 1 : -1, loss = Math.abs(endW - w); // "loss" = how much the weight changes
    const kgAt = tt => w + sign * Math.min(loss, proj.perWeek * tt * L);
    $("#rName").textContent = lead.name.split(" ")[0];
    wrapWords($(".res-h"));
    $("#jWeeks").textContent = L;

    // track milestones
    const marks = weekMarks(L);
    $("#trackMarks").innerHTML = marks.map(wk => `<span style="left:${wk / L * 100}%">W${wk}</span>`).join("");
    const markEls = $$("#trackMarks span");

    // reel
    const lostAt = wk => Math.min(loss, proj.perWeek * wk);
    $("#jList").innerHTML = marks.map((wk, i) => {
      const [h, p] = MILESTONES[i], extra = lead.programme === "Bridal Bootcamp" && i === 4 ? ", wedding ready" : "";
      return `<li><canvas width="180" height="240"></canvas><span class="j-kg">${(w + sign * lostAt(wk)).toFixed(1)} kg</span><span class="j-wk">Week ${wk}</span><h4>${h}</h4><p>${p}${extra}</p></li>`;
    }).join("");
    const reelEls = $$("#jList li");
    $$("#jList canvas").forEach((c, i) => M.draw(c.getContext("2d"), img, 180, 240, loss > 0 ? lostAt(marks[i]) / loss : marks[i] / L, k));
    onSee($("#jList"), () => reelEls.forEach((li, i) => setTimeout(() => li.classList.add("in"), i * 110)), .15);

    // stats + chart + ticket
    onSee($(".stats"), () => {
      countUp($("#nNow"), w, w % 1 ? 1 : 0); countUp($("#nTarget"), endW, endW % 1 ? 1 : 0);
      if (gain) $("#nLose").closest(".st").querySelector("span").textContent = "To gain";
      countUp($("#nLose"), loss, 1); countUp($("#nPace"), loss ? proj.perWeek : 0, 1); countUp($("#nWeeks"), loss ? proj.weeks : L);
      drawChart();
    });
    const date = lead.weddingDate ? new Date(lead.weddingDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
    $("#recName").textContent = plan.name;
    $("#tkNo").textContent = "No. " + lead.id.slice(-5).toUpperCase();
    $("#recLen").textContent = L < 26 ? `${L} weeks` : L === 26 ? "6 months" : "12 months";
    $("#recWhy").textContent = lead.programme === "Bridal Bootcamp"
      ? `Your wedding is on ${date}. This plan fits your date and gets you to around ${endW} kg at a healthy, sustainable pace.`
      : gain ? `Adding ${fmt(lead.target - w)} kg of lean muscle at a healthy pace takes about ${proj.weeks} weeks. This plan gives you the training, food and accountability to build it.`
      : loss ? `Losing ${fmt(w - lead.target)} kg at a healthy pace takes about ${proj.weeks} weeks. This plan gives you the time and accountability to get there.`
      : "You want strength and definition rather than weight loss. This plan builds it around your diary.";
    $("#recBuy").href = `checkout.html?plan=${plan.id}&lead=${lead.id}${lead.token ? "&t=" + encodeURIComponent(lead.token) : ""}`;
    const msg = `Hi Jory, I've just met future me on the Built For Life site.\n\nName: ${lead.name}\nProgramme: ${lead.programme}\nNow: ${w} kg, target: ${lead.target} kg\nRecommended: ${plan.name}${date ? `\nWedding: ${date}` : ""}\n\nCan we talk about getting started?`;
    $("#recWa").href = "https://wa.me/447734432205?text=" + encodeURIComponent(msg);
    const tk = $("#rec"); tk.classList.add("rise");
    onSee(tk, () => { tk.classList.add("in"); const pr = $("#recPrice"); if (reduce) { pr.textContent = B.gbp(plan.price); return; } const t0 = performance.now(); (function f(n) { const p = Math.min(1, (n - t0) / 1400); pr.textContent = B.gbp(Math.round(plan.price * easeOut(p))); if (p < 1) requestAnimationFrame(f); else pr.textContent = B.gbp(plan.price); })(t0); });

    let chartPts = null;
    function drawChart() {
      const ch = $("#chart"), W = 400, H = 150, pts = [];
      const minY = Math.min(endW, w) - 2, maxY = Math.max(endW, w) + 2, y = v => 10 + (maxY - v) / (maxY - minY) * (H - 20);
      for (let i = 0; i <= L; i++) pts.push([i / L * (W - 40) + 30, y(kgAt(i / L))]);
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      ch.innerHTML = `<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E3242B" stop-opacity=".35"/><stop offset="1" stop-color="#E3242B" stop-opacity="0"/></linearGradient></defs>
        <line class="grid" x1="30" y1="${y(w)}" x2="${W - 10}" y2="${y(w)}"/><line class="grid" x1="30" y1="${y(endW)}" x2="${W - 10}" y2="${y(endW)}"/>
        <text x="0" y="${y(w) + 4}">${w}</text><text x="0" y="${y(endW) + 4}">${endW}</text>
        <path class="area" d="${d} L${pts[pts.length - 1][0]} ${H} L30 ${H} Z"/>
        <path class="line" id="chLine" d="${d}"/>
        <circle class="dot" cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="5"/>
        <circle class="play" id="chPlay" r="4" cx="30" cy="${pts[0][1]}"/>
        <text x="30" y="${H + 16}">Week 0</text><text x="${W - 10}" y="${H + 16}" text-anchor="end">Week ${L}</text>`;
      const ln = $("#chLine"), len = ln.getTotalLength();
      ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len;
      requestAnimationFrame(() => { ln.style.transition = reduce ? "none" : "stroke-dashoffset 2s cubic-bezier(.22,1,.36,1)"; ln.style.strokeDashoffset = 0; ch.classList.add("in"); });
      chartPts = pts;
    }

    // the time machine
    const cv = $("#morphCanvas"), stage = $("#stage"), dpr = Math.min(devicePixelRatio || 1, 2);
    const size = () => { const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); };
    size(); addEventListener("resize", () => { size(); paint(cur, true); });
    const ctx = cv.getContext("2d"), rng = $("#morphRange"), odoW = $("#odoWeek"), odoK = $("#odoKg"), tag = $("#hudTag"), fill = $("#trackFill");
    let cur = -1, playing = !reduce, t0 = performance.now(), splitOn = false, sp = .5;
    function paint(t, force) {
      if (!force && Math.abs(t - cur) < .0005) return;
      cur = t;
      if (splitOn) {
        M.draw(ctx, img, cv.width, cv.height, 0, k);
        ctx.save(); ctx.beginPath(); ctx.rect(cv.width * sp, 0, cv.width, cv.height); ctx.clip();
        M.draw(ctx, img, cv.width, cv.height, 1, k); ctx.restore();
        $("#split i").style.left = sp * 100 + "%";
        return;
      }
      M.draw(ctx, img, cv.width, cv.height, t, k);
      const wk = Math.round(t * L);
      rng.value = Math.round(t * 1000);
      odoW.textContent = String(wk).padStart(2, "0");
      odoK.textContent = kgAt(t).toFixed(1);
      fill.style.transform = `scaleX(${t})`;
      tag.textContent = t < .02 ? "Now" : t > .98 ? "Future you" : `Week ${wk}`;
      tag.classList.toggle("fut", t > .98);
      let last = -1;
      markEls.forEach((el, i) => { const hit = t * L >= marks[i] - .01; el.classList.toggle("hit", hit); if (hit) last = i; });
      reelEls.forEach((li, i) => li.classList.toggle("now", i === last));
      if (chartPts) { const p = chartPts[Math.round(t * L)], c = $("#chPlay"); if (p && c) { c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); } }
    }
    const CYCLE = 9000; // hold, travel forward, hold on future, rewind
    function loop(now) {
      if (playing && !splitOn) {
        const c = ((now - t0) % CYCLE) / CYCLE;
        const t = c < .08 ? 0 : c < .58 ? easeIO((c - .08) / .5) : c < .82 ? 1 : c < .96 ? 1 - easeIO((c - .82) / .14) : 0;
        paint(t);
      }
      requestAnimationFrame(loop);
    }
    paint(reduce ? 1 : 0, true); requestAnimationFrame(loop);
    const setIcon = () => { $("#playIcon").setAttribute("d", playing ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5l11 7-11 7z"); $("#playBtn").setAttribute("aria-label", playing ? "Pause" : "Play"); };
    $("#playBtn").onclick = () => {
      if (splitOn) toggleSplit(false);
      playing = !playing; if (playing) t0 = performance.now() - (.08 + Math.max(0, cur) * .5) * CYCLE; setIcon();
    };
    rng.addEventListener("input", () => { if (splitOn) toggleSplit(false); playing = false; setIcon(); paint(rng.value / 1000); });
    function toggleSplit(on) {
      splitOn = on; $("#cmpBtn").setAttribute("aria-pressed", on); $("#split").hidden = !on; stage.classList.toggle("splitting", on);
      if (on) { playing = false; setIcon(); }
      paint(on ? 1 : cur, true);
    }
    $("#cmpBtn").onclick = () => toggleSplit(!splitOn);
    let sDrag = false;
    stage.addEventListener("pointerdown", e => { if (!splitOn) return; sDrag = true; stage.setPointerCapture(e.pointerId); move(e); });
    const move = e => { if (!sDrag) return; const r = stage.getBoundingClientRect(); sp = clamp((e.clientX - r.left) / r.width, .05, .95); paint(cur, true); };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", () => sDrag = false);
    setIcon();
    $$(".tm-track,.stage-note").forEach((el, i) => { el.classList.add("rise"); setTimeout(() => el.classList.add("in"), 900 + i * 120); });
    $$(".stats .st").forEach((el, i) => { el.classList.add("rise"); onSee(el, () => setTimeout(() => el.classList.add("in"), i * 90)); });
  }

  $("#restart").onclick = () => location.reload();
});
