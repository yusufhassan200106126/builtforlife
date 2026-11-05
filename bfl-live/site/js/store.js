/* =========================================================
   Built For Life — data store
   Two modes, picked automatically when a page loads:
   • LIVE: the site is hosted on Cloudflare with the database connected
     (/api/config says live). Data is loaded from and saved to the server,
     photos go to secure storage, and changes stream between the coach
     panel and client portals on any device.
   • DEMO: anywhere else (opened from a folder, or a plain static host).
     Everything is saved in this browser only (localStorage).
   Pages wait for BFL.ready before they start.
   ========================================================= */
(function () {
  const KEY = "bfl:demo:v2"; // v2 = starts empty

  const PLANS = {
    "Bridal Bootcamp": [
      { id: "b6w", name: "6 Week Bridal Reset", weeks: 6, price: 379, url: "https://buy.stripe.com/dRm6oH849e1O8PT4Coe3e0a" },
      { id: "b12w", name: "12 Week Transformation", weeks: 12, price: 999, url: "https://buy.stripe.com/14AeVd98d5vi0jnb0Me3e0b" },
      { id: "b6m", name: "6 Month Bridal Experience", weeks: 26, price: 2995, url: "https://buy.stripe.com/00w8wP4RX6zmaY1b0Me3e0c" },
      { id: "b12m", name: "12 Month Bridal Journey", weeks: 52, price: 4995, url: "https://buy.stripe.com/fZu00jache1O2rv0m8e3e0d" }
    ],
    "Daily Wins": [
      { id: "t12", name: "T12 Formula", weeks: 12, price: 999.99, url: "https://www.builtforlife.uk/bfl-products/p/12-week-formula-42za6" },
      { id: "d6m", name: "6 Month Total Reset", weeks: 26, price: 2995, url: "https://www.builtforlife.uk/bfl-products/p/6-month-reset-w8czf" },
      { id: "d12m", name: "12 Month Elite Partnership", weeks: 52, price: 4995, url: "https://www.builtforlife.uk/bfl-products/p/12-month-rebuild-dfhgj" }
    ]
  };
  const STATUSES = ["new", "contacted", "consultation", "client", "lost"];

  /* simple silhouette used for example leads (no real people) */
  function silhouette(hue) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},12%,22%)"/><stop offset="1" stop-color="hsl(${hue},12%,9%)"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><g fill="hsl(${hue},10%,58%)"><circle cx="150" cy="78" r="34"/><path d="M92 130q58-22 116 0l18 120-28 6-6-70-6 214h-34l-2-150-2 150h-34l-6-214-6 70-28-6z"/></g></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function sample() {
    const now = Date.now(), d = n => new Date(now - n * 864e5).toISOString();
    const mk = (o) => Object.assign({ id: "L" + Math.random().toString(36).slice(2, 9), example: true, notes: "", photo: silhouette(o.hue || 10) }, o);
    return [
      mk({ created: d(0.2), status: "new", name: "Sarah Mitchell", phone: "07700 900321", email: "sarah.m@example.com", programme: "Bridal Bootcamp", sex: "female", age: 34, height: 165, weight: 76, target: 66, days: 3, experience: "Some", where: "Gym", diet: "No restrictions", sleep: 6, weddingDate: new Date(now + 150 * 864e5).toISOString().slice(0, 10), goal: "Feel confident in my dress and in photos", plan: "12 Week Transformation", weeksNeeded: 14, hue: 340 }),
      mk({ created: d(1.5), status: "contacted", name: "Daniel Okafor", phone: "07700 900654", email: "dan.okafor@example.com", programme: "Daily Wins", sex: "male", age: 42, height: 182, weight: 98, target: 86, days: 3, experience: "Returning", where: "Hotel / travelling", diet: "No restrictions", sleep: 5, goal: "Energy back and lose the gut before summer", plan: "6 Month Total Reset", weeksNeeded: 20, hue: 210 }),
      mk({ created: d(3), status: "consultation", name: "Priya Shah", phone: "07700 900111", email: "priya.s@example.com", programme: "Bridal Bootcamp", sex: "female", age: 29, height: 160, weight: 64, target: 58, days: 4, experience: "Regular", where: "Home", diet: "Vegetarian", sleep: 7, weddingDate: new Date(now + 70 * 864e5).toISOString().slice(0, 10), goal: "Toned arms and back", plan: "6 Week Bridal Reset", weeksNeeded: 9, hue: 30 }),
      mk({ created: d(6), status: "client", name: "Mark Reynolds", phone: "07700 900987", email: "mark.r@example.com", programme: "Daily Wins", sex: "male", age: 51, height: 176, weight: 92, target: 82, days: 2, experience: "Beginner", where: "Gym", diet: "No restrictions", sleep: 6, goal: "Strong and healthy for my kids", plan: "T12 Formula", weeksNeeded: 17, hue: 160 })
    ];
  }

  /* ---------- Jory's content: exercise library + programme templates ---------- */
  const IMG = { curl: "assets/curl.jpg", cable: "assets/cable.jpg", coach: "assets/coaching.jpg", mirror: "assets/mirror.jpg", five: "assets/highfive.jpg", jory: "assets/jory.jpg" };
  function seedLibrary() {
    const x = (id, name, group, equip, img, cues) => ({ id, name, group, equip, img, video: "", cues });
    return [
      x("ex-squat", "Goblet squat", "Legs", "Dumbbell", IMG.coach, "Chest up, sit between your heels, drive through the whole foot."),
      x("ex-rdl", "Romanian deadlift", "Legs", "Dumbbells", IMG.mirror, "Soft knees, push hips back, bar close to the legs."),
      x("ex-lunge", "Walking lunge", "Legs", "Dumbbells", IMG.coach, "Long stride, back knee kisses the floor, stay tall."),
      x("ex-stepup", "Step-up", "Legs", "Bench", IMG.coach, "Whole foot on the box, push through the front heel."),
      x("ex-hipthrust", "Hip thrust", "Glutes", "Barbell / bench", IMG.mirror, "Chin tucked, ribs down, squeeze at the top for a second."),
      x("ex-row", "Cable row", "Back", "Cable", IMG.cable, "Pull elbows to your back pockets, shoulders down."),
      x("ex-pulldown", "Lat pulldown", "Back", "Cable", IMG.cable, "Lead with the elbows, bar to the top of the chest."),
      x("ex-fly", "Cable fly", "Chest", "Cable", IMG.cable, "Slight bend in the elbows, hug a big tree."),
      x("ex-press", "Dumbbell shoulder press", "Shoulders", "Dumbbells", IMG.jory, "Ribs down, press up and slightly in."),
      x("ex-curl", "Dumbbell bicep curl", "Arms", "Dumbbells", IMG.curl, "Elbows pinned, slow on the way down."),
      x("ex-plank", "Plank", "Core", "Bodyweight", IMG.five, "Squeeze glutes, push the floor away, breathe."),
      x("ex-bike", "Bike intervals", "Conditioning", "Bike", IMG.five, "30 seconds hard, 30 seconds easy.")
    ];
  }
  function seedTemplates() {
    const it = (exId, sets, reps, weight, rest, note) => ({ exId, sets, reps, weight, rest: rest || 60, note: note || "" });
    return [
      { id: "tpl-bridal", name: "Bridal Bootcamp · weekly", days: [
        { dow: 1, title: "Lower body + glutes", mins: 45, where: "Gym", items: [it("ex-squat", 4, "10", "12"), it("ex-rdl", 3, "10", "16"), it("ex-hipthrust", 4, "12", "30"), it("ex-lunge", 3, "10 each", "8"), it("ex-plank", 3, "40s", "")] },
        { dow: 2, title: "Upper body strength", mins: 45, where: "Gym", items: [it("ex-row", 4, "10", "25"), it("ex-press", 3, "12", "7.5"), it("ex-pulldown", 3, "12", "30"), it("ex-curl", 4, "10-12", "8"), it("ex-fly", 3, "12", "7.5")] },
        { dow: 5, title: "Conditioning", mins: 30, where: "Home", items: [it("ex-bike", 8, "30s on / 30s off", "", 30), it("ex-stepup", 3, "12 each", ""), it("ex-plank", 3, "45s", "")] }
      ] },
      { id: "tpl-dw", name: "Daily Wins · 3 days", days: [
        { dow: 1, title: "Full body A", mins: 40, where: "Gym", items: [it("ex-squat", 4, "8", "16"), it("ex-row", 4, "10", "30"), it("ex-press", 3, "10", "12"), it("ex-plank", 3, "45s", "")] },
        { dow: 3, title: "Full body B", mins: 40, where: "Gym", items: [it("ex-rdl", 4, "8", "20"), it("ex-pulldown", 4, "10", "40"), it("ex-fly", 3, "12", "10"), it("ex-curl", 3, "12", "10")] },
        { dow: 5, title: "Hotel / home circuit", mins: 25, where: "Hotel / travelling", items: [it("ex-lunge", 3, "12 each", ""), it("ex-stepup", 3, "12 each", ""), it("ex-plank", 3, "45s", ""), it("ex-bike", 6, "40s on / 20s off", "", 20)] }
      ] }
    ];
  }
  function migrate(d) {
    let changed = false;
    for (const k of ["leads", "orders", "events", "workouts", "checkins", "messages", "staff", "challenges", "posts"]) if (!Array.isArray(d[k])) { d[k] = []; changed = true; }
    const seed = !live.on || (live.me && live.me.role === "coach");
    if (!d.library || (live.on && seed && !d.library.length)) { d.library = seed ? seedLibrary() : []; changed = true; }
    if (!d.templates || (live.on && seed && !d.templates.length)) { d.templates = seed ? seedTemplates() : []; changed = true; }
    if (!d.food) { d.food = {}; changed = true; }
    if (!d.presence) d.presence = {};
    if (!d.settings) { d.settings = live.on ? {} : { pin: "1234" }; changed = true; }
    return changed;
  }

  const live = { on: false, cfg: null, me: null, cursor: 0, snap: new Map(), pending: new Map(), typing: {}, listeners: [], error: null };
  let lastRaw = null;
  function read() { try { const r = localStorage.getItem(KEY); lastRaw = r; return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  let data = read();
  if (!data) { data = fresh(); write(); }
  else if (migrate(data)) write();
  function fresh() { const d = { settings: { pin: "1234" }, leads: [], orders: [], events: [] }; migrate(d); return d; } // no client data: fills up as people use the site
  function sampleOrders(leads) {
    const m = leads.find(l => l.example && l.status === "client"); if (!m) return [];
    const p = findPlan(m.plan); if (!p) return [];
    return [{ id: "BFL-1001", created: m.created, leadId: m.id, name: m.name, email: m.email, phone: m.phone, planId: p.id, plan: p.name, programme: m.programme, amount: p.price, status: "paid", example: true }];
  }
  function findPlan(idOrName) { for (const prog in PLANS) { const p = PLANS[prog].find(x => x.id === idOrName || x.name === idOrName); if (p) return Object.assign({ programme: prog }, p); } return null; }
  function write() { try { const r = JSON.stringify(data); localStorage.setItem(KEY, r); lastRaw = r; return true; } catch (e) { return false; } }
  /* live sync between tabs (coach panel ↔ client portal ↔ website):
     calls fn(newData) whenever another tab saved something */
  function watch(fn) {
    if (live.on) { live.listeners.push(fn); return; }
    const check = () => {
      let r; try { r = localStorage.getItem(KEY); } catch (e) { return; }
      if (r === lastRaw || !r) return;
      lastRaw = r; try { data = JSON.parse(r); migrate(data); } catch (e) { return; }
      fn(data);
    };
    addEventListener("storage", e => { if (e.key === KEY) check(); });
    addEventListener("focus", check);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    setInterval(check, 2000);
  }
  /* "is typing…" between the coach panel and a client's portal */
  const typing = {
    k: (who, id) => `bfl:typing:${who}:${id}`,
    set(who, id) { if (live.on) return void api("POST", "/api/typing", { lead: id }).catch(() => {}); try { localStorage.setItem(this.k(who, id), String(Date.now())); } catch (e) {} },
    clear(who, id) { if (live.on) return void api("POST", "/api/typing", { lead: id, clear: true }).catch(() => {}); try { localStorage.removeItem(this.k(who, id)); } catch (e) {} },
    is(who, id) { if (live.on) return Date.now() - (live.typing[who + ":" + id] || 0) < 3500; try { return Date.now() - +(localStorage.getItem(this.k(who, id)) || 0) < 3500; } catch (e) { return false; } }
  };
  const uid = p => (p || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const monday = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  /* copy a template into real workouts for one client, starting the week of `from` */
  function applyTemplate(tplId, leadId, from, weeks) {
    const t = data.templates.find(x => x.id === tplId); if (!t) return 0;
    const start = monday(from), today = ymd(new Date()); let n = 0;
    for (let w = 0; w < (weeks || 1); w++) t.days.forEach(dy => {
      const date = ymd(addDays(start, w * 7 + (dy.dow + 6) % 7));
      if (date < today) return; // never schedule in the past
      data.workouts.push({ id: uid("w"), leadId, date, title: dy.title, mins: dy.mins, where: dy.where, note: "", items: dy.items.map(i => ({ ...i, id: uid("i") })), log: {}, done: false, created: new Date().toISOString() });
      n++;
    });
    return n;
  }


  /* =========================================================
     LIVE MODE (server on Cloudflare)
     ========================================================= */
  async function api(method, url, body) {
    const r = await fetch(url, { method, credentials: "same-origin", cache: "no-store", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error(j.error || "Something went wrong. Please try again."); e.status = r.status; throw e; }
    return j;
  }
  const SEP = "\u0001", K = (c, id) => c + SEP + id;
  const ARR = ["leads", "orders", "events", "workouts", "checkins", "messages", "library", "templates", "staff", "challenges", "posts"];
  // what each person is allowed to change (the server checks this too)
  const writable = c => live.me && (live.me.role === "coach"
    || (live.me.role === "staff" && !["orders", "settings", "staff"].includes(c))
    || (live.me.role === "client" && ["food", "workouts", "checkins", "messages", "leads", "posts"].includes(c)));
  function eachRec(d, fn) {
    ARR.forEach(c => (d[c] || []).forEach(r => { if (r && typeof r === "object") { if (!r.id) r.id = uid(c[0]); fn(c, r.id, r); } }));
    Object.keys(d.food || {}).forEach(k => fn("food", k, d.food[k]));
    if (d.settings && Object.keys(d.settings).length) fn("settings", "main", d.settings);
  }
  function snapshot() { live.snap = new Map(); eachRec(data, (c, id, r) => live.snap.set(K(c, id), JSON.stringify(r))); }
  function liveSave() {
    if (!live.me) return true;
    const cur = new Set();
    eachRec(data, (c, id, r) => {
      if (!writable(c)) return;
      const k = K(c, id), s = JSON.stringify(r); cur.add(k);
      if (live.snap.get(k) !== s) { live.snap.set(k, s); live.pending.set(k, { coll: c, id, data: r }); }
    });
    for (const k of Array.from(live.snap.keys())) {
      const [c, id] = k.split(SEP);
      if (writable(c) && !cur.has(k)) { live.snap.delete(k); live.pending.set(k, { coll: c, id, data: null }); }
    }
    keepOffline(); flush();
    return true;
  }
  /* offline: clients keep a copy of their data and any unsent changes on the phone, so the app works in a gym with no signal */
  const offKey = k => live.me && live.me.role === "client" ? `bfl:${k}:${live.me.email}` : null;
  let cacheT = 0;
  function keepOffline() {
    const pk = offKey("pending"); if (!pk) return;
    try { live.pending.size ? localStorage.setItem(pk, JSON.stringify(Array.from(live.pending.values()))) : localStorage.removeItem(pk); } catch (e) {}
    clearTimeout(cacheT); cacheT = setTimeout(() => { try { localStorage.setItem(offKey("cache"), JSON.stringify({ at: Date.now(), cursor: live.cursor, me: live.me, data })); } catch (e) {} }, 1500);
  }
  function restorePending() {
    const pk = offKey("pending"); if (!pk) return;
    let list = []; try { list = JSON.parse(localStorage.getItem(pk) || "[]"); } catch (e) {}
    list.forEach(ch => { if (!ch || !ch.coll || !writable(ch.coll)) return; const k = K(ch.coll, ch.id); if (ch.data) { upsert(ch.coll, ch.id, ch.data); live.snap.set(k, JSON.stringify(ch.data)); } else { remove(ch.coll, ch.id); live.snap.delete(k); } live.pending.set(k, ch); });
    if (list.length) flush();
  }
  let flushing = false, flushTimer = 0;
  async function flush() {
    if (flushing || !live.pending.size) return;
    flushing = true; clearTimeout(flushTimer);
    const batch = Array.from(live.pending.entries()).slice(0, 60);
    let ok = false;
    try {
      const r = await api("POST", "/api/sync", { changes: batch.map(([, ch]) => ({ coll: ch.coll, id: ch.id, data: ch.data })) });
      batch.forEach(([k, ch]) => { if (live.pending.get(k) === ch) live.pending.delete(k); });
      let changed = false;
      (r.saved || []).forEach(sv => { if (!live.pending.has(K(sv.coll, sv.id)) && applyOne(sv)) changed = true; });
      if (changed) emit();
      ok = true; setStatus(""); keepOffline();
    } catch (e) {
      if (e.status === 401) return void location.reload();
      setStatus(e.status === 413 ? e.message : navigator.onLine === false ? "Offline: saved on your phone, it'll send when you're back online" : "Saving… (check your connection)");
      if (e.status === 413 || e.status === 400) batch.forEach(([k, ch]) => { if (live.pending.get(k) === ch) live.pending.delete(k); });
    } finally {
      flushing = false;
      if (live.pending.size) flushTimer = setTimeout(flush, ok ? 0 : 4000);
    }
  }
  function upsert(coll, id, d) {
    if (coll === "food") { data.food[id] = d; return; }
    if (coll === "settings") { Object.keys(data.settings).forEach(k => delete data.settings[k]); Object.assign(data.settings, d); return; }
    const arr = data[coll] || (data[coll] = []), i = arr.findIndex(x => x && x.id === id);
    if (i >= 0) { const o = arr[i]; Object.keys(o).forEach(k => { if (!(k in d)) delete o[k]; }); Object.assign(o, d); }
    else if (coll === "leads" || coll === "orders") arr.unshift(d); else arr.push(d);
  }
  function remove(coll, id) {
    if (coll === "food") { if (!(id in data.food)) return false; delete data.food[id]; return true; }
    const arr = data[coll] || [], i = arr.findIndex(x => x && x.id === id);
    if (i < 0) return false; arr.splice(i, 1); return true;
  }
  function applyOne(ch) {
    const k = K(ch.coll, ch.id);
    if (ch.deleted || !ch.data) { live.snap.delete(k); return remove(ch.coll, ch.id); }
    const s = JSON.stringify(ch.data);
    if (live.snap.get(k) === s) return false;
    live.snap.set(k, s); upsert(ch.coll, ch.id, JSON.parse(s)); return true;
  }
  function emit() { live.listeners.forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
  let pollT = 0, polling = false;
  async function poll() {
    if (polling) return; polling = true;
    try {
      const r = await api("GET", "/api/changes?since=" + live.cursor);
      live.cursor = r.cursor;
      // a staff coach was given (or lost) a client: load their list again
      if (r.scope && live.scope != null && r.scope !== live.scope) { await reloadState(); polling = false; return; }
      const skew = Date.now() - r.now; live.typing = {};
      (r.typing || []).forEach(t => { live.typing[t.who + ":" + t.lead] = t.at + skew; });
      let changed = false;
      (r.changes || []).forEach(c => { if (!live.pending.has(K(c.coll, c.id)) && applyOne(c)) changed = true; });
      if (r.presence) data.presence = Object.assign(data.presence || {}, r.presence); // when clients last opened the app
      if (changed) { emit(); keepOffline(); }
      if (r.more) { polling = false; return poll(); }
    } catch (e) { if (e.status === 401) return void location.reload(); }
    finally { polling = false; }
  }
  async function reloadState() {
    const s = await api("GET", "/api/state");
    data = s.data; live.cursor = s.cursor; live.me = s.me; live.scope = s.scope; migrate(data); snapshot(); emit();
  }
  function schedule() { clearTimeout(pollT); pollT = setTimeout(async () => { await poll(); schedule(); }, document.hidden ? 15000 : 2000); }
  document.addEventListener("visibilitychange", () => { if (live.on && live.me && !document.hidden) { poll(); schedule(); } });
  // a small "saving…" note if the connection drops
  function setStatus(t) {
    let el = document.getElementById("bflSync");
    if (!t) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "bflSync"; el.setAttribute("role", "status"); el.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9999;background:#1b1b1b;color:#f2f0eb;border:1px solid #333;padding:8px 14px;font:13px/1.3 system-ui,sans-serif;border-radius:20px"; document.body.appendChild(el); }
    el.textContent = t;
  }
  addEventListener("online", () => { if (live.on && live.me) { flush(); poll(); } });
  addEventListener("beforeunload", e => { if (live.pending.size) { flush(); e.preventDefault(); e.returnValue = ""; } });

  const ready = (async () => {
    if (location.protocol === "file:") return;
    let c;
    try { const r = await fetch("/api/config", { cache: "no-store", credentials: "same-origin" }); if (!r.ok) return; c = await r.json(); }
    catch (e) { try { c = JSON.parse(localStorage.getItem("bfl:cfg") || "null"); } catch (x) {} if (!c) return; } // offline: remember it's the live site
    if (!c || !c.live) { try { localStorage.removeItem("bfl:cfg"); } catch (e) {} return; }
    try { localStorage.setItem("bfl:cfg", JSON.stringify(c)); } catch (e) {}
    live.on = true; live.cfg = c; live.me = c.session || null;
    data = { settings: {}, leads: [], orders: [], events: [], workouts: [], checkins: [], messages: [], library: [], templates: [], staff: [], challenges: [], posts: [], food: {} };
    if (!live.me) return;
    try {
      const s = await api("GET", "/api/state");
      data = s.data; live.cursor = s.cursor; live.me = s.me; live.scope = s.scope;
      snapshot();
      if (migrate(data) && live.me.role === "coach") liveSave(); // first run: upload Jory's starter library + templates
      restorePending(); keepOffline();
      schedule();
    } catch (e) {
      live.error = e; if (e.status === 401) { live.me = null; return; }
      // no signal: open with the copy saved on this phone (clients only)
      let c2 = null; try { c2 = JSON.parse(localStorage.getItem(`bfl:cache:${live.me.email}`) || "null"); } catch (x) {}
      if (!e.status && c2 && live.me.role === "client") { data = c2.data; live.cursor = c2.cursor; migrate(data); snapshot(); restorePending(); live.offline = true; setStatus("Offline: showing your saved plan"); schedule(); }
    }
  })();

  /* projection: realistic fat-loss pace ≈ 0.7% of bodyweight per week */
  function project(weight, target) {
    // building muscle: a realistic lean gain is about 0.25 kg a week
    if (target > weight) { const toGain = target - weight; return { toLose: 0, toGain, perWeek: 0.25, weeks: Math.max(6, Math.ceil(toGain / 0.25)), gain: true }; }
    const toLose = Math.max(0, weight - target);
    const perWeek = Math.max(0.35, weight * 0.007);
    return { toLose, perWeek, weeks: Math.max(6, Math.ceil(toLose / perWeek)) };
  }
  function recommend(programme, weeksNeeded, weeksAvailable) {
    const list = PLANS[programme] || PLANS["Daily Wins"];
    const want = weeksAvailable != null ? Math.min(weeksNeeded, weeksAvailable) : weeksNeeded;
    if (weeksAvailable != null) {
      // bridal: biggest plan that still fits before the wedding
      const fits = list.filter(p => p.weeks <= Math.max(6, weeksAvailable));
      return fits[fits.length - 1] || list[0];
    }
    return list.find(p => p.weeks >= want) || list[list.length - 1];
  }

  /* the questionnaire's answers (also used by the portal "About you" form and the coach's edit form) */
  const OPTIONS = {
    sex: ["Female", "Male"], days: ["1", "2", "3", "4", "5+"], experience: ["Beginner", "Returning", "Some", "Regular"],
    where: ["Gym", "Home", "Hotel / travelling"], diet: ["No restrictions", "Vegetarian", "Vegan", "Halal", "Other"]
  };
  // what's still missing from someone's details (people who bought without the questionnaire)
  const missing = l => !l ? [] : [["sex", "sex"], ["age", "age"], ["height", "height"], ["weight", "current weight"], ["target", "target weight"]].filter(([k]) => k === "sex" ? !l.sex : !(+l[k] > 0)).map(x => x[1]);

  /* ways to pay for a plan: in full, or split into monthly payments (no extra cost). Same rules on the server. */
  function payOptions(plan) {
    const p = plan.price, n = p >= 3500 ? [3, 6, 12] : p >= 1500 ? [3, 6] : p >= 500 ? [3] : [];
    return [{ id: "full", n: 1, each: p }, ...n.map(k => ({ id: "m" + k, n: k, each: Math.floor(p / k * 100) / 100 }))];
  }

  /* health questionnaire (PAR-Q style) every client signs before training */
  const HEALTH_Q = [
    "Has a doctor ever said you have a heart condition or high blood pressure?",
    "Do you get pain in your chest at rest, in daily life or when you exercise?",
    "Have you lost your balance from dizziness, or passed out, in the last 12 months?",
    "Have you been diagnosed with any other long-term medical condition?",
    "Do you take prescribed medication for a long-term condition?",
    "Do you have (or have you had in the last 12 months) a bone, joint or muscle problem that exercise could make worse?",
    "Has a doctor ever said you should only exercise under medical supervision?",
    "Are you pregnant, or have you given birth in the last 6 months?"
  ];
  const WAIVER = "I confirm my answers are true and I'll tell my coach straight away if anything changes. I understand exercise has some risk, I'll train within my limits and stop if I feel pain, dizziness or unwell, and I take part at my own risk. I agree to Built For Life keeping this health information to keep me safe while training.";

  /* everyday foods (per 100g, or per item where "each" is set) so search is instant and works offline */
  const F = (name, kcal, protein, carbs, fat, each, unit) => ({ code: "", name, brand: "", per100: { kcal, protein, carbs, fat }, serving: each ? { label: unit || "1", grams: each } : null, local: true });
  const FOODS = [
    F("Chicken breast, cooked", 165, 31, 0, 3.6), F("Chicken thigh, cooked", 209, 26, 0, 11), F("Turkey mince 5%", 140, 21, 0, 5), F("Beef mince 5%", 137, 21, 0, 5), F("Beef mince 20%", 254, 17, 0, 20),
    F("Steak, sirloin, cooked", 206, 29, 0, 9), F("Salmon fillet, cooked", 206, 22, 0, 13), F("Tuna, tinned in water", 109, 25, 0, 1), F("Cod, cooked", 105, 23, 0, 1), F("Prawns, cooked", 99, 24, 0, 0.3),
    F("Egg, large", 143, 13, 0.7, 10, 58, "1 egg"), F("Egg whites", 52, 11, 0.7, 0.2), F("Greek yoghurt 0%", 57, 10, 3.6, 0.2), F("Greek yoghurt full fat", 97, 9, 4, 5), F("Skyr", 63, 11, 4, 0.2),
    F("Cottage cheese", 98, 11, 3.4, 4.3), F("Cheddar cheese", 416, 25, 0.1, 35), F("Milk, semi-skimmed", 46, 3.6, 4.8, 1.7), F("Whey protein shake", 380, 78, 8, 5, 30, "1 scoop"), F("Tofu, firm", 144, 15, 3, 9),
    F("Porridge oats", 375, 11, 60, 8, 40, "40g bowl"), F("White rice, cooked", 130, 2.7, 28, 0.3), F("Brown rice, cooked", 123, 2.7, 26, 1), F("Pasta, cooked", 157, 5.8, 31, 0.9), F("Potatoes, boiled", 87, 1.9, 20, 0.1),
    F("Sweet potato, baked", 90, 2, 21, 0.2), F("Wholemeal bread", 247, 10, 41, 3.4, 40, "1 slice"), F("White bread", 265, 9, 49, 3.2, 40, "1 slice"), F("Bagel", 257, 10, 50, 1.5, 85, "1 bagel"), F("Wrap / tortilla", 310, 8, 52, 7, 62, "1 wrap"),
    F("Banana", 89, 1.1, 23, 0.3, 120, "1 banana"), F("Apple", 52, 0.3, 14, 0.2, 180, "1 apple"), F("Blueberries", 57, 0.7, 14, 0.3), F("Strawberries", 32, 0.7, 7.7, 0.3), F("Orange", 47, 0.9, 12, 0.1, 160, "1 orange"),
    F("Broccoli", 34, 2.8, 7, 0.4), F("Spinach", 23, 2.9, 3.6, 0.4), F("Mixed salad", 17, 1.2, 3, 0.2), F("Avocado", 160, 2, 9, 15, 150, "1 avocado"), F("Baked beans", 81, 4.7, 13, 0.4),
    F("Peanut butter", 588, 25, 20, 50, 15, "1 tbsp"), F("Almonds", 579, 21, 22, 50, 30, "handful"), F("Olive oil", 884, 0, 0, 100, 10, "1 tbsp"), F("Dark chocolate 70%", 598, 7.8, 46, 43, 20, "2 squares"), F("Protein bar", 350, 30, 35, 10, 60, "1 bar"),
    F("Hummus", 166, 8, 14, 10), F("Lentils, cooked", 116, 9, 20, 0.4), F("Chickpeas, tinned", 119, 7, 16, 2.6), F("Granola", 471, 10, 64, 20, 45, "1 bowl"), F("Rice cakes", 387, 8, 81, 3, 9, "1 cake")
  ];
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ");
  const localFoods = q => { const w = norm(q).split(/\s+/).filter(Boolean); return w.length ? FOODS.filter(f => w.every(x => norm(f.name).includes(x))).slice(0, 8) : []; };
  /* nutrition for an amount of a food: grams or a number of servings */
  const macros = (f, grams) => { const k = grams / 100, r = v => Math.round(v * k * 10) / 10; return { kcal: Math.round(f.per100.kcal * k), protein: r(f.per100.protein), carbs: r(f.per100.carbs), fat: r(f.per100.fat) }; };
  async function foodSearch(q) {
    const mine = localFoods(q);
    if (String(q).trim().length < 3) return mine;
    try {
      const r = live.on ? await api("GET", "/api/food/search?q=" + encodeURIComponent(q)) : await offSearch(q);
      return [...mine, ...(r.items || []).filter(x => !mine.some(m => norm(m.name) === norm(x.name)))].slice(0, 25);
    } catch (e) { return mine; }
  }
  async function foodBarcode(code) {
    const c = String(code).replace(/\D/g, ""); if (c.length < 6) throw new Error("That barcode looks too short.");
    const r = live.on ? await api("GET", "/api/food/barcode/" + c) : await offBarcode(c);
    if (!r.item) throw new Error("We couldn't find that product. Try searching by name.");
    return r.item;
  }
  // demo mode: ask Open Food Facts directly
  const offItem = p => { const n = p.nutriments || {}, kcal = n["energy-kcal_100g"] ?? (n.energy_100g ? n.energy_100g / 4.184 : null); if (kcal == null || !p.product_name) return null;
    return { code: p.code || "", name: p.product_name, brand: (p.brands || "").split(",")[0].trim(), per100: { kcal: Math.round(kcal), protein: +(n.proteins_100g || 0), carbs: +(n.carbohydrates_100g || 0), fat: +(n.fat_100g || 0) }, serving: p.serving_quantity ? { label: p.serving_size || "1 serving", grams: +p.serving_quantity } : null }; };
  async function offSearch(q) { const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,brands,nutriments,serving_size,serving_quantity`); const j = await r.json(); return { items: (j.products || []).map(offItem).filter(Boolean) }; }
  async function offBarcode(c) { const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity`); const j = await r.json(); return { item: j.status === 1 || j.product ? offItem({ ...j.product, code: c }) : null }; }

  /* daily habits: the coach can change these per client */
  const DEFAULT_HABITS = [
    { id: "steps", name: "Steps", kind: "count", target: 8000, unit: "steps" },
    { id: "sleep", name: "7+ hours sleep", kind: "check" },
    { id: "veg", name: "Veg with every meal", kind: "check" }
  ];
  const HABIT_PRESETS = [...DEFAULT_HABITS, { id: "water", name: "2.5L of water", kind: "check" }, { id: "noalc", name: "No alcohol", kind: "check" }, { id: "stretch", name: "10 min mobility", kind: "check" },
    { id: "walk", name: "30 min walk", kind: "check" }, { id: "nosugar", name: "No sugary drinks", kind: "check" }, { id: "read", name: "Screens off by 10pm", kind: "check" }];
  const habitsOf = l => Array.isArray(l && l.habits) ? l.habits : DEFAULT_HABITS;
  const habitDone = (h, v) => h.kind === "count" ? (+v || 0) >= (+h.target || 1) : !!v;

  window.BFL = {
    ready, OPTIONS, missing, payOptions, HEALTH_Q, WAIVER, foodSearch, foodBarcode, macros, habitsOf, habitDone, HABIT_PRESETS,
    get live() { return live.on; }, get me() { return live.me; }, get cfg() { return live.cfg || {}; }, get loadError() { return live.error; },
    api,
    get: () => data,
    save: () => live.on ? liveSave() : write(),
    reload() { if (live.on) return data; const d = read(); if (d) { data = d; migrate(data); } return data; },
    /* live-mode helpers */
    /* videos go straight to storage (live site only); returns the video's address */
    async uploadVideo(file, lead) {
      if (!live.on) throw new Error("Video uploads work on the live site. In the demo, paste a YouTube link instead.");
      if (!/^video\//.test(file.type)) throw new Error("Please choose a video.");
      if (file.size > 80 * 1024 * 1024) throw new Error("That video is over 80MB. Trim it to under a minute and try again.");
      const r = await fetch("/api/upload" + (lead ? "?lead=" + encodeURIComponent(lead) : ""), { method: "POST", credentials: "same-origin", headers: { "content-type": file.type === "video/quicktime" ? "video/quicktime" : file.type }, body: file });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "The upload didn't work. Please try again.");
      return j.url;
    },
    /* bookings: free times, book, cancel (live: the server checks the diary; demo: this browser) */
    bookingCfg(coachId) { const S = window.BFLSlots; if (live.on && live.me && live.me.role === "staff") { const st = (data.staff || []).find(x => x.id === live.me.email); return S.cfgOf(st && st.booking); } return S.cfgOf((data.settings || {}).booking); },
    async saveBookingCfg(cfg) {
      if (live.on) { const r = await api("POST", "/api/booking-settings", { booking: cfg }); if (live.me.role === "coach") { data.settings.booking = r.booking; live.snap.set(K("settings", "main"), JSON.stringify(data.settings)); } return r.booking; }
      data.settings.booking = cfg; write(); return cfg;
    },
    async slots() {
      if (live.on) return api("GET", "/api/slots");
      const S = window.BFLSlots, c = S.cfgOf((data.settings || {}).booking), d = new Date(), now = { date: ymd(d), min: d.getHours() * 60 + d.getMinutes() };
      return { on: c.on, mins: c.mins, where: c.where, notice: c.notice, auto: c.auto, coach: "Jory", days: S.slots(c, (data.events || []).filter(e => !e.coach), now) };
    },
    async book(leadId, date, time) {
      if (live.on) { const r = await api("POST", "/api/book", { date, time }); applyOne({ coll: "events", id: r.event.id, data: r.event }); emit(); return r.event; }
      const r = await this.slots(); if (!r.days.some(x => x.date === date && x.times.includes(time))) throw new Error("Sorry, that time has just gone. Please pick another.");
      const c = window.BFLSlots.cfgOf((data.settings || {}).booking), ev = { id: uid("e"), type: "session", date, time, mins: c.mins, where: c.where, leadId, coach: "", status: c.auto ? "confirmed" : "requested", by: "client", notes: "", created: new Date().toISOString() };
      data.events.push(ev); write(); return ev;
    },
    async cancelBooking(id) {
      if (live.on) { const r = await api("POST", "/api/book/cancel", { id }); applyOne({ coll: "events", id, data: r.event }); emit(); return r.event; }
      const ev = data.events.find(e => e.id === id), c = window.BFLSlots.cfgOf((data.settings || {}).booking), d = new Date();
      if (window.BFLSlots.hoursUntil({ date: ymd(d), min: d.getHours() * 60 + d.getMinutes() }, ev.date, ev.time) < c.notice) throw new Error(`It's less than ${c.notice} hours to go, so please message Jory to change it.`);
      ev.status = "cancelled"; ev.cancelledAt = new Date().toISOString(); ev.cancelledBy = "client"; write(); return ev;
    },
    /* challenges with leaderboards (live: worked out by the server so nobody sees anyone else's logs) */
    async community() {
      if (live.on && live.me && live.me.role === "client") return api("GET", "/api/community");
      const C = window.BFLCommunity, t = ymd(new Date()), me = live.me && live.me.lead;
      return { challenges: (data.challenges || []).map(c => { const b = C.board(c, data); return { ...c, status: C.status(c, t), count: b.length, board: b.slice(0, 10).map(x => ({ ...x, me: x.id === me })), all: b }; }) };
    },
    async calendarLink() { if (!live.on) throw new Error("The calendar link works on the live site."); return (await api("POST", "/api/ical/token", {})).url; },
    submitLead: lead => api("POST", "/api/lead", { lead }),
    future: (id, t) => api("POST", "/api/future", { id, t }),
    authStart: (email, as) => api("POST", "/api/auth/start", { email, as }),
    authVerify: (email, code, as) => api("POST", "/api/auth/verify", { email, code, as }),
    logout: () => { try { Object.keys(localStorage).filter(k => /^bfl:(cfg|cache:|pending:)/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} return api("POST", "/api/auth/logout", {}).catch(() => {}); },
    watch, typing, uid, ymd, monday, addDays, applyTemplate,
    ex: id => data.library.find(e => e.id === id) || { id, name: "Exercise", group: "", equip: "", img: "assets/coaching.jpg", cues: "" },
    reset() { const keep = { library: data.library, templates: data.templates }; data = fresh(); Object.assign(data, keep); write(); return data; }, // clears client data, keeps Jory's library + templates
    addOrder(o) { data = read() || data; data.orders = data.orders || []; data.orders.unshift(o); return write(); },
    findPlan,
    addLead(l) { data = read() || data; data.leads.unshift(l); if (!write()) { data.leads.shift(); return false; } return true; },
    PLANS, STATUSES, project, recommend, KEY, silhouette,
    gbp: n => "£" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }),
    esc: s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  };
})();
