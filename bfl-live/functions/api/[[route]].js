/* =========================================================
   Built For Life — the server (Cloudflare Pages Function)
   Handles everything under /api/*:
     logins (email codes), the database (D1), photos (R2), live sync
     between the coach panel and client portals, Stripe payments,
     the AI "future you" image and emails.
   Secrets are set in Cloudflare → Pages → Settings → Variables and secrets.
   ========================================================= */
import { Buffer } from "node:buffer";
import { T } from "../../lib/emails.js";
import { vapid, sendTo } from "../../lib/push.js";
import "../../site/js/risk.js"; // sets globalThis.BFLRisk (same rules as the coach panel)
import "../../site/js/slots.js"; // sets globalThis.BFLSlots (booking times)
import "../../site/js/community.js"; // sets globalThis.BFLCommunity (leaderboards)

/* ---------- prices live here on the server (keep in step with site/js/store.js) ---------- */
const PLANS = {
  "Bridal Bootcamp": [
    { id: "b6w", name: "6 Week Bridal Reset", weeks: 6, price: 379 },
    { id: "b12w", name: "12 Week Transformation", weeks: 12, price: 999 },
    { id: "b6m", name: "6 Month Bridal Experience", weeks: 26, price: 2995 },
    { id: "b12m", name: "12 Month Bridal Journey", weeks: 52, price: 4995 }
  ],
  "Daily Wins": [
    { id: "t12", name: "T12 Formula", weeks: 12, price: 999.99 },
    { id: "d6m", name: "6 Month Total Reset", weeks: 26, price: 2995 },
    { id: "d12m", name: "12 Month Elite Partnership", weeks: 52, price: 4995 }
  ]
};
function findPlan(id) {
  for (const programme in PLANS) { const p = PLANS[programme].find(x => x.id === id || x.name === id); if (p) return { ...p, programme }; }
  return null;
}
/* pay in full or split into monthly payments (same rules as site/js/store.js) */
function payOptions(plan) {
  const p = plan.price, n = p >= 3500 ? [3, 6, 12] : p >= 1500 ? [3, 6] : p >= 500 ? [3] : [];
  return [{ id: "full", n: 1, each: p }, ...n.map(k => ({ id: "m" + k, n: k, each: Math.floor(p / k * 100) / 100 }))];
}
const addMonth = (d, n = 1) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };
const gbp = n => "£" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
function project(weight, target) {
  if (target > weight) { const toGain = target - weight; return { toLose: 0, toGain, perWeek: 0.25, weeks: Math.max(6, Math.ceil(toGain / 0.25)), gain: true }; }
  const toLose = Math.max(0, weight - target), perWeek = Math.max(0.35, weight * 0.007);
  return { toLose, perWeek, weeks: Math.max(6, Math.ceil(toLose / perWeek)) };
}

/* a plain silhouette for people who skip the photo (same as the website's) */
function silhouette(hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},12%,22%)"/><stop offset="1" stop-color="hsl(${hue},12%,9%)"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><g fill="hsl(${hue},10%,58%)"><circle cx="150" cy="78" r="34"/><path d="M92 130q58-22 116 0l18 120-28 6-6-70-6 214h-34l-2-150-2 150h-34l-6-214-6 70-28-6z"/></g></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* ---------- small helpers ---------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const now = () => Date.now();
const rand = (n = 24) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return Buffer.from(b).toString("base64url"); };
const sha256 = async s => Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))).toString("hex");
const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const lower = s => String(s || "").trim().toLowerCase();
const h = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const flag = (env, k) => String(env[k] || "").trim() === "1";
const coachEmails = env => String(env.COACH_EMAILS || "").split(",").map(lower).filter(Boolean);
const siteUrl = (env, req) => (env.SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
const ipOf = req => req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "local";
async function body(req, max = 6_000_000) {
  const t = await req.text();
  if (t.length > max) fail(413, "That's too big to upload. Try a smaller photo.");
  try { return JSON.parse(t || "{}"); } catch { fail(400, "Bad request"); }
}

/* ---------- rate limits (per IP / email) ---------- */
async function limit(env, key, max, windowSec) {
  const t = now();
  const r = await env.DB.prepare(
    `INSERT INTO ratelimit (k, n, reset) VALUES (?1, 1, ?2)
     ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset < ?3 THEN 1 ELSE n + 1 END, reset = CASE WHEN reset < ?3 THEN ?2 ELSE reset END
     RETURNING n`).bind(key, t + windowSec * 1000, t).first();
  if (r && r.n > max) fail(429, "Too many tries. Please wait a few minutes and try again.");
}
async function counter(env, k, by = 1) {
  const r = await env.DB.prepare(`INSERT INTO counters (k, n) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET n = n + ?2 RETURNING n`).bind(k, by).first();
  return r.n;
}

/* =========================================================
   RECORDS: the generic data store
   ========================================================= */
const COLLS = ["leads", "orders", "events", "workouts", "checkins", "messages", "food", "library", "templates", "settings", "staff", "challenges", "posts"];
const ARRAYS = COLLS.filter(c => c !== "food" && c !== "settings");
function ownerOf(coll, id, data) {
  if (coll === "leads") return id;
  if (coll === "food") return String(id).split("|")[0];
  if (["library", "templates", "settings", "staff", "challenges"].includes(coll)) return null;
  return (data && data.leadId) || null;
}
const dayOf = d => { const v = d && (d.date || d.at || d.created); return v ? String(v).slice(0, 10) : null; };

async function getRec(env, coll, id) {
  const r = await env.DB.prepare(`SELECT data, deleted FROM records WHERE coll = ? AND id = ?`).bind(coll, id).first();
  return r && !r.deleted && r.data ? JSON.parse(r.data) : null;
}
/* write (or delete, when data is null) one record; returns a prepared statement for batching */
function putStmt(env, coll, id, data) {
  if (data === null) {
    return env.DB.prepare(`UPDATE records SET deleted = 1, data = NULL, updated = ?3, seq = (SELECT COALESCE(MAX(seq), 0) + 1 FROM records) WHERE coll = ?1 AND id = ?2`).bind(coll, id, now());
  }
  const s = JSON.stringify(data);
  if (s.length > 900_000) fail(413, "That record is too big to save.");
  return env.DB.prepare(
    `INSERT INTO records (coll, id, owner, email, d, data, seq, deleted, updated)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, (SELECT COALESCE(MAX(seq), 0) + 1 FROM records), 0, ?7)
     ON CONFLICT(coll, id) DO UPDATE SET owner = excluded.owner, email = excluded.email, d = excluded.d, data = excluded.data, seq = excluded.seq, deleted = 0, updated = excluded.updated`)
    .bind(coll, id, ownerOf(coll, id, data), coll === "leads" ? lower(data.email) || null : null, dayOf(data), s, now());
}
const putRec = (env, coll, id, data) => putStmt(env, coll, id, data).run();

/* ---------- photos: pull data:image/... strings out into R2 ---------- */
function decodeImage(s) {
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) return null;
  const buf = Buffer.from(m[3], "base64");
  if (buf.length > 8_000_000) fail(413, "That photo is too big.");
  const ok = m[2] === "jpeg" ? buf[0] === 0xff && buf[1] === 0xd8 : m[2] === "png" ? buf[0] === 0x89 && buf[1] === 0x50 : buf.subarray(8, 12).toString() === "WEBP";
  return ok ? { mime: m[1], ext: m[2] === "jpeg" ? "jpg" : m[2], buf } : null;
}
async function storePhoto(env, folder, img, name) {
  const key = `p/${folder}/${name || rand(12)}.${img.ext}`;
  await env.PHOTOS.put(key, img.buf, { httpMetadata: { contentType: img.mime } });
  return "/api/img/" + key;
}
async function extractPhotos(env, folder, v) {
  if (typeof v === "string") {
    if (v.length > 300 && v.startsWith("data:image/") && !v.startsWith("data:image/svg")) {
      const img = decodeImage(v); if (!img) return null; // not a real image: drop it
      return storePhoto(env, folder, img);
    }
    return v;
  }
  if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await extractPhotos(env, folder, x)); return out; }
  if (v && typeof v === "object") { const out = {}; for (const k of Object.keys(v)) out[k] = await extractPhotos(env, folder, v[k]); return out; }
  return v;
}
/* delete a client's photos from R2 */
async function deletePhotos(env, owner) {
  let cursor;
  do {
    const l = await env.PHOTOS.list({ prefix: `p/${owner}/`, cursor });
    if (l.objects.length) await env.PHOTOS.delete(l.objects.map(o => o.key));
    cursor = l.truncated ? l.cursor : null;
  } while (cursor);
}

/* coach-only fields a client must never see */
function redact(coll, d) {
  if (!d) return d;
  if (coll === "leads") { const { notes, ...rest } = d; return rest; }
  if (coll === "events") { const { notes, ...rest } = d; return rest; }
  return d;
}

/* =========================================================
   SESSIONS
   ========================================================= */
const COOKIE = "bfl_s";
function cookieOf(req) { const m = /(?:^|;\s*)bfl_s=([A-Za-z0-9_-]+)/.exec(req.headers.get("cookie") || ""); return m ? m[1] : null; }
function setCookie(id, maxAge) { return `${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
async function sessionOf(env, req) {
  const id = cookieOf(req); if (!id) return null;
  const s = await env.DB.prepare(`SELECT * FROM sessions WHERE id = ? AND expires > ?`).bind(id, now()).first();
  if (!s) return null;
  s.leadList = s.leads ? JSON.parse(s.leads) : [];
  if (s.role === "staff") {
    // staff only see the clients assigned to them (worked out fresh on every request)
    const st = await getRec(env, "staff", s.email);
    if (!st || st.active === false) return null;
    s.name = st.name || "";
    s.leadList = (await env.DB.prepare(`SELECT id FROM records WHERE coll = 'leads' AND deleted = 0 AND json_extract(data, '$.coach') = ?`).bind(s.email).all()).results.map(r => r.id);
  }
  return s;
}
const isCoach = s => s && s.role === "coach";            // the owner (Jory): sees everything
const isStaff = s => s && s.role === "staff";            // a coach Jory has added: only their own clients
const isTeam = s => isCoach(s) || isStaff(s);
function need(s, role) {
  if (!s) fail(401, "Please log in again.");
  if (role === "coach" && !isCoach(s)) fail(403, "Only the owner can do that.");
  if (role === "team" && !isTeam(s)) fail(403, "Coach only");
  return s;
}
/* which records someone can see: SQL + values */
function vis(s) {
  if (isCoach(s)) return { sql: "1 = 1", b: [] };
  if (isStaff(s)) return { sql: `((owner IN (SELECT value FROM json_each(?)) AND coll <> 'orders') OR coll IN ('library','templates','staff','challenges','posts') OR (coll = 'events' AND owner IS NULL AND json_extract(data, '$.coach') = ?))`, b: [JSON.stringify(s.leadList), s.email] };
  return { sql: `(owner IN (SELECT value FROM json_each(?)) OR coll IN ('library','challenges','posts'))`, b: [JSON.stringify(s.leadList)] };
}
const scopeOf = s => { if (!isStaff(s)) return ""; let h = 5381; for (const c of s.leadList.slice().sort().join(",")) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return s.leadList.length + "-" + h.toString(36); };
async function staffMember(env, email) { const st = await getRec(env, "staff", lower(email)); return st && st.active !== false ? st : null; }

async function memberLeads(env, email) {
  const { results } = await env.DB.prepare(`SELECT id, data FROM records WHERE coll = 'leads' AND deleted = 0 AND email = ?`).bind(lower(email)).all();
  const leads = results.map(r => JSON.parse(r.data));
  if (!leads.length) return { all: [], member: null };
  const { results: ords } = await env.DB.prepare(`SELECT data FROM records WHERE coll = 'orders' AND deleted = 0 AND owner IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(leads.map(l => l.id))).all();
  const paid = new Set(ords.map(o => JSON.parse(o.data)).filter(o => /^(paid|overdue)$/.test(o.status)).map(o => o.leadId));
  const members = leads.filter(l => l.status === "client" || paid.has(l.id)).sort((a, b) => String(b.created).localeCompare(String(a.created)));
  return { all: leads.map(l => l.id), member: members[0] || null };
}

/* ---------- login with an emailed 6-digit code ---------- */
async function authStart(env, req) {
  const b = await body(req, 5000), email = lower(b.email), role = b.as === "coach" ? "coach" : "client";
  if (!isEmail(email)) fail(400, "Please enter a valid email address.");
  await limit(env, "ip:auth:" + ipOf(req), 20, 900);
  await limit(env, "em:auth:" + email, 5, 900);
  let first = "";
  if (role === "coach") {
    const st = coachEmails(env).includes(email) ? null : await staffMember(env, email);
    if (!coachEmails(env).includes(email) && !st) fail(403, "That email isn't on the coach list. Ask Jory to add you in Settings → Team.");
    first = st ? String(st.name || "").split(" ")[0] : "Jory";
  } else {
    const m = await memberLeads(env, email);
    if (!m.member) fail(404, "We can't find a membership with that email. Use the email you paid with, or message Jory.");
    first = String(m.member.name || "").split(" ")[0];
  }
  const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  await env.DB.prepare(`INSERT INTO codes (email, role, hash, expires, tries) VALUES (?1, ?2, ?3, ?4, 0)
    ON CONFLICT(email, role) DO UPDATE SET hash = excluded.hash, expires = excluded.expires, tries = 0`)
    .bind(email, role, await sha256(code + "|" + email + "|" + (env.CODE_SALT || "bfl")), now() + 10 * 60_000).run();
  const sent = await sendEmail(env, { to: email, ...T.loginCode({ site: siteUrl(env, req), first, code, coach: role === "coach" }) });
  const out = { ok: true, sent };
  if (flag(env, "DEMO_CODES")) out.code = code; // testing only
  if (!sent && !out.code) fail(500, "We couldn't send the email just now. Please try again in a minute.");
  return json(out);
}
async function authVerify(env, req) {
  const b = await body(req, 5000), email = lower(b.email), role = b.as === "coach" ? "coach" : "client", code = String(b.code || "").replace(/\D/g, "");
  await limit(env, "ip:verify:" + ipOf(req), 30, 900);
  const row = await env.DB.prepare(`SELECT * FROM codes WHERE email = ? AND role = ?`).bind(email, role).first();
  if (!row || row.expires < now()) fail(400, "That code has expired. Ask for a new one.");
  if (row.tries >= 5) fail(429, "Too many wrong codes. Ask for a new one.");
  if (await sha256(code + "|" + email + "|" + (env.CODE_SALT || "bfl")) !== row.hash) {
    await env.DB.prepare(`UPDATE codes SET tries = tries + 1 WHERE email = ? AND role = ?`).bind(email, role).run();
    fail(400, "That code isn't right. Check and try again.");
  }
  await env.DB.prepare(`DELETE FROM codes WHERE email = ? AND role = ?`).bind(email, role).run();
  let lead = null, leads = [];
  let realRole = role;
  if (role === "coach") { if (!coachEmails(env).includes(email)) { if (!(await staffMember(env, email))) fail(403, "Coach only"); realRole = "staff"; } }
  else { const m = await memberLeads(env, email); if (!m.member) fail(404, "Membership not found."); lead = m.member.id; leads = m.all; }
  const id = rand(32), days = role === "coach" ? 14 : 60;
  await env.DB.prepare(`INSERT INTO sessions (id, role, email, lead, leads, created, expires) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, realRole, email, lead, JSON.stringify(leads), now(), now() + days * 864e5).run();
  if (Math.random() < 0.05) await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE expires < ?`).bind(now()),
    env.DB.prepare(`DELETE FROM codes WHERE expires < ?`).bind(now()),
    env.DB.prepare(`DELETE FROM ratelimit WHERE reset < ?`).bind(now()),
    env.DB.prepare(`DELETE FROM pending WHERE created < ?`).bind(now() - 7 * 864e5)
  ]);
  return json({ ok: true, role: realRole, lead }, 200, { "set-cookie": setCookie(id, days * 86400) });
}
async function authLogout(env, req) {
  const id = cookieOf(req); if (id) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
  return json({ ok: true }, 200, { "set-cookie": setCookie("x", 0) });
}

/* =========================================================
   STATE + LIVE CHANGES
   ========================================================= */
function emptyState() { const d = { food: {}, settings: {} }; ARRAYS.forEach(c => d[c] = []); return d; }
async function state(env, s) {
  let rows;
  const v = vis(s);
  if (isTeam(s)) {
    // coaches load everything they can see except workouts / food logs older than 120 days
    const cutoff = new Date(now() - 120 * 864e5).toISOString().slice(0, 10);
    rows = (await env.DB.prepare(`SELECT coll, id, data FROM records WHERE deleted = 0 AND ${v.sql} AND NOT (coll IN ('workouts','food') AND d IS NOT NULL AND d < ?) ORDER BY seq`).bind(...v.b, cutoff).all()).results;
  } else {
    rows = (await env.DB.prepare(`SELECT coll, id, data FROM records WHERE deleted = 0 AND ${v.sql} ORDER BY seq`).bind(...v.b).all()).results;
  }
  const cur = (await env.DB.prepare(`SELECT COALESCE(MAX(seq), 0) AS n FROM records`).first()).n;
  const d = emptyState();
  for (const r of rows) {
    if (!COLLS.includes(r.coll)) continue;
    const val = isTeam(s) ? JSON.parse(r.data) : redact(r.coll, JSON.parse(r.data));
    if (r.coll === "food") d.food[r.id] = val;
    else if (r.coll === "settings") d.settings = val;
    else d[r.coll].push(val);
  }
  const byNew = (a, b) => String(b.created || "").localeCompare(String(a.created || ""));
  d.leads.sort(byNew); d.orders.sort(byNew);
  if (isTeam(s)) d.presence = Object.fromEntries((await env.DB.prepare(`SELECT lead, at FROM presence`).all()).results.filter(x => isCoach(s) || s.leadList.includes(x.lead)).map(x => [x.lead, new Date(x.at).toISOString()]));
  if (isCoach(s)) { const st = await getRec(env, "settings", "main"); d.settings = st || {}; }
  else if (isStaff(s)) { const st = (await getRec(env, "settings", "main")) || {}; d.settings = { booking: st.booking }; }
  return json({ data: d, cursor: cur, me: { role: s.role, email: s.email, lead: s.lead, name: s.name || "" }, scope: scopeOf(s), now: now() });
}
async function changes(env, s, url) {
  const since = Math.max(0, parseInt(url.searchParams.get("since") || "0", 10) || 0);
  const t = now();
  const v = vis(s), L = JSON.stringify(s.leadList);
  const q = env.DB.prepare(`SELECT coll, id, data, deleted, seq FROM records WHERE seq > ? AND (${v.sql} OR (deleted = 1 AND coll IN ('library','templates','staff','challenges','posts','events'))) ORDER BY seq LIMIT 400`).bind(since, ...v.b);
  const tq = isCoach(s)
    ? env.DB.prepare(`SELECT who, lead, at FROM typing WHERE who = 'client' AND at > ?`).bind(t - 4000)
    : isStaff(s) ? env.DB.prepare(`SELECT who, lead, at FROM typing WHERE who = 'client' AND at > ? AND lead IN (SELECT value FROM json_each(?))`).bind(t - 4000, L)
    : env.DB.prepare(`SELECT who, lead, at FROM typing WHERE who = 'coach' AND at > ? AND lead IN (SELECT value FROM json_each(?))`).bind(t - 4000, L);
  const mq = env.DB.prepare(`SELECT COALESCE(MAX(seq), 0) AS n FROM records`);
  // presence: when each client last had the app open (written at most every 2 minutes)
  const pq = isTeam(s)
    ? env.DB.prepare(`SELECT lead, at FROM presence WHERE at > ?`).bind(t - 60_000)
    : env.DB.prepare(`INSERT INTO presence (lead, at) VALUES (?1, ?2) ON CONFLICT(lead) DO UPDATE SET at = ?2 WHERE presence.at < ?3`).bind(s.lead, t, t - 120_000);
  const [a, b, c, pr] = await env.DB.batch([q, tq, mq, pq]);
  const rows = a.results;
  // if there were more than 400 changes, carry on from the last one next time
  const cursor = rows.length === 400 ? rows[rows.length - 1].seq : Math.max(since, c.results[0].n);
  return json({
    changes: rows.map(r => ({ coll: r.coll, id: r.id, deleted: !!r.deleted, data: r.deleted ? null : (isTeam(s) ? JSON.parse(r.data) : redact(r.coll, JSON.parse(r.data))) }))
      .filter(c => !(isStaff(s) && c.coll === "settings")),
    typing: b.results, cursor, now: t, more: rows.length === 400, scope: scopeOf(s),
    presence: isTeam(s) ? Object.fromEntries((pr.results || []).filter(x => isCoach(s) || s.leadList.includes(x.lead)).map(x => [x.lead, new Date(x.at).toISOString()])) : undefined
  });
}

/* a day's food log: totals, logged foods and habit ticks */
function cleanFood(d) {
  const out = {};
  for (const k of ["kcal", "protein", "carbs", "fat", "water"]) { const n = num(d && d[k], 0, 100000); if (n != null) out[k] = n; }
  if (Array.isArray(d && d.items)) out.items = d.items.slice(0, 80).map(i => ({ id: clean(i.id, 40), name: clean(i.name, 120), brand: clean(i.brand, 60), grams: num(i.grams, 0, 5000) || 0, label: clean(i.label, 40),
    kcal: num(i.kcal, 0, 20000) || 0, protein: num(i.protein, 0, 2000) || 0, carbs: num(i.carbs, 0, 2000) || 0, fat: num(i.fat, 0, 2000) || 0, meal: clean(i.meal, 20), at: clean(i.at, 40) })).filter(i => i.name);
  if (d && d.habits && typeof d.habits === "object") { out.habits = {}; for (const k of Object.keys(d.habits).slice(0, 30)) { const v = d.habits[k]; out.habits[clean(k, 40)] = typeof v === "number" ? num(v, 0, 1e6) || 0 : !!v; } }
  return out;
}

/* ---------- what a client is allowed to change ---------- */
const pick = (o, keys) => { const r = {}; keys.forEach(k => { if (o && k in o) r[k] = o[k]; }); return r; };
async function clientMerge(env, s, coll, id, data, existing) {
  const mine = x => s.leadList.includes(x);
  if (data === null && coll !== "posts") return { reject: true }; // clients can't delete (except their own posts)
  if (coll === "food") {
    if (!mine(ownerOf("food", id))) return { reject: true };
    return { data: cleanFood(data) };
  }
  if (coll === "leads") {
    // clients can fill in / correct their own details ("About you" in the portal), nothing else
    if (!existing || !mine(id)) return { reject: true };
    const out = { ...existing };
    for (const [k, lo, hi] of [["age", 14, 100], ["height", 100, 250], ["weight", 30, 300], ["target", 30, 300], ["sleep", 0, 24], ["weeksNeeded", 1, 520]]) if (k in data) { const n = num(data[k], lo, hi); if (n != null) out[k] = n; }
    for (const [k, max] of [["goal", 600], ["days", 20], ["experience", 40], ["where", 40], ["diet", 60], ["profileAt", 40]]) if (k in data) out[k] = clean(data[k], max);
    if (["male", "female"].includes(data.sex)) out.sex = data.sex;
    if (isDate(data.weddingDate)) out.weddingDate = data.weddingDate;
    if (data.profileDone) out.profileDone = true;
    if ("community" in data) out.community = data.community !== false;
    if (data.health && typeof data.health === "object" && Array.isArray(data.health.answers)) {
      const h = data.health, answers = h.answers.slice(0, 12).map(x => x === true);
      const changed = JSON.stringify(answers) !== JSON.stringify((existing.health || {}).answers || null) || !(existing.health || {}).signedAt;
      out.health = { v: 1, answers, flags: answers.filter(Boolean).length, details: clean(h.details, 1500), emergency: { name: clean(h.emergency && h.emergency.name, 80), phone: clean(h.emergency && h.emergency.phone, 30) },
        signedName: clean(h.signedName, 80), signedAt: changed ? new Date().toISOString() : existing.health.signedAt, agreed: clean(h.agreed, 1200) };
      if (changed && out.health.flags) delete out.healthCleared; // new "yes" answers need looking at again
    }
    if (data.fromQuiz && mine(data.fromQuiz)) { out.fromQuiz = data.fromQuiz; out.noQuiz = false; }
    // photos copied from their own questionnaire
    for (const k of ["photo", "future"]) { const v = data[k]; const m = typeof v === "string" && /^\/api\/img\/p\/([^/]+)\//.exec(v); if (m && mine(m[1])) { out[k] = v; if (k === "photo") out.noPhoto = false; } }
    if (typeof data.photo === "string" && data.photo !== existing.photo && data.photo.startsWith("data:image/") && !data.photo.startsWith("data:image/svg")) { out.photo = data.photo; out.noPhoto = false; }
    return { data: out };
  }
  if (coll === "posts") {
    if (existing) {
      if (data === null) return mine(existing.leadId) ? { data: null } : { reject: true }; // delete your own post
      // liking is the only change you can make to someone else's post
      const likes = new Set(existing.likes || []), me = s.lead, wants = Array.isArray(data.likes) && data.likes.includes(me);
      wants ? likes.add(me) : likes.delete(me);
      const out = { ...existing, likes: [...likes] };
      if (mine(existing.leadId) && typeof data.text === "string") out.text = clean(data.text, 1000);
      return { data: out };
    }
    if (!data || !mine(data.leadId)) return { reject: true };
    const l = await getRec(env, "leads", data.leadId);
    if (!l || l.community === false) return { reject: true };
    const text = clean(data.text, 1000); if (!text && !data.img) return { reject: true };
    await limit(env, "post:" + data.leadId, 30, 86400);
    return { data: { id, leadId: data.leadId, authorName: globalThis.BFLCommunity.shortName(l.name), text, img: typeof data.img === "string" && data.img.startsWith("data:image/") ? data.img : null, at: new Date().toISOString(), likes: [] } };
  }
  if (coll === "workouts") {
    if (!existing || !mine(existing.leadId)) return { reject: true };
    return { data: { ...existing, ...pick(data, ["log", "done", "doneAt", "startedAt", "lastAt", "feel"]) } };
  }
  if (coll === "checkins") {
    if (existing) {
      if (!mine(existing.leadId)) return { reject: true };
      return { data: { ...data, id, leadId: existing.leadId, reply: existing.reply ?? null, seen: !!existing.seen } };
    }
    if (!mine(data.leadId)) return { reject: true };
    return { data: { ...data, id, reply: null, seen: false } };
  }
  if (coll === "messages") {
    if (existing) {
      if (!mine(existing.leadId)) return { reject: true };
      return { data: { ...existing, readByClient: !!data.readByClient || !!existing.readByClient } };
    }
    if (!mine(data.leadId)) return { reject: true };
    const vid = typeof data.video === "string" && /^\/api\/img\/p\/([^/]+)\/v-[\w-]+\.(mp4|mov|webm|m4v)$/.exec(data.video);
    return { data: { ...pick(data, ["leadId", "text", "img", "ref"]), ...(vid && mine(vid[1]) ? { video: data.video } : {}), id, from: "client", text: clean(data.text, 4000), at: new Date().toISOString(), readByCoach: false, readByClient: true }, notify: true };
  }
  return { reject: true };
}

/* ---------- what a staff coach is allowed to change: only their own clients ---------- */
async function staffMerge(env, s, coll, id, data, existing) {
  const mine = x => s.leadList.includes(x);
  if (["orders", "settings", "staff"].includes(coll)) return { reject: true };
  if (["library", "templates", "challenges", "posts"].includes(coll)) return { data: data && coll === "posts" && !existing ? { ...data, id, byCoach: true } : data };
  if (coll === "leads") {
    if (!existing || !mine(id) || data === null) return { reject: true };
    return { data: { ...existing, ...data, id, coach: existing.coach, coachName: existing.coachName, status: existing.status, email: existing.email || data.email } };
  }
  if (coll === "events") {
    const lead = (data && data.leadId) || (existing && existing.leadId);
    if (lead ? !mine(lead) : (existing && existing.coach !== s.email)) return { reject: true };
    if (data && existing && existing.leadId && data.leadId !== existing.leadId) return { reject: true };
    return { data: data ? { ...data, id, coach: data.coach || s.email } : null };
  }
  const owner = data ? ownerOf(coll, id, data) : ownerOf(coll, id, existing);
  if (!mine(owner) || (existing && !mine(ownerOf(coll, id, existing)))) return { reject: true };
  if (coll === "messages" && data && !existing && data.from === "coach") return { data: { ...data, id, by: s.email, byName: s.name || "" }, notify: "client" };
  return { data };
}

async function sync(env, s, req, ctx) {
  const b = await body(req, 12_000_000);
  const list = Array.isArray(b.changes) ? b.changes.slice(0, 300) : [];
  const stmts = [], saved = [], notes = [], deletedLeads = [];
  for (const ch of list) {
    const coll = String(ch.coll || ""), id = clean(ch.id, 120);
    if (!COLLS.includes(coll) || !id) continue;
    const existing = await getRec(env, coll, id);
    let data = ch.data === undefined ? null : ch.data;
    if (data !== null && (typeof data !== "object" || Array.isArray(data))) continue;
    if (!isCoach(s)) {
      const m = isStaff(s) ? await staffMerge(env, s, coll, id, data, existing) : await clientMerge(env, s, coll, id, data, existing);
      if (m.reject) {
        // send back their own copy so the page puts it right; never reveal anyone else's
        const own = existing && (["library", "challenges", "posts"].includes(coll) || (isStaff(s) && ["templates", "staff"].includes(coll)) || s.leadList.includes(ownerOf(coll, id, existing)));
        saved.push({ coll, id, data: own ? (isStaff(s) ? existing : redact(coll, existing)) : null, deleted: !own }); continue;
      }
      data = m.data;
      if (m.notify) notes.push(m.notify === "client" ? { ...data, toClient: true } : data);
    } else if (data && coll !== "food" && coll !== "settings") {
      data.id = id;
      if (coll === "messages" && !existing && data.from === "coach" && data.leadId) notes.push({ ...data, toClient: true });
    }
    if (coll === "events" && isTeam(s) && existing && existing.status === "requested" && data && ["confirmed", "declined"].includes(data.status)) notes.push({ bookingUpdate: data.status, ev: data });
    if (data) data = await extractPhotos(env, coll === "posts" ? "comm" : ownerOf(coll, id, data) || "lib", data);
    if (data === null && !existing) continue;
    if (isCoach(s) && data === null && coll === "leads") deletedLeads.push(id);
    stmts.push(putStmt(env, coll, id, data));
    saved.push({ coll, id, data: data && !isTeam(s) ? redact(coll, data) : data, deleted: data === null });
  }
  // deleting a sign-up also deletes everything that belongs to them, and their photos
  for (const lid of deletedLeads) {
    stmts.push(env.DB.prepare(`UPDATE records SET deleted = 1, data = NULL, updated = ?2, seq = (SELECT COALESCE(MAX(seq), 0) + 1 FROM records) WHERE owner = ?1 AND deleted = 0 AND coll <> 'orders'`).bind(lid, now()));
    stmts.push(env.DB.prepare(`DELETE FROM lead_tokens WHERE lead = ?`).bind(lid));
    ctx.waitUntil(deletePhotos(env, lid));
  }
  if (stmts.length) await env.DB.batch(stmts);
  // tell Jory by email if a client messages while he's away (at most one email per client per 30 min)
  for (const m of notes) ctx.waitUntil(m.bookingUpdate ? notifyBooking(env, req, m.ev, null, null, m.bookingUpdate) : m.toClient ? notifyClientMessage(env, req, m) : notifyCoachMessage(env, req, m));
  return json({ ok: true, saved });
}
/* Jory messaged a client who isn't in the app: email them (at most once per 30 min) */
async function notifyClientMessage(env, req, m) {
  try {
    await pushLeads(env, [m.leadId], { title: m.byName || "Jory", body: m.text || (m.video ? "Sent you a video" : "Sent you a photo"), url: "portal.html#chat", tag: "chat", skipIfOpen: "portal" }).catch(e => console.error(e));
    const st = (await getRec(env, "settings", "main")) || {};
    if (st.clientEmails === false) return;
    const pr = await env.DB.prepare(`SELECT at FROM presence WHERE lead = ?`).bind(m.leadId).first();
    if (pr && now() - pr.at < 10 * 60_000) return; // they're in the app right now
    const r = await env.DB.prepare(`INSERT INTO ratelimit (k, n, reset) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset < ?3 THEN 1 ELSE n + 1 END, reset = CASE WHEN reset < ?3 THEN ?2 ELSE reset END RETURNING n`)
      .bind("cmail:" + m.leadId, now() + 30 * 60_000, now()).first();
    if (r.n > 1) return;
    const l = await getRec(env, "leads", m.leadId);
    if (!l || !l.email) return;
    await sendEmail(env, { to: l.email, replyTo: coachEmails(env)[0], ...T.coachMessage({ site: siteUrl(env, req), first: String(l.name || "").split(" ")[0], text: m.text, photo: !!m.img }) });
  } catch (e) { console.error("notify client", e); }
}

/* =========================================================
   PUSH NOTIFICATIONS (phone / laptop, even when the app is closed)
   ========================================================= */
async function pushSubscribe(env, s, req) {
  const b = await body(req, 5000), sub = b.sub || {}, k = sub.keys || {};
  if (!/^https:\/\//.test(sub.endpoint || "") && !/^http:\/\/localhost/.test(sub.endpoint || "")) fail(400, "Bad subscription");
  if (!k.p256dh || !k.auth) fail(400, "Bad subscription");
  await env.DB.prepare(`INSERT INTO push_subs (endpoint, role, email, lead, p256dh, auth, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    ON CONFLICT(endpoint) DO UPDATE SET role = ?2, email = ?3, lead = ?4, p256dh = ?5, auth = ?6`).bind(clean(sub.endpoint, 1000), s.role, s.email, s.lead || null, clean(k.p256dh, 200), clean(k.auth, 100), now()).run();
  return json({ ok: true });
}
async function pushLeads(env, leads, msg) {
  if (!leads.length) return 0;
  const { results } = await env.DB.prepare(`SELECT * FROM push_subs WHERE role = 'client' AND lead IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(leads)).all();
  return results.length ? sendTo(env, results, msg) : 0;
}
async function pushTeam(env, emails, msg) {
  const { results } = await env.DB.prepare(`SELECT * FROM push_subs WHERE role IN ('coach','staff') AND email IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(emails.map(lower))).all();
  return results.length ? sendTo(env, results, msg) : 0;
}

/* =========================================================
   DAILY JOBS (morning email to Jory + check-in reminders)
   Runs on the first request after 8am UK time each day, so it needs
   no extra Cloudflare setup.
   ========================================================= */
let jobsCheckedAt = 0;
const london = (d, o) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", ...o }).format(d);
async function maybeDaily(env, req, ctx) {
  if (now() - jobsCheckedAt < 10 * 60_000) return; jobsCheckedAt = now();
  const d = new Date(), hour = +london(d, { hour: "numeric", hourCycle: "h23" });
  if (hour < 8) return;
  const day = london(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  const r = await env.DB.prepare(`INSERT INTO counters (k, n) VALUES (?, 1) ON CONFLICT(k) DO NOTHING RETURNING n`).bind("daily:" + day).first();
  if (!r) return; // already done today
  ctx.waitUntil(dailyJobs(env, req, day).catch(e => console.error("daily", e)));
}
async function loadAll(env) {
  const cutoff = new Date(now() - 60 * 864e5).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(`SELECT coll, id, data FROM records WHERE deleted = 0 AND coll IN ('leads','orders','workouts','checkins','messages','food','settings') AND NOT (coll IN ('workouts','food') AND d IS NOT NULL AND d < ?)`).bind(cutoff).all();
  const D = { leads: [], orders: [], workouts: [], checkins: [], messages: [], food: {}, settings: {} };
  for (const x of results) { const v = JSON.parse(x.data); if (x.coll === "food") D.food[x.id] = v; else if (x.coll === "settings") D.settings = v; else D[x.coll].push(v); }
  D.presence = Object.fromEntries((await env.DB.prepare(`SELECT lead, at FROM presence`).all()).results.map(x => [x.lead, new Date(x.at).toISOString()]));
  return D;
}
async function dailyJobs(env, req, day) {
  const D = await loadAll(env), site = siteUrl(env, req), st = D.settings || {};
  const since = now() - 864e5, T0 = x => new Date(x).getTime();
  // 1. morning briefing for Jory
  if (st.digest !== false) {
    const risks = globalThis.BFLRisk.assess(D).filter(r => !r.snoozed).map(r => ({ name: r.lead.name, level: r.level, reasons: r.reasons.map(x => x.text + (x.extra ? ` (${x.extra.toLowerCase()})` : "")) }));
    const paid = D.orders.filter(o => /^(paid|overdue)$/.test(o.status) && T0(o.created) > since);
    const y = { signups: D.leads.filter(l => T0(l.created) > since).length, revenue: gbp(paid.reduce((a, o) => a + o.amount, 0)), unread: D.messages.filter(m => m.from === "client" && !m.readByCoach).length, checkins: D.checkins.filter(c => T0(c.at) > since).length };
    const date = london(new Date(), { weekday: "long", day: "numeric", month: "long" });
    await sendEmail(env, { to: coachEmails(env), ...T.digest({ site, date, risks, y }) });
  }
  // 2. check-in reminders: a day overdue, at most once a week each
  if (st.checkinReminders !== false) {
    for (const l of D.leads.filter(l => globalThis.BFLRisk.isMember(D, l))) {
      const cs = D.checkins.filter(c => c.leadId === l.id).sort((a, b) => T0(a.at) - T0(b.at)), last = cs.length ? T0(cs[cs.length - 1].at) : null;
      if (!last) continue; // first check-in is set up by Jory at kick-off
      const days = Math.floor((now() - last) / 864e5);
      if (days < 8 || !l.email) continue;
      const k = await env.DB.prepare(`INSERT INTO ratelimit (k, n, reset) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset < ?3 THEN 1 ELSE n + 1 END, reset = CASE WHEN reset < ?3 THEN ?2 ELSE reset END RETURNING n`)
        .bind("cirem:" + l.id, now() + 6.5 * 864e5, now()).first();
      if (k.n > 1) continue;
      await pushLeads(env, [l.id], { title: "Weekly check-in time", body: "Two minutes: weight, a photo and how the week went.", url: "portal.html#checkin", tag: "checkin" }).catch(() => {});
      await sendEmail(env, { to: l.email, replyTo: coachEmails(env)[0], ...T.checkinReminder({ site, first: String(l.name).split(" ")[0], days }) });
    }
  }
}

async function notifyCoachMessage(env, req, m) {
  try {
    const l = await getRec(env, "leads", m.leadId);
    const to = l && l.coach && (await staffMember(env, l.coach)) ? [l.coach] : coachEmails(env);
    await pushTeam(env, to, { title: l ? l.name : "New message", body: m.text || (m.video ? "Sent a video" : "Sent a photo"), url: "admin.html#messages", tag: "msg-" + m.leadId, skipIfOpen: "admin" }).catch(e => console.error(e));
    const r = await env.DB.prepare(`INSERT INTO ratelimit (k, n, reset) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset < ?3 THEN 1 ELSE n + 1 END, reset = CASE WHEN reset < ?3 THEN ?2 ELSE reset END RETURNING n`)
      .bind("msgmail:" + m.leadId, now() + 30 * 60_000, now()).first();
    if (r.n > 1) return;
    await sendEmail(env, { to, ...T.clientMessage({ site: siteUrl(env, req), name: l ? l.name : "A client", text: m.text }) });
  } catch (e) { console.error("notify", e); }
}

async function typing(env, s, req) {
  const b = await body(req, 2000), lead = clean(b.lead, 120);
  if (!lead) fail(400, "No client");
  if (!isCoach(s) && !s.leadList.includes(lead)) fail(403, "Not yours");
  const who = isTeam(s) ? "coach" : "client";
  if (b.clear) await env.DB.prepare(`DELETE FROM typing WHERE who = ? AND lead = ?`).bind(who, lead).run();
  else await env.DB.prepare(`INSERT INTO typing (who, lead, at) VALUES (?1, ?2, ?3) ON CONFLICT(who, lead) DO UPDATE SET at = ?3`).bind(who, lead, now()).run();
  return json({ ok: true });
}

/* ---------- photos ---------- */
async function img(env, s, key, req) {
  const parts = key.split("/"); // p/<owner>/<file>
  if (parts[0] !== "p" || parts.length !== 3 || /\.\./.test(key)) fail(404, "Not found");
  const owner = parts[1];
  if (owner === "comm") need(s); // community photos: any logged-in member
  else if (owner !== "lib") { need(s); if (!isCoach(s) && !s.leadList.includes(owner)) fail(403, "Not yours"); }
  const cache = owner === "lib" ? "public, max-age=86400" : "private, max-age=86400";
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (range) {
    // videos: phones ask for one chunk at a time
    const h = await env.PHOTOS.head(key); if (!h) fail(404, "Not found");
    const size = h.size; let start = range[1] === "" ? Math.max(0, size - +range[2]) : +range[1], end = range[1] !== "" && range[2] !== "" ? Math.min(+range[2], size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    const o = await env.PHOTOS.get(key, { range: { offset: start, length: end - start + 1 } });
    return new Response(o.body, { status: 206, headers: { "content-type": h.httpMetadata?.contentType || "application/octet-stream", "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1), "accept-ranges": "bytes", "cache-control": cache, "x-content-type-options": "nosniff" } });
  }
  const o = await env.PHOTOS.get(key);
  if (!o) fail(404, "Not found");
  return new Response(o.body, { headers: { "content-type": o.httpMetadata?.contentType || "image/jpeg", "accept-ranges": "bytes", "cache-control": cache, "x-content-type-options": "nosniff", ...(o.size ? { "content-length": String(o.size) } : {}) } });
}

/* =========================================================
   COMMUNITY: challenge leaderboards (clients can't see each other's logs,
   so the server works out the scores and only shares names + totals)
   ========================================================= */
async function community(env, s) {
  const today = londonNow().date;
  const chs = (await env.DB.prepare(`SELECT data FROM records WHERE coll = 'challenges' AND deleted = 0`).all()).results.map(r => JSON.parse(r.data)).filter(c => c.end >= globalThis.BFLSlots.addDay(today, -14));
  if (!chs.length) return json({ challenges: [] });
  const from = chs.reduce((a, c) => c.start < a ? c.start : a, "9999"), to = chs.reduce((a, c) => c.end > a ? c.end : a, "0000");
  const rows = (await env.DB.prepare(`SELECT coll, id, data FROM records WHERE deleted = 0 AND (coll IN ('leads','orders') OR (coll IN ('workouts','checkins','food') AND d >= ? AND d <= ?))`).bind(globalThis.BFLSlots.addDay(from, -7), to).all()).results;
  const D = { leads: [], orders: [], workouts: [], checkins: [], food: {} };
  for (const r of rows) { const v = JSON.parse(r.data); if (r.coll === "food") D.food[r.id] = v; else D[r.coll].push(v); }
  const out = chs.map(c => {
    const b = globalThis.BFLCommunity.board(c, D), meRow = b.find(x => s.leadList.includes(x.id));
    return { ...c, status: globalThis.BFLCommunity.status(c, today), count: b.length, board: b.slice(0, 10).map(x => ({ name: x.name, score: x.score, rank: x.rank, me: s.leadList.includes(x.id) })), me: meRow ? { rank: meRow.rank, score: meRow.score } : null };
  });
  return json({ challenges: out });
}

/* =========================================================
   BOOKINGS: clients book their own sessions in their coach's free time
   ========================================================= */
function londonNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
async function coachOf(env, lead) {
  const st = lead && lead.coach ? await staffMember(env, lead.coach) : null;
  if (st) return { id: st.id, name: st.name, booking: st.booking || {}, emails: [st.id] };
  const set = (await getRec(env, "settings", "main")) || {};
  return { id: "", name: "Jory", booking: set.booking || {}, emails: coachEmails(env) };
}
async function coachEvents(env, coachId, from) {
  const { results } = await env.DB.prepare(`SELECT data FROM records WHERE coll = 'events' AND deleted = 0 AND d >= ?`).bind(from).all();
  return results.map(r => JSON.parse(r.data)).filter(e => (e.coach || "") === coachId);
}
async function slotsFor(env, s) {
  const lead = await getRec(env, "leads", s.lead), c = await coachOf(env, lead), now = londonNow();
  const cfg = globalThis.BFLSlots.cfgOf(c.booking), evs = await coachEvents(env, c.id, now.date);
  return { lead, c, cfg, now, evs, days: globalThis.BFLSlots.slots(cfg, evs, now) };
}
async function bookingRoutes(env, s, req, path, ctx) {
  if (path === "slots") {
    const x = await slotsFor(env, s);
    return json({ on: !!x.cfg.on, mins: x.cfg.mins, where: x.cfg.where, notice: x.cfg.notice, auto: x.cfg.auto, coach: x.c.name, days: x.days });
  }
  if (isTeam(s) && path === "booking-settings") {
    // a coach saves their own booking hours
    const b = await body(req, 20000), cfg = globalThis.BFLSlots.cfgOf(b.booking || {}), keep = {};
    keep.on = !!cfg.on; keep.auto = !!cfg.auto; keep.mins = num(cfg.mins, 15, 240) || 60; keep.step = [15, 30, 60].includes(+cfg.step) ? +cfg.step : 30;
    keep.notice = num(cfg.notice, 0, 168) ?? 12; keep.ahead = num(cfg.ahead, 1, 60) || 14; keep.where = clean(cfg.where, 60) || "Gym"; keep.days = {};
    for (let d = 0; d < 7; d++) { const w = cfg.days[d] || {}; keep.days[d] = { on: !!w.on, start: /^\d\d:\d\d$/.test(w.start) ? w.start : "09:00", end: /^\d\d:\d\d$/.test(w.end) ? w.end : "17:00" }; }
    if (isCoach(s)) { const st = (await getRec(env, "settings", "main")) || {}; st.booking = keep; await putRec(env, "settings", "main", st); }
    else { const st = await getRec(env, "staff", s.email); st.booking = keep; await putRec(env, "staff", s.email, st); }
    return json({ ok: true, booking: keep });
  }
  if (isTeam(s) && path === "ical/token") {
    const t = rand(18);
    if (isCoach(s)) { const st = (await getRec(env, "settings", "main")) || {}; st.icalToken = t; await putRec(env, "settings", "main", st); }
    else { const st = await getRec(env, "staff", s.email); st.icalToken = t; await putRec(env, "staff", s.email, st); }
    return json({ url: `${siteUrl(env, req)}/api/ical/${t}.ics` });
  }
  if (isTeam(s)) fail(403, "Clients only");
  const b = await body(req, 3000);
  if (path === "book") {
    await limit(env, "book:" + s.lead, 20, 86400);
    const x = await slotsFor(env, s), date = String(b.date || ""), time = String(b.time || "");
    if (!x.cfg.on) fail(400, "Online booking isn't open right now. Message your coach.");
    if (!isDate(date) || !/^\d\d:\d\d$/.test(time) || !x.days.some(d => d.date === date && d.times.includes(time))) fail(409, "Sorry, that time has just gone. Please pick another.");
    const ev = { id: "e" + rand(9).replace(/[-_]/g, "x"), type: "session", date, time, mins: x.cfg.mins, where: x.cfg.where, leadId: s.lead, coach: x.c.id, status: x.cfg.auto ? "confirmed" : "requested", by: "client", notes: "", created: new Date().toISOString() };
    await putRec(env, "events", ev.id, ev);
    ctx.waitUntil(notifyBooking(env, req, ev, x.lead, x.c, "booked"));
    return json({ ok: true, event: redact("events", ev) });
  }
  if (path === "book/cancel") {
    const ev = await getRec(env, "events", clean(b.id, 60));
    if (!ev || !s.leadList.includes(ev.leadId)) fail(404, "Booking not found");
    const lead = await getRec(env, "leads", ev.leadId), c = await coachOf(env, lead), cfg = globalThis.BFLSlots.cfgOf(c.booking);
    if (globalThis.BFLSlots.hoursUntil(londonNow(), ev.date, ev.time) < (+cfg.notice || 0)) fail(400, `It's less than ${cfg.notice} hours until this session, so please message ${c.name} to change it.`);
    ev.status = "cancelled"; ev.cancelledAt = new Date().toISOString(); ev.cancelledBy = "client";
    await putRec(env, "events", ev.id, ev);
    ctx.waitUntil(notifyBooking(env, req, ev, lead, c, "cancelled"));
    return json({ ok: true, event: redact("events", ev) });
  }
  fail(404, "Not found");
}
const niceDate = (d, t) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) + (t ? " at " + t : "");
async function notifyBooking(env, req, ev, lead, c, what) {
  try {
    const name = lead ? lead.name : "A client", when = niceDate(ev.date, ev.time), site = siteUrl(env, req);
    if (what === "booked" || what === "cancelled") {
      const title = what === "booked" ? (ev.status === "requested" ? `Booking request: ${name}` : `New booking: ${name}`) : `Cancelled: ${name}`;
      await pushTeam(env, c.emails, { title, body: `${when} · ${ev.where || ""}`, url: "admin.html#diary", tag: "book-" + ev.id });
      await sendEmail(env, { to: c.emails, ...T.booking({ site, kind: what, status: ev.status, name, when, where: ev.where }) });
    } else {
      await pushLeads(env, [ev.leadId], { title: what === "confirmed" ? "Session confirmed" : "Session not available", body: `${when}${what === "confirmed" ? " · see you there" : " · please pick another time"}`, url: "portal.html#book", tag: "book-" + ev.id });
    }
  } catch (e) { console.error("booking notify", e); }
}
/* calendar feed for Google / Apple / Outlook (read-only, secret link) */
async function ical(env, token) {
  token = token.replace(/\.ics$/, "");
  if (!/^[\w-]{16,}$/.test(token)) fail(404, "Not found");
  const set = (await getRec(env, "settings", "main")) || {};
  let coachId = null, name = "Built For Life";
  if (set.icalToken === token) coachId = "";
  else { const r = await env.DB.prepare(`SELECT data FROM records WHERE coll = 'staff' AND deleted = 0 AND json_extract(data, '$.icalToken') = ?`).bind(token).first(); if (r) { const st = JSON.parse(r.data); if (st.active !== false) { coachId = st.id; name = st.name; } } }
  if (coachId === null) fail(404, "Not found");
  const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const evs = (await coachEvents(env, coachId, from)).filter(e => e.status !== "cancelled" && e.status !== "declined");
  const ids = [...new Set(evs.map(e => e.leadId).filter(Boolean))], names = {};
  if (ids.length) (await env.DB.prepare(`SELECT id, data FROM records WHERE coll = 'leads' AND id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).all()).results.forEach(r => names[r.id] = JSON.parse(r.data).name);
  const esc = t => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const dt = (d, t) => d.replace(/-/g, "") + "T" + (t || "00:00").replace(":", "") + "00";
  const end = e => { const m = globalThis.BFLSlots.hm(e.time) + (+e.mins || 60), dd = Math.floor(m / 1440); return dt(globalThis.BFLSlots.addDay(e.date, dd), globalThis.BFLSlots.clock(m % 1440)); };
  const TYPE = { session: "Session", checkin: "Check-in", kickoff: "Kick-off call", consult: "Consultation", other: "" };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Built For Life//Coach diary//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)} · Built For Life`, "X-WR-TIMEZONE:Europe/London",
    "BEGIN:VTIMEZONE", "TZID:Europe/London", "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100", "TZNAME:BST", "DTSTART:19700329T010000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0000", "TZNAME:GMT", "DTSTART:19701025T020000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD", "END:VTIMEZONE"];
  for (const e of evs) {
    const who = names[e.leadId] || e.name || "", what = TYPE[e.type] ?? "";
    lines.push("BEGIN:VEVENT", `UID:${e.id}@builtforlife`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      ...(e.allDay ? [`DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`] : [`DTSTART;TZID=Europe/London:${dt(e.date, e.time)}`, `DTEND;TZID=Europe/London:${end(e)}`]),
      `SUMMARY:${esc([what, who].filter(Boolean).join(": ") || "Built For Life")}${e.status === "requested" ? " (request)" : ""}`, ...(e.where ? [`LOCATION:${esc(e.where)}`] : []), "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" } });
}

/* ---------- food search + barcodes (Open Food Facts, free; cached for a day) ---------- */
const offBase = env => (env.FOOD_API || "https://world.openfoodfacts.org").replace(/\/$/, "");
const FIELDS = "code,product_name,brands,nutriments,serving_size,serving_quantity";
function offItem(p) {
  const n = (p && p.nutriments) || {}, kcal = n["energy-kcal_100g"] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
  if (kcal == null || !p.product_name) return null;
  const f = v => Math.round((+v || 0) * 10) / 10;
  return { code: String(p.code || ""), name: clean(p.product_name, 120), brand: clean(String(p.brands || "").split(",")[0], 60), per100: { kcal: Math.round(kcal), protein: f(n.proteins_100g), carbs: f(n.carbohydrates_100g), fat: f(n.fat_100g) },
    serving: +p.serving_quantity > 0 ? { label: clean(p.serving_size || "1 serving", 40), grams: +p.serving_quantity } : null };
}
async function offFetch(env, path) {
  const u = offBase(env) + path, cache = typeof caches !== "undefined" && caches.default;
  if (cache) { const hit = await cache.match(u); if (hit) return hit.json(); }
  const r = await fetch(u, { headers: { "user-agent": "BuiltForLife/1.0 (hello@builtforlife.uk)", accept: "application/json" } });
  if (!r.ok) fail(502, "Food search isn't answering right now. Try again in a minute.");
  const j = await r.json();
  if (cache) await cache.put(u, new Response(JSON.stringify(j), { headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" } }));
  return j;
}
async function food(env, s, path, url) {
  await limit(env, "food:" + s.email, 300, 3600);
  if (path === "food/search") {
    const q = clean(url.searchParams.get("q"), 80); if (q.length < 2) return json({ items: [] });
    const j = await offFetch(env, `/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`);
    return json({ items: (j.products || []).map(offItem).filter(Boolean) });
  }
  const code = path.slice("food/barcode/".length).replace(/\D/g, "").slice(0, 14);
  if (code.length < 6) fail(400, "That barcode looks too short.");
  const j = await offFetch(env, `/api/v2/product/${code}.json?fields=${FIELDS}`);
  return json({ item: j && j.product ? offItem({ ...j.product, code }) : null });
}

/* ---------- video uploads (exercise demos, form checks): straight into R2 ---------- */
const VIDEO = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };
async function upload(env, s, req, url) {
  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!VIDEO[type]) fail(415, "Please choose a video (MP4 or MOV).");
  const len = +(req.headers.get("content-length") || 0), MAX = 80 * 1024 * 1024;
  if (len > MAX) fail(413, "That video is over 80MB. Trim it to under a minute and try again.");
  let folder;
  const lead = clean(url.searchParams.get("lead"), 120);
  if (isTeam(s)) folder = lead ? (isCoach(s) || s.leadList.includes(lead) ? lead : fail(403, "Not your client")) : "lib";
  else { if (!lead || !s.leadList.includes(lead)) fail(403, "Not yours"); folder = lead; }
  await limit(env, "upload:" + s.email, 40, 3600);
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > MAX) fail(413, "That video is too big.");
  const sig = String.fromCharCode(...buf.subarray(4, 8)), webm = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  if (!(sig === "ftyp" || webm)) fail(415, "That file doesn't look like a video.");
  const key = `p/${folder}/v-${rand(10)}.${VIDEO[type]}`;
  await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: type } });
  return json({ url: "/api/img/" + key, size: buf.length });
}

/* =========================================================
   PUBLIC: the questionnaire ("Future You")
   ========================================================= */
async function leadToken(env, id, t) {
  if (!id || !t) return false;
  const r = await env.DB.prepare(`SELECT token FROM lead_tokens WHERE lead = ?`).bind(id).first();
  return !!r && r.token === t;
}
async function newLead(env, req, ctx) {
  await limit(env, "ip:lead:" + ipOf(req), 12, 3600);
  const b = await body(req, 8_000_000), x = b.lead || {};
  const name = clean(x.name, 80), email = lower(clean(x.email, 120)), phone = clean(x.phone, 30);
  if (name.length < 2 || !isEmail(email) || phone.replace(/\D/g, "").length < 10) fail(400, "Please check your name, email and phone number.");
  const programme = PLANS[x.programme] ? x.programme : "Daily Wins";
  const weight = num(x.weight, 30, 300), target = num(x.target, 30, 300);
  if (weight == null || target == null) fail(400, "Please check your weight and target.");
  const id = "L" + now().toString(36) + rand(3).replace(/[-_]/g, "x");
  const plan = findPlan(x.plan);
  const lead = {
    id, created: new Date().toISOString(), status: "new", notes: "",
    name, phone, email, programme,
    sex: ["male", "female"].includes(x.sex) ? x.sex : clean(x.sex, 20).toLowerCase(),
    age: num(x.age, 14, 100), height: num(x.height, 100, 250), weight, target,
    days: clean(x.days, 20), experience: clean(x.experience, 40), where: clean(x.where, 40), diet: clean(x.diet, 60),
    sleep: num(x.sleep, 0, 24), weddingDate: programme === "Bridal Bootcamp" && isDate(x.weddingDate) ? x.weddingDate : null,
    goal: clean(x.goal, 600), plan: plan ? plan.name : "", weeksNeeded: num(x.weeksNeeded, 1, 520) || 12,
    consent: !!x.consent, noPhoto: true, photo: null
  };
  const photo = typeof x.photo === "string" && x.photo.startsWith("data:image/") && !x.photo.startsWith("data:image/svg") ? decodeImage(x.photo) : null;
  if (photo) { lead.photo = await storePhoto(env, id, photo, "start"); lead.noPhoto = false; }
  else lead.photo = silhouette(programme === "Bridal Bootcamp" ? 340 : 210);
  const token = rand(24);
  await env.DB.batch([putStmt(env, "leads", id, lead), env.DB.prepare(`INSERT INTO lead_tokens (lead, token, created) VALUES (?, ?, ?)`).bind(id, token, now())]);
  ctx.waitUntil(Promise.all([sendEmail(env, { to: coachEmails(env), ...T.newLead({ site: siteUrl(env, req), l: lead }) }),
    pushTeam(env, coachEmails(env), { title: `New sign-up: ${name}`, body: `${programme} · ${weight} → ${target} kg`, url: "admin.html#leads", tag: "lead" })]));
  return json({ id, token, photo: lead.photo });
}
async function leadPublic(env, id, url) {
  if (!(await leadToken(env, id, url.searchParams.get("t")))) fail(404, "Not found");
  const l = await getRec(env, "leads", id); if (!l) fail(404, "Not found");
  return json({ id: l.id, name: l.name, email: l.email, phone: l.phone, programme: l.programme, plan: l.plan, weddingDate: l.weddingDate });
}

/* ---------- the AI "future you" (Google Gemini "Nano Banana") ---------- */
function futurePrompt(l) {
  const w = l.weight, sex = l.sex === "male" ? "man" : l.sex === "female" ? "woman" : "person";
  const plan = findPlan(l.plan), L = plan ? plan.weeks : 12;
  const p = project(w, l.target), loss = Math.min(p.toLose, p.perWeek * L), endW = Math.round((w - loss) * 10) / 10;
  const gain = p.gain ? Math.min(p.toGain, p.perWeek * L) : 0, upW = Math.round((w + gain) * 10) / 10;
  const change = gain >= 0.5
    ? `about ${Math.round(gain)} kg heavier from lean muscle (from ${w} kg to about ${upW} kg): visibly broader, fuller shoulders and chest, bigger arms, a stronger back and slightly thicker legs, with the waist staying slim and low body fat`
    : loss >= 0.5
    ? `about ${Math.round(loss)} kg lighter (from ${w} kg to about ${endW} kg): visibly less body fat around the stomach, waist, hips and face, a slimmer midsection, and slightly more visible muscle tone in the shoulders and arms`
    : `the same body weight but leaner and stronger: more visible muscle tone in the shoulders, arms and legs, a tighter midsection and more athletic posture`;
  return [
    `Edit this photo of a real ${sex}.`,
    `Show the realistic result of ${L} weeks of personal training and good nutrition: ${change}.`,
    `Keep their identity exactly the same: same face, facial features, skin tone, hair, age, expression, pose, camera angle, clothing, background, lighting and photo quality.`,
    `The change must look natural and achievable for a normal person, not a fitness model or bodybuilder. No exaggeration, no bodybuilder look, no changes to height.`,
    `Photorealistic. Return one image only, same framing as the original.`
  ].join(" ");
}
function findImage(o) {
  if (o?.output_image?.data) return o.output_image.data;
  for (const s of o?.steps || []) for (const c of s?.content || []) if (c?.type === "image" && c.data) return c.data;
  for (const c of o?.outputs || []) if (c?.type === "image" && c.data) return c.data;
  for (const c of o?.candidates || []) for (const p of c?.content?.parts || []) { const d = p.inline_data || p.inlineData; if (d?.data) return d.data; }
  return null;
}
async function future(env, req, ctx) {
  if (!env.GEMINI_API_KEY) fail(503, "AI is off");
  const b = await body(req, 5000), id = clean(b.id, 120);
  if (!(await leadToken(env, id, b.t))) fail(404, "Not found");
  await limit(env, "future:" + id, 3, 86400);
  const day = new Date().toISOString().slice(0, 10);
  if ((await counter(env, "ai:" + day)) > (parseInt(env.AI_DAILY_LIMIT || "100", 10) || 100)) fail(503, "AI limit reached for today");
  const l = await getRec(env, "leads", id);
  if (!l || l.noPhoto || !String(l.photo || "").startsWith("/api/img/")) fail(400, "No photo");
  const o = await env.PHOTOS.get(l.photo.replace("/api/img/", ""));
  if (!o) fail(400, "No photo");
  const buf = Buffer.from(await o.arrayBuffer()), mime = o.httpMetadata?.contentType || "image/jpeg";
  const base = (env.GEMINI_API || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const r = await fetch(`${base}/v1beta/interactions`, {
    method: "POST", headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.GEMINI_MODEL || "gemini-nano-banana-2.1",
      input: [{ type: "text", text: futurePrompt(l) }, { type: "image", mime_type: mime, data: buf.toString("base64") }],
      response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "3:4", image_size: "1K" }
    })
  });
  const text = await r.text();
  if (!r.ok) { console.error("Gemini", r.status, text.slice(0, 400)); fail(502, "AI failed"); }
  let b64 = null; try { b64 = findImage(JSON.parse(text)); } catch {}
  if (!b64) { console.error("Gemini: no image", text.slice(0, 400)); fail(502, "AI returned no image"); }
  const out = Buffer.from(b64, "base64");
  const url = await storePhoto(env, id, { mime: "image/jpeg", ext: "jpg", buf: out }, "future-" + rand(6));
  const fresh = await getRec(env, "leads", id);
  if (fresh) { fresh.future = url; await putRec(env, "leads", id, fresh); }
  return json({ image: "data:image/jpeg;base64," + b64, url });
}

/* =========================================================
   STRIPE
   ========================================================= */
const stripeBase = env => (env.STRIPE_API || "https://api.stripe.com").replace(/\/$/, "");
function form(obj, prefix, out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, method, path, params) {
  const r = await fetch(stripeBase(env) + "/v1/" + path, {
    method, headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: params ? form(params).toString() : undefined
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("Stripe", r.status, JSON.stringify(t).slice(0, 400)); fail(502, (t.error && t.error.message) || "Payment provider error"); }
  return t;
}

async function checkout(env, req) {
  if (!env.STRIPE_SECRET_KEY) fail(503, "Payments aren't switched on yet.");
  await limit(env, "ip:checkout:" + ipOf(req), 20, 3600);
  const b = await body(req, 10000);
  const plan = findPlan(b.planId); if (!plan) fail(400, "Please pick a plan.");
  const name = clean(b.name, 80), email = lower(clean(b.email, 120)), phone = clean(b.phone, 30);
  if (name.length < 2 || !isEmail(email) || phone.replace(/\D/g, "").length < 10) fail(400, "Please check your name, email and phone number.");
  const start = isDate(b.start) ? b.start : null, wedding = isDate(b.wedding) ? b.wedding : null;
  if (plan.programme === "Bridal Bootcamp" && !wedding) fail(400, "Please add your wedding date.");
  let leadId = null;
  if (b.id && (await leadToken(env, b.id, b.t))) leadId = b.id;
  const po = payOptions(plan).find(o => o.id === b.pay) || payOptions(plan)[0];
  const orderId = "BFL-" + (1000 + (await counter(env, "order")));
  const pend = { orderId, leadId, name, email, phone, planId: plan.id, start, wedding, pay: po.id, instalments: po.n, each: po.each, created: new Date().toISOString() };
  const site = siteUrl(env, req);
  const back = `${site}/checkout.html?plan=${plan.id}${leadId ? `&lead=${leadId}&t=${encodeURIComponent(b.t)}` : ""}&cancelled=1`;
  const product = { name: `Built For Life · ${plan.name}`, description: `${plan.programme} coaching programme` };
  const s = po.n > 1 ? await stripe(env, "POST", "checkout/sessions", {
    // monthly: a Stripe subscription that we stop after the last payment
    mode: "subscription", customer_email: email, client_reference_id: orderId,
    success_url: `${site}/checkout.html?paid={CHECKOUT_SESSION_ID}&o=${orderId}`, cancel_url: back,
    metadata: { order: orderId, plan: plan.id, instalments: po.n },
    subscription_data: { metadata: { order: orderId, instalments: po.n }, description: `${plan.name} · ${po.n} monthly payments · ${orderId}` },
    line_items: { 0: { quantity: 1, price_data: { currency: "gbp", unit_amount: Math.round(po.each * 100), recurring: { interval: "month" }, product_data: { name: `${product.name} (${po.n} monthly payments)` } } } }
  }) : await stripe(env, "POST", "checkout/sessions", {
    mode: "payment", customer_email: email, client_reference_id: orderId,
    success_url: `${site}/checkout.html?paid={CHECKOUT_SESSION_ID}&o=${orderId}`, cancel_url: back,
    metadata: { order: orderId, plan: plan.id },
    payment_intent_data: { metadata: { order: orderId }, description: `${plan.name} · ${orderId}` },
    line_items: { 0: { quantity: 1, price_data: { currency: "gbp", unit_amount: Math.round(plan.price * 100), product_data: { name: `Built For Life · ${plan.name}`, description: `${plan.programme} coaching programme` } } } }
  });
  await env.DB.prepare(`INSERT INTO pending (id, session, data, created) VALUES (?, ?, ?, ?)`).bind(orderId, s.id, JSON.stringify(pend), now()).run();
  return json({ url: s.url, order: orderId });
}

/* turn a paid Stripe session into an order (safe to call more than once) */
async function confirmPaid(env, req, ctx, session) {
  const orderId = session.metadata && session.metadata.order || session.client_reference_id;
  if (!orderId) return null;
  const have = await getRec(env, "orders", orderId);
  if (have) return have;
  const p = await env.DB.prepare(`SELECT data FROM pending WHERE id = ?`).bind(orderId).first();
  if (!p) return null;
  const pend = JSON.parse(p.data), plan = findPlan(pend.planId);
  let lead = pend.leadId ? await getRec(env, "leads", pend.leadId) : null;
  if (!lead) {
    // no link from the result screen: use the questionnaire this email filled in, if there is one
    const r = await env.DB.prepare(`SELECT data FROM records WHERE coll = 'leads' AND deleted = 0 AND email = ? ORDER BY updated DESC LIMIT 5`).bind(lower(pend.email)).all();
    const found = r.results.map(x => JSON.parse(x.data)).find(l => +l.weight > 0 && !l.noQuiz);
    if (found) lead = found;
  }
  if (!lead) {
    const id = "L" + now().toString(36) + rand(3).replace(/[-_]/g, "x");
    lead = { id, created: new Date().toISOString(), status: "client", notes: "", name: pend.name, phone: pend.phone, email: pend.email, programme: plan.programme, plan: plan.name,
      weight: 0, target: 0, weeksNeeded: plan.weeks, weddingDate: pend.wedding, photo: silhouette(plan.programme === "Bridal Bootcamp" ? 340 : 210), noPhoto: true, noQuiz: true };
  }
  Object.assign(lead, { status: "client", plan: plan.name, programme: plan.programme, name: pend.name || lead.name, phone: pend.phone || lead.phone, email: pend.email || lead.email });
  if (pend.wedding) lead.weddingDate = pend.wedding;
  const nowIso = new Date().toISOString(), n = pend.instalments || 1, first = (session.amount_total ?? Math.round((n > 1 ? pend.each : plan.price) * 100)) / 100;
  const order = {
    id: orderId, created: nowIso, leadId: lead.id, name: lead.name, email: lead.email, phone: lead.phone,
    planId: plan.id, plan: plan.name, programme: plan.programme, amount: first, total: plan.price,
    status: "paid", start: pend.start, weddingDate: pend.wedding, stripeSession: session.id, paymentIntent: session.payment_intent || null,
    payType: n > 1 ? "monthly" : "full", instalments: n, each: n > 1 ? pend.each : plan.price, paidCount: 1,
    payments: [{ at: nowIso, amount: first, invoice: session.invoice || null }], invoices: session.invoice ? [session.invoice] : [],
    subscription: session.subscription || null, nextDue: n > 1 ? addMonth(nowIso) : null
  };
  await env.DB.batch([putStmt(env, "leads", lead.id, lead), putStmt(env, "orders", orderId, order), env.DB.prepare(`DELETE FROM pending WHERE id = ?`).bind(orderId)]);
  const site = siteUrl(env, req), wa = env.COACH_WHATSAPP || "447734432205";
  ctx.waitUntil(Promise.all([
    sendEmail(env, { to: order.email, replyTo: coachEmails(env)[0], ...T.welcome({ site, first: order.name.split(" ")[0], plan: plan.name, orderId, amount: n > 1 ? `${gbp(order.amount)} today, then ${gbp(order.each)} a month (${n} payments in total)` : gbp(order.amount), email: order.email, wa }) }),
    sendEmail(env, { to: coachEmails(env), ...T.payment({ site, o: { ...order, amountText: gbp(order.amount) + (n > 1 ? ` (1 of ${n})` : "") } }) }),
    pushTeam(env, coachEmails(env), { title: `${gbp(order.amount)} from ${order.name}`, body: `${plan.name}${n > 1 ? ` · payment 1 of ${n}` : ""}`, url: "admin.html#payments", tag: "pay" })
  ]));
  return order;
}
async function verifyStripe(env, req, raw) {
  const sig = req.headers.get("stripe-signature") || "";
  const parts = Object.fromEntries(sig.split(",").map(x => x.split("=")).filter(x => x.length === 2).map(([k, v]) => [k.trim(), v]));
  const v1s = sig.split(",").filter(x => x.trim().startsWith("v1=")).map(x => x.trim().slice(3));
  const t = parseInt(parts.t, 10);
  if (!t || !v1s.length || Math.abs(now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`))).toString("hex");
  const eq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
  return v1s.some(v => eq(v, mac));
}
/* ---------- monthly payments ---------- */
async function orderForInvoice(env, inv) {
  const meta = (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.metadata) || (inv.subscription_details && inv.subscription_details.metadata) || {};
  const sub = inv.subscription || (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) || null;
  if (meta.order) { const o = await getRec(env, "orders", meta.order); if (o) return o; }
  if (!sub) return null;
  const r = await env.DB.prepare(`SELECT data FROM records WHERE coll = 'orders' AND deleted = 0 AND json_extract(data, '$.subscription') = ?`).bind(sub).first();
  return r ? JSON.parse(r.data) : null;
}
async function instalmentPaid(env, req, ctx, inv) {
  const ord = await orderForInvoice(env, inv);
  if (!ord || ord.payType !== "monthly") return; // the first payment is recorded when checkout completes
  ord.invoices = ord.invoices || [];
  if (ord.invoices.includes(inv.id) || inv.billing_reason === "subscription_create") return;
  const amt = (inv.amount_paid || 0) / 100;
  ord.invoices.push(inv.id); ord.payments = ord.payments || []; ord.payments.push({ at: new Date().toISOString(), amount: amt, invoice: inv.id });
  ord.paidCount = (ord.paidCount || 1) + 1; ord.amount = Math.round(((ord.amount || 0) + amt) * 100) / 100;
  ord.status = "paid"; delete ord.failedAt; delete ord.payUrl;
  if (ord.paidCount >= ord.instalments) {
    ord.nextDue = null; ord.complete = true;
    if (ord.subscription) await stripe(env, "DELETE", "subscriptions/" + encodeURIComponent(ord.subscription)).catch(e => console.error("cancel sub", e));
  } else ord.nextDue = addMonth(ord.nextDue || new Date());
  await putRec(env, "orders", ord.id, ord);
  ctx.waitUntil(sendEmail(env, { to: coachEmails(env), ...T.payment({ site: siteUrl(env, req), o: { ...ord, amountText: `${gbp(amt)} (${ord.paidCount} of ${ord.instalments})` } }) }));
}
async function instalmentFailed(env, req, ctx, inv) {
  const ord = await orderForInvoice(env, inv);
  if (!ord) return;
  ord.status = "overdue"; ord.failedAt = new Date().toISOString(); ord.payUrl = inv.hosted_invoice_url || null;
  await putRec(env, "orders", ord.id, ord);
  const site = siteUrl(env, req);
  ctx.waitUntil(Promise.all([
    sendEmail(env, { to: ord.email, replyTo: coachEmails(env)[0], ...T.paymentFailed({ site, first: String(ord.name).split(" ")[0], amount: gbp((inv.amount_due || 0) / 100), plan: ord.plan, url: ord.payUrl }) }),
    pushTeam(env, coachEmails(env), { title: `Payment failed: ${ord.name}`, body: `${ord.plan} · ${gbp((inv.amount_due || 0) / 100)}`, url: "admin.html#payments", tag: "fail" }),
    pushLeads(env, [ord.leadId], { title: "Your payment didn't go through", body: "Tap to sort it in a minute. Your plan carries on as normal.", url: ord.payUrl || "portal.html", tag: "pay" }),
    sendEmail(env, { to: coachEmails(env), ...T.paymentFailedCoach({ site, name: ord.name, amount: gbp((inv.amount_due || 0) / 100), plan: ord.plan, n: (ord.paidCount || 1) + 1, of: ord.instalments }) })
  ]));
}
async function webhook(env, req, ctx) {
  if (!env.STRIPE_WEBHOOK_SECRET) fail(503, "Webhook not configured");
  const raw = await req.text();
  if (!(await verifyStripe(env, req, raw))) fail(400, "Bad signature");
  const ev = JSON.parse(raw), o = ev.data && ev.data.object;
  if ((ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") && o.payment_status === "paid") await confirmPaid(env, req, ctx, o);
  if (ev.type === "invoice.paid" || ev.type === "invoice.payment_succeeded") await instalmentPaid(env, req, ctx, o);
  if (ev.type === "invoice.payment_failed") await instalmentFailed(env, req, ctx, o);
  if (ev.type === "charge.refunded" && o.payment_intent) {
    const pi = await stripe(env, "GET", "payment_intents/" + o.payment_intent);
    const id = pi.metadata && pi.metadata.order, ord = id && await getRec(env, "orders", id);
    if (ord) { ord.status = o.amount_refunded >= o.amount ? "refunded" : "part-refunded"; ord.refunded = o.amount_refunded / 100; await putRec(env, "orders", id, ord); }
  }
  return json({ received: true });
}
async function orderStatus(env, req, ctx, url) {
  const id = clean(url.searchParams.get("o"), 40), sid = clean(url.searchParams.get("s"), 200);
  if (!id || !sid) fail(400, "Missing order");
  await limit(env, "ip:os:" + ipOf(req), 60, 600);
  let ord = await getRec(env, "orders", id);
  if (!ord) {
    const p = await env.DB.prepare(`SELECT session FROM pending WHERE id = ?`).bind(id).first();
    if (!p || p.session !== sid) fail(404, "Not found");
    // the webhook may not have arrived yet: ask Stripe directly
    const s = await stripe(env, "GET", "checkout/sessions/" + encodeURIComponent(sid));
    if (s.payment_status === "paid") ord = await confirmPaid(env, req, ctx, s);
    if (!ord) return json({ status: "pending" });
  }
  if (ord.stripeSession !== sid) fail(404, "Not found");
  return json({ status: ord.status, order: pick(ord, ["id", "name", "email", "plan", "planId", "programme", "amount", "total", "start", "weddingDate", "created", "payType", "instalments", "each", "paidCount"]) });
}

/* =========================================================
   EMAIL (Resend)
   ========================================================= */
async function sendEmail(env, { to, subject, html, replyTo }) {
  const list = [].concat(to || []).filter(Boolean);
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !list.length) return false;
  try {
    const r = await fetch((env.RESEND_API || "https://api.resend.com").replace(/\/$/, "") + "/emails", {
      method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: list, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) })
    });
    if (!r.ok) console.error("email failed", r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) { console.error("email error", e); return false; }
}

/* =========================================================
   ROUTER
   ========================================================= */
export async function onRequest(ctx) {
  const { request: req, env } = ctx;
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, ""), m = req.method;
  try {
    if (path === "config") {
      if (!env.DB || !env.PHOTOS) return json({ live: false });
      const s = await sessionOf(env, req);
      const pk = await vapid(env).then(v => v.pubB64).catch(e => { console.error("vapid", e); return null; });
      return json({ live: true, push: !!pk, pushKey: pk, stripe: !!env.STRIPE_SECRET_KEY, ai: !!env.GEMINI_API_KEY, email: !!env.RESEND_API_KEY, testCodes: flag(env, "DEMO_CODES"),
        stripeTest: String(env.STRIPE_SECRET_KEY || "").startsWith("sk_test"), session: s ? { role: s.role, email: s.email, lead: s.lead } : null });
    }
    if (!env.DB || !env.PHOTOS) fail(503, "The database isn't connected yet.");
    // only accept writes from our own pages (simple CSRF guard); Stripe's webhook is exempt
    if (m !== "GET" && path !== "stripe-webhook") {
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin && origin !== (env.SITE_URL || "").replace(/\/$/, "")) fail(403, "Bad origin");
    }
    if (m === "POST" && path === "auth/start") return await authStart(env, req);
    if (m === "POST" && path === "auth/verify") return await authVerify(env, req);
    if (m === "POST" && path === "auth/logout") return await authLogout(env, req);
    if (m === "POST" && path === "lead") return await newLead(env, req, ctx);
    if (m === "GET" && path.startsWith("lead/")) return await leadPublic(env, path.slice(5), url);
    if (m === "POST" && path === "future") return await future(env, req, ctx);
    if (m === "POST" && path === "checkout") return await checkout(env, req);
    if (m === "POST" && path === "stripe-webhook") return await webhook(env, req, ctx);
    if (m === "GET" && path === "order-status") return await orderStatus(env, req, ctx, url);
    if (m === "GET" && path.startsWith("ical/")) return await ical(env, path.slice(5));
    await maybeDaily(env, req, ctx).catch(e => console.error("daily check", e));
    const s = await sessionOf(env, req);
    if (m === "GET" && path.startsWith("img/")) return await img(env, s, decodeURIComponent(path.slice(4)), req);
    if (m === "POST" && path === "upload") return await upload(env, need(s), req, url);
    if (m === "GET" && (path === "food/search" || path.startsWith("food/barcode/"))) return await food(env, need(s), path, url);
    if (m === "GET" && path === "community") return await community(env, need(s));
    if ((m === "GET" && path === "slots") || (m === "POST" && ["book", "book/cancel", "booking-settings", "ical/token"].includes(path))) return await bookingRoutes(env, need(s), req, path, ctx);
    if (m === "GET" && path === "state") return await state(env, need(s));
    if (m === "GET" && path === "changes") return await changes(env, need(s), url);
    if (m === "POST" && path === "sync") return await sync(env, need(s), req, ctx);
    if (m === "POST" && path === "typing") return await typing(env, need(s), req);
    if (m === "POST" && path === "push/subscribe") return await pushSubscribe(env, need(s), req);
    if (m === "POST" && path === "push/unsubscribe") { need(s); const b = await body(req, 3000); await env.DB.prepare(`DELETE FROM push_subs WHERE endpoint = ?`).bind(clean(b.endpoint, 1000)).run(); return json({ ok: true }); }
    if (m === "POST" && path === "push/test") { need(s); const n = isTeam(s) ? await pushTeam(env, [s.email], { title: "Notifications are on", body: "You'll get alerts here even when the panel is closed.", url: "admin.html" }) : await pushLeads(env, [s.lead], { title: "Notifications are on", body: "We'll let you know when your coach messages you.", url: "portal.html#today" }); return json({ ok: true, sent: n }); }
    if (m === "POST" && path === "daily-now") { need(s, "coach"); await dailyJobs(env, req, "manual"); return json({ ok: true }); }
    fail(404, "Not found");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e && e.stack || e);
    return json({ error: "Something went wrong on our side. Please try again." }, 500);
  }
}
