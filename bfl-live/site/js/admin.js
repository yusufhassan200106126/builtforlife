/* =========================================================
   Built For Life — coach panel (demo)
   ========================================================= */
window.BFL.ready.then(function () {
  const B = window.BFL, M = window.BFLMorph, esc = B.esc;
  let D = B.get();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const LABEL = { new: "New", contacted: "Contacted", consultation: "Consultation", client: "Client", lost: "Lost" };
  const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 6e4); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
  const day = iso => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const waNum = p => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "44" + d.slice(1); return d; };
  const planOf = l => (B.PLANS[l.programme] || []).find(p => p.name === l.plan);
  const save = () => { if (!B.save()) toast("Couldn't save. Browser storage may be full."); badge(); };
  function toast(m) { const t = document.createElement("div"); t.className = "toast"; t.textContent = m; $("#toasts").append(t); setTimeout(() => t.remove(), 2400); }

  /* login */
  const SK = "bfl:coach";
  const inSession = () => { try { return sessionStorage.getItem(SK) === "1"; } catch (e) { return false; } };
  /* who's logged in: the owner (Jory) sees everything; staff coaches only their own clients */
  const ROLE = () => B.live ? (B.me && B.me.role) || "" : "coach";
  const isOwner = () => ROLE() === "coach";
  const staffList = () => (D.staff || []).filter(x => x.active !== false);
  const coachLabel = l => l.coach ? ((staffList().find(x => x.id === l.coach) || {}).name || l.coachName || l.coach) : "Jory";
  function enter() {
    document.body.classList.toggle("role-staff", !isOwner());
    if (B.live) { const dp = $(".demo-pill"); if (dp) { dp.textContent = B.cfg.stripeTest ? "Live · test payments" : "Live"; dp.style.color = "#7ee2a8"; dp.style.borderColor = "rgba(126,226,168,.4)"; } }
    $("#login").hidden = true; $("#app").hidden = false; show(location.hash.slice(1) || "dashboard"); }
  $("#loginForm").addEventListener("submit", e => {
    e.preventDefault(); if (B.live) return; D = B.reload();
    if ($("#pin").value === String(D.settings.pin)) { try { sessionStorage.setItem(SK, "1"); } catch (x) {} enter(); }
    else { $("#loginErr").textContent = "That PIN isn't right."; const c = $(".login-card"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); $("#pin").value = ""; }
  });
  $("#logout").onclick = async () => { if (B.live) { await B.logout(); location.replace(location.pathname); return; } try { sessionStorage.removeItem(SK); } catch (e) {} location.reload(); };
  /* live site: log in with an emailed code instead of the demo PIN */
  if (B.live) {
    let em = "";
    const card = $("#loginForm");
    const step1 = () => { card.innerHTML = `<span class="mark">B</span><h1>Coach panel</h1><p>Built For Life</p>
        <input id="cEm" type="email" autocomplete="email" placeholder="Your email" aria-label="Email" style="letter-spacing:0;font-size:16px">
        <button class="btn red" type="submit">Send me a code</button><p class="err" id="loginErr" role="alert"></p>
        ${B.loadError && B.loadError.status !== 401 ? `<p class="hint">${esc(B.loadError.message)}</p>` : `<p class="hint">We'll email you a 6-digit code.</p>`}`;
      card.dataset.step = "1"; setTimeout(() => $("#cEm").focus(), 60); };
    const step2 = code => { card.innerHTML = `<span class="mark">B</span><h1>Check your email</h1><p>${esc(em)}</p>
        <input id="cCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="Code">
        <button class="btn red" type="submit">Log in</button><p class="err" id="loginErr" role="alert"></p>
        <p class="hint">${code ? `Test mode: your code is <b>${code}</b>` : "It can take a minute. Check spam too."}</p><button type="button" class="hint" id="cBack" style="background:none;border:0;color:var(--muted);text-decoration:underline;cursor:pointer">Use a different email</button>`;
      card.dataset.step = "2"; $("#cBack").onclick = step1; setTimeout(() => $("#cCode").focus(), 60); };
    step1();
    card.addEventListener("submit", async e => {
      e.preventDefault(); e.stopImmediatePropagation();
      const b = $("button[type=submit]", card); b.disabled = true;
      try {
        if (card.dataset.step === "1") { em = $("#cEm").value.trim(); const r = await B.authStart(em, "coach"); step2(r.code); }
        else { await B.authVerify(em, $("#cCode").value.trim(), "coach"); location.reload(); }
      } catch (x) { $("#loginErr").textContent = x.message; b.disabled = false; }
    }, true);
  }

  /* nav */
  const TITLES = { dashboard: "Dashboard", diary: "Diary", training: "Training", checkins: "Check-ins", risk: "Clients at risk", community: "Community", messages: "Messages", leads: "Sign-ups", payments: "Payments", pipeline: "Pipeline", clients: "Clients", settings: "Settings" };
  let current = "dashboard";
  function show(v) {
    if (!TITLES[v]) v = "dashboard"; current = v;
    $$("#sideNav button").forEach(b => b.classList.toggle("on", b.dataset.view === v));
    $("#viewTitle").textContent = TITLES[v];
    $("#topDate").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const old = $("#view"), view = old.cloneNode(false); old.replaceWith(view);
    VIEWS[v](view); $("#side").classList.remove("open"); badge(); animate(view);
    if (location.hash.slice(1) !== v) history.replaceState(null, "", "#" + v);
  }
  $("#sideNav").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) show(b.dataset.view); });
  $("#menuT").onclick = () => $("#side").classList.toggle("open");
  addEventListener("hashchange", () => { const v = location.hash.slice(1); if (!$("#app").hidden && v && v !== current && TITLES[v]) show(v); });
  function badge() {
    const n = D.leads.filter(l => l.status === "new").length; $("#newBadge").hidden = !n; $("#newBadge").textContent = n;
    const p = (D.orders || []).filter(o => Date.now() - new Date(o.created) < 864e5).length; $("#payBadge").hidden = !p; $("#payBadge").textContent = p;
    try { const t = itemsBetween(new Date(), new Date()).filter(i => !i.done).length; $("#todayBadge").hidden = !t; $("#todayBadge").textContent = t; } catch (e) {}
    const ci = (D.checkins || []).filter(c => !c.seen).length; $("#ciBadge").hidden = !ci; $("#ciBadge").textContent = ci;
    const um = (D.messages || []).filter(m => m.from === "client" && !m.readByCoach).length; $("#msgBadge").hidden = !um; $("#msgBadge").textContent = um;
    try { const rk = risks().filter(r => !r.snoozed).length; $("#riskBadge").hidden = !rk; $("#riskBadge").textContent = rk; bell(); } catch (e) { console.error(e); }
  }
  // live sync with the website and client portal in other tabs
  B.watch(fresh => {
    const before = { o: (D.orders || []).length, l: D.leads.length, c: (D.checkins || []).length, m: (D.messages || []).filter(x => x.from === "client").length };
    D = fresh; if ($("#app").hidden) return;
    // keep what Jory is typing in a chat or a form
    const ae = document.activeElement;
    const typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.id !== "mIn" && $("#view").contains(ae) && (ae.value || "").length > 0;
    const drawerOpen = !!$("#layer .drawer");
    if (!drawerOpen && !typing) { const keep = $("#mIn") ? $("#mIn").value : null; show(current); if (keep != null && $("#mIn")) { $("#mIn").value = keep; if (ae && ae.id === "mIn") $("#mIn").focus(); } }
    else badge();
    const O = D.orders || [], cl = (D.messages || []).filter(x => x.from === "client");
    if (O.length > before.o) cash(O[0]);
    else if (D.leads.length > before.l) toast(`New sign-up: ${D.leads[0].name}`);
    if ((D.checkins || []).length > before.c) { const c = D.checkins[D.checkins.length - 1]; toast(`New check-in from ${(leadName(c.leadId) || "a client").split(" ")[0]}: ${c.weight} kg`); }
    if (cl.length > before.m) { const m = cl.sort((a, b) => a.at.localeCompare(b.at)).pop(); if (!(current === "messages" && msgState.client === m.leadId)) toast(`Message from ${(leadName(m.leadId) || "a client").split(" ")[0]}: ${(m.text || "Photo").slice(0, 50)}`); }
    popNew();
  });
  function cash(o) {
    const t = document.createElement("div"); t.className = "cash";
    t.innerHTML = `<i>£</i><div><small>New payment</small><b>${B.gbp(o.amount)}</b><span>${esc(o.name)} · ${esc(o.plan)}</span></div>`;
    document.body.append(t); setTimeout(() => t.classList.add("out"), 4200); setTimeout(() => t.remove(), 4800);
  }

  const row = l => {
    const lose = Math.round((l.weight - l.target) * 10) / 10;
    return `<div class="lead" data-id="${l.id}"><img src="${l.photo}" alt="">
      <div><b>${esc(l.name)}${l.example ? '<span class="tag">Example</span>' : ""}</b><div class="sub">${esc(l.programme)} · ${esc(l.plan)}</div></div>
      <div class="right"><span class="st st-${l.status}">${LABEL[l.status]}</span><span class="kg">${!(+l.weight > 0) ? (B.missing(l).length ? "Details missing" : "Direct buy") : lose > 0 ? `<b>−${lose}</b> kg` : lose < 0 ? `<b>+${-lose}</b> kg` : "Strength"} · ${ago(l.created)}</span></div></div>`;
  };
  const bind = el => el.addEventListener("click", e => { const r = e.target.closest("[data-id]"); if (r && !e.target.closest("a,button")) openLead(r.dataset.id); });


  /* ---------- motion: counters, bars, rows, sparklines ---------- */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const fmtN = (v, f) => f === "gbp" ? B.gbp(Math.round(v)) : f === "pct" ? Math.round(v) + "%" : String(Math.round(v));
  function animate(root) {
    $$(".card", root).forEach((c, i) => c.style.setProperty("--d", i));
    $$(".lead, tbody tr, .feed li", root).forEach((r, i) => r.style.setProperty("--r", Math.min(i, 14)));
    $$("[data-count]", root).forEach(el => {
      const to = +el.dataset.count, f = el.dataset.fmt;
      if (reduce) { el.textContent = f === "gbp" ? B.gbp(to) : fmtN(to, f); return; }
      const t0 = performance.now() + 150;
      (function tick(n) { const p = Math.max(0, Math.min(1, (n - t0) / 1300)); el.textContent = p < 1 ? fmtN(to * easeOut(p), f) : (f === "gbp" ? B.gbp(to) : fmtN(to, f)); if (p < 1) requestAnimationFrame(tick); })(performance.now());
    });
    $$(".bar-row i span", root).forEach(sp => { const w = sp.style.width; sp.style.width = "0"; requestAnimationFrame(() => requestAnimationFrame(() => sp.style.width = w)); });
    $$(".draw", root).forEach(pa => { const L = pa.getTotalLength ? pa.getTotalLength() : 0; pa.style.strokeDasharray = L; pa.style.strokeDashoffset = L; requestAnimationFrame(() => requestAnimationFrame(() => { pa.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1) .2s"; pa.style.strokeDashoffset = 0; })); });
    $$(".ring .arc", root).forEach(a => { const v = +a.dataset.v; requestAnimationFrame(() => requestAnimationFrame(() => a.style.strokeDashoffset = 314 - 314 * v)); });
  }
  // a 14-day series as a smooth svg path
  function series(items, val, days = 14) {
    const out = Array(days).fill(0), now = new Date(); now.setHours(23, 59, 59, 999);
    items.forEach(x => { const d = Math.floor((now - new Date(x.created)) / 864e5); if (d >= 0 && d < days) out[days - 1 - d] += val(x); });
    return out;
  }
  function spark(vals, w = 300, h = 70, cls = "") {
    const max = Math.max(1, ...vals), pts = vals.map((v, i) => [i / (vals.length - 1) * w, h - 6 - v / max * (h - 14)]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`; }
    const last = pts[pts.length - 1];
    return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="fillp" d="${d} L${w} ${h} L0 ${h} Z"/><path class="draw" d="${d}"/><circle cx="${last[0]}" cy="${last[1]}" r="4"/></svg>`;
  }

  const VIEWS = {};
  VIEWS.dashboard = el => {
    const L = D.leads, wk = L.filter(l => Date.now() - new Date(l.created) < 7 * 864e5).length;
    const clients = L.filter(l => l.status === "client"), conv = L.length ? Math.round(clients.length / L.length * 100) : 0;
    const O = D.orders || [], paidO = O.filter(o => /^(paid|overdue)$/.test(o.status)), value = paidO.reduce((a, o) => a + o.amount, 0);
    const nowD = new Date(), month = paidO.filter(o => new Date(o.created).getMonth() === nowD.getMonth() && new Date(o.created).getFullYear() === nowD.getFullYear()).reduce((a, o) => a + o.amount, 0);
    const pipe = L.filter(l => ["new", "contacted", "consultation"].includes(l.status)).reduce((a, l) => a + ((planOf(l) || {}).price || 0), 0);
    const byProg = Object.keys(B.PLANS).map(p => [p, L.filter(l => l.programme === p).length]);
    const byPlan = {}; L.forEach(l => byPlan[l.plan] = (byPlan[l.plan] || 0) + 1);
    const max = Math.max(1, ...Object.values(byPlan));
    const h = nowD.getHours(), hi = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const stages = ["new", "contacted", "consultation", "client"].map(st => [st, L.filter(l => l.status === st).length]);
    const feed = [...L.map(l => ({ t: l.created, k: "lead", l })), ...O.map(o => ({ t: o.created, k: "pay", o }))].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 8);
    el.innerHTML = `
      <div class="hq card">
        <div class="hq-main">
          <p class="hq-hi">${hi}, Jory <span class="live"><i></i>Live</span></p>
          <b class="hq-big" data-count="${month}" data-fmt="gbp">£0</b>
          <span class="hq-sub">taken this month · <b>${B.gbp(value)}</b> all time</span>
          ${spark(series(paidO, o => o.amount), 520, 90, "rev")}
          <span class="hq-axis"><span>14 days ago</span><span>Today</span></span>
        </div>
        <div class="ring">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><circle class="arc" data-v="${conv / 100}" cx="60" cy="60" r="50"/></svg>
          <div><b data-count="${conv}" data-fmt="pct">0%</b><span>sign-ups<br>become clients</span></div>
        </div>
        <div class="hq-feed"><p class="feed-h">Activity</p><ul class="feed">${feed.map(f => f.k === "pay"
          ? `<li class="pay" data-id="${f.o.leadId}"><i>£</i><span><b>${esc(f.o.name)}</b> paid ${B.gbp(f.o.amount)}</span><small>${ago(f.t)}</small></li>`
          : `<li data-id="${f.l.id}"><i>+</i><span><b>${esc(f.l.name)}</b> ${f.l.noQuiz ? "bought directly" : "met future them"}</span><small>${ago(f.t)}</small></li>`).join("") || "<li>Nothing yet</li>"}</ul></div>
      </div>
      <div class="kpis">
        <div class="card kpi"><span>Sign-ups this week</span><b data-count="${wk}">0</b><small>${L.filter(l => l.status === "new").length} waiting for a reply</small>${spark(series(L, () => 1), 200, 40, "mini")}</div>
        <div class="card kpi"><span>Clients</span><b data-count="${clients.length}">0</b><small>${conv}% of sign-ups</small></div>
        <div class="card kpi"><span>Payments</span><b data-count="${paidO.length}">0</b><small>${B.gbp(paidO.length ? value / paidO.length : 0)} average</small>${spark(series(paidO, () => 1), 200, 40, "mini")}</div>
        <div class="card kpi"><span>In the pipeline</span><b data-count="${pipe}" data-fmt="gbp">£0</b><small>If every open lead signs</small></div>
      </div>
      ${riskCard()}
      <div class="card dash-today"><div class="card-h"><h2>Today</h2><button class="btn sm" data-go="diary">Open diary</button></div>
        ${(() => { const t = itemsBetween(new Date(), new Date()), n = toSort().length; return (t.length ? `<ul class="ag-list">${t.map(todayRow).join("")}</ul>` : `<div class="empty">Nothing in the diary today.</div>`) + (n ? `<p class="dash-sort" data-go="diary"><b>${n}</b> thing${n === 1 ? "" : "s"} to sort: replies, kick-off calls and new plans →</p>` : ""); })()}</div>
      <div class="card funnel"><div class="card-h"><h2>Pipeline</h2><button class="btn sm" data-go="pipeline">Open board</button></div>
        <div class="fun">${stages.map(([st, n], i) => `<div class="fun-s st-${st}" style="--w:${Math.max(.18, n / Math.max(1, L.length))};--i:${i}"><b data-count="${n}">0</b><span>${LABEL[st]}</span></div>`).join("")}</div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>Latest sign-ups</h2><button class="btn sm" data-go="leads">See all</button></div>
          ${L.slice(0, 6).map(row).join("") || '<div class="empty">No sign-ups yet. Share the questionnaire link to get your first.</div>'}</div>
        <div style="display:grid;gap:20px;align-content:start">
          <div class="card"><div class="card-h"><h2>Latest payments</h2><button class="btn sm" data-go="payments">See all</button></div>${O.slice(0, 4).map(payRow).join("") || '<div class="empty">No payments yet.</div>'}</div>
          <div class="card"><div class="card-h"><h2>By programme</h2></div><div class="bars">${byProg.map(([p, n]) => `<div class="bar-row"><span>${p}</span><i><span style="width:${L.length ? n / L.length * 100 : 0}%"></span></i><b>${n}</b></div>`).join("")}</div></div>
          <div class="card"><div class="card-h"><h2>Recommended plans</h2></div><div class="bars">${Object.entries(byPlan).sort((a, b) => b[1] - a[1]).map(([p, n]) => `<div class="bar-row"><span>${esc(p)}</span><i><span style="width:${n / max * 100}%"></span></i><b>${n}</b></div>`).join("") || '<div class="empty">Nothing yet</div>'}</div></div>
        </div>
      </div>`;
    el.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) show(g.dataset.go); });
    if (!isOwner()) { // staff: no money or sales on their dashboard
      const ms = members(), nm = (B.me && B.me.name) || "coach";
      el.querySelector(".hq").outerHTML = `<div class="hq card staff-hq"><div class="hq-main"><p class="hq-hi">Hi ${esc(nm.split(" ")[0])} <span class="live"><i></i>Live</span></p><b class="hq-big">${ms.length}</b><span class="hq-sub">client${ms.length === 1 ? "" : "s"} assigned to you · ${(D.workouts || []).filter(w => w.done && w.doneAt && Date.now() - new Date(w.doneAt) < 7 * 864e5).length} workouts done this week</span></div></div>`;
      el.querySelectorAll(".kpis, .funnel").forEach(x => x.remove());
    }
    bind(el);
  };

  /* =========================================================
     DIARY: today, this week, onboarding, and what needs sorting
     ========================================================= */
  const TYPES = {
    session: { label: "Training session", short: "Session", c: "#E3242B" },
    checkin: { label: "Check-in", short: "Check-in", c: "#7fb2ff" },
    kickoff: { label: "Kick-off call", short: "Kick-off", c: "#f2b84b" },
    consult: { label: "Consultation", short: "Consult", c: "#c08bff" },
    other: { label: "Other", short: "Other", c: "#9a9690" },
    onboard: { label: "Onboarding · day one", short: "Day one", c: "#5fd18b", auto: true },
    wedding: { label: "Wedding day", short: "Wedding", c: "#ff9ec4", auto: true }
  };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseD = s => new Date(s + "T00:00:00");
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const monday = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const hm = t => { const [h, m] = String(t || "09:00").split(":").map(Number); return h * 60 + m; };
  const clock = mins => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const uid = () => "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const leadName = id => (D.leads.find(l => l.id === id) || {}).name;

  // everything that belongs on the calendar between two dates (inclusive)
  function itemsBetween(from, to) {
    const a = ymd(from), b = ymd(to), out = [];
    (D.events || []).forEach(e => { if (e.date >= a && e.date <= b && !/cancelled|declined/.test(e.status || "")) out.push({ ...e, name: (leadName(e.leadId) || e.name || "Client") + (e.status === "requested" ? " (request)" : "") }); });
    (D.orders || []).filter(o => /^(paid|overdue)$/.test(o.status) && o.start && o.start >= a && o.start <= b)
      .forEach(o => out.push({ id: "o-" + o.id, auto: true, type: "onboard", date: o.start, allDay: true, leadId: o.leadId, name: o.name, notes: o.plan }));
    D.leads.filter(l => l.weddingDate && l.status === "client" && l.weddingDate >= a && l.weddingDate <= b)
      .forEach(l => out.push({ id: "w-" + l.id, auto: true, type: "wedding", date: l.weddingDate, allDay: true, leadId: l.id, name: l.name }));
    return out.sort((x, y) => (x.date + (x.allDay ? "00:00" : x.time)).localeCompare(y.date + (y.allDay ? "00:00" : y.time)));
  }
  // things Jory should do that aren't in the diary yet
  function toSort() {
    const list = [];
    (D.events || []).filter(e => e.status === "requested" && e.date >= ymd(new Date())).forEach(e => list.push({ k: "booking", e, l: D.leads.find(x => x.id === e.leadId) || { name: "Client", id: "" }, t: e.created || e.date }));
    D.leads.filter(l => l.status === "new").forEach(l => list.push({ k: "reply", l, t: l.created }));
    const paid = (D.orders || []).filter(o => /^(paid|overdue)$/.test(o.status));
    paid.forEach(o => {
      if (!o.leadId) return;
      const booked = (D.events || []).some(e => e.leadId === o.leadId && e.type === "kickoff");
      if (!booked && !list.some(x => x.k === "kickoff" && x.l.id === o.leadId)) { const l = D.leads.find(x => x.id === o.leadId); if (l) list.push({ k: "kickoff", l, o, t: o.created }); }
    });
    D.leads.filter(l => (D.orders || []).some(o => o.leadId === l.id && /^(paid|overdue)$/.test(o.status)) && !(D.workouts || []).some(w => w.leadId === l.id))
      .forEach(l => list.push({ k: "plan", l, t: ((D.orders || []).find(o => o.leadId === l.id) || {}).created || l.created }));
    return list.sort((a, b) => new Date(b.t) - new Date(a.t));
  }
  const chip = it => `<i class="ev-chip" style="--c:${(TYPES[it.type] || TYPES.other).c}">${(TYPES[it.type] || TYPES.other).short}</i>`;
  const todayRow = it => {
    const l = D.leads.find(x => x.id === it.leadId);
    return `<li class="ag ${it.done ? "done" : ""}" data-ev="${esc(it.id)}" style="--c:${(TYPES[it.type] || TYPES.other).c}">
      <span class="ag-t">${it.allDay ? "All day" : `${it.time}<small>${clock(hm(it.time) + (+it.mins || 60))}</small>`}</span>
      <span class="ag-b"><b>${esc(it.name)}</b><span>${chip(it)} ${esc(it.where || it.notes || "")}</span></span>
      ${l && l.phone ? `<a class="ag-wa" href="https://wa.me/${waNum(l.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(l.name)}">WA</a>` : ""}
      ${it.auto ? "" : `<button class="ag-done" data-done="${esc(it.id)}" aria-label="Mark done">${it.done ? "✓" : ""}</button>`}</li>`;
  };

  /* ---------- booking hours: when clients can book themselves in ---------- */
  function bookingHours() {
    const c = B.bookingCfg(), DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer" role="dialog" aria-modal="true" aria-label="Booking hours">
      <div class="d-h"><div><h2>Booking hours</h2><p>Clients book sessions in these times from their portal. Anything in your diary is blocked out.</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="d-b"><label class="ck"><input type="checkbox" id="bhOn" ${c.on ? "checked" : ""}> <span><b>Let clients book online</b><small>Turn off to hide booking in the portal.</small></span></label>
        <div class="bh-days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<div class="bh-d"><label class="ck"><input type="checkbox" data-bon="${d}" ${c.days[d].on ? "checked" : ""}> <b>${DN[d]}</b></label><input type="time" data-bs="${d}" value="${c.days[d].start}" step="900"><span>to</span><input type="time" data-be="${d}" value="${c.days[d].end}" step="900"></div>`).join("")}</div>
        <div class="ed-grid"><div class="field"><label for="bhLen">Session length</label><select id="bhLen">${[30, 45, 60, 75, 90].map(m => `<option ${+c.mins === m ? "selected" : ""} value="${m}">${m} min</option>`).join("")}</select></div>
          <div class="field"><label for="bhStep">Start times every</label><select id="bhStep">${[15, 30, 60].map(m => `<option ${+c.step === m ? "selected" : ""} value="${m}">${m} min</option>`).join("")}</select></div>
          <div class="field"><label for="bhNotice">Minimum notice</label><select id="bhNotice">${[0, 2, 4, 12, 24, 48].map(h => `<option ${+c.notice === h ? "selected" : ""} value="${h}">${h ? h + " hours" : "None"}</option>`).join("")}</select></div>
          <div class="field"><label for="bhAhead">How far ahead</label><select id="bhAhead">${[7, 14, 21, 28].map(d => `<option ${+c.ahead === d ? "selected" : ""} value="${d}">${d / 7} week${d > 7 ? "s" : ""}</option>`).join("")}</select></div>
          <div class="field"><label for="bhWhere">Where</label><input id="bhWhere" value="${esc(c.where)}"></div></div>
        <label class="ck"><input type="checkbox" id="bhAuto" ${c.auto ? "checked" : ""}> <span><b>Confirm bookings automatically</b><small>Off: each booking waits for you to confirm it in To sort.</small></span></label>
        <div class="cal-sync"><p class="sec-t">Google / Apple calendar</p><p class="note">Add your diary to your phone's calendar. It updates by itself (Google checks every few hours).</p><div class="toolbar"><button class="btn sm" id="bhCal">Get my calendar link</button></div><div id="bhCalOut"></div></div>
      </div>
      <div class="d-f"><button class="btn red sm" id="bhSave">Save booking hours</button></div></div>`;
    $("#layer").onclick = e => { if (e.target.closest("[data-close]")) $("#layer").innerHTML = ""; };
    $("#bhCal").onclick = async () => {
      try { const u = await B.calendarLink(); $("#bhCalOut").innerHTML = `<input class="cal-url" readonly value="${esc(u)}"><p class="note"><b>Google Calendar:</b> on a computer, Settings → Add calendar → From URL → paste. <b>iPhone:</b> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar. Keep the link private. Pressing the button again makes a new link and stops the old one.</p>`; const i = $(".cal-url"); i.select(); try { await navigator.clipboard.writeText(u); toast("Link copied"); } catch (x) {} }
      catch (x) { $("#bhCalOut").innerHTML = `<p class="note">${esc(x.message)}</p>`; }
    };
    $("#bhSave").onclick = async () => {
      const days = {}; for (let d = 0; d < 7; d++) days[d] = { on: $(`[data-bon="${d}"]`).checked, start: $(`[data-bs="${d}"]`).value || "09:00", end: $(`[data-be="${d}"]`).value || "17:00" };
      const bad = Object.values(days).some(w => w.on && w.end <= w.start); if (bad) return toast("Each day's end time needs to be after its start time");
      try { await B.saveBookingCfg({ on: $("#bhOn").checked, auto: $("#bhAuto").checked, mins: +$("#bhLen").value, step: +$("#bhStep").value, notice: +$("#bhNotice").value, ahead: +$("#bhAhead").value, where: $("#bhWhere").value.trim() || "Gym", days }); $("#layer").innerHTML = ""; toast("Booking hours saved"); show("diary"); }
      catch (x) { toast(x.message); }
    };
  }

  let wkOffset = 0;
  VIEWS.diary = el => {
    const now = new Date(), today = ymd(now);
    const start = addD(monday(now), wkOffset * 7), end = addD(start, 6);
    const week = itemsBetween(start, end), todays = itemsBetween(now, now), sort = toSort();
    const label = `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    const H0 = 6, H1 = 22, PX = 52;
    const sessions = week.filter(i => !i.auto), people = new Set(sessions.map(i => i.leadId || i.name));
    const days = [...Array(7)].map((_, i) => addD(start, i));

    // lay out overlapping events side by side
    function lanes(list) {
      const placed = [];
      list.forEach(e => {
        const s = hm(e.time), f = s + (+e.mins || 60);
        let lane = 0; while (placed.some(p => p.lane === lane && p.s < f && s < p.f)) lane++;
        placed.push({ e, s, f, lane });
      });
      placed.forEach(p => { p.n = Math.max(...placed.filter(q => q.s < p.f && p.s < q.f).map(q => q.lane)) + 1; });
      return placed;
    }
    let r = 0;
    const grid = days.map(d => {
      const ds = ymd(d), items = week.filter(i => i.date === ds), timed = lanes(items.filter(i => !i.allDay));
      const isToday = ds === today, nowTop = ((now.getHours() * 60 + now.getMinutes()) - H0 * 60) / 60 * PX;
      return `<div class="wk-col ${isToday ? "today" : ""} ${ds < today ? "past" : ""}" data-day="${ds}">
        <div class="wk-day"><span>${d.toLocaleDateString("en-GB", { weekday: "short" })}</span><b>${d.getDate()}</b></div>
        <div class="wk-all">${items.filter(i => i.allDay).map(i => `<button class="ev all" data-ev="${esc(i.id)}" style="--c:${(TYPES[i.type] || TYPES.other).c};--r:${r++}"><b>${(TYPES[i.type] || TYPES.other).short}</b> ${esc(i.name)}</button>`).join("")}</div>
        <div class="wk-body" style="height:${(H1 - H0) * PX}px">
          ${isToday && nowTop > 0 && nowTop < (H1 - H0) * PX ? `<i class="now" style="top:${nowTop}px"></i>` : ""}
          ${timed.map(p => { const top = Math.max(0, (p.s - H0 * 60) / 60 * PX), h = Math.max(26, (p.f - p.s) / 60 * PX - 3);
            return `<button class="ev ${p.e.done ? "done" : ""} ${h < 46 ? "short" : ""}" data-ev="${esc(p.e.id)}" title="${esc(p.e.time + " · " + p.e.name + " · " + (TYPES[p.e.type] || TYPES.other).label)}" style="--c:${(TYPES[p.e.type] || TYPES.other).c};--r:${r++};top:${top}px;height:${h}px;left:calc(${p.lane / p.n * 100}% + 2px);width:calc(${100 / p.n}% - 4px)">
              <span>${p.e.time}</span><b>${esc(p.e.name)}</b><small>${(TYPES[p.e.type] || TYPES.other).short}${p.e.where ? " · " + esc(p.e.where) : ""}</small></button>`; }).join("")}
        </div></div>`;
    }).join("");
    const hours = [...Array(H1 - H0)].map((_, i) => `<span style="top:${i * PX}px">${String(H0 + i).padStart(2, "0")}:00</span>`).join("");
    const agenda = days.map(d => { const ds = ymd(d), items = week.filter(i => i.date === ds);
      return `<div class="ag-day ${ds === today ? "today" : ""}"><p>${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</p>${items.length ? `<ul class="ag-list">${items.map(todayRow).join("")}</ul>` : `<p class="ag-none">Nothing booked</p>`}</div>`; }).join("");

    el.innerHTML = `
      <div class="dy-top">
        <div class="card dy-today"><div class="card-h"><h2>Today</h2><span class="dy-date">${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span></div>
          ${todays.length ? `<ul class="ag-list">${todays.map(todayRow).join("")}</ul>` : `<div class="empty">Nothing in the diary today.<br><button class="btn sm red" data-add style="margin-top:12px">+ Add a session</button></div>`}</div>
        <div class="card"><div class="card-h"><h2>To sort</h2><span class="dy-count">${sort.length}</span></div>
          ${sort.length ? `<ul class="todo">${sort.map(x => x.k === "booking"
            ? `<li><i class="td-i kick">?</i><span><b>${esc(x.l.name.split(" ")[0])} wants ${new Date(x.e.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${esc(x.e.time)}</b><small>Booking request · ${x.e.mins || 60} min · ${esc(x.e.where || "")}</small></span><button class="btn sm red" data-bkok="${esc(x.e.id)}">Confirm</button><button class="btn sm" data-bkno="${esc(x.e.id)}">Decline</button></li>`
            : x.k === "reply"
            ? `<li><i class="td-i new">!</i><span><b>Reply to ${esc(x.l.name)}</b><small>Signed up ${ago(x.l.created)} · ${esc(x.l.plan || x.l.programme)}</small></span><a class="btn sm" href="https://wa.me/${waNum(x.l.phone)}" target="_blank" rel="noopener">WhatsApp</a><button class="btn sm" data-open="${x.l.id}">Open</button></li>`
            : x.k === "plan" ? `<li><i class="td-i plan">＋</i><span><b>Set up ${esc(x.l.name.split(" ")[0])}'s training plan</b><small>New client · ${esc(x.l.plan || x.l.programme)}</small></span><button class="btn sm red" data-setplan="${x.l.id}">Build plan</button></li>`
            : `<li><i class="td-i kick">☎</i><span><b>Book ${esc(x.l.name.split(" ")[0])}'s kick-off call</b><small>Paid ${ago(x.o.created)} · ${esc(x.o.plan)}${x.o.start ? ` · starts ${day(x.o.start)}` : ""}</small></span><button class="btn sm red" data-kick="${x.l.id}">Book it</button></li>`).join("")}</ul>`
            : `<div class="empty">All sorted. New sign-ups and new clients needing a kick-off call show up here.</div>`}</div>
        <div class="card dy-stats">
          <div><b data-count="${sessions.length}">0</b><span>sessions this week</span></div>
          <div><b data-count="${people.size}">0</b><span>clients this week</span></div>
          <div><b data-count="${week.filter(i => i.type === "onboard").length}">0</b><span>starting this week</span></div>
        </div>
      </div>
      <div class="card wk">
        <div class="card-h wk-h">
          <div class="wk-nav"><button class="icon-btn" id="wkPrev" aria-label="Previous week">‹</button><button class="btn sm" id="wkNow">This week</button><button class="icon-btn" id="wkNext" aria-label="Next week">›</button><h2>${label}</h2></div>
          <button class="btn sm" id="bkHours">Booking hours${B.bookingCfg().on ? " · on" : ""}</button>
          <div class="wk-key">${Object.entries(TYPES).map(([k, t]) => `<span style="--c:${t.c}">${t.short}</span>`).join("")}</div>
          <button class="btn red sm" data-add>+ Add to diary</button>
        </div>
        <div class="wk-grid"><div class="wk-hours"><div class="wk-day"></div><div class="wk-all"></div><div class="wk-body" style="height:${(H1 - H0) * PX}px">${hours}</div></div>${grid}</div>
        <div class="wk-agenda">${agenda}</div>
        <p class="note wk-tip">Tap an empty slot to add a session there. Onboarding days and weddings appear automatically from payments.</p>
      </div>`;

    $("#wkPrev").onclick = () => { wkOffset--; show("diary"); };
    $("#wkNext").onclick = () => { wkOffset++; show("diary"); };
    $("#wkNow").onclick = () => { wkOffset = 0; show("diary"); };
    el.addEventListener("click", e => {
      const add = e.target.closest("[data-add]"); if (add) return eventForm({});
      const kick = e.target.closest("[data-kick]"); if (kick) return eventForm({ leadId: kick.dataset.kick, type: "kickoff", mins: 30, where: "Phone" });
      const bk = e.target.closest("[data-bkok],[data-bkno]");
      if (bk) { const ev = D.events.find(x => x.id === (bk.dataset.bkok || bk.dataset.bkno)); if (ev) { ev.status = bk.dataset.bkok ? "confirmed" : "declined"; save(); toast(bk.dataset.bkok ? "Confirmed. They've been told." : "Declined. They've been told."); show("diary"); } return; }
      if (e.target.closest("#bkHours")) return bookingHours();
      const op = e.target.closest("[data-open]"); if (op) return openLead(op.dataset.open);
      const sp = e.target.closest("[data-setplan]"); if (sp) { tr.client = sp.dataset.setplan; tr.tab = "plan"; tr.week = 0; show("training"); return applyDialog(sp.dataset.setplan, (D.leads.find(l => l.id === sp.dataset.setplan) || {}).programme === "Bridal Bootcamp" ? "tpl-bridal" : "tpl-dw"); }
      const dn = e.target.closest("[data-done]"); if (dn) { const ev = (D.events || []).find(x => x.id === dn.dataset.done); if (ev) { ev.done = !ev.done; save(); toast(ev.done ? "Marked as done" : "Marked as not done"); show("diary"); } return; }
      if (e.target.closest("a")) return;
      const ev = e.target.closest("[data-ev]"); if (ev) return openItem(ev.dataset.ev);
      const body = e.target.closest(".wk-body"), col = e.target.closest(".wk-col");
      if (body && col) { // click an empty slot → new session at that time (to the half hour)
        const y = e.clientY - body.getBoundingClientRect().top, mins = H0 * 60 + Math.floor(y / PX * 2) * 30;
        eventForm({ date: col.dataset.day, time: clock(Math.min(mins, (H1 - 1) * 60)) });
      }
    });
  };

  function openItem(id) {
    if (id.startsWith("o-") || id.startsWith("w-")) {
      const it = itemsBetween(new Date(2000, 0, 1), new Date(2100, 0, 1)).find(x => x.id === id);
      if (it && it.leadId) openLead(it.leadId);
      return;
    }
    const ev = (D.events || []).find(x => x.id === id); if (ev) eventForm(ev);
  }

  // add / edit a diary entry
  function eventForm(ev) {
    const isNew = !ev.id, now = new Date();
    const e = Object.assign({ type: "session", date: ymd(now), time: clock(Math.min(20 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes() + 30) / 30) * 30)), mins: 60, where: "Gym", notes: "", leadId: "" }, ev);
    const people = D.leads.slice().sort((a, b) => (a.status === "client" ? 0 : 1) - (b.status === "client" ? 0 : 1) || a.name.localeCompare(b.name));
    const series = e.series ? (D.events || []).filter(x => x.series === e.series).length : 0;
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer ev-drawer" role="dialog" aria-modal="true" aria-label="${isNew ? "Add to diary" : "Edit diary entry"}">
      <div class="d-h"><div><h2>${isNew ? "Add to diary" : "Diary entry"}</h2><p>${isNew ? "Sessions, check-ins and calls" : esc((TYPES[e.type] || TYPES.other).label)}</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <form class="d-b ev-form" id="evForm">
        <div class="fld"><label for="evWho">Who</label><select id="evWho"><option value="">Someone new…</option>${people.map(l => `<option value="${l.id}" ${l.id === e.leadId ? "selected" : ""}>${esc(l.name)}${l.status === "client" ? " · client" : ""}</option>`).join("")}</select>
          <input id="evName" placeholder="Their name" value="${esc(e.leadId ? "" : e.name || "")}" ${e.leadId ? "hidden" : ""}></div>
        <div class="fld"><label>What</label><div class="seg ev-types">${Object.entries(TYPES).filter(([, t]) => !t.auto).map(([k, t]) => `<button type="button" data-t="${k}" class="${e.type === k ? "on" : ""}" style="--c:${t.c}">${t.label}</button>`).join("")}</div></div>
        <div class="ev-row">
          <div class="fld"><label for="evDate">Date</label><input type="date" id="evDate" value="${e.date}"></div>
          <div class="fld"><label for="evTime">Time</label><input type="time" id="evTime" value="${e.time}" step="900"></div>
          <div class="fld"><label for="evMins">Length</label><select id="evMins">${[15, 30, 45, 60, 75, 90, 120].map(m => `<option value="${m}" ${+e.mins === m ? "selected" : ""}>${m < 60 ? m + " min" : m / 60 + (m % 60 ? "" : "") + (m === 60 ? " hour" : m % 60 ? ` hr ${m % 60}` : " hours")}</option>`).join("")}</select></div>
        </div>
        <div class="fld"><label>Where</label><div class="seg" id="evWhere">${["Gym", "Online", "Their home", "Phone", "Outdoors"].map(w => `<button type="button" data-w="${w}" class="${e.where === w ? "on" : ""}">${w}</button>`).join("")}</div></div>
        ${isNew ? `<div class="fld"><label for="evRep">Repeat</label><select id="evRep"><option value="0">Just once</option><option value="4">Every week for 4 weeks</option><option value="8">Every week for 8 weeks</option><option value="12">Every week for 12 weeks</option><option value="26">Every week for 6 months</option></select></div>` : series > 1 ? `<p class="note">Part of a weekly series (${series} sessions).</p>` : ""}
        <div class="fld"><label for="evNotes">Notes</label><textarea class="notes" id="evNotes" placeholder="Focus for the session, injuries, what to check…">${esc(e.notes)}</textarea></div>
        <p class="ev-clash" id="evClash" role="status"></p>
        <div id="evZ"></div>
      </form>
      <div class="d-f"><button class="btn red sm" id="evSave">${isNew ? "Add to diary" : "Save changes"}</button>
        ${!isNew ? `<button class="btn sm" id="evDone">${e.done ? "Mark not done" : "Mark done"}</button>${e.leadId ? `<button class="btn sm" id="evLead">Open client</button>` : ""}<button class="btn danger sm" id="evDel" style="margin-left:auto">Delete</button>` : ""}</div>
    </div>`;
    let type = e.type, where = e.where;
    const close = () => { $("#layer").innerHTML = ""; };
    $("#layer").onclick = x => { if (x.target.closest("[data-close]")) close(); };
    $("#evWho").onchange = x => { $("#evName").hidden = !!x.target.value; if (!x.target.value) $("#evName").focus(); };
    $(".ev-types").onclick = x => { const b = x.target.closest("[data-t]"); if (!b) return; type = b.dataset.t; $$(".ev-types button").forEach(y => y.classList.toggle("on", y === b)); if (type === "kickoff" || type === "checkin") { $("#evMins").value = "30"; } clash(); };
    $("#evWhere").onclick = x => { const b = x.target.closest("[data-w]"); if (!b) return; where = b.dataset.w; $$("#evWhere button").forEach(y => y.classList.toggle("on", y === b)); };
    // warn about double bookings
    function clash() {
      const d = $("#evDate").value, s = hm($("#evTime").value), f = s + +$("#evMins").value;
      const hit = (D.events || []).find(x => x.id !== e.id && x.date === d && hm(x.time) < f && s < hm(x.time) + (+x.mins || 60));
      $("#evClash").textContent = hit ? `Heads up: this overlaps ${leadName(hit.leadId) || hit.name || "another entry"} at ${hit.time}.` : "";
    }
    ["evDate", "evTime", "evMins"].forEach(id => $("#" + id).addEventListener("input", clash)); clash();
    $("#evSave").onclick = () => {
      const leadId = $("#evWho").value, name = leadId ? leadName(leadId) : $("#evName").value.trim();
      if (!name) { $("#evName").hidden = false; $("#evName").focus(); return toast("Add who it's with"); }
      const d = $("#evDate").value, t = $("#evTime").value;
      if (!d || !t) return toast("Add a date and time");
      const base = { type, time: t, mins: +$("#evMins").value, where, notes: $("#evNotes").value.trim(), leadId, name };
      D.events = D.events || [];
      if (isNew) {
        const n = +($("#evRep") ? $("#evRep").value : 0) || 1, series = n > 1 ? uid() : null;
        for (let i = 0; i < n; i++) D.events.push({ ...base, id: uid() + i, date: ymd(addD(parseD(d), i * 7)), series, done: false, created: new Date().toISOString() });
        save(); close(); toast(n > 1 ? `${n} weekly ${TYPES[type].short.toLowerCase()}s added` : "Added to the diary");
        wkOffset = Math.round((monday(parseD(d)) - monday(new Date())) / 6048e5);
      } else {
        Object.assign(D.events.find(x => x.id === e.id), base, { date: d });
        save(); close(); toast("Saved");
      }
      show("diary");
    };
    if (!isNew) {
      $("#evDone").onclick = () => { const x = D.events.find(y => y.id === e.id); x.done = !x.done; save(); close(); toast(x.done ? "Marked as done" : "Marked as not done"); show(current); };
      if ($("#evLead")) $("#evLead").onclick = () => openLead(e.leadId);
      $("#evDel").onclick = () => {
        $("#evZ").innerHTML = `<div class="confirm">Delete this entry?${series > 1 ? ` <button type="button" class="btn danger sm" id="evDelAll">Whole series</button>` : ""} <button type="button" class="btn danger sm" id="evDelOne">${series > 1 ? "Just this one" : "Delete"}</button></div>`;
        $("#evDelOne").onclick = () => { D.events = D.events.filter(x => x.id !== e.id); save(); close(); toast("Deleted"); show(current); };
        if ($("#evDelAll")) $("#evDelAll").onclick = () => { D.events = D.events.filter(x => x.series !== e.series); save(); close(); toast("Series deleted"); show(current); };
      };
    }
  }

  /* =========================================================
     TRAINING · CHECK-INS · MESSAGES (linked to the client portal)
     ========================================================= */
  const isMember = l => l.status === "client" || (D.orders || []).some(o => o.leadId === l.id && /^(paid|overdue)$/.test(o.status));
  const members = () => D.leads.filter(isMember).sort((a, b) => a.name.localeCompare(b.name));
  const wOf = id => (D.workouts || []).filter(w => w.leadId === id);
  const doneSets = w => w.items.reduce((n, it) => n + ((w.log || {})[it.id] || []).filter(s => s && s.done).length, 0);
  const allSets = w => w.items.reduce((n, it) => n + (+it.sets || 0), 0);
  const lastActive = id => { const t = [...wOf(id).filter(w => w.lastAt || w.doneAt).map(w => w.doneAt || w.lastAt), ...(D.checkins || []).filter(c => c.leadId === id).map(c => c.at), ...(D.messages || []).filter(m => m.leadId === id && m.from === "client").map(m => m.at)].sort().pop(); return t || null; };
  function flag(l) {
    const up = wOf(l.id).filter(w => w.date >= ymd(new Date())).length, la = lastActive(l.id);
    if (!wOf(l.id).length) return ["No plan yet", "warn"];
    if (wOf(l.id).some(w => !w.done && w.startedAt && Date.now() - new Date(w.lastAt || w.startedAt) < 3 * 36e5)) return ["Training now", "live"];
    if (la && Date.now() - new Date(la) > 5 * 864e5) return [`Quiet ${Math.floor((Date.now() - new Date(la)) / 864e5)}d`, "bad"];
    if (!up) return ["Plan ends", "warn"];
    return ["On track", "ok"];
  }
  const initials = n => n.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();
  const avatar = l => `<span class="avt" style="--h:${[...l.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}">${esc(initials(l.name))}</span>`;
  function sendMsg(leadId, text, extra) {
    D.messages = D.messages || [];
    D.messages.push(Object.assign({ id: B.uid("m"), leadId, from: "coach", text, img: null, at: new Date().toISOString(), readByCoach: true, readByClient: false }, extra || {}));
  }

  /* ---------- TRAINING ---------- */
  let tr = { tab: "plan", client: null, week: 0 };
  VIEWS.training = el => {
    const ms = members();
    if (!tr.client || !ms.some(l => l.id === tr.client)) tr.client = ms[0] ? ms[0].id : null;
    const tabs = `<div class="seg tr-tabs" id="trTabs">${[["plan", "Client plans"], ["library", `Exercise library · ${D.library.length}`], ["templates", `Templates · ${D.templates.length}`]].map(([k, l]) => `<button data-t="${k}" class="${tr.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
    if (tr.tab === "library") el.innerHTML = tabs + libraryHTML();
    else if (tr.tab === "templates") el.innerHTML = tabs + templatesHTML();
    else el.innerHTML = tabs + (ms.length ? planHTML(ms) : `<div class="card"><div class="empty">No clients yet. When someone pays for a plan they appear here, ready for Jory to build their workouts.<br><br>Tip for the demo: buy a plan on the website, then come back.</div></div>`);
    $("#trTabs").onclick = e => { const b = e.target.closest("[data-t]"); if (b) { tr.tab = b.dataset.t; show("training"); } };
    el.addEventListener("click", trClick);
    if (tr.tab === "plan" && tr.client) {
      const f = $("#nutForm"); if (f) f.onsubmit = e => { e.preventDefault(); const l = D.leads.find(x => x.id === tr.client); l.targets = { kcal: +$("#nKcal").value || 0, protein: +$("#nPro").value || 0, water: +$("#nWat").value || 0 }; l.mealNotes = $("#nNotes").value.trim(); save(); toast(`${l.name.split(" ")[0]}'s food targets updated`); };
    }
  };
  function planHTML(ms) {
    const l = D.leads.find(x => x.id === tr.client), now = new Date();
    const start = addD(monday(now), tr.week * 7), end = addD(start, 6);
    const ws = wOf(l.id).filter(w => w.date >= ymd(start) && w.date <= ymd(end));
    const o = (D.orders || []).filter(x => x.leadId === l.id && /^(paid|overdue)$/.test(x.status)).pop();
    const tg = Object.assign({ kcal: l.sex === "male" ? 2300 : 1850, protein: Math.round(Math.max(100, (l.target || l.weight || 70) * 1.8)), water: 2.5 }, l.targets || {});
    const lastC = (D.checkins || []).filter(c => c.leadId === l.id).pop();
    return `<div class="tr-wrap">
      <aside class="card tr-clients"><div class="card-h"><h2>Clients</h2><span class="note">${ms.length}</span></div>
        ${ms.map(m => { const [t, c] = flag(m); return `<button class="tr-cl ${m.id === l.id ? "on" : ""}" data-client="${m.id}">${avatar(m)}<span class="grow"><b>${esc(m.name)}</b><small>${esc(m.plan || m.programme)}</small></span><span class="fl fl-${c}">${t}</span></button>`; }).join("")}</aside>
      <section class="tr-main">
        <div class="card"><div class="card-h tr-head">
          <div class="tr-who">${avatar(l)}<div><h2>${esc(l.name)}'s plan</h2><span class="note">${esc(l.plan || "")}${o && o.start ? ` · started ${day(o.start)}` : ""}${lastC ? ` · last check-in ${lastC.weight} kg, ${ago(lastC.at)}` : ""}</span></div></div>
          <div class="toolbar"><button class="btn sm" data-apply>Apply template</button><button class="btn sm" data-copyweek>Copy week to next</button><button class="btn sm" data-savetpl>Save week as template</button><button class="btn sm" data-msg="${l.id}">Message</button></div></div>
          <div class="tr-weeknav"><button class="icon-btn" data-wk="-1" aria-label="Previous week">‹</button><button class="btn sm" data-wk="0">This week</button><button class="icon-btn" data-wk="1" aria-label="Next week">›</button>
            <b>${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b><span class="note">${ws.filter(w => w.done).length} of ${ws.length} done</span></div>
          <div class="tr-week">${[...Array(7)].map((_, i) => { const d = ymd(addD(start, i)), list = ws.filter(w => w.date === d), past = d < ymd(now);
            return `<div class="tr-day ${d === ymd(now) ? "today" : ""} ${past ? "past" : ""}" data-day="${d}"><div class="tr-dh"><span>${parseD(d).toLocaleDateString("en-GB", { weekday: "short" })}</span><b>${parseD(d).getDate()}</b></div>
              ${list.map((w, k) => { const dn = doneSets(w), tot = allSets(w), live = !w.done && w.startedAt && Date.now() - new Date(w.lastAt || w.startedAt) < 3 * 36e5;
                return `<button class="tr-w ${w.done ? "done" : live ? "live" : ""}" data-w="${w.id}" draggable="true" style="--r:${k}"><span class="tr-ws">${w.done ? "Done" : live ? "Live now" : dn ? `${dn}/${tot} sets` : "Planned"}</span><b>${esc(w.title)}</b><small>${w.mins} min · ${w.items.length} ex</small>${dn && !w.done ? `<i class="mbar"><span style="width:${dn / Math.max(1, tot) * 100}%"></span></i>` : ""}</button>`; }).join("")}
              <button class="tr-add" data-addw="${d}" aria-label="Add a workout on ${parseD(d).toLocaleDateString("en-GB", { weekday: "long" })}">+ Add</button></div>`; }).join("")}</div>
          <p class="note tr-tip">Drag a workout to another day to move it. Changes show in ${esc(l.name.split(" ")[0])}'s portal straight away.</p>
        </div>
        <form class="card tr-food" id="nutForm"><div class="card-h"><h2>Food targets</h2><span class="note">Shown on ${esc(l.name.split(" ")[0])}'s Food tab · diet: ${esc(l.diet || "not given")}</span></div>
          <div class="tr-food-in"><label class="fld2"><span>Calories</span><input id="nKcal" type="number" value="${tg.kcal}"></label><label class="fld2"><span>Protein (g)</span><input id="nPro" type="number" value="${tg.protein}"></label><label class="fld2"><span>Water (L)</span><input id="nWat" type="number" step="0.1" value="${tg.water}"></label>
            <label class="fld2 wide"><span>Meal notes</span><textarea id="nNotes" rows="2" placeholder="e.g. Protein at every meal, swap the evening carbs for veg on rest days">${esc(l.mealNotes || "")}</textarea></label><button class="btn red sm" type="submit">Save targets</button></div></form>
      </section></div>`;
  }
  function trClick(e) {
    const t = e.target;
    const c = t.closest("[data-client]"); if (c) { tr.client = c.dataset.client; return show("training"); }
    const wk = t.closest("[data-wk]"); if (wk) { tr.week = wk.dataset.wk === "0" ? 0 : tr.week + +wk.dataset.wk; return show("training"); }
    const w = t.closest("[data-w]"); if (w) return workoutEditor(D.workouts.find(x => x.id === w.dataset.w));
    const a = t.closest("[data-addw]"); if (a) return workoutEditor({ leadId: tr.client, date: a.dataset.addw });
    if (t.closest("[data-apply]")) return applyDialog(tr.client);
    if (t.closest("[data-copyweek]")) return copyWeek();
    if (t.closest("[data-savetpl]")) return saveWeekTpl();
    const m = t.closest("[data-msg]"); if (m) { msgState.client = m.dataset.msg; return show("messages"); }
    const ex = t.closest("[data-ex]"); if (ex) return exerciseEditor(D.library.find(x => x.id === ex.dataset.ex));
    if (t.closest("[data-addex]")) return exerciseEditor({});
    const tp = t.closest("[data-deltpl]"); if (tp) { const T = D.templates.find(x => x.id === tp.dataset.deltpl); if (T) { tp.outerHTML = `<span class="confirm">Delete “${esc(T.name)}”? <button class="btn danger sm" data-deltplyes="${T.id}">Delete</button></span>`; } return; }
    const ty = t.closest("[data-deltplyes]"); if (ty) { D.templates = D.templates.filter(x => x.id !== ty.dataset.deltplyes); save(); toast("Template deleted"); return show("training"); }
    const ap = t.closest("[data-applytpl]"); if (ap) return applyDialog(null, ap.dataset.applytpl);
  }
  // drag a workout to another day
  document.addEventListener("dragstart", e => { const w = e.target.closest && e.target.closest(".tr-w"); if (!w) return; e.dataTransfer.setData("text/plain", w.dataset.w); w.classList.add("dragging"); });
  document.addEventListener("dragend", e => { const w = e.target.closest && e.target.closest(".tr-w"); if (w) w.classList.remove("dragging"); $$(".tr-day").forEach(d => d.classList.remove("over")); });
  document.addEventListener("dragover", e => { const d = e.target.closest && e.target.closest(".tr-day"); if (!d) return; e.preventDefault(); $$(".tr-day").forEach(x => x.classList.toggle("over", x === d)); });
  document.addEventListener("drop", e => { const d = e.target.closest && e.target.closest(".tr-day"); if (!d) return; e.preventDefault(); const id = e.dataTransfer.getData("text/plain"), w = (D.workouts || []).find(x => x.id === id); if (!w || w.date === d.dataset.day) return; w.date = d.dataset.day; save(); toast(`Moved to ${parseD(w.date).toLocaleDateString("en-GB", { weekday: "long" })}`); show("training"); });

  function workoutEditor(w) {
    const isNew = !w.id, l = D.leads.find(x => x.id === w.leadId) || {};
    const e = JSON.parse(JSON.stringify(Object.assign({ title: "", mins: 45, where: l.where || "Gym", note: "", items: [] }, w)));
    const exOpts = sel => D.library.map(x => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${esc(x.name)} · ${esc(x.group)}</option>`).join("");
    const rowsHTML = () => e.items.map((it, i) => { const log = ((w.log || {})[it.id] || []).filter(s => s && s.done);
      return `<div class="we-row" data-i="${i}"><div class="we-top"><span class="we-n">${i + 1}</span><select data-f="exId" aria-label="Exercise">${exOpts(it.exId)}</select>
        <button type="button" class="icon-btn" data-mv="-1" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button type="button" class="icon-btn" data-mv="1" aria-label="Move down" ${i < e.items.length - 1 ? "" : "disabled"}>↓</button><button type="button" class="icon-btn danger" data-rm aria-label="Remove exercise">✕</button></div>
        <div class="we-nums"><label><span>Sets</span><input data-f="sets" type="number" min="1" max="12" value="${esc(it.sets)}"></label><label><span>Reps</span><input data-f="reps" value="${esc(it.reps)}"></label><label><span>Weight kg</span><input data-f="weight" value="${esc(it.weight)}"></label><label><span>Rest s</span><input data-f="rest" type="number" value="${esc(it.rest || 60)}"></label></div>
        <input class="we-note" data-f="note" placeholder="Note for the client (optional)" value="${esc(it.note || "")}">
        ${log.length ? `<p class="we-log">Logged: ${log.map(s => `${esc(s.weight || "–")} kg × ${esc(s.reps || "–")}`).join(" · ")}</p>` : ""}</div>`; }).join("") || `<p class="note">No exercises yet. Add some below.</p>`;
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer we" role="dialog" aria-modal="true" aria-label="Workout">
      <div class="d-h"><div><h2>${isNew ? "New workout" : "Edit workout"}</h2><p>${esc(l.name || "")} · ${parseD(e.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}${w.done ? " · completed" : ""}</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="d-b">
        <div class="we-meta"><label class="fld2 wide"><span>Title</span><input id="weTitle" list="weTitles" autocomplete="off" value="${esc(e.title)}" placeholder="Type any name, e.g. Leg day, Hotel circuit, Boxing pads"></label><datalist id="weTitles">${[...new Set([...D.templates.flatMap(t => t.days.map(d => d.title)), ...(D.workouts || []).map(w => w.title)])].map(t => `<option value="${esc(t)}">`).join("")}</datalist>
          <label class="fld2"><span>Date</span><input id="weDate" type="date" value="${e.date}"></label><label class="fld2"><span>Minutes</span><input id="weMins" type="number" value="${e.mins}"></label>
          <label class="fld2"><span>Where</span><select id="weWhere">${["Gym", "Home", "Hotel / travelling", "Outdoors"].map(x => `<option ${x === e.where ? "selected" : ""}>${x}</option>`).join("")}</select></label>
          <label class="fld2 wide"><span>Note to ${esc((l.name || "client").split(" ")[0])}</span><input id="weNote" value="${esc(e.note)}" placeholder="Shown at the top of the workout"></label></div>
        <div><p class="sec-t">Exercises</p><div id="weRows" class="we-rows">${rowsHTML()}</div>
          <div class="we-add"><label class="grow"><span class="sr">Exercise to add</span><input id="weNew" list="weLib" autocomplete="off" placeholder="Type any exercise, or pick from your library…"></label><datalist id="weLib">${D.library.map(x => `<option value="${esc(x.name)}">${esc(x.group)}</option>`).join("")}</datalist><button type="button" class="btn red sm" id="weAdd">+ Add exercise</button></div>
          <p class="note we-hint" id="weHint">Not in your library? Just type it, and it's saved to your library for next time.</p></div>
        <div id="weZ"></div>
      </div>
      <div class="d-f"><button class="btn red sm" id="weSave">${isNew ? "Add to plan" : "Save changes"}</button>${!isNew ? `<button class="btn sm" id="weDup">Duplicate to next week</button><button class="btn danger sm" id="weDel" style="margin-left:auto">Remove workout</button>` : ""}</div></div>`;
    const close = () => { $("#layer").innerHTML = ""; };
    $("#layer").onclick = x => { if (x.target.closest("[data-close]")) close(); };
    const sync = () => $$("#weRows .we-row").forEach(r => { const it = e.items[+r.dataset.i]; $$("[data-f]", r).forEach(inp => { it[inp.dataset.f] = inp.type === "number" ? +inp.value : inp.value; }); });
    const redraw = () => { $("#weRows").innerHTML = rowsHTML(); };
    $("#weRows").addEventListener("click", x => {
      const r = x.target.closest(".we-row"); if (!r) return; sync(); const i = +r.dataset.i;
      if (x.target.closest("[data-rm]")) { e.items.splice(i, 1); redraw(); }
      const mv = x.target.closest("[data-mv]"); if (mv) { const j = i + +mv.dataset.mv; [e.items[i], e.items[j]] = [e.items[j], e.items[i]]; redraw(); }
    });
    const addEx = () => {
      const name = $("#weNew").value.trim(); if (!name) { $("#weNew").focus(); return toast("Type an exercise name"); }
      sync();
      let ex = D.library.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!ex) { ex = { id: B.uid("ex"), name: name.charAt(0).toUpperCase() + name.slice(1), group: "My exercises", equip: "", img: "assets/coaching.jpg", video: "", cues: "" }; D.library.push(ex); save(); toast(`“${ex.name}” added to your library`); $("#weLib").insertAdjacentHTML("beforeend", `<option value="${esc(ex.name)}">My exercises</option>`); }
      e.items.push({ id: B.uid("i"), exId: ex.id, sets: 3, reps: "10", weight: "", rest: 60, note: "" }); redraw();
      const rows = $$("#weRows .we-row"); rows[rows.length - 1].classList.add("flash"); rows[rows.length - 1].scrollIntoView({ block: "nearest", behavior: "smooth" });
      $("#weNew").value = ""; $("#weNew").focus();
    };
    $("#weAdd").onclick = addEx;
    $("#weNew").addEventListener("keydown", x => { if (x.key === "Enter") { x.preventDefault(); addEx(); } });
    $("#weNew").addEventListener("input", () => { const v = $("#weNew").value.trim(), known = D.library.some(x => x.name.toLowerCase() === v.toLowerCase()); $("#weHint").textContent = !v ? "Not in your library? Just type it, and it's saved to your library for next time." : known ? "In your library ✓" : `New: “${v}” will be added to your library.`; $("#weHint").classList.toggle("is-new", !!v && !known); });
    $("#weSave").onclick = () => {
      sync(); const title = $("#weTitle").value.trim(); if (!title) { $("#weTitle").focus(); return toast("Give the workout a title"); }
      if (!e.items.length) return toast("Add at least one exercise");
      Object.assign(e, { title, date: $("#weDate").value || e.date, mins: +$("#weMins").value || 45, where: $("#weWhere").value, note: $("#weNote").value.trim() });
      if (isNew) D.workouts.push(Object.assign(e, { id: B.uid("w"), log: {}, done: false, created: new Date().toISOString() }));
      else Object.assign(D.workouts.find(x => x.id === w.id), { title: e.title, date: e.date, mins: e.mins, where: e.where, note: e.note, items: e.items });
      save(); close(); toast(isNew ? `Added to ${(l.name || "").split(" ")[0]}'s plan` : "Workout updated"); show("training");
    };
    if (!isNew) {
      $("#weDup").onclick = () => { sync(); D.workouts.push({ ...JSON.parse(JSON.stringify(e)), id: B.uid("w"), date: ymd(addD(parseD(e.date), 7)), items: e.items.map(i => ({ ...i, id: B.uid("i") })), log: {}, done: false, doneAt: null, startedAt: null, lastAt: null, created: new Date().toISOString() }); save(); close(); toast("Copied to next week"); show("training"); };
      $("#weDel").onclick = () => { $("#weZ").innerHTML = `<div class="confirm">Remove this workout from the plan?${doneSets(w) ? " What they logged is kept in their history." : ""} <button class="btn danger sm" id="weDelY">Remove</button></div>`; $("#weDelY").onclick = () => { D.workouts = D.workouts.filter(x => x.id !== w.id); save(); close(); toast("Workout removed"); show("training"); }; };
    }
  }
  function applyDialog(leadId, tplId) {
    const ms = members();
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer" role="dialog" aria-modal="true" aria-label="Apply template">
      <div class="d-h"><div><h2>Apply a template</h2><p>Copies the workouts into a client's plan. You can edit them after.</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="d-b"><label class="fld2 wide"><span>Client</span><select id="apC">${ms.map(m => `<option value="${m.id}" ${m.id === (leadId || tr.client) ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
        <label class="fld2 wide"><span>Template</span><select id="apT">${D.templates.map(t => `<option value="${t.id}" ${t.id === tplId ? "selected" : ""}>${esc(t.name)} (${t.days.length} workouts a week)</option>`).join("")}</select></label>
        <div class="we-meta"><label class="fld2"><span>Starting the week of</span><input type="date" id="apD" value="${ymd(addD(monday(new Date()), tr.week * 7))}"></label><label class="fld2"><span>For</span><select id="apN">${[1, 2, 4, 6, 8, 12].map(n => `<option value="${n}" ${n === 4 ? "selected" : ""}>${n} week${n > 1 ? "s" : ""}</option>`).join("")}</select></label></div>
        <p class="note">Past days are skipped automatically.</p></div>
      <div class="d-f"><button class="btn red sm" id="apGo">Apply</button></div></div>`;
    $("#layer").onclick = x => { if (x.target.closest("[data-close]")) $("#layer").innerHTML = ""; };
    $("#apGo").onclick = () => { const c = $("#apC").value; if (!c) return toast("No clients yet"); const n = B.applyTemplate($("#apT").value, c, parseD($("#apD").value), +$("#apN").value); save(); $("#layer").innerHTML = ""; tr.client = c; tr.tab = "plan"; toast(`${n} workouts added to ${leadName(c).split(" ")[0]}'s plan`); show("training"); };
  }
  function copyWeek() {
    const start = addD(monday(new Date()), tr.week * 7), a = ymd(start), z = ymd(addD(start, 6));
    const ws = wOf(tr.client).filter(w => w.date >= a && w.date <= z); if (!ws.length) return toast("Nothing in this week to copy");
    ws.forEach(w => D.workouts.push({ ...JSON.parse(JSON.stringify(w)), id: B.uid("w"), date: ymd(addD(parseD(w.date), 7)), items: w.items.map(i => ({ ...i, id: B.uid("i") })), log: {}, done: false, doneAt: null, startedAt: null, lastAt: null, created: new Date().toISOString() }));
    save(); tr.week++; toast(`${ws.length} workouts copied to next week`); show("training");
  }
  function saveWeekTpl() {
    const start = addD(monday(new Date()), tr.week * 7), a = ymd(start), z = ymd(addD(start, 6));
    const ws = wOf(tr.client).filter(w => w.date >= a && w.date <= z); if (!ws.length) return toast("Nothing in this week to save");
    const name = `${leadName(tr.client).split(" ")[0]}'s week · ${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    D.templates.push({ id: B.uid("tpl"), name, days: ws.map(w => ({ dow: parseD(w.date).getDay(), title: w.title, mins: w.mins, where: w.where, items: w.items.map(({ exId, sets, reps, weight, rest, note }) => ({ exId, sets, reps, weight, rest, note })) })) });
    save(); toast(`Saved as template “${name}”`);
  }
  function libraryHTML() {
    const groups = [...new Set(D.library.map(x => x.group))];
    return `<div class="card"><div class="card-h"><h2>Exercise library</h2><button class="btn red sm" data-addex>+ Add exercise</button></div>
      ${groups.map(g => `<div class="lib-g"><p class="sec-t">${esc(g)}</p><div class="lib">${D.library.filter(x => x.group === g).map((x, i) => `<button class="lib-c" data-ex="${x.id}" style="--r:${i}"><img src="${esc(x.img)}" alt=""><span><b>${esc(x.name)}</b><small>${esc(x.equip)}${x.video ? " · video" : ""}</small></span></button>`).join("")}</div></div>`).join("")}</div>`;
  }
  function templatesHTML() {
    return `<div class="card"><div class="card-h"><h2>Templates</h2><span class="note">Save any client's week as a template from their plan</span></div>
      <div class="tpls">${D.templates.map(t => `<div class="tpl"><div class="tpl-h"><b>${esc(t.name)}</b><span class="note">${t.days.length} workouts a week</span></div>
        <ul>${t.days.map(d => `<li><span>${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.dow]}</span><b>${esc(d.title)}</b><small>${d.items.length} exercises · ${d.mins} min</small></li>`).join("")}</ul>
        <div class="toolbar"><button class="btn red sm" data-applytpl="${t.id}">Apply to a client</button><button class="btn danger sm" data-deltpl="${t.id}">Delete</button></div></div>`).join("") || `<div class="empty">No templates yet.</div>`}</div></div>`;
  }
  function exerciseEditor(x) {
    const isNew = !x.id, e = Object.assign({ name: "", group: "Legs", equip: "", cues: "", video: "", img: "assets/coaching.jpg" }, x);
    const used = !isNew && (D.workouts || []).some(w => w.items.some(i => i.exId === x.id));
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer" role="dialog" aria-modal="true" aria-label="Exercise">
      <div class="d-h"><div><h2>${isNew ? "New exercise" : esc(e.name)}</h2><p>Shown to clients in their workouts</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="d-b"><div class="ex-pic"><img id="exImg" src="${esc(e.img)}" alt=""><label class="btn sm">Change photo<input type="file" accept="image/*" id="exFile" hidden></label></div>
        <label class="fld2 wide"><span>Name</span><input id="exName" value="${esc(e.name)}" placeholder="e.g. Bulgarian split squat"></label>
        <div class="we-meta"><label class="fld2"><span>Muscle group</span><input id="exGroup" value="${esc(e.group)}" list="exGroups"><datalist id="exGroups">${[...new Set(D.library.map(y => y.group))].map(g => `<option value="${esc(g)}">`).join("")}</datalist></label><label class="fld2"><span>Equipment</span><input id="exEquip" value="${esc(e.equip)}"></label></div>
        <label class="fld2 wide"><span>Coaching cues</span><textarea id="exCues" rows="3">${esc(e.cues)}</textarea></label>
        <div class="fld2 wide"><span>Demo video</span><div class="vid-row"><input id="exVid" value="${esc(e.video)}" placeholder="Paste a YouTube link, or upload your own"><label class="btn sm">Upload video<input type="file" accept="video/*" id="exVidFile" hidden></label>${e.video ? `<button type="button" class="btn sm" id="exVidPlay">Play</button>` : ""}</div><small class="note" id="exVidNote">${B.live ? "Film it on your phone (under a minute). Clients see a play button on this exercise." : "Demo: paste a YouTube link. Uploading your own videos works on the live site."}</small></div><div id="exZ"></div></div>
      <div class="d-f"><button class="btn red sm" id="exSave">${isNew ? "Add to library" : "Save"}</button>${!isNew ? `<button class="btn danger sm" id="exDel" style="margin-left:auto">Delete</button>` : ""}</div></div>`;
    $("#layer").onclick = y => { if (y.target.closest("[data-close]")) $("#layer").innerHTML = ""; };
    $("#exFile").onchange = async y => { const f = y.target.files[0]; if (!f) return; try { e.img = await M.compress(f, 700); $("#exImg").src = e.img; } catch (z) { toast("That photo couldn't be opened"); } };
    $("#exVidFile").onchange = async y => {
      const f = y.target.files[0]; if (!f) return; const note = $("#exVidNote"); note.textContent = "Uploading… keep this open";
      try { const u = await B.uploadVideo(f); $("#exVid").value = u; note.textContent = "Uploaded. Press Save."; } catch (z) { note.textContent = z.message; }
    };
    if ($("#exVidPlay")) $("#exVidPlay").onclick = () => window.BFLApp && BFLApp.video($("#exVid").value.trim(), e.name);
    $("#exSave").onclick = () => {
      const name = $("#exName").value.trim(); if (!name) return toast("Add a name");
      const v = $("#exVid").value.trim();
      Object.assign(e, { name, group: $("#exGroup").value.trim() || "Other", equip: $("#exEquip").value.trim(), cues: $("#exCues").value.trim(), video: /^https?:\/\//.test(v) || /^\/api\/img\//.test(v) ? v : "" });
      if (isNew) D.library.push(Object.assign(e, { id: B.uid("ex") })); else Object.assign(D.library.find(y => y.id === x.id), e);
      save(); $("#layer").innerHTML = ""; toast(isNew ? "Added to the library" : "Saved"); show("training");
    };
    if (!isNew) $("#exDel").onclick = () => {
      $("#exZ").innerHTML = `<div class="confirm">${used ? "This exercise is in some clients' workouts. They'll keep it, but you won't be able to add it again. " : ""}Delete it? <button class="btn danger sm" id="exDelY">Delete</button></div>`;
      $("#exDelY").onclick = () => { D.library = D.library.filter(y => y.id !== x.id); save(); $("#layer").innerHTML = ""; toast("Deleted"); show("training"); };
    };
  }

  /* ---------- CHECK-INS ---------- */
  let ciFilter = "new";
  VIEWS.checkins = el => {
    const all = (D.checkins || []).slice().sort((a, b) => b.at.localeCompare(a.at));
    const list = ciFilter === "new" ? all.filter(c => !c.seen) : all;
    const ms = members(), missed = ms.filter(l => { const cs = (D.checkins || []).filter(c => c.leadId === l.id); const since = cs.length ? cs[cs.length - 1].at : ((D.orders || []).find(o => o.leadId === l.id && /^(paid|overdue)$/.test(o.status)) || {}).created; return since && Date.now() - new Date(since) > 7 * 864e5; });
    el.innerHTML = `
      <div class="card"><div class="card-h"><div class="seg" id="ciF"><button data-f="new" class="${ciFilter === "new" ? "on" : ""}">New · ${all.filter(c => !c.seen).length}</button><button data-f="all" class="${ciFilter === "all" ? "on" : ""}">All · ${all.length}</button></div><span class="note">Clients check in from their portal. Replies go to their chat.</span></div></div>
      ${missed.length ? `<div class="card"><div class="card-h"><h2>Missed check-ins</h2><span class="note">No check-in for over a week</span></div>${missed.map(l => `<div class="ci-miss">${avatar(l)}<span class="grow"><b>${esc(l.name)}</b><small>${esc(l.plan || "")}</small></span><button class="btn sm" data-nudge="${l.id}">Send reminder</button><a class="btn sm" href="https://wa.me/${waNum(l.phone)}" target="_blank" rel="noopener">WhatsApp</a></div>`).join("")}</div>` : ""}
      <div class="ci-list">${list.map((c, k) => { const l = D.leads.find(x => x.id === c.leadId) || { name: "Client" }; const prev = (D.checkins || []).filter(x => x.leadId === c.leadId && x.at < c.at).pop(); const d = prev ? Math.round((c.weight - prev.weight) * 10) / 10 : (l.weight ? Math.round((c.weight - l.weight) * 10) / 10 : null);
        return `<article class="card ci-c ${c.seen ? "" : "new"}" data-ci="${c.id}" style="--r:${k}">
          <div class="ci-top">${avatar(l)}<div class="grow"><b>${esc(l.name)}</b><small>${new Date(c.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${ago(c.at)}</small></div>${c.seen ? "" : `<span class="fl fl-live">New</span>`}</div>
          <div class="ci-body">${c.photo ? `<img class="ci-ph" src="${esc(c.photo)}" alt="${esc(l.name)} check-in photo">` : ""}
            <div class="ci-nums"><div><b>${c.weight}</b><span>kg${d != null ? ` <em class="${d < 0 ? "ok" : d > 0 ? "warn" : ""}">${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}</em>` : ""}</span></div><div><b>${c.energy}/10</b><span>Energy</span></div><div><b>${c.sleep}/10</b><span>Sleep</span></div><div><b class="sm">${esc(c.food)}</b><span>Food targets</span></div></div></div>
          ${c.note ? `<p class="ci-note">“${esc(c.note)}”</p>` : ""}
          ${c.reply ? `<p class="ci-reply"><b>You replied:</b> ${esc(c.reply)}</p>` : `<div class="ci-r"><textarea data-reply="${c.id}" rows="2" placeholder="Reply to ${esc(l.name.split(" ")[0])}…"></textarea><div class="toolbar"><button class="btn red sm" data-send="${c.id}">Send reply</button>${["Great week, keep it going!", "Let's adjust your plan this week."].map(q => `<button class="chip-q" data-q="${c.id}">${q}</button>`).join("")}${c.seen ? "" : `<button class="btn sm" data-seen="${c.id}">Mark seen</button>`}<button class="btn sm" data-plan="${c.leadId}">Open plan</button></div></div>`}
        </article>`; }).join("") || `<div class="card"><div class="empty">${ciFilter === "new" ? "No new check-ins. You're all caught up." : "No check-ins yet. Clients send them weekly from their portal."}</div></div>`}</div>`;
    $("#ciF").onclick = e => { const b = e.target.closest("[data-f]"); if (b) { ciFilter = b.dataset.f; show("checkins"); } };
    el.addEventListener("click", e => {
      const s = e.target.closest("[data-send]");
      if (s) { const c = D.checkins.find(x => x.id === s.dataset.send), txt = $(`[data-reply="${c.id}"]`).value.trim(); if (!txt) return toast("Write a reply first"); c.reply = txt; c.repliedAt = new Date().toISOString(); c.seen = true; sendMsg(c.leadId, txt, { ref: { type: "checkin", id: c.id, label: `Re: check-in ${new Date(c.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${c.weight} kg` } }); save(); toast("Reply sent to their chat"); return show("checkins"); }
      const q = e.target.closest("[data-q]"); if (q) { const ta = $(`[data-reply="${q.dataset.q}"]`); ta.value = q.textContent; ta.focus(); return; }
      const sn = e.target.closest("[data-seen]"); if (sn) { D.checkins.find(x => x.id === sn.dataset.seen).seen = true; save(); return show("checkins"); }
      const p = e.target.closest("[data-plan]"); if (p) { tr.client = p.dataset.plan; tr.tab = "plan"; tr.week = 0; return show("training"); }
      const n = e.target.closest("[data-nudge]"); if (n) { sendMsg(n.dataset.nudge, `Hi ${leadName(n.dataset.nudge).split(" ")[0]}, quick reminder to send your weekly check-in. Takes 2 minutes and keeps us on track!`); save(); toast("Reminder sent to their chat"); n.disabled = true; n.textContent = "Sent"; }
    });
  };

  /* =========================================================
     CLIENTS AT RISK
     Uses js/risk.js: no training 7+ days, 2+ missed check-ins,
     nothing logged 5+ days, no reply to Jory for 3+ days.
     ========================================================= */
  const risks = () => window.BFLRisk ? window.BFLRisk.assess(D) : [];
  const RICON = { train: "🏋", checkin: "✓", log: "✎", reply: "✉" };
  const dAgo = ms => { if (!ms) return "never"; const d = Math.floor((Date.now() - ms) / 864e5); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
  function riskCard() {
    const rs = risks().filter(r => !r.snoozed);
    if (!members().length) return "";
    return `<div class="card risk-dash ${rs.length ? "" : "calm"}"><div class="card-h"><h2>Clients at risk</h2><button class="btn sm" data-go="risk">${rs.length ? "See all" : "Open"}</button></div>
      ${rs.length ? `<div class="rd-list">${rs.slice(0, 4).map(r => `<button class="rd" data-risk="${r.lead.id}">${avatar(r.lead)}<span class="grow"><b>${esc(r.lead.name)}</b><small>${esc(r.reasons.map(x => x.text).join(" · "))}</small></span><span class="fl ${r.level === "high" ? "fl-bad" : "fl-warn"}">${r.level === "high" ? "High" : "Watch"}</span></button>`).join("")}</div>`
        : `<div class="empty">Everyone's on track. Nobody has gone quiet.</div>`}</div>`;
  }
  let riskTab = "open";
  VIEWS.risk = el => {
    const all = risks(), open = all.filter(r => !r.snoozed), snz = all.filter(r => r.snoozed), ms = members();
    const list = riskTab === "open" ? open : snz, high = open.filter(r => r.level === "high").length;
    const R = window.BFLRisk.RULES;
    el.innerHTML = `
      <div class="risk-sum">
        <div class="card kpi ${high ? "hot" : ""}"><span>High risk</span><b data-count="${high}">0</b><small>Step in today</small></div>
        <div class="card kpi"><span>Worth watching</span><b data-count="${open.length - high}">0</b><small>One warning sign</small></div>
        <div class="card kpi"><span>On track</span><b data-count="${ms.length - all.length}">0</b><small>of ${ms.length} clients</small></div>
        <div class="card kpi"><span>Handled</span><b data-count="${snz.length}">0</b><small>Snoozed for now</small></div>
      </div>
      <div class="card"><div class="card-h"><div class="seg" id="rkF"><button data-f="open" class="${riskTab === "open" ? "on" : ""}">Needs you · ${open.length}</button><button data-f="snz" class="${riskTab === "snz" ? "on" : ""}">Handled · ${snz.length}</button></div>
        <span class="note">Flags: no workout for ${R.noTraining}+ days · ${R.missedCheckins}+ missed check-ins · nothing logged for ${R.notLogging}+ days · no reply for ${R.noReplyHours / 24}+ days</span></div></div>
      <div class="risk-list">${list.map((r, k) => {
        const l = r.lead, phone = String(l.phone || "");
        return `<article class="card rk ${r.level}" style="--r:${k}" data-rk="${l.id}">
          <div class="rk-top">${avatar(l)}<div class="grow"><b>${esc(l.name)}</b><small>${esc(l.plan || "")} · week ${Math.max(1, Math.floor(r.since / 7) + 1)}</small></div>
            <span class="fl ${r.snoozed ? "fl-ok" : r.level === "high" ? "fl-bad" : "fl-warn"}">${r.snoozed ? "Handled" : r.level === "high" ? "High risk" : "Watch"}</span></div>
          <ul class="rk-why">${r.reasons.map(x => `<li class="rw-${x.key}"><i>${RICON[x.key]}</i><span><b>${esc(x.text)}</b>${x.extra ? `<small>${esc(x.extra)}</small>` : ""}</span></li>`).join("")}</ul>
          <div class="rk-last"><span>Last workout<b>${dAgo(r.last.train)}</b></span><span>Last check-in<b>${dAgo(r.last.checkin)}</b></span><span>Last logged<b>${dAgo(r.last.log)}</b></span><span>Opened the app<b>${r.last.seen ? dAgo(r.last.seen) : "—"}</b></span></div>
          <div class="rk-act">${r.snoozed ? `<span class="note">Snoozed until ${new Date(l.riskSnooze).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}${l.riskNote ? ` · ${esc(l.riskNote)}` : ""}</span><button class="btn sm" data-unsnooze="${l.id}">Bring back</button>`
            : `<button class="btn red sm" data-nudge2="${l.id}">Send a nudge</button><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${waNum(phone)}?text=${encodeURIComponent(r.nudge)}">WhatsApp</a>${phone ? `<a class="btn sm" href="tel:${esc(phone.replace(/\s/g, ""))}">Call</a>` : ""}<button class="btn sm" data-chat="${l.id}">Chat</button><button class="btn sm" data-plan="${l.id}">Plan</button><button class="btn sm ghost" data-snooze="${l.id}">I've handled it</button>`}</div>
        </article>`; }).join("") || `<div class="card"><div class="empty">${riskTab === "open" ? (ms.length ? "Nobody needs chasing right now. Everyone's training, logging and replying." : "No clients yet. When people join, anyone who goes quiet shows up here.") : "Nothing snoozed."}</div></div>`}</div>`;
    $("#rkF").onclick = e => { const b = e.target.closest("[data-f]"); if (b) { riskTab = b.dataset.f; show("risk"); } };
    el.addEventListener("click", e => {
      const g = sel => e.target.closest(sel);
      let b;
      if ((b = g("[data-nudge2]"))) return nudgeDialog(b.dataset.nudge2);
      if ((b = g("[data-chat]"))) { msgState.client = b.dataset.chat; return show("messages"); }
      if ((b = g("[data-plan]"))) { tr.client = b.dataset.plan; tr.tab = "plan"; tr.week = 0; return show("training"); }
      if ((b = g("[data-snooze]"))) return snoozeDialog(b.dataset.snooze);
      if ((b = g("[data-unsnooze]"))) { const l = D.leads.find(x => x.id === b.dataset.unsnooze); delete l.riskSnooze; delete l.riskNote; save(); return show("risk"); }
    });
  };
  function nudgeDialog(id) {
    const r = window.BFLRisk.client(D, D.leads.find(l => l.id === id)), l = r.lead;
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer sm-dr" role="dialog" aria-modal="true" aria-label="Send a nudge">
      <div class="d-h"><div><h2>Nudge ${esc(l.name.split(" ")[0])}</h2><p>${esc(r.reasons.map(x => x.text).join(" · "))}</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="d-b"><p class="sec-t">Message (edit it to sound like you)</p><textarea class="notes" id="ndT" rows="6">${esc(r.nudge)}</textarea>
        <label class="ck"><input type="checkbox" id="ndS" checked> Snooze this alert for 3 days after sending</label></div>
      <div class="d-f"><button class="btn red sm" id="ndSend">Send to their portal</button><a class="btn sm" id="ndWa" target="_blank" rel="noopener">Send on WhatsApp</a></div></div>`;
    const ta = $("#ndT"), wa = $("#ndWa"), upd = () => wa.href = `https://wa.me/${waNum(l.phone)}?text=${encodeURIComponent(ta.value)}`; upd(); ta.oninput = upd;
    const after = () => { if ($("#ndS").checked) { l.riskSnooze = new Date(Date.now() + 3 * 864e5).toISOString(); l.riskNote = "Nudged"; } save(); $("#layer").innerHTML = ""; show(current); };
    $("#ndSend").onclick = () => { const t = ta.value.trim(); if (!t) return; sendMsg(l.id, t); toast(`Nudge sent to ${l.name.split(" ")[0]}`); after(); };
    wa.onclick = () => setTimeout(after, 300);
    $("#layer").onclick = e => { if (e.target.closest("[data-close]")) $("#layer").innerHTML = ""; };
    setTimeout(() => ta.focus(), 50);
  }
  function snoozeDialog(id) {
    const l = D.leads.find(x => x.id === id);
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer sm-dr" role="dialog" aria-modal="true" aria-label="Handled">
      <div class="d-h"><div><h2>Handled ${esc(l.name.split(" ")[0])}?</h2><p>Hide the alert for a while. It comes back if nothing changes.</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="d-b"><p class="sec-t">What happened</p><div class="seg" id="snR"><button class="on">Spoke to them</button><button>On holiday</button><button>Injured / ill</button><button>Other</button></div>
        <p class="sec-t" style="margin-top:14px">Snooze for</p><div class="seg" id="snD"><button data-d="3" class="on">3 days</button><button data-d="7">1 week</button><button data-d="14">2 weeks</button></div></div>
      <div class="d-f"><button class="btn red sm" id="snOk">Snooze alert</button></div></div>`;
    ["#snR", "#snD"].forEach(k => $(k).onclick = e => { const b = e.target.closest("button"); if (!b) return; $$(k + " button").forEach(x => x.classList.toggle("on", x === b)); });
    $("#snOk").onclick = () => { l.riskSnooze = new Date(Date.now() + +$("#snD .on").dataset.d * 864e5).toISOString(); l.riskNote = $("#snR .on").textContent; save(); $("#layer").innerHTML = ""; toast("Snoozed"); show(current); };
    $("#layer").onclick = e => { if (e.target.closest("[data-close]")) $("#layer").innerHTML = ""; };
  }
  document.addEventListener("click", e => { const r = e.target.closest("[data-risk]"); if (r) { riskTab = "open"; show("risk"); setTimeout(() => { const c = $(`[data-rk="${r.dataset.risk}"]`); if (c) { c.scrollIntoView({ block: "center", behavior: "smooth" }); c.classList.add("flash"); } }, 60); } });

  /* =========================================================
     NOTIFICATIONS: the bell, and pop-ups on this device
     ========================================================= */
  function notifEvents() {
    const since = Date.now() - 14 * 864e5, ev = [], nm = id => leadName(id) || "A client", T = s => new Date(s).getTime();
    D.leads.forEach(l => { if (T(l.created) > since) ev.push({ k: "lead:" + l.id, t: T(l.created), ic: "+", title: `New sign-up: ${l.name}`, body: `${l.programme || ""}${l.plan ? " · " + l.plan : ""}`, go: ["leads", l.id] }); });
    (D.orders || []).forEach(o => { if (/^(paid|overdue)$/.test(o.status) && T(o.created) > since) ev.push({ k: "pay:" + o.id, t: T(o.created), ic: "£", title: `${B.gbp(o.amount)} from ${o.name}`, body: o.plan, go: ["payments"], cls: "pay" }); });
    (D.orders || []).forEach(o => { if (o.status === "overdue" && o.failedAt) ev.push({ k: "fail:" + o.id + o.failedAt, t: T(o.failedAt), ic: "!", title: `Payment failed: ${o.name}`, body: `${o.plan} · payment ${(o.paidCount || 1) + 1} of ${o.instalments}`, go: ["payments"], cls: "hot" }); });
    D.leads.forEach(l => { const h = l.health; if (h && h.flags && !l.healthCleared && !h.paper) ev.push({ k: "health:" + l.id + h.signedAt, t: T(h.signedAt), ic: "♥", title: `${l.name.split(" ")[0]}'s health form needs a look`, body: `${h.flags} "yes" answer${h.flags > 1 ? "s" : ""} · review before training`, go: ["leads", l.id], cls: "hot" }); });
    (D.events || []).forEach(e => { if (e.by === "client" && e.created && T(e.created) > since) ev.push({ k: "bk:" + e.id, t: T(e.created), ic: "📅", title: `${nm(e.leadId).split(" ")[0]} ${e.status === "requested" ? "wants to book" : "booked"} a session`, body: `${new Date(e.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${e.time}`, go: ["diary"] });
      if (e.cancelledBy === "client" && e.cancelledAt && T(e.cancelledAt) > since) ev.push({ k: "bkx:" + e.id, t: T(e.cancelledAt), ic: "✕", title: `${nm(e.leadId).split(" ")[0]} cancelled a session`, body: `${new Date(e.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${e.time}`, go: ["diary"] }); });
    (D.checkins || []).forEach(c => { if (T(c.at) > since) ev.push({ k: "ci:" + c.id, t: T(c.at), ic: "✓", title: `${nm(c.leadId).split(" ")[0]} checked in`, body: `${c.weight} kg${c.note ? " · " + c.note : ""}`, go: ["checkins"] }); });
    (D.messages || []).forEach(m => { if (m.from === "client" && T(m.at) > since) ev.push({ k: "msg:" + m.id, t: T(m.at), ic: "✉", title: `Message from ${nm(m.leadId).split(" ")[0]}`, body: m.text || "Sent a photo", go: ["messages", m.leadId] }); });
    (D.workouts || []).forEach(w => { if (w.done && w.doneAt && T(w.doneAt) > since) ev.push({ k: "wk:" + w.id, t: T(w.doneAt), ic: "🏋", title: `${nm(w.leadId).split(" ")[0]} finished a workout`, body: w.title, go: ["training", w.leadId] }); });
    // at-risk alerts are dated from when this panel first spotted them
    let first = {}; try { first = JSON.parse(localStorage.getItem("bfl:coach:riskSeen") || "{}"); } catch (e) {}
    let dirty = false;
    risks().filter(r => !r.snoozed).forEach(r => { const k = "risk:" + r.lead.id + ":" + r.reasons.map(x => x.key).join(","); if (!first[k]) { first[k] = Date.now(); dirty = true; } ev.push({ k, t: first[k], ic: "!", title: `${r.lead.name} needs a nudge`, body: r.reasons.map(x => x.text).join(" · "), go: ["risk", r.lead.id], cls: r.level === "high" ? "hot" : "" }); });
    if (dirty) try { localStorage.setItem("bfl:coach:riskSeen", JSON.stringify(first)); } catch (e) {}
    return ev.sort((a, b) => b.t - a.t).slice(0, 50);
  }
  const seenAt = () => { const s = D.settings && D.settings.notifSeen; return s ? new Date(s).getTime() : Date.now() - 3 * 864e5; };
  function bell() {
    const n = notifEvents().filter(e => e.t > seenAt()).length, el = $("#bellN");
    if (!el) return; el.hidden = !n; el.textContent = n > 9 ? "9+" : n;
    if ($("#notifPanel")) renderPanel();
  }
  function renderPanel() {
    const ev = notifEvents(), s = seenAt();
    let p = $("#notifPanel");
    if (!p) { p = document.createElement("div"); p.id = "notifPanel"; p.className = "notif"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Notifications"); document.body.append(p); }
    p.innerHTML = `<div class="nf-h"><b>Notifications</b><button class="link" id="nfAll">Mark all read</button></div>
      <div class="nf-l">${ev.map(e => `<button class="nf ${e.t > s ? "unread" : ""} ${e.cls || ""}" data-k="${esc(e.k)}"><i>${e.ic}</i><span class="grow"><b>${esc(e.title)}</b><small>${esc(String(e.body || "").slice(0, 90))}</small></span><time>${ago(new Date(e.t).toISOString())}</time></button>`).join("") || `<div class="empty">Nothing yet. Sign-ups, payments, check-ins, messages and at-risk clients show up here.</div>`}</div>
      <div class="nf-f"><button class="link" id="nfSet">Notification settings</button></div>`;
    $("#nfAll").onclick = () => { D.settings.notifSeen = new Date().toISOString(); save(); };
    $("#nfSet").onclick = () => { closePanel(); show("settings"); };
    p.onclick = e => { const b = e.target.closest("[data-k]"); if (!b) return; const ev2 = ev.find(x => x.k === b.dataset.k); closePanel(); openGo(ev2.go); };
  }
  function openGo([v, id]) {
    if (v === "messages" && id) msgState.client = id;
    if (v === "training" && id) { tr.client = id; tr.tab = "plan"; tr.week = 0; }
    show(v);
    if (v === "leads" && id) openLead(id);
    if (v === "risk" && id) setTimeout(() => { const c = $(`[data-rk="${id}"]`); if (c) { c.scrollIntoView({ block: "center" }); c.classList.add("flash"); } }, 60);
  }
  function closePanel() { const p = $("#notifPanel"); if (p) p.remove(); $("#bell").setAttribute("aria-expanded", "false"); }
  $("#bell").onclick = e => { e.stopPropagation(); if ($("#notifPanel")) return closePanel(); renderPanel(); $("#bell").setAttribute("aria-expanded", "true"); };
  document.addEventListener("click", e => { if ($("#notifPanel") && !e.target.closest("#notifPanel,#bell")) closePanel(); });

  // pop-ups on this phone / laptop (while the coach panel is open)
  const POP = "bfl:coach:popups";
  const popOn = () => { try { return localStorage.getItem(POP) === "1" && "Notification" in window && Notification.permission === "granted"; } catch (e) { return false; } };
  let popKnown = null;
  function popNew() {
    const ev = notifEvents();
    if (!popKnown) { popKnown = new Set(ev.map(e => e.k)); return; }
    const fresh = ev.filter(e => !popKnown.has(e.k)); fresh.forEach(e => popKnown.add(e.k));
    if (!popOn() || !fresh.length) return;
    fresh.slice(0, 3).forEach(e => { try { const n = new Notification(e.title, { body: e.body || "", tag: e.k, icon: "assets/jory.jpg" }); n.onclick = () => { focus(); openGo(e.go); n.close(); }; } catch (x) {} });
  }
  setInterval(() => { if (!$("#app").hidden) { badge(); popNew(); } }, 10 * 60e3); // risk changes as time passes

  function notifCard() {
    const st = D.settings || {}, perm = "Notification" in window ? Notification.permission : "unsupported";
    const on = k => st[k] !== false ? "checked" : "";
    return `<div class="card"><div class="card-h"><h2>Notifications</h2></div><div class="form nf-set">
      <label class="ck"><input type="checkbox" id="nPop" ${popOn() ? "checked" : ""} ${perm === "unsupported" || perm === "denied" ? "disabled" : ""}> <span><b>Pop-ups on this device</b><small>${perm === "denied" ? "Blocked in your browser settings. Allow notifications for this site to turn them on." : perm === "unsupported" ? "This browser doesn't support pop-ups." : (B.live ? "New sign-ups, payments, messages and bookings on this phone or laptop, even when the panel is closed. On iPhone, add the panel to your Home Screen first (Share → Add to Home Screen)." : "New sign-ups, payments, check-ins, messages and at-risk clients, while the coach panel is open.")}</small></span></label>
      <label class="ck"><input type="checkbox" data-st="digest" ${on("digest")}> <span><b>Morning email</b><small>Every day at 8am: who's at risk, plus yesterday's sign-ups, payments and unread messages.</small></span></label>
      <label class="ck"><input type="checkbox" data-st="clientEmails" ${on("clientEmails")}> <span><b>Email clients when you message them</b><small>Only if they haven't opened the app in the last 10 minutes, at most once every 30 minutes.</small></span></label>
      <label class="ck"><input type="checkbox" data-st="checkinReminders" ${on("checkinReminders")}> <span><b>Check-in reminders</b><small>An email to clients when their weekly check-in is a day overdue (once a week).</small></span></label>
      ${B.live ? "" : `<p class="note">Demo: emails only go out on the live site.</p>`}
    </div></div>`;
  }
  function bindNotif(el) {
    const p = $("#nPop", el);
    if (p) p.onchange = async () => {
      if (p.checked && B.live && window.BFLApp && window.BFLApp.needsIOSHelp()) { p.checked = false; return toast("On iPhone: Share → Add to Home Screen, open it from there, then turn this on"); }
      if (p.checked && B.live && window.BFLApp) { try { await window.BFLApp.enablePush(); try { localStorage.setItem(POP, "1"); } catch (e) {} toast("Notifications are on for this device"); } catch (e) { p.checked = false; toast(e.message); } return; }
      if (!p.checked && B.live && window.BFLApp) window.BFLApp.disablePush();
      if (p.checked) { let r = Notification.permission; if (r !== "granted") r = await Notification.requestPermission(); if (r !== "granted") { p.checked = false; return toast("Notifications weren't allowed"); } try { localStorage.setItem(POP, "1"); } catch (e) {} new Notification("Pop-ups are on", { body: "You'll see new sign-ups, payments and clients who need you.", icon: "assets/jory.jpg" }); }
      else { try { localStorage.removeItem(POP); } catch (e) {} }
    };
    $$("[data-st]", el).forEach(c => c.onchange = () => { D.settings[c.dataset.st] = c.checked; save(); toast("Saved"); });
  }

  /* =========================================================
     COMMUNITY: challenges with leaderboards + the members' wall
     ========================================================= */
  VIEWS.community = el => {
    const C = window.BFLCommunity, t = ymd(new Date()), chs = (D.challenges || []).slice().sort((a, b) => b.start.localeCompare(a.start));
    const posts = (D.posts || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 80), me = (B.me && B.me.name) || "Jory";
    el.innerHTML = `<div class="grid2 comm">
      <div><div class="card"><div class="card-h"><h2>New challenge</h2></div><div class="form ed-grid" id="chForm">
        <div class="field wide"><label for="chT">Title</label><input id="chT" placeholder="e.g. November 12-workout challenge"></div>
        <div class="field"><label for="chM">Scored on</label><select id="chM">${Object.entries(C.METRICS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join("")}</select></div>
        <div class="field"><label for="chP">Prize (optional)</label><input id="chP" placeholder="e.g. Free month"></div>
        <div class="field"><label for="chS">Starts</label><input id="chS" type="date" value="${t}"></div>
        <div class="field"><label for="chE">Ends</label><input id="chE" type="date" value="${ymd(addD(new Date(), 27))}"></div>
        <div class="field wide"><label for="chDsc">Rules (optional)</label><input id="chDsc" placeholder="e.g. Every finished workout counts"></div>
        <div class="toolbar wide"><button class="btn red sm" id="chAdd">Start challenge</button><span class="note">All clients join automatically. Anyone can hide themselves in their portal.</span></div></div></div>
        ${chs.map(c => { const b = C.board(c, D), st = C.status(c, t);
          return `<div class="card chl"><div class="card-h"><div><h2>${esc(c.title)}</h2><p class="note">${{ live: "Live", soon: "Starts soon", ended: "Finished" }[st]} · ${day(c.start)} – ${day(c.end)} · ${esc((C.METRICS[c.metric] || {}).label || "")}${c.prize ? " · 🏆 " + esc(c.prize) : ""}</p></div><button class="btn sm ghost" data-chdel="${esc(c.id)}">Delete</button></div>
            <ol class="lbc">${b.slice(0, 10).map(r => `<li><span>${r.rank}</span><b>${esc((D.leads.find(l => l.id === r.id) || {}).name || r.name)}</b><em>${(+r.score).toLocaleString("en-GB")}</em></li>`).join("") || `<li class="note">No one in yet.</li>`}</ol>
            ${st !== "soon" && b[0] && b[0].score ? `<div class="toolbar pad"><button class="btn sm" data-chwin="${esc(c.id)}">Post the ${st === "ended" ? "winner" : "leaderboard"} to the wall</button></div>` : ""}</div>`; }).join("")}</div>
      <div><div class="card"><div class="card-h"><h2>Members' wall</h2><span class="note">Posts from clients and coaches. Delete anything that shouldn't be there.</span></div>
        <form class="form" id="cpForm"><textarea id="cpT" rows="2" placeholder="Post to everyone as ${esc(me)}…"></textarea><div class="toolbar"><button class="btn red sm" type="submit">Post</button></div></form>
        <div class="wall">${posts.map(p => `<article class="wp"><div class="wp-h"><b>${esc(p.authorName || "Member")}</b>${p.byCoach || !p.leadId ? `<i class="fl fl-live">Coach</i>` : ""}<small>${ago(p.at)}</small><span class="grow"></span><span class="note">♥ ${(p.likes || []).length}</span><button class="btn sm ghost" data-pdel="${esc(p.id)}">Delete</button></div>${p.text ? `<p>${esc(p.text)}</p>` : ""}${p.img ? `<img src="${esc(p.img)}" alt="">` : ""}</article>`).join("") || `<div class="empty">No posts yet.</div>`}</div></div></div></div>`;
    $("#chAdd").onclick = () => {
      const title = $("#chT").value.trim(), start = $("#chS").value, end = $("#chE").value;
      if (title.length < 3) return toast("Give it a title"); if (!start || !end || end < start) return toast("Check the dates");
      D.challenges = D.challenges || []; D.challenges.push({ id: B.uid("ch"), title, metric: $("#chM").value, prize: $("#chP").value.trim(), desc: $("#chDsc").value.trim(), start, end, members: "all", created: new Date().toISOString() });
      save(); toast("Challenge started. Clients see it in their Team tab."); show("community");
    };
    $("#cpForm").onsubmit = e => { e.preventDefault(); const text = $("#cpT").value.trim(); if (!text) return;
      D.posts = D.posts || []; D.posts.push({ id: B.uid("p"), leadId: null, byCoach: true, authorName: me, text, img: null, at: new Date().toISOString(), likes: [] }); save(); show("community"); };
    el.addEventListener("click", e => {
      const d = e.target.closest("[data-pdel],[data-chdel]");
      if (d) { if (d.dataset.sure !== "1") { d.dataset.sure = "1"; d.textContent = "Sure?"; return; } if (d.dataset.pdel) D.posts = D.posts.filter(x => x.id !== d.dataset.pdel); else D.challenges = D.challenges.filter(x => x.id !== d.dataset.chdel); save(); return show("community"); }
      const w = e.target.closest("[data-chwin]");
      if (w) { const c = D.challenges.find(x => x.id === w.dataset.chwin), b = C.board(c, D).slice(0, 3), st = C.status(c, t);
        const text = `${st === "ended" ? "🏆 " + c.title + " results!" : "📊 " + c.title + ": the top three right now"}\n${b.map((r, i) => `${["🥇", "🥈", "🥉"][i]} ${r.name}: ${(+r.score).toLocaleString("en-GB")}`).join("\n")}${st === "ended" && c.prize ? `\nCongrats ${b[0].name}, the ${c.prize} is yours!` : "\nKeep going everyone!"}`;
        D.posts = D.posts || []; D.posts.push({ id: B.uid("p"), leadId: null, byCoach: true, authorName: me, text, img: null, at: new Date().toISOString(), likes: [] }); save(); toast("Posted to the wall"); show("community"); }
    });
  };

  /* ---------- MESSAGES ---------- */
  let msgState = { client: null, img: null, draft: "" };
  const QUICK = ["Great work this week!", "Can you send me a video of that lift?", "How's the body feeling?", "Don't forget your check-in on Sunday."];
  VIEWS.messages = el => {
    const ms = members(), M2 = D.messages || [];
    const lastOf = id => M2.filter(m => m.leadId === id).sort((a, b) => a.at.localeCompare(b.at)).pop();
    const convs = ms.slice().sort((a, b) => ((lastOf(b) || {}).at || "").localeCompare((lastOf(a) || {}).at || ""));
    if (!msgState.client || !ms.some(l => l.id === msgState.client)) msgState.client = convs[0] ? convs[0].id : null;
    const l = D.leads.find(x => x.id === msgState.client);
    const thread = l ? M2.filter(m => m.leadId === l.id).sort((a, b) => a.at.localeCompare(b.at)) : [];
    const ws = l ? wOf(l.id) : [], wkA = ymd(monday(new Date())), wkZ = ymd(addD(monday(new Date()), 6)), wkW = ws.filter(w => w.date >= wkA && w.date <= wkZ).sort((a, b) => a.date.localeCompare(b.date));
    const lastC = l ? (D.checkins || []).filter(c => c.leadId === l.id).pop() : null;
    el.innerHTML = !ms.length ? `<div class="card"><div class="empty">No clients yet. Chats open here once someone has a plan.</div></div>` : `
      <div class="msg-wrap">
        <aside class="card msg-list"><div class="card-h"><h2>Chats</h2><button class="btn sm" id="bcast">Message everyone</button></div>
          ${convs.map(c => { const last = lastOf(c.id), un = M2.filter(m => m.leadId === c.id && m.from === "client" && !m.readByCoach).length;
            return `<button class="msg-c ${c.id === msgState.client ? "on" : ""} ${un ? "unread" : ""}" data-conv="${c.id}">${avatar(c)}<span class="grow"><b>${esc(c.name)}</b><small data-typing="${c.id}">${last ? (last.from === "coach" ? "You: " : "") + esc(last.text || "Photo") : "No messages yet"}</small></span><span class="msg-meta">${last ? `<small>${ago(last.at)}</small>` : ""}${un ? `<i>${un}</i>` : ""}</span></button>`; }).join("")}</aside>
        <section class="card msg-main">
          <div class="card-h"><div class="tr-who">${avatar(l)}<div><h2>${esc(l.name)}</h2><span class="note" id="mSub">${esc(l.plan || "")} · ${flag(l)[0]}</span></div></div><a class="btn sm" href="https://wa.me/${waNum(l.phone)}" target="_blank" rel="noopener">WhatsApp</a></div>
          <div class="msg-thread" id="mThread">${thread.map(m => `<div class="mb ${m.from === "coach" ? "me" : "them"}">${m.ref ? `<span class="ref">${esc(m.ref.label)}</span>` : ""}${m.img ? `<img src="${esc(m.img)}" alt="Photo">` : ""}${m.video ? `<video src="${esc(m.video)}" controls playsinline preload="metadata"></video>` : ""}${m.text ? `<p>${esc(m.text)}</p>` : ""}<time>${new Date(m.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${m.from === "coach" && m.readByClient ? " · Seen" : ""}</time></div>`).join("") || `<div class="empty">Say hello to ${esc(l.name.split(" ")[0])}. They'll see it in their portal.</div>`}<div class="mb them typing" id="mTyping" hidden aria-label="${esc(l.name.split(" ")[0])} is typing"><span></span><span></span><span></span></div></div>
          <div class="msg-quick">${QUICK.map(q => `<button class="chip-q" data-quick>${esc(q)}</button>`).join("")}</div>
          <form class="msg-comp" id="mComp">${msgState.img ? `<div class="att"><img src="${msgState.img}" alt="Photo to send"><button type="button" class="icon-btn" id="mAttX" aria-label="Remove photo">✕</button></div>` : ""}
            <label class="icon-btn" aria-label="Attach a photo or video" style="cursor:pointer">＋<input type="file" accept="image/*,video/*" id="mFile" hidden></label>
            <textarea id="mIn" rows="1" placeholder="Message ${esc(l.name.split(" ")[0])}…">${esc(msgState.draft)}</textarea><button class="btn red sm" type="submit">Send</button></form>
        </section>
        <aside class="card msg-ctx"><div class="card-h"><h2>This week</h2><button class="btn sm" data-plan="${l.id}">Open plan</button></div>
          <div class="ctx-b">${wkW.length ? wkW.map(w => `<div class="ctx-w ${w.done ? "done" : ""}"><span>${parseD(w.date).toLocaleDateString("en-GB", { weekday: "short" })}</span><b>${esc(w.title)}</b><small>${w.done ? "Done" : doneSets(w) ? `${doneSets(w)}/${allSets(w)} sets` : "Planned"}</small></div>`).join("") : `<p class="note">No workouts this week.</p>`}
            ${lastC ? `<div class="ctx-c"><p class="sec-t">Last check-in</p><b>${lastC.weight} kg</b><small>${ago(lastC.at)} · energy ${lastC.energy}/10 · sleep ${lastC.sleep}/10</small></div>` : ""}
            ${l.weddingDate ? `<div class="ctx-c"><p class="sec-t">Wedding</p><b>${parseD(l.weddingDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</b></div>` : ""}</div></aside>
      </div>`;
    if (!ms.length) return;
    // opening a chat marks their messages read
    let ch = false; thread.forEach(m => { if (m.from === "client" && !m.readByCoach) { m.readByCoach = true; ch = true; } }); if (ch) { save(); }
    const th = $("#mThread"); th.scrollTop = th.scrollHeight;
    const ta = $("#mIn"); let lastPing = 0;
    ta.oninput = () => { msgState.draft = ta.value; ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px";
      if (ta.value.trim() && Date.now() - lastPing > 1200) { B.typing.set("coach", l.id); lastPing = Date.now(); } if (!ta.value.trim()) B.typing.clear("coach", l.id); };
    ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#mComp").requestSubmit(); } };
    $("#mFile").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (/^video\//.test(f.type)) { toast("Uploading video…"); try { const u = await B.uploadVideo(f, l.id); sendMsg(l.id, ta.value.trim(), { video: u }); save(); ta.value = ""; show("messages"); toast("Video sent"); } catch (x) { toast(x.message); } return; }
      try { msgState.img = await M.compress(f, 900); show("messages"); } catch (x) { toast("That photo couldn't be opened"); }
    };
    if ($("#mAttX")) $("#mAttX").onclick = () => { msgState.img = null; show("messages"); };
    $("#mComp").onsubmit = e => { e.preventDefault(); const t = ta.value.trim(); if (!t && !msgState.img) return; B.typing.clear("coach", l.id); sendMsg(l.id, t, { img: msgState.img }); if (!B.save()) { D.messages.pop(); return toast("Couldn't send. Storage may be full."); } msgState.img = null; msgState.draft = ""; show("messages"); setTimeout(() => $("#mIn") && $("#mIn").focus(), 30); };
    el.addEventListener("click", e => {
      const c = e.target.closest("[data-conv]"); if (c) { msgState.client = c.dataset.conv; msgState.draft = ""; return show("messages"); }
      const q = e.target.closest("[data-quick]"); if (q) { ta.value = q.textContent; msgState.draft = ta.value; ta.focus(); return; }
      const p = e.target.closest("[data-plan]"); if (p) { tr.client = p.dataset.plan; tr.tab = "plan"; tr.week = 0; return show("training"); }
      if (e.target.closest("#bcast")) broadcast();
    });
    setTimeout(() => { if (!matchMedia("(pointer:coarse)").matches && $("#mIn")) $("#mIn").focus({ preventScroll: true }); }, 50);
  };
  // show "… is typing" while the client types in their portal
  setInterval(() => {
    if (current !== "messages" || $("#app").hidden) return;
    $$("[data-typing]").forEach(sm => { const on = B.typing.is("client", sm.dataset.typing); if (on && !sm.dataset.orig) { sm.dataset.orig = sm.textContent; sm.textContent = "typing…"; sm.classList.add("is-typing"); } else if (!on && sm.dataset.orig) { sm.textContent = sm.dataset.orig; delete sm.dataset.orig; sm.classList.remove("is-typing"); } });
    const bub = $("#mTyping"); if (!bub || !msgState.client) return;
    const on = B.typing.is("client", msgState.client);
    if (bub.hidden === on) { bub.hidden = !on; if (on) { const t = $("#mThread"); t.appendChild(bub); t.scrollTop = t.scrollHeight; } const sub = $("#mSub"); if (sub) { if (on) { sub.dataset.orig = sub.textContent; sub.textContent = "typing…"; } else if (sub.dataset.orig) sub.textContent = sub.dataset.orig; sub.classList.toggle("is-typing", on); } }
  }, 400);
  function broadcast() {
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer" role="dialog" aria-modal="true" aria-label="Message everyone">
      <div class="d-h"><div><h2>Message everyone</h2><p>Goes to each client's chat separately</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="d-b"><label class="fld2 wide"><span>Send to</span><select id="bcTo"><option value="all">All clients (${members().length})</option>${Object.keys(B.PLANS).map(p => `<option value="${p}">${p} clients (${members().filter(l => l.programme === p).length})</option>`).join("")}</select></label>
        <label class="fld2 wide"><span>Message</span><textarea id="bcTxt" rows="5" placeholder="e.g. Gym's closed Monday for the bank holiday. Your home workout is in the app instead."></textarea></label></div>
      <div class="d-f"><button class="btn red sm" id="bcGo">Send</button></div></div>`;
    $("#layer").onclick = x => { if (x.target.closest("[data-close]")) $("#layer").innerHTML = ""; };
    $("#bcGo").onclick = () => { const t = $("#bcTxt").value.trim(); if (!t) return toast("Write a message first"); const to = $("#bcTo").value, list = members().filter(l => to === "all" || l.programme === to); list.forEach(l => sendMsg(l.id, t)); save(); $("#layer").innerHTML = ""; toast(`Sent to ${list.length} client${list.length === 1 ? "" : "s"}`); show("messages"); };
  }

  let F = { status: "all", prog: "all", q: "" };
  VIEWS.leads = el => {
    el.innerHTML = `<div class="card"><div class="card-h" style="display:grid;gap:12px">
        <div class="toolbar"><div class="seg" id="fS">${["all", ...B.STATUSES].map(s => `<button data-s="${s}" class="${F.status === s ? "on" : ""}">${s === "all" ? "All" : LABEL[s]}</button>`).join("")}</div>
        <select id="fP" aria-label="Programme"><option value="all">All programmes</option>${Object.keys(B.PLANS).map(p => `<option ${F.prog === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="toolbar"><input type="search" id="fQ" placeholder="Search name, phone, email" value="${esc(F.q)}"><button class="btn sm" id="csv">Export CSV</button></div></div>
      <div id="rows"></div></div>`;
    const draw = () => {
      const q = F.q.toLowerCase();
      const list = D.leads.filter(l => (F.status === "all" || l.status === F.status) && (F.prog === "all" || l.programme === F.prog) && (!q || [l.name, l.phone, l.email].join(" ").toLowerCase().includes(q)));
      $("#rows").innerHTML = list.map(row).join("") || '<div class="empty">No sign-ups match.</div>';
    };
    draw();
    $("#fS").onclick = e => { const b = e.target.closest("[data-s]"); if (!b) return; F.status = b.dataset.s; $$("#fS button").forEach(x => x.classList.toggle("on", x === b)); draw(); };
    $("#fP").onchange = e => { F.prog = e.target.value; draw(); };
    $("#fQ").oninput = e => { F.q = e.target.value; draw(); };
    $("#csv").onclick = exportCSV;
    bind(el);
  };

  const payRow = o => `<div class="lead pay" data-id="${o.leadId}"><span class="pay-amt">${B.gbp(o.amount)}</span>
      <div><b>${esc(o.name)}${o.example ? '<span class="tag">Example</span>' : ""}</b><div class="sub">${esc(o.plan)} · ${esc(o.id)}</div></div>
      <div class="right">${payPill(o)}<span class="kg">${ago(o.created)}</span></div></div>`;

  const payPill = o => o.status === "overdue" ? `<span class="st st-lost">Payment failed</span>${o.payUrl ? `<br><a class="note" href="${esc(o.payUrl)}" target="_blank" rel="noopener">Pay link</a>` : ""}`
    : /refund/.test(o.status) ? `<span class="st st-lost">${o.status === "part-refunded" ? "Part refunded" : "Refunded"}</span>`
    : o.payType === "monthly" ? (o.complete || (o.paidCount || 1) >= o.instalments ? `<span class="st st-client">Paid in full</span>` : `<span class="st st-consultation">Monthly</span><br><small class="inst">next ${o.nextDue ? day(o.nextDue) : "—"}</small>`)
    : `<span class="st st-client">Paid</span>`;
  VIEWS.payments = el => {
    const O = D.orders || [], paid = O.filter(o => /^(paid|overdue)$/.test(o.status));
    const total = paid.reduce((a, o) => a + o.amount, 0), avg = paid.length ? total / paid.length : 0;
    const byPlan = {}; paid.forEach(o => byPlan[o.plan] = (byPlan[o.plan] || 0) + o.amount);
    el.innerHTML = `<div class="kpis">
        <div class="card kpi"><span>Total taken</span><b data-count="${total}" data-fmt="gbp">£0</b><small>${paid.length} paid orders</small>${spark(series(paid, o => o.amount), 200, 40, "mini")}</div>
        <div class="card kpi"><span>Still to come</span><b data-count="${Math.round(paid.filter(o => o.payType === "monthly").reduce((a, o) => a + Math.max(0, (o.total || 0) - o.amount), 0))}" data-fmt="gbp">£0</b><small>${paid.filter(o => o.payType === "monthly" && (o.paidCount || 1) < o.instalments).length} on monthly payments${O.some(o => o.status === "overdue") ? ` · <b style="color:#ff6b70">${O.filter(o => o.status === "overdue").length} failed</b>` : ""}</small></div>
        <div class="card kpi"><span>Bridal Bootcamp</span><b>${B.gbp(paid.filter(o => o.programme === "Bridal Bootcamp").reduce((a, o) => a + o.amount, 0))}</b><small>${paid.filter(o => o.programme === "Bridal Bootcamp").length} orders</small></div>
        <div class="card kpi"><span>Daily Wins</span><b>${B.gbp(paid.filter(o => o.programme === "Daily Wins").reduce((a, o) => a + o.amount, 0))}</b><small>${paid.filter(o => o.programme === "Daily Wins").length} orders</small></div></div>
      <div class="card"><div class="card-h"><h2>All payments</h2><button class="btn sm" id="ocsv">Export CSV</button></div>
      <div class="tbl"><table><thead><tr><th>Order</th><th>Date</th><th>Client</th><th>Plan</th><th>Start</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${O.map(o => `<tr data-id="${o.leadId}"><td style="font-family:var(--mono)">${esc(o.id)}</td><td>${day(o.created)}</td><td><b>${esc(o.name)}</b><br><small style="color:var(--muted)">${esc(o.email)}</small></td><td>${esc(o.plan)}<br><small style="color:var(--muted)">${esc(o.programme)}</small></td><td>${o.start ? day(o.start) : "—"}</td><td style="font-family:var(--mono);font-weight:600">${B.gbp(o.amount)}${o.payType === "monthly" ? `<br><small class="inst">${o.paidCount || 1} of ${o.instalments} · ${B.gbp(o.total)} total</small>` : ""}</td><td>${payPill(o)}</td></tr>`).join("") || '<tr><td colspan="7"><div class="empty">No payments yet. Buy a plan on the website to see one appear here.</div></td></tr>'}
      </tbody></table></div></div>
      <div class="card"><div class="card-h"><h2>Revenue by plan</h2></div><div class="bars">${Object.entries(byPlan).sort((a, b) => b[1] - a[1]).map(([p, v]) => `<div class="bar-row"><span>${esc(p)}</span><i><span style="width:${total ? v / total * 100 : 0}%"></span></i><b>${B.gbp(v)}</b></div>`).join("") || '<div class="empty">Nothing yet</div>'}</div></div>`;
    $("#ocsv").onclick = () => {
      const cols = ["id", "created", "status", "name", "email", "phone", "programme", "plan", "payType", "instalments", "paidCount", "amount", "total", "nextDue", "start", "weddingDate"], q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([[cols.join(","), ...O.map(o => cols.map(c => q(o[c])).join(","))].join("\n")], { type: "text/csv" })); a.download = "bfl-payments.csv"; a.click();
    };
    bind(el);
  };

  VIEWS.pipeline = el => {
    el.innerHTML = `<p class="note">Drag a card to move someone along, or tap it to open their details.</p><div class="board">${B.STATUSES.map(s => {
      const list = D.leads.filter(l => l.status === s);
      return `<div class="col" data-col="${s}"><div class="col-h"><b>${LABEL[s]}</b><span>${list.length}</span></div><div class="col-b">${list.map(l => `<div class="mini" draggable="true" data-id="${l.id}"><img src="${l.photo}" alt=""><div><b>${esc(l.name)}</b><small>${esc(l.plan)}</small></div></div>`).join("")}</div></div>`;
    }).join("")}</div>`;
    let dragId = null;
    el.addEventListener("dragstart", e => { const m = e.target.closest(".mini"); if (!m) return; dragId = m.dataset.id; m.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
    el.addEventListener("dragend", e => { const m = e.target.closest(".mini"); if (m) m.classList.remove("dragging"); $$(".col", el).forEach(c => c.classList.remove("drag-over")); });
    el.addEventListener("dragover", e => { const c = e.target.closest(".col"); if (!c) return; e.preventDefault(); $$(".col", el).forEach(x => x.classList.toggle("drag-over", x === c)); });
    el.addEventListener("drop", e => { const c = e.target.closest(".col"); if (!c || !dragId) return; e.preventDefault(); setStatus(dragId, c.dataset.col); });
    bind(el);
  };

  VIEWS.clients = el => {
    const list = D.leads.filter(l => l.status === "client");
    el.innerHTML = `<div class="card"><div class="tbl"><table><thead><tr><th></th><th>Client</th><th>Plan</th><th>Start → target</th><th>Coach</th><th>Contact</th><th>Since</th></tr></thead><tbody>
      ${list.map(l => `<tr data-id="${l.id}"><td><img src="${l.photo}" alt="" style="width:40px;height:50px;object-fit:cover"></td><td><b>${esc(l.name)}</b></td><td>${esc(l.plan)}<br><small style="color:var(--muted)">${esc(l.programme)}</small></td><td style="font-family:var(--mono)">${+l.weight > 0 ? `${l.weight} → ${l.target} kg` : `<span class="miss">Details missing</span>`}</td><td>${esc(coachLabel(l))}</td><td>${esc(l.phone)}</td><td>${day(l.created)}</td></tr>`).join("") || '<tr><td colspan="7"><div class="empty">No clients yet. Move a sign-up to “Client” when they buy.</div></td></tr>'}
      </tbody></table></div></div>`;
    bind(el);
  };

  VIEWS.settings = el => {
    if (B.live && !isOwner()) {
      el.innerHTML = `<div class="card"><div class="card-h"><h2>Account</h2></div><div class="form"><p class="note">Logged in as <b>${esc(B.me.email)}</b> (coach). You see the clients Jory has assigned to you. Payments and the team are managed by Jory.</p></div></div>`;
      el.insertAdjacentHTML("beforeend", notifCard()); bindNotif(el); return;
    }
    if (B.live) {
      el.innerHTML = `<div class="card"><div class="card-h"><h2>Account</h2></div><div class="form">
          <p class="note">Logged in as <b>${esc(B.me.email)}</b> (owner). You log in with a code sent to your email. Add coaches under Team below.</p>
          <p class="note">Everything is saved online and updates live on every device. Payments are taken by Stripe${B.cfg.stripeTest ? " (test mode: no real money)" : ""}.${B.cfg.ai ? " AI future-you photos are on." : " AI future-you photos are off."}${B.cfg.email ? "" : " Emails are off (no RESEND_API_KEY)."}</p>
          <div class="toolbar"><button class="btn sm" id="csv2">Export sign-ups CSV</button></div></div></div>`;
      el.insertAdjacentHTML("beforeend", teamCard() + notifCard()); bindNotif(el); bindTeam(el);
      $("#csv2").onclick = exportCSV; return;
    }
    el.innerHTML = `<div class="card"><div class="card-h"><h2>Security</h2></div><div class="form">
        <div class="field"><label for="np">New PIN (4–8 digits)</label><input id="np" inputmode="numeric" maxlength="8"></div>
        <div><button class="btn red sm" id="pinSave">Change PIN</button></div></div></div>
      <div class="card"><div class="card-h"><h2>Demo data</h2></div><div class="form">
        <p class="note">Sign-ups are saved in this browser for the demo. When the site goes live they'll be stored online, so Jory sees them on any device.</p>
        <div class="toolbar"><button class="btn sm" id="csv2">Export CSV</button><button class="btn danger sm" id="rst">Clear all data</button></div><div id="rz"></div></div></div>`;
    $("#pinSave").onclick = () => { const p = $("#np").value.trim(); if (!/^\d{4,8}$/.test(p)) return toast("Use 4 to 8 digits"); D.settings.pin = p; save(); $("#np").value = ""; toast("PIN changed"); };
    el.insertAdjacentHTML("beforeend", teamCard() + notifCard()); bindNotif(el); bindTeam(el);
    $("#csv2").onclick = exportCSV;
    $("#rst").onclick = () => { $("#rz").innerHTML = `<div class="confirm">Delete every sign-up and payment in this browser? <button class="btn danger sm" id="ry">Clear</button></div>`; $("#ry").onclick = () => { D = B.reset(); toast("All data cleared"); show("dashboard"); }; };
  };

  /* ---------- TEAM (owner only): add coaches and see who has which clients ---------- */
  function teamCard() {
    const st = staffList(), ms = D.leads.filter(isMember);
    return `<div class="card"><div class="card-h"><h2>Team</h2><span class="note">Coaches you add log in with their own email and only see the clients you give them.</span></div>
      <div class="team">${[{ id: "", name: "Jory (you)", email: B.me ? B.me.email : "owner", owner: true }, ...st].map(x => `<div class="tm">${avatar({ name: x.name || x.email })}<span class="grow"><b>${esc(x.name || x.email)}</b><small>${esc(x.email)}${x.owner ? " · owner" : " · coach"}</small></span><span class="tm-n"><b>${ms.filter(l => (l.coach || "") === x.id).length}</b> clients</span>${x.owner ? "" : `<button class="btn sm ghost" data-rmstaff="${esc(x.id)}">Remove</button>`}</div>`).join("")}</div>
      <div class="form team-add"><div class="field"><label for="tmName">Name</label><input id="tmName" placeholder="e.g. Sam Carter"></div><div class="field"><label for="tmEmail">Email</label><input id="tmEmail" type="email" placeholder="sam@builtforlife.uk"></div><div><button class="btn red sm" id="tmAdd">Add coach</button></div></div>
      <p class="note pad">Give a coach a client from the client's profile (Sign-ups or Clients → open them → Coach).</p></div>`;
  }
  function bindTeam(el) {
    const add = $("#tmAdd", el); if (!add) return;
    add.onclick = () => {
      const name = $("#tmName").value.trim(), email = $("#tmEmail").value.trim().toLowerCase();
      if (name.length < 2) return toast("Add their name");
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Add a valid email");
      if (B.me && email === String(B.me.email).toLowerCase()) return toast("That's you");
      D.staff = D.staff || [];
      const ex = D.staff.find(x => x.id === email);
      if (ex) Object.assign(ex, { name, active: true }); else D.staff.push({ id: email, email, name, active: true, added: new Date().toISOString() });
      save(); toast(`${name} added. They log in at the coach panel with ${email}`); show("settings");
    };
    el.addEventListener("click", e => {
      const b = e.target.closest("[data-rmstaff]"); if (!b) return;
      const x = D.staff.find(y => y.id === b.dataset.rmstaff), mine = D.leads.filter(l => l.coach === x.id);
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = mine.length ? `Remove & give their ${mine.length} clients back to you?` : "Sure? Remove"; return; }
      x.active = false; mine.forEach(l => { l.coach = ""; l.coachName = ""; }); save(); toast(`${x.name} removed`); show("settings");
    });
  }

  function setStatus(id, s) {
    const l = D.leads.find(x => x.id === id); if (!l || l.status === s) return;
    l.status = s; save(); toast(`${l.name.split(" ")[0]}: ${LABEL[s]}`); show(current);
  }

  /* lead drawer */
  async function openLead(id) {
    const l = D.leads.find(x => x.id === id); if (!l) return;
    const plan = planOf(l), lose = Math.round((l.weight - l.target) * 10) / 10;
    const wed = l.weddingDate ? new Date(l.weddingDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
    const msg = `Hi ${l.name.split(" ")[0]}, it's Jory from Built For Life. Thanks for doing the transformation check! Based on your answers I'd recommend the ${l.plan}${plan ? ` (${B.gbp(plan.price)})` : ""}. Have you got 15 minutes this week for a quick call so I can talk you through it?`;
    $("#layer").innerHTML = `<div class="scrim" data-close></div><div class="drawer" role="dialog" aria-modal="true">
      <div class="d-h"><div><h2>${esc(l.name)}</h2><p>${esc(l.programme)} · signed up ${ago(l.created)}${l.example ? " · example" : ""}</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="d-b">
        ${!(+l.weight > 0) ? "" : `<div class="ba"><figure><img src="${l.photo}" alt="Before"><figcaption>Now · ${l.weight} kg</figcaption></figure><figure><canvas id="dAfter" width="300" height="400"></canvas><figcaption>${l.future ? "AI preview" : "Target"} · ${l.target} kg</figcaption></figure></div>
        ${l.noPhoto ? '<p class="note">They skipped the photo.</p>' : ""}`}
        ${(D.orders || []).filter(o => o.leadId === l.id).map(o => `<div class="paid-box"><span>Paid ${day(o.created)} · ${esc(o.id)}</span><b>${B.gbp(o.amount)}</b><small>${esc(o.plan)}${o.start ? ` · starts ${day(o.start)}` : ""}</small></div>`).join("")}
        ${isOwner() ? `<div><p class="sec-t">Status</p><div class="seg" id="dS" style="margin-top:8px">${B.STATUSES.map(s => `<button data-s="${s}" class="${l.status === s ? "on" : ""}">${LABEL[s]}</button>`).join("")}</div></div>
        <div><p class="sec-t">Coach</p><select class="coach-sel" id="dCoach"><option value="">Jory (you)</option>${staffList().map(x => `<option value="${esc(x.id)}" ${l.coach === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>${staffList().length ? "" : `<small class="note"> Add coaches in Settings → Team.</small>`}</div>` : `<p class="note">Coach: ${esc(coachLabel(l))}</p>`}
        <div><p class="sec-t">Recommended</p><div class="kv" style="margin-top:8px"><span>Plan</span><b>${esc(l.plan)}${plan ? ` · ${B.gbp(plan.price)}` : ""}</b><span>Goal</span><b>${!(+l.weight > 0) ? "Bought directly: details still missing" : lose < 0 ? `Gain ${-lose} kg (${l.weight} → ${l.target})` : lose > 0 ? `Lose ${lose} kg (${l.weight} → ${l.target})` : "Strength and definition"}</b><span>Time needed</span><b>${+l.weeksNeeded > 0 ? `About ${l.weeksNeeded} weeks` : "—"}</b>${wed ? `<span>Wedding</span><b>${wed}</b>` : ""}</div></div>
        <div id="dAns">${answersHTML(l)}</div>
        ${isMember(l) ? `<div id="dHealth">${healthHTML(l)}</div>` : ""}
        ${isMember(l) ? `<div id="dHabits">${habitsHTML(l)}</div>` : ""}
        ${isMember(l) ? foodHTML(l) : ""}
        <div><p class="sec-t">Notes</p><textarea class="notes" id="dN" placeholder="Call notes, injuries, preferences…">${esc(l.notes)}</textarea></div>
        <div id="dz"></div>
      </div>
      <div class="d-f"><a class="btn red sm" target="_blank" rel="noopener" href="https://wa.me/${waNum(l.phone)}?text=${encodeURIComponent(msg)}">WhatsApp</a><a class="btn sm" href="tel:${esc(l.phone.replace(/\s/g, ""))}">Call</a><a class="btn sm" href="mailto:${esc(l.email)}">Email</a><button class="btn sm" id="dBook">Book session</button>${isMember(l) ? `<button class="btn sm" id="dPlan">Training plan</button><button class="btn sm" id="dChat">Chat</button>` : ""}<button class="btn sm" id="dSave">Save notes</button><button class="btn danger sm" id="dDel" style="margin-left:auto">Delete</button></div>
    </div>`;
    const close = () => { $("#layer").innerHTML = ""; };
    $("#layer").onclick = e => { if (e.target.closest("[data-close]")) close(); };
    if ($("#dCoach")) $("#dCoach").onchange = e => { const x = staffList().find(y => y.id === e.target.value); l.coach = x ? x.id : ""; l.coachName = x ? x.name : ""; save(); toast(x ? `${l.name.split(" ")[0]} is now ${x.name}'s client` : `${l.name.split(" ")[0]} is with you`); };
    if ($("#dS")) $("#dS").onclick = e => { const b = e.target.closest("[data-s]"); if (!b) return; $$("#dS button").forEach(x => x.classList.toggle("on", x === b)); setStatus(l.id, b.dataset.s); };
    if ($("#dPlan")) $("#dPlan").onclick = () => { $("#layer").innerHTML = ""; tr.client = l.id; tr.tab = "plan"; tr.week = 0; show("training"); };
    if ($("#dChat")) $("#dChat").onclick = () => { $("#layer").innerHTML = ""; msgState.client = l.id; show("messages"); };
    $("#dBook").onclick = () => eventForm({ leadId: l.id, type: l.status === "client" && !(D.events || []).some(x => x.leadId === l.id && x.type === "kickoff") ? "kickoff" : "session" });
    $("#dSave").onclick = () => { l.notes = $("#dN").value; save(); toast("Notes saved"); };
    bindAnswers(l); bindHealth(l); bindHabits(l);
    $("#dDel").onclick = () => { $("#dz").innerHTML = `<div class="confirm">Delete ${esc(l.name)} and their photo for good? <button class="btn danger sm" id="dy">Delete</button></div>`; $("#dy").onclick = () => { D.leads = D.leads.filter(x => x.id !== l.id); D.events = (D.events || []).filter(x => x.leadId !== l.id); ["workouts", "checkins", "messages"].forEach(k => D[k] = (D[k] || []).filter(x => x.leadId !== l.id)); save(); close(); toast("Deleted"); show(current); }; };
    try { const img = await M.loadPair(l.photo, l.future); M.draw($("#dAfter").getContext("2d"), img, 300, 400, 1, l.noPhoto ? 0.12 : M.strength(l.weight, l.target)); } catch (e) {}
  }
  addEventListener("keydown", e => { if (e.key === "Escape") $("#layer").innerHTML = ""; });

  /* ---------- a client's details: shown safely ("—" when missing) and editable by Jory ---------- */
  const val = (v, suf) => v === 0 || (v != null && v !== "" && v !== "undefined") ? esc(v) + (suf || "") : `<span class="miss">—</span>`;
  const quizTwin = l => D.leads.filter(x => x !== l && x.email && String(x.email).toLowerCase() === String(l.email || "").toLowerCase() && !B.missing(x).length).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
  function answersHTML(l) {
    const miss = B.missing(l), twin = miss.length ? quizTwin(l) : null;
    return `<div class="row-h"><p class="sec-t">Their details</p><button class="btn sm" id="dEdit">${miss.length ? "Add details" : "Edit details"}</button></div>
      ${miss.length ? `<div class="miss-box"><b>Missing: ${esc(miss.join(", "))}</b><span>${l.profileDone ? "" : "They'll be asked for these when they log in to their portal. "}Or ask them in chat and fill them in here.</span><span class="toolbar">${twin ? `<button class="btn red sm" id="dTwin">Use their questionnaire answers (${esc(day(twin.created))})</button>` : ""}<button class="btn sm" id="dAsk">Ask in chat</button></span></div>` : ""}
      <div class="kv" style="margin-top:8px">
      <span>In their words</span><b>${val(l.goal)}</b><span>Sex</span><b>${val(l.sex && l.sex[0].toUpperCase() + l.sex.slice(1))}</b><span>Age</span><b>${val(+l.age > 0 ? l.age : "")}</b><span>Height</span><b>${val(+l.height > 0 ? l.height : "", " cm")}</b>
      <span>Weight → target</span><b>${+l.weight > 0 && +l.target > 0 ? `${esc(l.weight)} → ${esc(l.target)} kg` : val("")}</b>
      <span>Training days</span><b>${val(l.days, " a week")}</b><span>Experience</span><b>${val(l.experience)}</b><span>Trains at</span><b>${val(l.where)}</b>
      <span>Diet</span><b>${val(l.diet)}</b><span>Sleep</span><b>${val(+l.sleep > 0 ? l.sleep : "", " hrs")}</b>${l.programme === "Bridal Bootcamp" ? `<span>Wedding</span><b>${val(l.weddingDate)}</b>` : ""}
      <span>Phone</span><b>${val(l.phone)}</b><span>Email</span><b>${val(l.email)}</b></div>`;
  }
  /* ---------- daily habits: Jory chooses them per client ---------- */
  function habitsHTML(l, editing) {
    const hs = B.habitsOf(l), days = [...Array(7)].map((_, i) => ymd(new Date(Date.now() - i * 864e5)));
    const pct = h => Math.round(days.filter(d => B.habitDone(h, (((D.food || {})[l.id + "|" + d] || {}).habits || {})[h.id])).length / 7 * 100);
    if (editing) return `<div class="row-h"><p class="sec-t">Habits</p></div><div class="hb-ed">${hs.map((h, i) => `<div class="hb-r"><input data-hn="${i}" value="${esc(h.name)}"><select data-hk="${i}"><option value="check" ${h.kind === "check" ? "selected" : ""}>Tick</option><option value="count" ${h.kind === "count" ? "selected" : ""}>Number</option></select><input data-ht="${i}" inputmode="numeric" placeholder="target" value="${h.kind === "count" ? esc(h.target || "") : ""}" ${h.kind === "count" ? "" : "hidden"}><button class="btn sm ghost" data-hx="${i}" aria-label="Remove">✕</button></div>`).join("")}
      <div class="hb-pre">${B.HABIT_PRESETS.filter(p => !hs.some(h => h.id === p.id)).map(p => `<button class="chip-q" data-hp="${esc(p.id)}">+ ${esc(p.name)}</button>`).join("")}<button class="chip-q" data-hp="custom">+ Your own</button></div>
      <div class="toolbar"><button class="btn red sm" id="hbSave">Save habits</button><button class="btn sm" id="hbCancel">Cancel</button></div></div>`;
    return `<div class="row-h"><p class="sec-t">Habits · last 7 days</p><button class="btn sm" id="hbEdit">Edit habits</button></div>
      ${hs.length ? `<div class="hb-sum">${hs.map(h => `<div><span>${esc(h.name)}</span><i><b style="width:${pct(h)}%"></b></i><em>${pct(h)}%</em></div>`).join("")}</div>` : `<p class="note">No habits set.</p>`}`;
  }
  function bindHabits(l) {
    const box = $("#dHabits"); if (!box) return;
    let draft = null;
    const paint = () => { box.innerHTML = habitsHTML(Object.assign({}, l, draft ? { habits: draft } : {}), !!draft); };
    box.onclick = e => {
      const t = e.target;
      if (t.id === "hbEdit") { draft = B.habitsOf(l).map(h => ({ ...h })); return paint(); }
      if (t.id === "hbCancel") { draft = null; return paint(); }
      const read = () => $$(".hb-r", box).forEach((r, i) => { draft[i].name = $(`[data-hn="${i}"]`, box).value.trim() || draft[i].name; draft[i].kind = $(`[data-hk="${i}"]`, box).value; draft[i].target = +$(`[data-ht="${i}"]`, box).value || 0; });
      if (t.dataset.hx != null) { read(); draft.splice(+t.dataset.hx, 1); return paint(); }
      if (t.dataset.hp) { read(); const p = B.HABIT_PRESETS.find(x => x.id === t.dataset.hp); draft.push(p ? { ...p } : { id: B.uid("h"), name: "New habit", kind: "check" }); return paint(); }
      if (t.id === "hbSave") { read(); l.habits = draft.filter(h => h.name).map(h => h.kind === "count" ? { ...h, target: h.target || 1 } : { id: h.id, name: h.name, kind: "check" }); draft = null; save(); toast("Habits saved. They show on their Today screen."); paint(); }
    };
    box.onchange = e => { const k = e.target.dataset.hk; if (k != null) { const ti = $(`[data-ht="${k}"]`, box); ti.hidden = e.target.value !== "count"; if (!ti.hidden && !ti.value) ti.value = 8000; } };
  }
  /* ---------- their food, last 7 days ---------- */
  function foodHTML(l) {
    const tg = Object.assign({ kcal: l.sex === "male" ? 2300 : 1850, protein: Math.round(Math.max(100, (+l.target || +l.weight || 70) * 1.8)) }, l.targets || {});
    const days = [...Array(7)].map((_, i) => ymd(new Date(Date.now() - i * 864e5)));
    const rows = days.map(d => ({ d, f: (D.food || {})[l.id + "|" + d] })).filter(r => r.f && (r.f.kcal || r.f.protein || (r.f.items || []).length));
    if (!rows.length) return `<div><p class="sec-t">Food · last 7 days</p><p class="note">Nothing logged yet.</p></div>`;
    return `<div><p class="sec-t">Food · last 7 days</p><div class="tbl"><table class="food-t"><thead><tr><th>Day</th><th>Calories</th><th>Protein</th><th>Logged</th></tr></thead><tbody>${rows.map(r => `<tr><td>${new Date(r.d + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</td><td class="${r.f.kcal > tg.kcal * 1.1 ? "warn" : ""}">${Math.round(r.f.kcal || 0)} / ${tg.kcal}</td><td class="${(r.f.protein || 0) >= tg.protein ? "ok" : ""}">${Math.round(r.f.protein || 0)}g / ${tg.protein}g</td><td><small>${esc((r.f.items || []).map(i => i.name).slice(0, 4).join(", ") || "quick adds")}</small></td></tr>`).join("")}</tbody></table></div></div>`;
  }
  /* ---------- health questionnaire ---------- */
  function healthHTML(l) {
    const h = l.health;
    if (!h) return `<p class="sec-t">Health form</p><div class="miss-box"><b>Not signed yet</b><span>They're asked to fill it in when they log in to their portal.</span><button class="btn sm" id="hPaper">Got a paper form instead</button></div>`;
    if (h.paper) return `<p class="sec-t">Health form</p><p class="note">Paper form on file (noted ${day(h.signedAt)}).</p>`;
    const yes = B.HEALTH_Q.map((q, i) => h.answers[i] ? q : null).filter(Boolean), cl = l.healthCleared;
    return `<div class="row-h"><p class="sec-t">Health form</p><span class="fl ${yes.length && !cl ? "fl-warn" : "fl-ok"}">${yes.length ? (cl ? "Cleared to train" : `${yes.length} to review`) : "All clear"}</span></div>
      <div class="kv" style="margin-top:8px"><span>Signed</span><b>${esc(h.signedName)} · ${new Date(h.signedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</b>
      <span>Emergency contact</span><b>${esc((h.emergency || {}).name || "—")} · <a href="tel:${esc(String((h.emergency || {}).phone || "").replace(/\s/g, ""))}">${esc((h.emergency || {}).phone || "")}</a></b></div>
      ${yes.length ? `<div class="hq-yes">${yes.map(q => `<p><b>Yes:</b> ${esc(q)}</p>`).join("")}${h.details ? `<p class="hq-det">“${esc(h.details)}”</p>` : ""}
        ${cl ? `<p class="note">Cleared by ${esc(cl.by)} on ${day(cl.at)}${cl.note ? ` · ${esc(cl.note)}` : ""}</p>` : `<div class="toolbar"><input id="hNote" placeholder="e.g. GP letter received, avoid heavy overhead work"><button class="btn red sm" id="hClear">Cleared to train</button></div>`}</div>` : ""}`;
  }
  function bindHealth(l) {
    const box = $("#dHealth"); if (!box) return;
    box.onclick = e => {
      if (e.target.id === "hClear") { l.healthCleared = { by: (B.me && (B.me.name || B.me.email)) || "Jory", at: new Date().toISOString(), note: ($("#hNote").value || "").trim() }; save(); toast("Marked as cleared"); box.innerHTML = healthHTML(l); }
      if (e.target.id === "hPaper") { l.health = { v: 1, paper: true, answers: [], flags: 0, signedAt: new Date().toISOString() }; save(); box.innerHTML = healthHTML(l); }
    };
  }
  function bindAnswers(l) {
    if ($("#dTwin")) $("#dTwin").onclick = () => {
      const src = quizTwin(l); if (!src) return;
      ["sex", "age", "height", "weight", "target", "goal", "days", "experience", "where", "diet", "sleep", "weeksNeeded", "weddingDate"].forEach(k => { if ((l[k] == null || l[k] === "" || l[k] === 0) && src[k] != null && src[k] !== "") l[k] = src[k]; });
      if ((l.noPhoto || !l.photo) && src.photo && !src.noPhoto) { l.photo = src.photo; l.noPhoto = false; }
      if (!l.future && src.future) l.future = src.future;
      l.noQuiz = false; l.fromQuiz = src.id; save(); toast("Answers copied from their questionnaire"); openLead(l.id);
    };
    if ($("#dAsk")) $("#dAsk").onclick = () => {
      const miss = B.missing(l);
      sendMsg(l.id, `Hi ${l.name.split(" ")[0]}, a few things are missing from your profile so I can set up your plan properly: your ${miss.join(", ")}. You can add them in your portal (tap the person icon at the top) or just reply here and I'll fill them in.`);
      save(); toast("Asked in their chat"); $("#dAsk").disabled = true; $("#dAsk").textContent = "Asked";
    };
    $("#dEdit").onclick = () => {
      const O = B.OPTIONS, opt = (list, v) => `<option value=""${v ? "" : " selected"}>—</option>` + list.map(o => `<option${String(v).toLowerCase() === o.toLowerCase() ? " selected" : ""}>${esc(o)}</option>`).join("");
      const n = v => +v > 0 ? v : "";
      $("#dAns").innerHTML = `<div class="row-h"><p class="sec-t">Edit details</p></div><div class="form ed-grid">
        <div class="field"><label for="eNm">Name</label><input id="eNm" value="${esc(l.name || "")}"></div>
        <div class="field"><label for="eSx">Sex</label><select id="eSx">${opt(O.sex, l.sex)}</select></div>
        <div class="field"><label for="eAg">Age</label><input id="eAg" inputmode="numeric" value="${n(l.age)}"></div>
        <div class="field"><label for="eHt">Height (cm)</label><input id="eHt" inputmode="numeric" value="${n(l.height)}"></div>
        <div class="field"><label for="eWt">Weight now (kg)</label><input id="eWt" inputmode="decimal" value="${n(l.weight)}"></div>
        <div class="field"><label for="eTg">Target weight (kg)</label><input id="eTg" inputmode="decimal" value="${n(l.target)}"></div>
        <div class="field"><label for="eDy">Training days</label><select id="eDy">${opt(O.days, l.days)}</select></div>
        <div class="field"><label for="eEx">Experience</label><select id="eEx">${opt(O.experience, l.experience)}</select></div>
        <div class="field"><label for="eWh">Trains at</label><select id="eWh">${opt(O.where, l.where)}</select></div>
        <div class="field"><label for="eDi">Diet</label><select id="eDi">${opt(O.diet, l.diet)}</select></div>
        <div class="field"><label for="eSl">Sleep (hours)</label><input id="eSl" inputmode="decimal" value="${n(l.sleep)}"></div>
        ${l.programme === "Bridal Bootcamp" ? `<div class="field"><label for="eWd">Wedding date</label><input id="eWd" type="date" value="${esc(l.weddingDate || "")}"></div>` : ""}
        <div class="field"><label for="ePh">Phone</label><input id="ePh" value="${esc(l.phone || "")}"></div>
        <div class="field"><label for="eEm">Email</label><input id="eEm" type="email" value="${esc(l.email || "")}"></div>
        <div class="field wide"><label for="eGl">Goal, in their words</label><textarea id="eGl" rows="2">${esc(l.goal || "")}</textarea></div>
        <p class="err wide" id="eErr" role="alert"></p>
        <div class="toolbar wide"><button class="btn red sm" id="eSave">Save details</button><button class="btn sm" id="eCancel">Cancel</button></div></div>`;
      $("#eCancel").onclick = () => { $("#dAns").innerHTML = answersHTML(l); bindAnswers(l); };
      $("#eSave").onclick = () => {
        const g = id => $("#" + id).value.trim(), num = id => { const v = parseFloat(g(id).replace(",", ".")); return Number.isFinite(v) ? v : null; };
        const chk = (id, lo, hi, label) => { const v = num(id); if (g(id) && (v == null || v < lo || v > hi)) { $("#eErr").textContent = `${label} looks wrong.`; return false; } return true; };
        if (!chk("eAg", 14, 100, "Age") || !chk("eHt", 120, 230, "Height") || !chk("eWt", 30, 300, "Weight") || !chk("eTg", 30, 300, "Target weight") || !chk("eSl", 0, 24, "Sleep")) return;
        if (g("eEm") && !/^\S+@\S+\.\S+$/.test(g("eEm"))) { $("#eErr").textContent = "That email doesn't look right."; return; }
        Object.assign(l, { name: g("eNm") || l.name, sex: g("eSx").toLowerCase(), age: num("eAg") || "", height: num("eHt") || "", weight: num("eWt") || 0, target: num("eTg") || 0,
          days: g("eDy"), experience: g("eEx"), where: g("eWh"), diet: g("eDi"), sleep: num("eSl") || "", phone: g("ePh"), email: g("eEm"), goal: g("eGl") });
        if ($("#eWd")) l.weddingDate = g("eWd") || null;
        if (+l.weight > 0 && +l.target > 0) { l.weeksNeeded = B.project(l.weight, l.target).weeks; }
        if (!B.missing(l).length) l.profileDone = true;
        save(); toast("Details saved"); openLead(l.id);
      };
    };
  }

  function exportCSV() {
    const cols = ["created", "status", "name", "phone", "email", "programme", "plan", "sex", "age", "height", "weight", "target", "weeksNeeded", "weddingDate", "days", "experience", "where", "diet", "sleep", "goal", "notes"];
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...D.leads.map(l => cols.map(c => q(l[c])).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "bfl-signups.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  if (B.live) { if (B.me && (B.me.role === "coach" || B.me.role === "staff")) enter(); }
  else if (inSession()) enter(); else setTimeout(() => $("#pin").focus(), 80);
});
