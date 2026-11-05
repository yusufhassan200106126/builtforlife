/* =========================================================
   Built For Life — client portal ("My Built For Life")
   LIVE: login is by email + a 6-digit code sent by email; workouts,
   check-ins, food and messages are saved on the server and stream live
   to and from the coach panel on any device.
   DEMO: the code is shown on screen and everything is saved in this browser.
   ========================================================= */
window.BFL.ready.then(function () {
  const B = window.BFL, M = window.BFLMorph, esc = B.esc;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SESSION = "bfl:portal:me";
  let D = B.get(), me = null, route = "today", param = "";

  const today = () => B.ymd(new Date());
  // their coach: Jory, or the coach Jory has given them to
  const CN = () => (me && me.coachName) || "Jory", CI = () => CN()[0].toUpperCase();
  const parse = s => new Date(s + "T00:00:00");
  const nice = (s, o = { weekday: "short", day: "numeric", month: "short" }) => parse(s).toLocaleDateString("en-GB", o);
  const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 6e4); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
  const timeOf = iso => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const save = () => { if (!B.save()) toast("Couldn't save. Your browser storage may be full."); };
  function toast(m) { const t = document.createElement("div"); t.className = "pt-toast"; t.textContent = m; $("#toasts").append(t); setTimeout(() => t.remove(), 2600); }
  const icon = {
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M7 4l13 8-13 8z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>',
    cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l7-7"/></svg>',
    timer: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
    scan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M7 8v8M10 8v8M13 8v8M16 8v8"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5"/></svg>'
  };

  /* ---------- who's logged in ---------- */
  const isMember = l => l && (l.status === "client" || (D.orders || []).some(o => o.leadId === l.id && /^(paid|overdue)$/.test(o.status)));
  function findMember(email) {
    const e = String(email || "").trim().toLowerCase();
    const ls = D.leads.filter(l => (l.email || "").toLowerCase() === e);
    return ls.find(isMember) || null;
  }
  function loadMe() {
    if (B.live) { const id = B.me && B.me.role === "client" ? B.me.lead : null; me = id ? (D.leads.find(l => l.id === id) || D.leads.find(isMember) || null) : null; return; }
    let id = null; try { id = localStorage.getItem(SESSION); } catch (e) {} me = D.leads.find(l => l.id === id) || null; if (me && !isMember(me)) me = null; }
  /* bought separately from the questionnaire? copy their questionnaire answers across so nobody is asked twice */
  const QUIZ = ["sex", "age", "height", "weight", "target", "goal", "days", "experience", "where", "diet", "sleep", "weeksNeeded", "weddingDate"];
  function adoptAnswers() {
    if (!me || !B.missing(me).length) return;
    const em = String(me.email || "").toLowerCase();
    const src = D.leads.filter(l => l !== me && String(l.email || "").toLowerCase() === em && !B.missing(l).length).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
    if (!src) return;
    QUIZ.forEach(k => { if ((me[k] == null || me[k] === "" || me[k] === 0) && src[k] != null && src[k] !== "") me[k] = src[k]; });
    if ((me.noPhoto || !me.photo) && src.photo && !src.noPhoto) { me.photo = src.photo; me.noPhoto = false; }
    if (!me.future && src.future) me.future = src.future;
    me.noQuiz = false; me.fromQuiz = src.id;
    B.save();
  }
  function setMe(l) { me = l; try { localStorage.setItem(SESSION, l ? l.id : ""); } catch (e) {} }

  /* ---------- the client's data ---------- */
  const myOrder = () => (D.orders || []).filter(o => o.leadId === me.id && /^(paid|overdue)$/.test(o.status)).sort((a, b) => new Date(b.created) - new Date(a.created))[0];
  const myPlan = () => { const o = myOrder(); return B.findPlan(o ? o.planId || o.plan : me.plan) || { name: me.plan || "Your plan", weeks: 12 }; };
  const planStart = () => { const o = myOrder(); return o && o.start ? parse(o.start) : o ? new Date(new Date(o.created).setHours(0, 0, 0, 0)) : new Date(); };
  const planWeek = () => Math.max(1, Math.min(myPlan().weeks, Math.floor((Date.now() - planStart()) / 6048e5) + 1));
  const myWorkouts = () => D.workouts.filter(w => w.leadId === me.id).sort((a, b) => a.date.localeCompare(b.date));
  const myCheckins = () => D.checkins.filter(c => c.leadId === me.id).sort((a, b) => a.at.localeCompare(b.at));
  const myMsgs = () => D.messages.filter(m => m.leadId === me.id).sort((a, b) => a.at.localeCompare(b.at));
  const unread = () => myMsgs().filter(m => m.from === "coach" && !m.readByClient).length;
  const targets = () => Object.assign({ kcal: me.sex === "male" ? 2300 : 1850, protein: Math.round(Math.max(100, (+me.target || +me.weight || (me.sex === "male" ? 80 : 65)) * 1.8)), water: 2.5 }, me.targets || {});
  const foodKey = (d = today()) => me.id + "|" + d;
  const foodDay = (d = today()) => Object.assign({ kcal: 0, protein: 0, water: 0 }, D.food[foodKey(d)] || {});
  const setsDone = w => w.items.reduce((n, it) => n + ((w.log || {})[it.id] || []).filter(s => s && s.done).length, 0);
  const setsTotal = w => w.items.reduce((n, it) => n + (+it.sets || 0), 0);
  const nowWeight = () => { const c = myCheckins(); return c.length ? +c[c.length - 1].weight : +me.weight || 0; };
  function streak() {
    const days = new Set();
    myWorkouts().filter(w => w.done && w.doneAt).forEach(w => days.add(w.doneAt.slice(0, 10)));
    myCheckins().forEach(c => days.add(c.date));
    Object.keys(D.food).filter(k => k.startsWith(me.id + "|") && (D.food[k].protein > 0 || D.food[k].water > 0)).forEach(k => days.add(k.split("|")[1]));
    let n = 0, d = new Date(); if (!days.has(B.ymd(d))) d = B.addDays(d, -1);
    while (days.has(B.ymd(d))) { n++; d = B.addDays(d, -1); }
    return n;
  }
  const checkinDue = () => { const c = myCheckins(); return !c.length ? (Date.now() - planStart()) > 2 * 864e5 || myWorkouts().some(w => w.done) : (Date.now() - new Date(c[c.length - 1].at)) > 6 * 864e5; };

  /* ---------- routing ---------- */
  function go(h) { if (location.hash !== "#" + h) location.hash = h; else render(); }
  addEventListener("hashchange", () => render());
  function render(keepScroll) {
    D = B.get(); loadMe(); adoptAnswers();
    const h = (location.hash || "#today").slice(1), [r, p] = h.split("/");
    route = r || "today"; param = p || "";
    const v = $("#view"), sy = scrollY;
    if (!me) { $("#nav").hidden = true; v.className = "pt-view login"; v.innerHTML = loginView(); bindLogin(); return; }
    const views = { today: todayView, train: trainView, w: workoutView, food: foodView, progress: progressView, checkin: checkinView, chat: chatView, profile: profileView, health: healthView, book: bookView, team: teamView };
    if (!views[route]) route = "today";
    // bought without the questionnaire? ask for their details first (once per visit)
    if (B.missing(me).length && !me.profileDone && route === "today" && !askedProfile) { askedProfile = true; route = "profile"; history.replaceState(null, "", "#profile"); }
    else if (!me.health && route === "today" && !askedHealth) { askedHealth = true; route = "health"; history.replaceState(null, "", "#health"); }
    $("#nav").hidden = route === "w" || route === "checkin" || route === "profile" || route === "health";
    $$("#nav a").forEach(a => a.classList.toggle("on", a.dataset.r === (route === "book" ? "today" : route)));
    if (route === "book" && prevRoute !== "book") slotsCache = null; // fresh free times each visit
    if (route === "team" && prevRoute !== "team") commCache = null;
    prevRoute = route;
    $$("#nav a").forEach(a => a.classList.toggle("on", a.dataset.r === route));
    const n = unread(); $("#chatBadge").hidden = !n; $("#chatBadge").textContent = n; $("#navCoach").textContent = CN().split(" ")[0];
    v.className = "pt-view r-" + route + (keepScroll ? "" : " enter");
    v.innerHTML = views[route]();
    (binds[route] || (() => {}))();
    if (keepScroll) scrollTo(0, sy); else { scrollTo(0, 0); }
    if (route === "chat") { const t = $(".chat-thread"); if (t) t.scrollTop = t.scrollHeight; markRead(); }
  }
  const binds = {};
  let askedProfile = false, askedHealth = false, prevRoute = null;

  /* ---------- login ---------- */
  let pendingCode = null, pendingLead = null;
  function loginView() {
    const pre = new URLSearchParams(location.search).get("email") || "";
    const members = D.leads.filter(isMember);
    return `<div class="lg-art" aria-hidden="true"><img src="assets/coaching.jpg" alt=""><p>Built For Life<br><b>Personal training for life.</b></p></div><section class="lg">
      <div class="lg-mark"><span class="logo-mark">B</span></div>
      <p class="kicker">My Built For Life</p>
      <h1 class="lg-h">Your plan,<br><em>your progress.</em></h1>
      ${pendingLead ? `<form class="lg-form" id="codeForm" novalidate>
          <p class="lg-p">We've sent a 6-digit code to <b>${esc(pendingLead.email)}</b>.</p>
          ${pendingCode ? `<p class="demo-code">${B.live ? "Test mode" : "Demo"}: your code is <b>${pendingCode}</b>${B.live ? "" : " (on the live site it arrives by email)"}</p>` : `<p class="lg-p">Check your inbox (and spam folder). It can take a minute.</p>`}
          <label class="fld"><span>Code</span><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></label>
          <p class="err" id="lgErr" role="alert"></p>
          <button class="btn red full" type="submit"><span>Log in</span></button>
          <button class="link" type="button" id="lgBack">Use a different email</button>
        </form>`
      : `<form class="lg-form" id="lgForm" novalidate>
          <p class="lg-p">Log in with the email you used when you joined. No password needed.</p>
          <label class="fld"><span>Email</span><input id="lgEmail" type="email" autocomplete="email" value="${esc(pre)}" placeholder="you@email.com"></label>
          <p class="err" id="lgErr" role="alert"></p>
          <button class="btn red full" type="submit"><span>Send me a code</span></button>
        </form>
        ${B.live ? "" : members.length ? `<div class="demo-who"><p>Demo: members in this browser</p>${members.slice(0, 6).map(l => `<button type="button" class="chip" data-email="${esc(l.email)}">${esc(l.name)}</button>`).join("")}</div>` : `<p class="demo-who"><span>Demo: buy a plan on the website first, then log in here with that email.</span></p>`}`}
      <a class="lg-site" href="index.html">← Back to the website</a>
    </section>`;
  }
  function bindLogin() {
    const f = $("#lgForm");
    if (f) {
      f.onsubmit = async e => {
        e.preventDefault();
        if (B.live) {
          const email = $("#lgEmail").value.trim(), btn = $("button[type=submit]", f);
          if (!/^\S+@\S+\.\S+$/.test(email)) { $("#lgErr").textContent = "Please enter the email you joined with."; return; }
          btn.disabled = true; $("#lgErr").textContent = "";
          try { const r = await B.authStart(email, "client"); pendingLead = { email }; pendingCode = r.code || null; render(); setTimeout(() => { const c = $("#code"); if (c) c.focus(); }, 50); }
          catch (x) { $("#lgErr").textContent = x.message; btn.disabled = false; }
          return;
        }
        D = B.reload();
        const l = findMember($("#lgEmail").value);
        if (!l) { $("#lgErr").textContent = "We can't find a membership with that email. Use the email you paid with, or message Jory."; return; }
        pendingLead = l; pendingCode = String(Math.floor(100000 + Math.random() * 900000)); render();
        setTimeout(() => { const c = $("#code"); if (c) c.focus(); }, 50);
      };
      $$(".demo-who [data-email]").forEach(b => b.onclick = () => { $("#lgEmail").value = b.dataset.email; f.requestSubmit(); });
      if (!$("#lgEmail").value) setTimeout(() => $("#lgEmail").focus(), 50);
    }
    const c = $("#codeForm");
    if (c) {
      c.onsubmit = async e => {
        e.preventDefault();
        if (B.live) {
          const btn = $("button[type=submit]", c); btn.disabled = true; $("#lgErr").textContent = "";
          try { await B.authVerify(pendingLead.email, $("#code").value.trim(), "client"); history.replaceState(null, "", location.pathname + "#today"); location.reload(); }
          catch (x) { $("#lgErr").textContent = x.message; btn.disabled = false; }
          return;
        }
        if ($("#code").value.trim() !== pendingCode) { $("#lgErr").textContent = "That code isn't right. Check and try again."; return; }
        setMe(pendingLead); pendingLead = pendingCode = null;
        history.replaceState(null, "", location.pathname + "#today"); render();
        toast(`Welcome, ${me.name.split(" ")[0]}`);
      };
      $("#lgBack").onclick = () => { pendingLead = pendingCode = null; render(); };
    }
  }

  /* ---------- TODAY ---------- */
  function todayView() {
    const first = me.name.split(" ")[0], h = new Date().getHours(), hi = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
    const plan = myPlan(), wk = planWeek(), pct = Math.round(wk / plan.weeks * 100), st = streak();
    const ws = myWorkouts(), t = today();
    const todayW = ws.find(w => w.date === t) || ws.find(w => w.date > t && !w.done);
    const wed = me.weddingDate ? Math.ceil((parse(me.weddingDate) - parse(t)) / 864e5) : null;
    const tg = targets(), fd = foodDay();
    const next = (D.events || []).filter(e => e.leadId === me.id && e.date >= t && !e.done && !/cancelled|declined/.test(e.status || "")).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    const lastCoach = myMsgs().filter(m => m.from === "coach").pop();
    const bar = (v, max, c) => `<i class="bar"><span style="width:${Math.min(100, max ? v / max * 100 : 0)}%;background:${c}"></span></i>`;
    return `
      <header class="hd">
        <span class="logo-mark sm">B</span>
        <div class="hd-t"><span class="kick">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span><h1>${hi}, ${esc(first)}</h1></div>
        <a class="round" href="#profile" aria-label="My details">${icon.user}</a><button class="round" id="logout" aria-label="Log out">${icon.out}</button>
      </header>
      ${B.missing(me).length ? `<a class="card due s1" href="#profile"><span class="sq">${icon.user}</span><span class="grow"><b>Finish your profile</b><small>Jory still needs your ${esc(B.missing(me).join(", "))} · 1 min</small></span>${icon.chev}</a>` : ""}
      <div id="appSlot"></div>
      ${!me.health ? `<a class="card due s1" href="#health"><span class="sq">${icon.heart}</span><span class="grow"><b>Sign your health form</b><small>A few yes/no questions so ${esc(CN())} can keep you safe · 1 min</small></span>${icon.chev}</a>` : ""}
      ${(() => { const o = myOrder(); if (!o || o.status !== "overdue") return ""; return `<a class="card due pay-bad s1" href="${esc(o.payUrl || "#chat")}" ${o.payUrl ? 'target="_blank" rel="noopener"' : ""}><span class="sq">£</span><span class="grow"><b>Your last payment didn't go through</b><small>Tap to pay securely. Your plan carries on as normal.</small></span>${icon.chev}</a>`; })()}
      <section class="card plan s1">
        <div class="row"><b>${esc(plan.name)}</b><span class="mono">Week ${wk} of ${plan.weeks}</span></div>
        ${(() => { const o = myOrder(); return o && o.payType === "monthly" && (o.paidCount || 1) < o.instalments ? `<div class="row pay-row-m"><span class="muted">Payment ${o.paidCount || 1} of ${o.instalments}</span><span class="mono">Next ${B.gbp(o.each)}${o.nextDue ? " · " + nice(o.nextDue) : ""}</span></div>` : ""; })()}
        <i class="bar thick"><span style="width:${pct}%"></span></i>
        <div class="row chips"><span>${icon.flame}<b>${st} day</b> streak</span>${wed != null && wed >= 0 ? `<span>${icon.heart}Wedding in <b>${wed} days</b></span>` : ""}</div>
      </section>
      ${todayW ? `<a class="hero s2" href="#w/${todayW.id}">
          <img src="${esc(B.ex((todayW.items[0] || {}).exId).img)}" alt="">
          <span class="tag">${todayW.date === t ? (todayW.done ? "Done today" : "Today's workout") : "Next workout · " + nice(todayW.date)}</span>
          <div class="hero-b"><div><h2>${esc(todayW.title)}</h2><span class="mono">${todayW.mins} min · ${todayW.items.length} exercises · ${esc(todayW.where)}</span></div>
          <span class="go">${todayW.done ? icon.check + "Done" : (setsDone(todayW) ? "Resume" : "Start") + icon.play}</span></div>
          ${setsDone(todayW) && !todayW.done ? `<i class="bar hero-bar"><span style="width:${setsDone(todayW) / Math.max(1, setsTotal(todayW)) * 100}%"></span></i>` : ""}
        </a>` : `<section class="card empty-plan s2"><b>Jory is building your plan</b><p>Your workouts will appear here as soon as he's set them. You'll get a message when they're ready.</p></section>`}
      ${checkinDue() ? `<a class="card due s3" href="#checkin"><span class="sq">${icon.check}</span><span class="grow"><b>Weekly check-in is due</b><small>Weight, photo and how the week went · 2 min</small></span>${icon.chev}</a>` : ""}
      ${lastCoach && !lastCoach.readByClient ? `<a class="card msg s3" href="#chat"><span class="av">${CI()}</span><span class="grow"><b>${esc(CN())}</b><small>${esc(lastCoach.text || "Sent a photo")}</small></span><span class="dot"></span></a>` : ""}
      ${habitsCard()}
      <a class="card food s4" href="#food">
        <div class="row"><span class="kick">Today's food</span><span class="muted">Set by Jory</span></div>
        <div class="tri">
          <div><b>${fd.kcal.toLocaleString("en-GB")}<small> / ${tg.kcal.toLocaleString("en-GB")}</small></b>${bar(fd.kcal, tg.kcal, "#F2F0EB")}<span>Calories</span></div>
          <div><b>${fd.protein}g<small> / ${tg.protein}g</small></b>${bar(fd.protein, tg.protein, "#E3242B")}<span>Protein</span></div>
          <div><b>${(+fd.water).toFixed(1)}L<small> / ${tg.water}L</small></b>${bar(fd.water, tg.water, "#7fb2ff")}<span>Water</span></div>
        </div>
      </a>
      ${next ? `<section class="card next s5"><div class="date"><span>${parse(next.date).toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span><b>${parse(next.date).getDate()}</b></div><div class="grow"><b>${esc(({ session: "PT session", checkin: "Check-in call", kickoff: "Kick-off call", consult: "Consultation" })[next.type] || "Session")} with ${esc(CN())}</b><small>${next.time} · ${next.mins} min · ${esc(next.where || "")}${next.status === "requested" ? " · waiting for " + esc(CN()) + " to confirm" : ""}</small></div><a class="mini-btn" href="#book">Manage</a></section>` : ""}
      <a class="card book-cta s5" href="#book"><span class="sq">${icon.cal}</span><span class="grow"><b>Book a session</b><small>Pick a time that suits you</small></span>${icon.chev}</a>
    `;
  }
  binds.today = () => { $("#logout").onclick = async () => { if (B.live) { await B.logout(); location.replace(location.pathname); return; } setMe(null); toast("Logged out"); render(); }; appCard(); };

  /* ---------- TEAM: challenges + community wall ---------- */
  let commCache = null, postImg = null;
  const C = window.BFLCommunity;
  function teamView() {
    const on = me.community !== false, t = today();
    const posts = (D.posts || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 60);
    const chs = commCache ? commCache.challenges.filter(c => c.status !== "ended" || c.end >= B.ymd(B.addDays(new Date(), -7))) : null;
    return `
      <header class="hd"><div class="hd-t"><span class="kick">Built For Life team</span><h1>Challenges<br>&amp; community</h1></div></header>
      ${!chs ? `<section class="card s1"><p class="muted">Loading challenges…</p></section>` : chs.length ? chs.map((c, k) => `<section class="card chal s${Math.min(3, k + 1)} ${c.status}">
          <div class="row"><span class="kick">${c.status === "live" ? `Live · ends ${nice(c.end)}` : c.status === "soon" ? `Starts ${nice(c.start)}` : "Finished"}</span><span class="mono">${c.count} in</span></div>
          <h2>${esc(c.title)}</h2>${c.prize ? `<p class="prize">🏆 ${esc(c.prize)}</p>` : ""}<p class="muted small">${esc((C.METRICS[c.metric] || {}).label || "")}${c.desc ? " · " + esc(c.desc) : ""}</p>
          ${on ? `<ol class="lb">${c.board.map(r => `<li class="${r.me ? "me" : ""}"><span class="rk">${r.rank}</span><span class="grow">${esc(r.name)}${r.me ? " (you)" : ""}</span><b>${(+r.score).toLocaleString("en-GB")}</b></li>`).join("") || `<li class="muted">Nobody's scored yet. Be first.</li>`}</ol>
            ${c.me && !c.board.some(r => r.me) ? `<p class="lb-me">You're <b>#${c.me.rank}</b> with <b>${c.me.score.toLocaleString("en-GB")}</b></p>` : ""}` : `<p class="muted small">You're hidden from leaderboards.</p>`}
        </section>`).join("") : `<section class="card s1"><b>No challenges right now</b><p class="muted">${esc(CN())} will post the next one here.</p></section>`}
      <section class="card s3 comm-set"><label class="chk"><input type="checkbox" id="commOn" ${on ? "checked" : ""}> <span>Show me on leaderboards and the wall <small class="muted">(first name and initial only)</small></span></label></section>
      ${on ? `<form class="card s4 post-new" id="postForm"><textarea id="postT" rows="2" maxlength="1000" placeholder="Share a win, a PB, a meal…"></textarea>${postImg ? `<div class="att"><img src="${postImg}" alt="Photo to post"><button type="button" id="postX" aria-label="Remove photo">✕</button></div>` : ""}
        <div class="row"><label class="round attach" aria-label="Add a photo">${icon.cam}<input type="file" accept="image/*" id="postImg" hidden></label><button class="btn red sm" type="submit"><span>Post</span></button></div></form>` : ""}
      <section class="feed s5">${posts.map(p => { const mine = p.leadId === me.id, liked = (p.likes || []).includes(me.id), coach = p.byCoach || !p.leadId;
        return `<article class="card post ${coach ? "coach" : ""}"><div class="row"><span class="av">${esc((p.authorName || "M")[0])}</span><span class="grow"><b>${esc(p.authorName || "Member")}</b>${coach ? `<i class="badge-c">Coach</i>` : ""}<small>${ago(p.at)}</small></span>${mine ? `<button class="x" data-pdel="${esc(p.id)}" aria-label="Delete post">✕</button>` : ""}</div>
          ${p.text ? `<p>${esc(p.text)}</p>` : ""}${p.img ? `<img src="${esc(p.img)}" alt="">` : ""}
          <button class="like ${liked ? "on" : ""}" data-like="${esc(p.id)}" ${on ? "" : "disabled"} aria-pressed="${liked}">${icon.heart}<span>${(p.likes || []).length || ""}</span></button></article>`; }).join("") || `<p class="muted pad-x">No posts yet.</p>`}</section>`;
  }
  binds.team = async () => {
    if (!commCache) { try { commCache = await B.community(); } catch (e) { commCache = { challenges: [] }; } if (route === "team") render(true); return; }
    $("#commOn").onchange = e => { me.community = e.target.checked; save(); commCache = null; render(true); };
    const f = $("#postForm");
    if (f) {
      $("#postImg").onchange = async e => { const x = e.target.files[0]; if (!x) return; try { postImg = await M.compress(x, 1000); const keep = $("#postT").value; render(true); $("#postT").value = keep; } catch (z) { toast("That photo couldn't be opened"); } };
      if ($("#postX")) $("#postX").onclick = () => { postImg = null; render(true); };
      f.onsubmit = e => { e.preventDefault(); const text = $("#postT").value.trim(); if (!text && !postImg) return;
        D.posts = D.posts || []; D.posts.push({ id: B.uid("p"), leadId: me.id, authorName: C.shortName(me.name), text, img: postImg, at: new Date().toISOString(), likes: [] }); postImg = null; save(); toast("Posted"); render(true); };
    }
  };
  document.addEventListener("click", e => {
    if (route !== "team") return;
    const l = e.target.closest("[data-like]"); if (l) { const p = (D.posts || []).find(x => x.id === l.dataset.like); if (!p) return; const s = new Set(p.likes || []); s.has(me.id) ? s.delete(me.id) : s.add(me.id); p.likes = [...s]; save(); render(true); return; }
    const d = e.target.closest("[data-pdel]"); if (d) { if (d.dataset.sure !== "1") { d.dataset.sure = "1"; d.textContent = "Delete?"; return; } D.posts = D.posts.filter(x => x.id !== d.dataset.pdel); save(); render(true); }
  });

  /* ---------- BOOK A SESSION ---------- */
  let bookDay = null, slotsCache = null;
  const dLabel = (d, o) => parse(d).toLocaleDateString("en-GB", o || { weekday: "short", day: "numeric", month: "short" });
  function bookView() {
    const t = today(), mine = (D.events || []).filter(e => e.leadId === me.id && e.date >= t && e.status !== "cancelled" && e.status !== "declined" && !e.done).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const S = slotsCache;
    return `
      <header class="hd"><a class="round" href="#today" aria-label="Back">${icon.back}</a><div class="hd-t"><span class="kick">With ${esc(CN())}</span><h1>Book a session</h1></div></header>
      ${mine.length ? `<section class="card s1 my-bk"><span class="kick">Coming up</span>${mine.map(e => `<div class="bk-i"><div class="date"><span>${dLabel(e.date, { weekday: "short" }).toUpperCase()}</span><b>${parse(e.date).getDate()}</b></div><span class="grow"><b>${e.time} · ${e.mins || 60} min</b><small>${esc(e.where || "")} · ${e.status === "requested" ? `<em class="pend">Waiting for ${esc(CN())} to confirm</em>` : "Confirmed"}</small></span><button class="mini-btn" data-ics="${esc(e.id)}">Calendar</button>${e.by === "client" || e.type === "session" ? `<button class="mini-btn ghost" data-cancel="${esc(e.id)}">Cancel</button>` : ""}</div>`).join("")}</section>` : ""}
      <section class="card s2 bk-pick">${!S ? `<p class="muted">Loading free times…</p>` : !S.on ? `<b>Online booking isn't open yet</b><p class="muted">Message ${esc(CN())} to arrange your next session.</p><a class="btn red" href="#chat"><span>Message ${esc(CN())}</span></a>`
        : !S.days.length ? `<b>No free times right now</b><p class="muted">Everything's booked for the next couple of weeks. Message ${esc(CN())} and they'll fit you in.</p>`
        : `<span class="kick">Pick a day</span><div class="bk-days" role="tablist">${S.days.map(d => `<button type="button" role="tab" class="bk-d ${d.date === bookDay ? "on" : ""}" data-bd="${d.date}"><span>${dLabel(d.date, { weekday: "short" })}</span><b>${parse(d.date).getDate()}</b><small>${d.times.length} free</small></button>`).join("")}</div>
          <span class="kick">${dLabel(bookDay, { weekday: "long", day: "numeric", month: "long" })} · ${S.mins} min · ${esc(S.where)}</span>
          <div class="bk-times">${((S.days.find(d => d.date === bookDay) || {}).times || []).map(x => `<button type="button" class="chip bk-t" data-bt="${x}">${x}</button>`).join("")}</div>
          <p class="muted small">${S.auto ? "Your booking is confirmed straight away." : `${esc(CN())} confirms each booking.`} You can cancel up to ${S.notice} hours before.</p>`}</section>`;
  }
  binds.book = async () => {
    if (!slotsCache) { try { slotsCache = await B.slots(); bookDay = slotsCache.days[0] ? slotsCache.days[0].date : null; } catch (e) { slotsCache = { on: false, days: [] }; toast(e.message); } if (route === "book") render(true); return; }
    $("#view").onclick = async e => {
      const d = e.target.closest("[data-bd]"); if (d) { bookDay = d.dataset.bd; return render(true); }
      const t = e.target.closest("[data-bt]");
      if (t) {
        const when = `${dLabel(bookDay, { weekday: "long", day: "numeric", month: "long" })} at ${t.dataset.bt}`;
        if (!confirm2(`Book ${when}?`, t)) return;
        t.disabled = true; t.textContent = "Booking…";
        try { const ev = await B.book(me.id, bookDay, t.dataset.bt); slotsCache = null; toast(ev.status === "requested" ? `Requested. ${CN()} will confirm.` : `Booked: ${when}`); burst(); render(true); }
        catch (x) { toast(x.message); slotsCache = null; render(true); }
        return;
      }
      const c = e.target.closest("[data-cancel]");
      if (c) { if (!confirm2("Cancel this session?", c)) return; try { await B.cancelBooking(c.dataset.cancel); slotsCache = null; toast("Cancelled"); render(true); } catch (x) { toast(x.message); } return; }
      const ic = e.target.closest("[data-ics]"); if (ic) icsDownload(D.events.find(x => x.id === ic.dataset.ics));
    };
  };
  // tap twice to confirm (no browser pop-ups)
  function confirm2(msg, btn) { if (btn.dataset.sure === "1") return true; $$("[data-sure]").forEach(b => { if (b !== btn) { b.dataset.sure = ""; b.textContent = b.dataset.orig || b.textContent; } }); btn.dataset.orig = btn.textContent; btn.dataset.sure = "1"; btn.textContent = "Tap again to confirm"; toast(msg); setTimeout(() => { if (btn.isConnected && btn.dataset.sure === "1") { btn.dataset.sure = ""; btn.textContent = btn.dataset.orig; } }, 4000); return false; }
  function icsDownload(e) {
    if (!e) return;
    const p = s => s.replace(/[-:]/g, ""), m = window.BFLSlots.hm(e.time) + (+e.mins || 60), end = window.BFLSlots.clock(m % 1440);
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Built For Life//Portal//EN", "BEGIN:VEVENT", `UID:${e.id}@builtforlife`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART:${p(e.date)}T${p(e.time)}00`, `DTEND:${p(e.date)}T${p(end)}00`, `SUMMARY:PT session with ${CN()} · Built For Life`, `LOCATION:${e.where || ""}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "built-for-life-session.ics"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  /* ---------- daily habits ---------- */
  function habitStreak(h) {
    let n = 0, d = new Date();
    const at = day => ((D.food[me.id + "|" + B.ymd(day)] || {}).habits || {})[h.id];
    if (!B.habitDone(h, at(d))) d = B.addDays(d, -1);
    while (B.habitDone(h, at(d)) && n < 365) { n++; d = B.addDays(d, -1); }
    return n;
  }
  function habitsCard() {
    const hs = B.habitsOf(me); if (!hs.length) return "";
    const v = foodDay().habits || {}, done = hs.filter(h => B.habitDone(h, v[h.id])).length;
    return `<section class="card habits s4"><div class="row"><span class="kick">Daily habits</span><span class="mono">${done}/${hs.length} today</span></div>
      <div class="hb-list">${hs.map(h => { const ok = B.habitDone(h, v[h.id]), st = habitStreak(h);
        return h.kind === "count"
          ? `<div class="hb ${ok ? "on" : ""}"><span class="hb-t"><b>${esc(h.name)}</b><small>Target ${(+h.target).toLocaleString("en-GB")} ${esc(h.unit || "")}${st ? ` · ${icon.flame}${st}` : ""}</small></span><label class="hb-n"><span class="sr">${esc(h.name)}</span><input inputmode="numeric" data-hc="${esc(h.id)}" value="${v[h.id] ? +v[h.id] : ""}" placeholder="0"></label></div>`
          : `<button type="button" class="hb ${ok ? "on" : ""}" data-hb="${esc(h.id)}" aria-pressed="${ok}"><span class="hb-t"><b>${esc(h.name)}</b><small>${st ? `${icon.flame}${st} day${st === 1 ? "" : "s"}` : "Tap when done"}</small></span><span class="hb-c">${icon.check}</span></button>`; }).join("")}</div></section>`;
  }
  function setHabit(id, val) {
    const fd = foodDay(); fd.habits = Object.assign({}, fd.habits, { [id]: val }); D.food[foodKey()] = fd; save();
    const hs = B.habitsOf(me); if (val && hs.every(h => B.habitDone(h, fd.habits[h.id]))) { burst(); toast("All habits done today!"); }
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-hb]"); if (!b || route !== "today") return; const v = foodDay().habits || {}; setHabit(b.dataset.hb, !v[b.dataset.hb]); render(true); });
  document.addEventListener("change", e => { const i = e.target.closest("[data-hc]"); if (!i || route !== "today") return; setHabit(i.dataset.hc, Math.max(0, Math.round(+String(i.value).replace(/\D/g, "") || 0))); render(true); });

  /* ---------- the app: install it, turn on notifications ---------- */
  const DISMISS = "bfl:appcard:hide";
  async function appCard() {
    const slot = $("#appSlot"), A = window.BFLApp; if (!slot || !A) return;
    let hidden = false; try { hidden = Date.now() - +(localStorage.getItem(DISMISS) || 0) < 14 * 864e5; } catch (e) {}
    const ps = await A.pushState();
    let html = "";
    if (!A.standalone() && (A.canInstall() || A.needsIOSHelp()) && !hidden)
      html = `<section class="card app-card s1"><img src="icons/icon-192.png" alt=""><span class="grow"><b>Get the Built For Life app</b><small>${A.needsIOSHelp() ? "Add it to your Home Screen for notifications from " + esc(CN()) + "." : "One tap. Opens full screen, with notifications."}</small></span>
        <button class="btn red sm" id="appGo">${A.needsIOSHelp() ? "How" : "Install"}</button><button class="x" id="appX" aria-label="Not now">✕</button></section>`;
    else if (ps === "off" && !hidden)
      html = `<section class="card app-card s1"><span class="sq">${icon.bell}</span><span class="grow"><b>Turn on notifications</b><small>Know the moment ${esc(CN())} replies or a session is booked.</small></span><button class="btn red sm" id="pushGo">Turn on</button><button class="x" id="appX" aria-label="Not now">✕</button></section>`;
    slot.innerHTML = html;
    if ($("#appX")) $("#appX").onclick = () => { try { localStorage.setItem(DISMISS, String(Date.now())); } catch (e) {} slot.innerHTML = ""; };
    if ($("#appGo")) $("#appGo").onclick = async () => { if (A.needsIOSHelp()) return iosHelp(); await A.install(); appCard(); };
    if ($("#pushGo")) $("#pushGo").onclick = async () => { try { await A.enablePush(); toast("Notifications are on"); appCard(); } catch (e) { toast(e.message); } };
  }
  function iosHelp() {
    const d = document.createElement("div"); d.className = "ios-help";
    d.innerHTML = `<div class="ih-card" role="dialog" aria-label="Add to Home Screen"><b>Add to your Home Screen</b><ol><li>Tap the <b>Share</b> button <span class="ih-i">⬆︎</span> at the bottom of Safari</li><li>Scroll and tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b>, then open Built For Life from your Home Screen and turn on notifications</li></ol><button class="btn red full" type="button">Got it</button></div>`;
    d.onclick = e => { if (e.target === d || e.target.closest("button")) d.remove(); }; document.body.append(d);
  }
  if (window.BFLApp) window.BFLApp.onChange(() => { if (route === "today") appCard(); });

  /* ---------- TRAIN (this week) ---------- */
  let trainWeek = 0;
  function trainView() {
    const start = B.addDays(B.monday(new Date()), trainWeek * 7), end = B.addDays(start, 6), t = today();
    const ws = myWorkouts().filter(w => w.date >= B.ymd(start) && w.date <= B.ymd(end));
    const done = ws.filter(w => w.done).length;
    return `
      <header class="hd"><div class="hd-t"><span class="kick">Your training</span><h1>${trainWeek === 0 ? "This week" : trainWeek === 1 ? "Next week" : trainWeek === -1 ? "Last week" : "Week of " + nice(B.ymd(start), { day: "numeric", month: "short" })}</h1></div>
        <div class="wk-nav"><button class="round" id="twPrev" aria-label="Previous week">${icon.back}</button><button class="round" id="twNext" aria-label="Next week">${icon.chev}</button></div></header>
      <section class="card s1 wk-sum"><div><b>${done}</b><span>of ${ws.length} done</span></div><i class="bar thick"><span style="width:${ws.length ? done / ws.length * 100 : 0}%"></span></i></section>
      <ol class="days">${[...Array(7)].map((_, i) => {
        const d = B.ymd(B.addDays(start, i)), list = ws.filter(w => w.date === d);
        return `<li class="day ${d === t ? "is-today" : ""} s${Math.min(6, i + 1)}"><div class="day-d"><span>${parse(d).toLocaleDateString("en-GB", { weekday: "short" })}</span><b>${parse(d).getDate()}</b></div>
          <div class="day-b">${list.length ? list.map(w => `<a class="wk ${w.done ? "done" : ""}" href="#w/${w.id}"><span class="grow"><b>${esc(w.title)}</b><small>${w.mins} min · ${w.items.length} exercises${setsDone(w) && !w.done ? ` · ${setsDone(w)}/${setsTotal(w)} sets` : ""}</small></span>${w.done ? `<span class="ok">${icon.check}</span>` : icon.chev}</a>`).join("") : `<span class="rest">Rest day</span>`}</div></li>`;
      }).join("")}</ol>`;
  }
  binds.train = () => { $("#twPrev").onclick = () => { trainWeek--; render(); }; $("#twNext").onclick = () => { trainWeek++; render(); }; };

  /* ---------- WORKOUT PLAYER ---------- */
  function workoutView() {
    const w = D.workouts.find(x => x.id === param && x.leadId === me.id);
    if (!w) return `<header class="hd"><a class="round" href="#train" aria-label="Back">${icon.back}</a><div class="hd-t"><h1>Workout not found</h1></div></header><p class="muted pad">Jory may have moved or removed it. <a href="#train">See this week</a>.</p>`;
    w.log = w.log || {};
    const total = setsTotal(w), dn = setsDone(w);
    return `
      <header class="hd sticky"><a class="round" href="#train" aria-label="Back to this week">${icon.back}</a>
        <div class="hd-t"><span class="kick">${nice(w.date, { weekday: "long", day: "numeric", month: "short" })}</span><h1>${esc(w.title)}</h1></div>
        <span class="mono big" id="wkCount">${dn}/${total}</span></header>
      <i class="bar thick pad-x" id="wkBar"><span style="width:${total ? dn / total * 100 : 0}%"></span></i>
      ${w.note ? `<section class="card coach-note s1"><span class="av">${CI()}</span><p><b>${esc(CN())}:</b> ${esc(w.note)}</p></section>` : ""}
      ${w.items.map((it, n) => { const ex = B.ex(it.exId), log = w.log[it.id] || [];
        return `<article class="ex s${Math.min(6, n + 1)}" data-item="${it.id}">
          <div class="ex-media"><img src="${esc(ex.img)}" alt="${esc(ex.name)}">${ex.video ? `<button type="button" class="ex-play" data-vid="${esc(ex.video)}" data-vt="${esc(ex.name)}" aria-label="Watch the demo: ${esc(ex.name)}">${icon.play}</button>` : ""}<button type="button" class="ex-form" data-form="${esc(ex.name)}" aria-label="Send ${esc(CN())} a form check video">${icon.cam}<span>Form check</span></button><span class="ex-n">${n + 1}/${w.items.length}</span></div>
          <div class="ex-b"><h2>${esc(ex.name)}</h2><p class="mono">${it.sets} sets · ${esc(it.reps)} reps${it.weight ? ` · ${esc(it.weight)} kg` : ""} · ${it.rest || 60}s rest</p>
            ${ex.cues ? `<p class="cue">${esc(ex.cues)}</p>` : ""}${it.note ? `<p class="cue t-red"><b>Jory:</b> ${esc(it.note)}</p>` : ""}
            <div class="sets"><div class="sets-h"><span>Set</span><span>kg</span><span>Reps</span><span></span></div>
            ${[...Array(+it.sets || 0)].map((_, i) => { const s = log[i] || {};
              return `<div class="set ${s.done ? "done" : ""}"><b>${i + 1}</b>
                <input aria-label="Weight for set ${i + 1}" inputmode="decimal" data-w="${i}" value="${esc(s.weight ?? it.weight ?? "")}" placeholder="–">
                <input aria-label="Reps for set ${i + 1}" inputmode="numeric" data-r="${i}" value="${esc(s.reps ?? String(it.reps).replace(/[^0-9]/g, "").slice(0, 2))}" placeholder="–">
                <button class="tick" data-tick="${i}" aria-label="${s.done ? "Undo" : "Done"} set ${i + 1}" aria-pressed="${!!s.done}">${icon.check}</button></div>`; }).join("")}</div>
          </div></article>`; }).join("")}
      <div class="finish-bar"><button class="btn red full" id="finish"><span>${w.done ? "Workout complete" : "Finish workout"}</span></button></div>
      <div class="rest-ov" id="restOv" hidden><div class="rest-in"><span class="kick">Rest</span><b id="restT">60</b><i class="bar thick"><span id="restBar"></span></i><button class="btn line" id="restSkip"><span>Skip</span></button></div></div>`;
  }
  let restTimer = 0;
  binds.w = () => {
    const w = D.workouts.find(x => x.id === param && x.leadId === me.id); if (!w) return;
    const store = (itemId, i, patch) => { w.log[itemId] = w.log[itemId] || []; w.log[itemId][i] = Object.assign({}, w.log[itemId][i] || {}, patch); if (!w.startedAt) w.startedAt = new Date().toISOString(); w.lastAt = new Date().toISOString(); save(); };
    $$(".ex").forEach(card => {
      const id = card.dataset.item, it = w.items.find(x => x.id === id);
      $$("input", card).forEach(inp => inp.addEventListener("change", () => { const i = +(inp.dataset.w ?? inp.dataset.r); store(id, i, inp.dataset.w != null ? { weight: inp.value.trim() } : { reps: inp.value.trim() }); }));
      $$("[data-tick]", card).forEach(b => b.onclick = () => {
        const i = +b.dataset.tick, row = b.closest(".set"), was = row.classList.contains("done");
        store(id, i, { done: !was, weight: $(`[data-w="${i}"]`, card).value.trim(), reps: $(`[data-r="${i}"]`, card).value.trim() });
        row.classList.toggle("done", !was); b.setAttribute("aria-pressed", !was);
        const total = setsTotal(w), dn = setsDone(w); $("#wkCount").textContent = `${dn}/${total}`; $("#wkBar span").style.width = (dn / total * 100) + "%";
        if (!was && !reduce && navigator.vibrate) navigator.vibrate(15);
        if (!was && dn < total) rest(+it.rest || 60);
        if (!was && dn === total && !w.done) setTimeout(() => $("#finish").classList.add("pulse"), 200);
      });
    });
    $("#finish").onclick = () => {
      if (w.done) return go("train");
      w.done = true; w.doneAt = new Date().toISOString(); save(); burst();
      const first = me.name.split(" ")[0];
      $("#view").insertAdjacentHTML("beforeend", `<div class="done-ov" id="doneOv"><div class="done-in"><span class="done-tick">${icon.check}</span><h2>Nice work, ${esc(first)}.</h2><p>${esc(w.title)} done · ${setsDone(w)} sets logged. Jory can see it in his panel.</p><p class="mono">${icon.flame} ${streak()} day streak</p><a class="btn red full" href="#today"><span>Back to today</span></a></div></div>`);
    };
    $("#restSkip").onclick = () => stopRest();
  };
  function rest(sec) {
    stopRest(); const ov = $("#restOv"); if (!ov) return; ov.hidden = false; const t0 = Date.now();
    const tick = () => { const left = Math.max(0, sec - (Date.now() - t0) / 1000); const el = $("#restT"); if (!el) return stopRest(); el.textContent = Math.ceil(left); $("#restBar").style.width = (left / sec * 100) + "%"; if (left <= 0) { stopRest(); if (navigator.vibrate) navigator.vibrate([60, 40, 60]); toast("Rest over. Next set!"); } };
    tick(); restTimer = setInterval(tick, 200);
  }
  function stopRest() { clearInterval(restTimer); const ov = $("#restOv"); if (ov) ov.hidden = true; }

  /* ---------- FOOD ---------- */
  function foodView() {
    const tg = targets(), fd = foodDay();
    const ring = (v, max, c, label, unit, key, steps) => { const p = Math.min(1, max ? v / max : 0), C = 2 * Math.PI * 42;
      return `<section class="card ring-card"><div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42"/><circle class="arc" cx="50" cy="50" r="42" style="stroke:${c};stroke-dasharray:${C};stroke-dashoffset:${C * (1 - p)}"/></svg><div><b>${key === "water" ? (+v).toFixed(1) : Math.round(v).toLocaleString("en-GB")}</b><small>/ ${max.toLocaleString("en-GB")}${unit}</small></div></div>
        <div class="ring-r"><b>${label}</b><span class="muted">${v >= max ? "Target hit. Nice." : `${key === "water" ? (max - v).toFixed(1) : Math.round(max - v).toLocaleString("en-GB")}${unit} to go`}</span><div class="adds">${steps.map(s => `<button class="chip" data-add="${key}" data-v="${s[0]}">+${s[1]}</button>`).join("")}<button class="chip ghost" data-add="${key}" data-v="-${steps[0][0]}" aria-label="Take off ${steps[0][1]}">−</button></div></div></section>`; };
    return `
      <header class="hd"><div class="hd-t"><span class="kick">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span><h1>Today's food</h1></div></header>
      <section class="card s1 fsearch"><div class="row"><span class="kick">Log food</span><span class="muted">${Math.round(fd.carbs || 0)}g carbs · ${Math.round(fd.fat || 0)}g fat today</span></div>
        <div class="fs-bar"><label class="grow"><span class="sr">Search food</span><input id="fsQ" type="search" placeholder="Search, e.g. chicken breast, Greek yoghurt" autocomplete="off" enterkeyhint="search"></label><button class="round" id="fsScan" type="button" aria-label="Scan a barcode">${icon.scan}</button></div>
        <div id="fsRes" class="fs-res" aria-live="polite"></div>
        <small class="off-credit">Food data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a></small>
        ${(fd.items || []).length ? `<ul class="flog">${fd.items.map(i => `<li><span class="grow"><b>${esc(i.name)}</b><small>${esc(i.label || i.grams + "g")} · ${i.kcal} kcal · ${i.protein}g protein</small></span><button class="x" data-rm="${esc(i.id)}" aria-label="Remove ${esc(i.name)}">✕</button></li>`).join("")}</ul>` : ""}
      </section>
      <div class="s1">${ring(fd.protein, tg.protein, "#E3242B", "Protein", "g", "protein", [[10, "10g"], [25, "25g"], [40, "40g"]])}</div>
      <div class="s2">${ring(fd.kcal, tg.kcal, "#F2F0EB", "Calories", "", "kcal", [[100, "100"], [300, "300"], [600, "600"]])}</div>
      <div class="s3">${ring(fd.water, tg.water, "#7fb2ff", "Water", "L", "water", [[0.25, "250ml"], [0.5, "500ml"]])}</div>
      <section class="card s4 meals"><div class="row"><span class="kick">From Jory</span><span class="muted">${esc(me.diet || "No restrictions")}</span></div>
        <p>${esc(me.mealNotes || "Build every meal around a palm of protein, two fists of veg and a cupped hand of carbs. Hit your protein first and the rest gets easier.")}</p></section>`;
  }
  binds.food = () => {
    $$("[data-add]").forEach(b => b.onclick = () => {
      const k = b.dataset.add, v = +b.dataset.v, fd = foodDay();
      fd[k] = Math.max(0, Math.round((fd[k] + v) * 100) / 100); D.food[foodKey()] = fd; save(); render(true);
      if (v > 0 && fd[k] >= targets()[k] && fd[k] - v < targets()[k]) { burst(); toast(`${k === "kcal" ? "Calorie" : k[0].toUpperCase() + k.slice(1)} target hit!`); }
    });
    // search as you type
    let t = 0, seq = 0, found = [];
    const q = $("#fsQ"), res = $("#fsRes");
    const show = list => { found = list; res.innerHTML = list.length ? list.map((f, i) => `<button class="fs-i" data-fi="${i}" type="button"><span class="grow"><b>${esc(f.name)}</b><small>${esc(f.brand || (f.local ? "Common food" : ""))}${f.serving ? " · " + esc(f.serving.label) : ""}</small></span><span class="mono">${f.per100.kcal}<small> kcal/100g</small></span></button>`).join("") : q.value.trim().length > 1 ? `<p class="muted">No matches. Try a simpler word, or scan the barcode.</p>` : ""; };
    q.oninput = () => { clearTimeout(t); const v = q.value.trim(), my = ++seq; if (!v) return show([]); res.innerHTML = `<p class="muted">Searching…</p>`; t = setTimeout(async () => { const list = await B.foodSearch(v); if (my === seq) show(list); }, 350); };
    res.onclick = e => { const b = e.target.closest("[data-fi]"); if (b) amountSheet(found[+b.dataset.fi]); };
    $$("[data-rm]").forEach(b => b.onclick = () => { const fd = foodDay(), it = (fd.items || []).find(x => x.id === b.dataset.rm); if (!it) return;
      fd.items = fd.items.filter(x => x !== it); ["kcal", "protein", "carbs", "fat"].forEach(k => fd[k] = Math.max(0, Math.round(((fd[k] || 0) - (it[k] || 0)) * 10) / 10)); D.food[foodKey()] = fd; save(); render(true); });
    $("#fsScan").onclick = scanBarcode;
  };
  /* how much did you have? */
  function amountSheet(f) {
    const d = document.createElement("div"); d.className = "sheet";
    const hasServ = f.serving && f.serving.grams > 0;
    d.innerHTML = `<div class="sh-card" role="dialog" aria-label="${esc(f.name)}"><b class="sh-t">${esc(f.name)}</b><small class="muted">${esc(f.brand || "")}</small>
      <div class="seg3 sh-unit">${hasServ ? `<button type="button" class="on" data-u="s">${esc(f.serving.label)}</button>` : ""}<button type="button" class="${hasServ ? "" : "on"}" data-u="g">Grams</button></div>
      <div class="stepper sm"><button type="button" class="round" data-st="-1" aria-label="Less">−</button><label><span class="sr">Amount</span><input id="shAmt" inputmode="decimal" value="${hasServ ? 1 : 100}"></label><span class="unit" id="shU">${hasServ ? "×" : "g"}</span><button type="button" class="round" data-st="1" aria-label="More">+</button></div>
      <div class="sh-mac" id="shMac"></div>
      <div class="sh-meal seg3">${["Breakfast", "Lunch", "Dinner", "Snack"].map((m, i) => `<button type="button" class="${i === ((h => h < 11 ? 0 : h < 15 ? 1 : h < 21 ? 2 : 3))(new Date().getHours()) ? "on" : ""}">${m}</button>`).join("")}</div>
      <button class="btn red full" id="shAdd" type="button"><span>Add to today</span></button></div>`;
    document.body.append(d);
    let unit = hasServ ? "s" : "g";
    const grams = () => { const v = parseFloat(String($("#shAmt", d).value).replace(",", ".")) || 0; return unit === "s" ? v * f.serving.grams : v; };
    const upd = () => { const m = B.macros(f, grams()); $("#shMac", d).innerHTML = `<span><b>${m.kcal}</b> kcal</span><span><b>${m.protein}g</b> protein</span><span><b>${m.carbs}g</b> carbs</span><span><b>${m.fat}g</b> fat</span>`; };
    d.onclick = e => {
      if (e.target === d) return d.remove();
      const u = e.target.closest("[data-u]"); if (u) { unit = u.dataset.u; $$("[data-u]", d).forEach(x => x.classList.toggle("on", x === u)); $("#shAmt", d).value = unit === "s" ? 1 : 100; $("#shU", d).textContent = unit === "s" ? "×" : "g"; upd(); }
      const st = e.target.closest("[data-st]"); if (st) { const i = $("#shAmt", d), step = unit === "s" ? 0.5 : 10; i.value = Math.max(0, Math.round(((parseFloat(i.value) || 0) + step * +st.dataset.st) * 10) / 10); upd(); }
      const ml = e.target.closest(".sh-meal button"); if (ml) $$(".sh-meal button", d).forEach(x => x.classList.toggle("on", x === ml));
    };
    $("#shAmt", d).oninput = upd; upd();
    $("#shAdd", d).onclick = () => {
      const g = grams(); if (!(g > 0)) return;
      const m = B.macros(f, g), fd = foodDay(), amt = parseFloat($("#shAmt", d).value) || 0;
      fd.items = fd.items || [];
      fd.items.push({ id: B.uid("f"), name: f.name, brand: f.brand || "", grams: Math.round(g), label: unit === "s" ? `${amt} × ${f.serving.label}` : `${Math.round(g)}g`, ...m, meal: $(".sh-meal .on", d).textContent, at: new Date().toISOString() });
      const before = fd.protein || 0;
      ["kcal", "protein", "carbs", "fat"].forEach(k => fd[k] = Math.round(((fd[k] || 0) + m[k]) * 10) / 10);
      D.food[foodKey()] = fd; save(); d.remove(); toast(`Added ${f.name}`); render(true);
      if (fd.protein >= targets().protein && before < targets().protein) { burst(); toast("Protein target hit!"); }
    };
  }
  /* scan a barcode with the camera (or type the number) */
  async function scanBarcode() {
    const d = document.createElement("div"); d.className = "sheet scan";
    d.innerHTML = `<div class="sh-card" role="dialog" aria-label="Scan a barcode"><b class="sh-t">Scan a barcode</b><div class="scan-v"><video playsinline muted autoplay></video><i></i></div><p class="muted" id="scMsg">Point your camera at the barcode.</p>
      <div class="fs-bar"><label class="grow"><span class="sr">Barcode number</span><input id="scCode" inputmode="numeric" placeholder="Or type the numbers under the barcode"></label><button class="btn red sm" id="scGo" type="button">Find</button></div><button class="btn line full" id="scX" type="button"><span>Cancel</span></button></div>`;
    document.body.append(d);
    let stream = null, done = false, stop = () => { done = true; if (stream) stream.getTracks().forEach(t => t.stop()); d.remove(); };
    const found = async code => { if (done) return; done = true; $("#scMsg", d).textContent = "Looking it up…"; try { const f = await B.foodBarcode(code); stop(); amountSheet(f); } catch (e) { done = false; $("#scMsg", d).textContent = e.message; } };
    $("#scX", d).onclick = stop; d.onclick = e => { if (e.target === d) stop(); };
    $("#scGo", d).onclick = () => found($("#scCode", d).value);
    const v = $("video", d);
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); v.srcObject = stream; }
    catch (e) { $("#scMsg", d).textContent = "Camera not available. Type the barcode numbers instead."; $(".scan-v", d).hidden = true; return; }
    if ("BarcodeDetector" in window) {
      const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      (async function loop() { if (done) return; try { const r = await det.detect(v); if (r[0]) return found(r[0].rawValue); } catch (e) {} setTimeout(loop, 250); })();
    } else {
      // iPhone Safari: load a barcode reader the first time it's needed
      try {
        if (!window.ZXing) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js"; sc.onload = ok; sc.onerror = no; document.head.append(sc); });
        const rd = new ZXing.BrowserMultiFormatReader();
        rd.decodeFromStream(stream, v, (r) => { if (r && !done) { rd.reset(); found(r.getText()); } });
      } catch (e) { $("#scMsg", d).textContent = "Type the numbers under the barcode instead."; }
    }
  }

  /* ---------- PROGRESS ---------- */
  function progressView() {
    const plan = myPlan(), cs = myCheckins(), start = +me.weight || (cs[0] && +cs[0].weight) || 0;
    const target = +me.target || 0;
    const now = nowWeight() || start, proj = B.project(start || 1, target || start || 1), sign = proj.gain ? 1 : -1, loss = proj.gain ? Math.min(proj.toGain, proj.perWeek * plan.weeks) : Math.min(proj.toLose, proj.perWeek * plan.weeks), endW = Math.round(((start || 0) + sign * loss) * 10) / 10;
    const s0 = planStart(), wkOf = iso => Math.max(0, (new Date(iso) - s0) / 6048e5);
    const pts = [{ wk: 0, kg: start }, ...cs.map(c => ({ wk: wkOf(c.at), kg: +c.weight }))].filter(p => p.kg);
    const W = 330, H = 150, maxW = Math.max(start, endW, ...pts.map(p => p.kg)) + 1, minW = Math.min(endW, ...pts.map(p => p.kg)) - 1;
    const X = wk => 28 + Math.min(1, wk / plan.weeks) * (W - 36), Y = kg => 14 + (maxW - kg) / Math.max(1, maxW - minW) * (H - 34);
    const planAt = wk => start + sign * Math.min(loss, proj.perWeek * wk);
    const lastPt = pts[pts.length - 1], ahead = lastPt && lastPt.wk >= 0.5 ? Math.round(-sign * (planAt(lastPt.wk) - lastPt.kg) * 10) / 10 : null;
    const photos = [];
    if (me.photo && !me.noPhoto) photos.push({ src: me.photo, label: "Week 0", kg: me.weight });
    cs.filter(c => c.photo).forEach(c => photos.push({ src: c.photo, label: "Week " + Math.round(wkOf(c.at)), kg: c.weight }));
    const done = myWorkouts().filter(w => w.done).length, st = streak();
    const wins = [];
    if (st >= 3) wins.push([icon.flame, `${st}-day streak`]);
    if (start && now && start - now >= 1) wins.push(['<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16M6 15l4-5 3 3 5-7"/></svg>', `${Math.floor(start - now)} kg down`]);
    if (done) wins.push(['<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/></svg>', `${done} workout${done === 1 ? "" : "s"} done`]);
    if (cs.length) wins.push([icon.check, `${cs.length} check-in${cs.length === 1 ? "" : "s"}`]);
    if (!start || !(+me.target > 0)) return `
      <header class="hd"><div class="hd-t"><span class="kick">Your progress</span><h1>Catching up to<br>future you</h1></div></header>
      <section class="card empty-plan s1"><b>Add your starting point</b><p>Tell Jory your current and target weight and your progress line, wins and future-you preview appear here.</p><a class="btn red" href="#profile"><span>Add my details</span></a></section>
      ${wins.length ? `<section class="wins s2"><span class="kick">Your wins</span><div>${wins.map(w => `<span class="win">${w[0]}<b>${w[1]}</b></span>`).join("")}</div></section>` : ""}`;
    return `
      <header class="hd"><div class="hd-t"><span class="kick">Your progress</span><h1>Catching up to<br>future you</h1></div></header>
      <section class="stats3 s1"><div><span>Started</span><b>${start || "–"}<small> kg</small></b></div><div><span>Now</span><b>${now || "–"}<small> kg</small></b></div><div class="red"><span>Future you</span><b>${endW || "–"}<small> kg</small></b></div></section>
      <section class="card chart-card s2"><div class="row"><b>Weight · ${plan.weeks} weeks</b>${ahead != null ? `<span class="pill ${ahead >= 0 ? "ok" : "warn"}">${ahead >= 0 ? `${ahead} kg ahead of plan` : `${-ahead} kg behind plan`}</span>` : `<span class="muted">Check in to start your line</span>`}</div>
        ${start ? `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Your check-in weights against the future you plan">
          <line x1="28" y1="${Y(start)}" x2="${W - 8}" y2="${Y(start)}" class="g"/><line x1="28" y1="${Y(endW)}" x2="${W - 8}" y2="${Y(endW)}" class="g"/>
          <text x="0" y="${Y(start) + 4}">${start}</text><text x="0" y="${Y(endW) + 4}">${endW}</text>
          <path class="plan" d="${[...Array(plan.weeks + 1)].map((_, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(planAt(i)).toFixed(1)).join(" ")}"/>
          ${pts.length > 1 ? `<path class="real" d="${pts.map((p, i) => (i ? "L" : "M") + X(p.wk).toFixed(1) + " " + Y(p.kg).toFixed(1)).join(" ")}"/>` : ""}
          ${pts.map((p, i) => `<circle cx="${X(p.wk)}" cy="${Y(p.kg)}" r="${i === pts.length - 1 ? 6 : 4}" class="pt${i === pts.length - 1 ? " last" : ""}"/>`).join("")}
          <circle cx="${X(plan.weeks)}" cy="${Y(endW)}" r="6" class="goal"/>
          <text x="28" y="${H - 2}">Wk 0</text><text x="${W - 8}" y="${H - 2}" text-anchor="end">Wk ${plan.weeks}</text></svg>
          <div class="legend"><span><i class="l-real"></i>Your check-ins</span><span><i class="l-plan"></i>Future you plan</span></div>` : `<p class="muted">Your first check-in sets your starting point.</p>`}
      </section>
      <section class="photos s3">${photos.slice(-2).map(p => `<figure><img src="${esc(p.src)}" alt="${esc(p.label)}"><figcaption>${esc(p.label)} · ${esc(p.kg)} kg</figcaption></figure>`).join("")}
        <figure class="future"><canvas id="futureCv" width="240" height="320" aria-label="Future you preview"></canvas><figcaption>Future you · ${endW || "–"} kg</figcaption></figure></section>
      ${wins.length ? `<section class="wins s4"><span class="kick">Your wins</span><div>${wins.map(w => `<span class="win">${w[0]}<b>${w[1]}</b></span>`).join("")}</div></section>` : ""}
      <div class="s5 pad-x acts2"><a class="btn red" href="#checkin"><span>Check in</span></a><button class="btn line" id="share"><span>Share my win</span></button></div>`;
  }
  binds.progress = async () => {
    if (!$("#share")) return;
    $("#share").onclick = async () => {
      const txt = `${streak()} day streak with @builtforlife_uk`;
      try { if (navigator.share) await navigator.share({ text: txt, url: "https://www.builtforlife.uk" }); else { await navigator.clipboard.writeText(txt); toast("Copied. Paste it on your story!"); } } catch (e) {}
    };
    const cv = $("#futureCv"); if (!cv || !(+me.weight > 0)) return;
    const src = (me.photo && !me.noPhoto) ? me.photo : B.silhouette(me.programme === "Bridal Bootcamp" ? 340 : 210);
    try { const img = await M.loadPair(src, me.future); M.draw(cv.getContext("2d"), img, 240, 320, 1, me.noPhoto || !me.photo ? 0.12 : M.strength(+me.weight, +me.target || +me.weight)); } catch (e) {}
  };

  /* ---------- ABOUT YOU (details for people who bought directly, editable any time) ---------- */
  let pfPhoto = null;
  function profileView() {
    const first = B.missing(me).length && !me.profileDone, O = B.OPTIONS;
    const seg = (id, list, val) => `<div class="seg3 wrap" id="${id}">${list.map(o => `<button type="button" class="${String(val) === o ? "on" : ""}">${esc(o)}</button>`).join("")}</div>`;
    const fld = (id, label, val, attrs) => `<label class="fld"><span>${label}</span><input id="${id}" value="${esc(val ?? "")}" ${attrs || ""}></label>`;
    const n = v => +v > 0 ? v : "";
    return `
      <header class="hd"><a class="round" href="#today" aria-label="Close">${icon.back}</a><div class="hd-t"><span class="kick">${first ? "Welcome · takes 1 minute" : "My details"}</span><h1>${first ? "Tell Jory<br>about you" : "Your details"}</h1></div></header>
      <form class="ci pf" id="pfForm" novalidate>
        ${first ? `<p class="pf-intro s1">Jory uses this to build your plan, set your food targets and track your progress. Only Jory sees it.</p>` : ""}
        <section class="ci-sl s1">
          <div><b>Sex</b>${seg("pfSex", O.sex, me.sex ? me.sex[0].toUpperCase() + me.sex.slice(1) : "")}</div>
          <div class="pf-2">${fld("pfAge", "Age", n(me.age), 'inputmode="numeric" maxlength="3"')}${fld("pfH", "Height (cm)", n(me.height), 'inputmode="numeric" maxlength="3"')}</div>
          <div class="pf-2">${fld("pfW", "Weight now (kg)", n(me.weight), 'inputmode="decimal"')}${fld("pfT", "Target weight (kg)", n(me.target), 'inputmode="decimal"')}</div>
          <label><b>Your main goal</b><textarea id="pfGoal" rows="2" placeholder="e.g. Feel confident in my wedding dress, more energy, get strong">${esc(me.goal || "")}</textarea></label>
          <div><b>Days a week you can train</b>${seg("pfDays", O.days, me.days)}</div>
          <div><b>Training experience</b>${seg("pfExp", O.experience, me.experience)}</div>
          <div><b>Where you'll train</b>${seg("pfWhere", O.where, me.where)}</div>
          <div><b>Diet</b>${seg("pfDiet", O.diet, me.diet)}</div>
          <div class="pf-2">${fld("pfSleep", "Sleep (hours a night)", n(me.sleep), 'inputmode="decimal"')}${me.programme === "Bridal Bootcamp" ? fld("pfWed", "Wedding date", me.weddingDate || "", 'type="date"') : "<span></span>"}</div>
          ${me.noPhoto || !me.photo ? `<label class="ci-photo"><input type="file" accept="image/*" capture="user" id="pfPhoto"><span class="ph">${pfPhoto ? `<img src="${pfPhoto}" alt="Your starting photo">` : icon.cam + "<b>Starting photo (optional)</b>"}</span><small>Front on, good light. It becomes your week 0 photo. Only Jory sees it.</small></label>` : ""}
        </section>
        <div class="finish-bar"><p class="err" id="pfErr" role="alert"></p><button class="btn red full" type="submit"><span>${first ? "Save and continue" : "Save my details"}</span></button></div>
      </form>`;
  }
  binds.profile = () => {
    const f = $("#pfForm");
    $$(".seg3", f).forEach(s => s.onclick = e => { const b = e.target.closest("button"); if (!b) return; $$("button", s).forEach(x => x.classList.toggle("on", x === b)); });
    if ($("#pfPhoto")) $("#pfPhoto").onchange = async e => { const file = e.target.files[0]; if (!file) return; try { pfPhoto = await M.compress(file, 720); $(".pf .ci-photo .ph").innerHTML = `<img src="${pfPhoto}" alt="Your starting photo">`; } catch (x) { toast("That photo couldn't be opened"); } };
    const on = id => { const b = $(`#${id} .on`); return b ? b.textContent : ""; };
    f.onsubmit = e => {
      e.preventDefault();
      const err = m => { $("#pfErr").textContent = m; return false; };
      const num = id => parseFloat(String($("#" + id).value).replace(",", "."));
      const age = num("pfAge"), h = num("pfH"), w = num("pfW"), t = num("pfT"), sl = num("pfSleep");
      if (!on("pfSex")) return err("Please choose your sex (it changes your food targets).");
      if (!(age >= 14 && age <= 100)) return err("Please add your age.");
      if (!(h >= 120 && h <= 230)) return err("Please add your height in cm (e.g. 172).");
      if (!(w >= 30 && w <= 300)) return err("Please add your current weight in kg.");
      if (!(t >= 30 && t <= 300)) return err("Please add the weight you'd like to get to.");
      Object.assign(me, { sex: on("pfSex").toLowerCase(), age: Math.round(age), height: Math.round(h), weight: Math.round(w * 10) / 10, target: Math.round(t * 10) / 10,
        goal: $("#pfGoal").value.trim(), days: on("pfDays") || me.days || "", experience: on("pfExp") || me.experience || "", where: on("pfWhere") || me.where || "", diet: on("pfDiet") || me.diet || "",
        sleep: sl > 0 && sl <= 24 ? sl : (me.sleep || ""), weeksNeeded: B.project(w, t).weeks, profileDone: true, profileAt: new Date().toISOString() });
      if ($("#pfWed") && $("#pfWed").value) me.weddingDate = $("#pfWed").value;
      if (pfPhoto) { me.photo = pfPhoto; me.noPhoto = false; pfPhoto = null; }
      save(); toast("Thanks! Jory can see your details now"); go("today");
    };
  };

  /* ---------- HEALTH QUESTIONNAIRE + WAIVER ---------- */
  function healthView() {
    const h = me.health || {}, a = h.answers || [];
    return `
      <header class="hd"><a class="round" href="#today" aria-label="Close">${icon.back}</a><div class="hd-t"><span class="kick">${h.signedAt ? "Signed " + new Date(h.signedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Before you start · 1 minute"}</span><h1>Your health<br>check</h1></div></header>
      <form class="ci hq-form" id="hqForm" novalidate>
        <p class="pf-intro s1">Answer honestly. A "yes" doesn't stop you training: it just means ${esc(CN())} will adapt your plan, and may ask you to check with your GP first. Only your coach sees this.</p>
        <section class="ci-sl s1">${B.HEALTH_Q.map((q, i) => `<div class="hq-q"><b>${i + 1}. ${esc(q)}</b><div class="seg3 yn" data-q="${i}"><button type="button" class="${a[i] === false ? "on" : ""}" data-v="0">No</button><button type="button" class="${a[i] === true ? "on" : ""}" data-v="1">Yes</button></div></div>`).join("")}
          <label id="hqDetW" ${a.some(Boolean) ? "" : "hidden"}><b>Tell ${esc(CN())} more</b><textarea id="hqDet" rows="3" placeholder="What is it, when, and any advice from your doctor">${esc(h.details || "")}</textarea></label>
          <div class="pf-2">${["Emergency contact name", "Their phone"].map((l, i) => `<label class="fld"><span>${l}</span><input id="hqE${i}" ${i ? 'type="tel" autocomplete="off"' : ""} value="${esc((h.emergency || {})[i ? "phone" : "name"] || "")}"></label>`).join("")}</div>
          <div class="waiver"><b>Agreement</b><p>${esc(B.WAIVER)}</p><label class="chk"><input type="checkbox" id="hqOk" ${h.signedAt ? "checked" : ""}> <span>I agree</span></label>
            <label class="fld"><span>Type your full name to sign</span><input id="hqSig" autocomplete="name" value="${esc(h.signedName || "")}" placeholder="${esc(me.name || "")}"></label></div>
        </section>
        <div class="finish-bar"><p class="err" id="hqErr" role="alert"></p><button class="btn red full" type="submit"><span>${h.signedAt ? "Update and sign" : "Sign and continue"}</span></button></div>
      </form>`;
  }
  binds.health = () => {
    const f = $("#hqForm");
    $$(".yn", f).forEach(s => s.onclick = e => { const b = e.target.closest("button"); if (!b) return; $$("button", s).forEach(x => x.classList.toggle("on", x === b)); $("#hqDetW").hidden = !$$('.yn [data-v="1"].on', f).length; });
    f.onsubmit = e => {
      e.preventDefault();
      const err = m => { $("#hqErr").textContent = m; };
      const answers = $$(".yn", f).map(s => { const b = $(".on", s); return b ? b.dataset.v === "1" : null; });
      if (answers.some(x => x === null)) return err("Please answer every question.");
      const yes = answers.filter(Boolean).length, det = $("#hqDet").value.trim();
      if (yes && det.length < 3) return err(`Please tell ${CN()} a bit more about your "yes" answer.`);
      const en = $("#hqE0").value.trim(), ep = $("#hqE1").value.trim();
      if (en.length < 2 || ep.replace(/\D/g, "").length < 10) return err("Please add an emergency contact and their phone number.");
      if (!$("#hqOk").checked) return err("Please tick to agree.");
      const sig = $("#hqSig").value.trim();
      if (sig.length < 3) return err("Please type your full name to sign.");
      me.health = { v: 1, answers, flags: yes, details: yes ? det : "", emergency: { name: en, phone: ep }, signedName: sig, signedAt: new Date().toISOString(), agreed: B.WAIVER };
      if (yes) delete me.healthCleared;
      save(); toast(yes ? `Thanks. ${CN()} will look at your answers before your first session.` : "Thanks, you're good to go"); go("today");
    };
  };

  /* ---------- CHECK-IN ---------- */
  let ciPhoto = null, ciFood = "Most days";
  function checkinView() {
    const last = myCheckins().pop(), w = last ? +last.weight : +me.weight > 0 ? +me.weight : "";
    const n = myCheckins().length + 1;
    return `
      <header class="hd"><a class="round" href="#today" aria-label="Close">${icon.back}</a><div class="hd-t"><span class="kick">Check-in ${n} · week ${planWeek()}</span><h1>How did the week go?</h1></div></header>
      <form class="ci" id="ciForm" novalidate>
        <section class="ci-w s1"><span class="kick muted">This morning's weight</span>
          <div class="stepper"><button type="button" class="round big" data-step="-0.1" aria-label="Lower">−</button><label><span class="sr">Weight in kg</span><input id="ciW" inputmode="decimal" value="${w}"></label><span class="unit">KG</span><button type="button" class="round big" data-step="0.1" aria-label="Higher">+</button></div>
          <span class="delta" id="ciDelta"></span></section>
        <label class="ci-photo s2" id="ciPhotoL"><input type="file" accept="image/*" capture="environment" id="ciPhoto"><span class="ph">${ciPhoto ? `<img src="${ciPhoto}" alt="Your check-in photo">` : icon.cam + "<b>Add photo</b>"}</span><small>Same spot, same light as last time. Only Jory sees it.</small></label>
        <section class="ci-sl s3">
          <label><span class="row"><b>Energy</b><span class="mono t-red" id="enO">7 / 10</span></span><input type="range" id="ciEn" min="1" max="10" value="7"></label>
          <label><span class="row"><b>Sleep</b><span class="mono t-red" id="slO">7 / 10</span></span><input type="range" id="ciSl" min="1" max="10" value="7"></label>
          <div><b>Did you hit your food targets?</b><div class="seg3" id="ciFood">${["Mostly not", "Most days", "Every day"].map(o => `<button type="button" class="${o === ciFood ? "on" : ""}">${o}</button>`).join("")}</div></div>
          <label><b>Anything for Jory?</b><textarea id="ciNote" rows="3" placeholder="Wins, struggles, aches, questions…"></textarea></label>
        </section>
        <div class="finish-bar"><p class="err" id="ciErr" role="alert"></p><button class="btn red full" type="submit"><span>Send to Jory</span></button></div>
      </form>`;
  }
  binds.checkin = () => {
    const last = myCheckins().pop(), base = last ? +last.weight : +me.weight;
    const upd = () => { const v = +$("#ciW").value; const d = base ? Math.round((v - base) * 10) / 10 : 0; $("#ciDelta").textContent = base && v ? (d === 0 ? "Same as last time" : `${d > 0 ? "+" : "−"}${Math.abs(d)} kg since ${last ? "last check-in" : "you started"}`) : ""; $("#ciDelta").className = "delta " + (d < 0 ? "ok" : d > 0 ? "warn" : ""); };
    $$("[data-step]").forEach(b => b.onclick = () => { $("#ciW").value = (Math.round(((+$("#ciW").value || 0) + +b.dataset.step) * 10) / 10).toFixed(1); upd(); });
    $("#ciW").oninput = upd; upd();
    $("#ciEn").oninput = e => $("#enO").textContent = e.target.value + " / 10";
    $("#ciSl").oninput = e => $("#slO").textContent = e.target.value + " / 10";
    $("#ciFood").onclick = e => { const b = e.target.closest("button"); if (!b) return; ciFood = b.textContent; $$("#ciFood button").forEach(x => x.classList.toggle("on", x === b)); };
    $("#ciPhoto").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { ciPhoto = await M.compress(f, 640); $("#ciPhotoL .ph").innerHTML = `<img src="${ciPhoto}" alt="Your check-in photo">`; } catch (x) { toast("That photo couldn't be opened"); } };
    $("#ciForm").onsubmit = e => {
      e.preventDefault(); const kg = +$("#ciW").value;
      if (!(kg >= 30 && kg <= 300)) { $("#ciErr").textContent = "Please add your weight in kg."; return; }
      D.checkins.push({ id: B.uid("c"), leadId: me.id, date: today(), at: new Date().toISOString(), weight: Math.round(kg * 10) / 10, photo: ciPhoto, energy: +$("#ciEn").value, sleep: +$("#ciSl").value, food: ciFood, note: $("#ciNote").value.trim(), reply: null, seen: false });
      if (!B.save()) { D.checkins.pop(); D.checkins.push({ id: B.uid("c"), leadId: me.id, date: today(), at: new Date().toISOString(), weight: Math.round(kg * 10) / 10, photo: null, energy: +$("#ciEn").value, sleep: +$("#ciSl").value, food: ciFood, note: $("#ciNote").value.trim(), reply: null, seen: false }); save(); toast("Saved without the photo (storage full)"); }
      ciPhoto = null; burst();
      $("#view").insertAdjacentHTML("beforeend", `<div class="done-ov"><div class="done-in"><span class="done-tick">${icon.check}</span><h2>Sent to Jory.</h2><p>He'll reply in your chat. Your progress line has been updated.</p><a class="btn red full" href="#progress"><span>See my progress</span></a><a class="btn line full" href="#today"><span>Back to today</span></a></div></div>`);
    };
  };

  /* ---------- CHAT ---------- */
  let chatImg = null, formRef = null;
  function chatView() {
    const ms = myMsgs();
    let lastDay = "";
    return `
      <header class="hd chat-hd"><span class="av big">${CI()}</span><div class="hd-t"><h1>${esc(CN())}</h1><span class="muted small" id="chatSub">Usually replies within a few hours · 7am–8pm</span></div>${"Notification" in window && Notification.permission === "default" ? `<button class="notif-on" id="notifOn" type="button">Notify me</button>` : ""}</header>
      <div class="chat-thread" id="thread">${ms.length ? ms.map(m => { const d = m.at.slice(0, 10), sep = d !== lastDay ? `<p class="chat-day">${d === today() ? "Today" : nice(d, { weekday: "long", day: "numeric", month: "short" })}</p>` : ""; lastDay = d;
        return sep + `<div class="bub ${m.from === "client" ? "me" : "them"}">${m.ref ? `<span class="ref">${esc(m.ref.label)}</span>` : ""}${m.img ? `<img src="${esc(m.img)}" alt="Photo">` : ""}${m.video ? `<video src="${esc(m.video)}" controls playsinline preload="metadata"></video>` : ""}${m.text ? `<p>${esc(m.text)}</p>` : ""}<time>${timeOf(m.at)}${m.from === "client" && m.readByCoach ? " · Seen" : ""}</time></div>`; }).join("")
        : `<div class="chat-empty"><span class="av big">${CI()}</span><b>Message ${esc(CN())} any time</b><p>Questions about your plan, a form check video, how you're feeling. He's here for it.</p></div>`}<div class="bub them typing" id="typingBub" hidden aria-label="${esc(CN())} is typing"><span></span><span></span><span></span></div></div>
      <form class="composer" id="composer">
        ${chatImg ? `<div class="att"><img src="${chatImg}" alt="Photo to send"><button type="button" id="attX" aria-label="Remove photo">✕</button></div>` : ""}
        <label class="round attach" aria-label="Add a photo">${icon.clip}<input type="file" accept="image/*,video/*" id="chatFile" hidden></label>
        <label class="grow"><span class="sr">Message</span><textarea id="chatIn" rows="1" placeholder="Message ${esc(CN())}…"></textarea></label>
        <button class="round send" type="submit" aria-label="Send">${icon.send}</button>
      </form>`;
  }
  function markRead() { let ch = false; myMsgs().forEach(m => { if (m.from === "coach" && !m.readByClient) { m.readByClient = true; ch = true; } }); if (ch) { save(); $("#chatBadge").hidden = true; } }
  binds.chat = () => {
    const ta = $("#chatIn");
    if ($("#notifOn")) $("#notifOn").onclick = async () => {
      if (B.live && window.BFLApp && (await window.BFLApp.pushState()) === "off") { try { await window.BFLApp.enablePush(); $("#notifOn").remove(); toast(`You'll get a notification when ${CN()} replies`); } catch (e) { toast(e.message); } return; }
      const r = await Notification.requestPermission(); $("#notifOn").remove(); if (r === "granted") { toast("You'll get a pop-up when Jory replies"); try { new Notification("Notifications are on", { body: "We'll let you know when Jory messages you.", icon: "assets/jory.jpg" }); } catch (e) {} } };
    let lastPing = 0;
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px";
      if (ta.value.trim() && Date.now() - lastPing > 1200) { B.typing.set("client", me.id); lastPing = Date.now(); } if (!ta.value.trim()) B.typing.clear("client", me.id); });
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); $("#composer").requestSubmit(); } });
    const fc = (() => { try { return sessionStorage.getItem("bfl:formcheck"); } catch (e) { return null; } })();
    if (fc) { try { sessionStorage.removeItem("bfl:formcheck"); } catch (e) {} formRef = { type: "form", label: `Form check · ${fc}` }; if (!ta.value) ta.value = `Form check on my ${fc.toLowerCase()}: how does this look?`; toast("Tap the paperclip to add your video"); }
    $("#chatFile").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (/^video\//.test(f.type)) {
        toast("Uploading video… keep the app open");
        try { const u = await B.uploadVideo(f, me.id); D.messages.push({ id: B.uid("m"), leadId: me.id, from: "client", text: $("#chatIn").value.trim(), video: u, ref: formRef, at: new Date().toISOString(), readByCoach: false, readByClient: true }); formRef = null; save(); render(true); const t = $("#thread"); t.scrollTop = t.scrollHeight; toast("Video sent"); }
        catch (x) { toast(x.message); }
        return;
      }
      try { chatImg = await M.compress(f, 900); const keep = ta.value; render(true); $("#chatIn").value = keep; } catch (x) { toast("That photo couldn't be opened"); } };
    if ($("#attX")) $("#attX").onclick = () => { chatImg = null; render(true); };
    $("#composer").onsubmit = e => {
      e.preventDefault(); const text = $("#chatIn").value.trim(); if (!text && !chatImg) return;
      B.typing.clear("client", me.id);
      D.messages.push({ id: B.uid("m"), leadId: me.id, from: "client", text, img: chatImg, ref: formRef || undefined, at: new Date().toISOString(), readByCoach: false, readByClient: true }); formRef = null;
      if (!B.save()) { D.messages.pop(); toast("Couldn't send. Storage may be full."); return; }
      chatImg = null; render(true); const t = $("#thread"); t.scrollTop = t.scrollHeight; setTimeout(() => $("#chatIn").focus(), 30);
    };
    if (!matchMedia("(pointer:coarse)").matches) setTimeout(() => ta.focus(), 50);
  };

  /* ---------- celebration ---------- */
  function burst() {
    if (reduce) return;
    const c = $("#burst"), x = c.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = Array.from({ length: 90 }, (_, i) => { const a = Math.random() * 6.28, v = 3 + Math.random() * 9; return { x: innerWidth / 2, y: innerHeight * .45, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, s: 3 + Math.random() * 6, r: Math.random() * 6, c: ["#E3242B", "#F2F0EB", "#B5161C"][i % 3] }; });
    const t0 = performance.now();
    (function f(n) { const t = (n - t0) / 1000; x.clearRect(0, 0, innerWidth, innerHeight);
      P.forEach(p => { p.vy += .3; p.x += p.vx; p.y += p.vy; p.r += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.max(0, 1 - t / 2); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s, p.s, p.s * 2); x.restore(); });
      if (t < 2.2) requestAnimationFrame(f); else x.clearRect(0, 0, innerWidth, innerHeight); })(t0);
  }

  /* ---------- live updates from the coach panel ---------- */
  let lastPopped = null;
  // demo videos and form checks from inside a workout
  document.addEventListener("click", e => {
    const v = e.target.closest("[data-vid]"); if (v) { e.preventDefault(); if (window.BFLApp) BFLApp.video(v.dataset.vid, v.dataset.vt); return; }
    const f = e.target.closest("[data-form]"); if (f) { e.preventDefault(); try { sessionStorage.setItem("bfl:formcheck", f.dataset.form); } catch (x) {} go("chat"); }
  });
  // demo: remember when they last opened the app (the live server tracks this itself)
  if (!B.live) setInterval(() => { if (me && !document.hidden) { D.presence = D.presence || {}; const p = D.presence[me.id]; if (!p || Date.now() - new Date(p) > 120000) { D.presence[me.id] = new Date().toISOString(); B.save(); } } }, 5000);
  B.watch(d => {
    D = d; const before = me ? me.id : null; loadMe();
    if (!me) { if (before) render(); return; }
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (route === "chat") { const keep = $("#chatIn") ? $("#chatIn").value : ""; const had = $("#chatIn") && document.activeElement === $("#chatIn"); render(true); if ($("#chatIn")) { $("#chatIn").value = keep; if (had) $("#chatIn").focus(); } const t = $("#thread"); if (t) t.scrollTop = t.scrollHeight; }
    else if (!typing && route !== "w" && route !== "checkin") render(true);
    const n = unread(); $("#chatBadge").hidden = !n; $("#chatBadge").textContent = n;
    const last = myMsgs().filter(m => m.from === "coach").pop();
    if (last && !last.readByClient && route !== "chat" && Date.now() - new Date(last.at) < 15000) toast("New message from Jory");
    // pop-up on their phone / laptop if the portal is in the background
    if (last && last.id !== lastPopped && !last.readByClient && Date.now() - new Date(last.at) < 60000 && document.hidden && "Notification" in window && Notification.permission === "granted") {
      lastPopped = last.id; try { const n = new Notification(CN(), { body: last.text || "Sent you a photo", icon: "assets/jory.jpg", tag: "bfl-chat" }); n.onclick = () => { focus(); location.hash = "chat"; n.close(); }; } catch (e) {}
    }
  });

  // show "Jory is typing…" while he types in the coach panel
  setInterval(() => {
    if (!me || route !== "chat") return;
    const on = B.typing.is("coach", me.id), bub = $("#typingBub"), sub = $("#chatSub");
    if (!bub) return;
    if (bub.hidden === on) {
      bub.hidden = !on; if (sub) { sub.textContent = on ? "typing…" : "Usually replies within a few hours · 7am–8pm"; sub.classList.toggle("is-typing", on); }
      if (on) { const t = $("#thread"); t.appendChild(bub); t.scrollTop = t.scrollHeight; }
    }
  }, 400);

  render();
});
