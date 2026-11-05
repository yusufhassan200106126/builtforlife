/* =========================================================
   Built For Life — local test server (no Cloudflare account needed)
   Runs the real server code (functions/api/[[route]].js) on your computer
   with a local database, local photo storage, and pretend Stripe, AI and
   email services, so the whole flow can be tested end to end.

     node --no-warnings dev/local-server.mjs        then open http://localhost:8788

   Pretend services:
     • Stripe: a fake payment page (no card needed) that sends a real signed webhook
     • AI: returns your own photo slightly brightened (so you can see the flow)
     • Email: nothing is sent; see them at http://localhost:8788/__mails
   For real Stripe/Gemini/Resend testing use `npx wrangler pages dev` (see SETUP.md).
   ========================================================= */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = +(process.env.PORT || 8788), ORIGIN = `http://localhost:${PORT}`;
const { onRequest } = await import(path.join(ROOT, "functions/api/[[route]].js"));

/* ---------- D1 look-alike on SQLite ---------- */
const dbFile = process.env.DB_FILE || path.join(ROOT, "dev/.local.sqlite");
const sql = new DatabaseSync(dbFile);
sql.exec(fs.readFileSync(path.join(ROOT, "schema.sql"), "utf8"));
class Stmt {
  constructor(q, args = []) { this.q = q; this.args = args; }
  bind(...a) { return new Stmt(this.q, a); }
  _p() { return sql.prepare(this.q); }
  async first() { return this._p().get(...this.args) ?? null; }
  async all() { return { results: this._p().all(...this.args), success: true }; }
  async run() { const r = /\breturning\b/i.test(this.q) ? this._p().all(...this.args) : this._p().run(...this.args); return { success: true, results: Array.isArray(r) ? r : [], meta: r }; }
  _sync() { return /^\s*select|\breturning\b/i.test(this.q) ? { results: this._p().all(...this.args) } : (this._p().run(...this.args), { results: [] }); }
}
const DB = {
  prepare: q => new Stmt(q),
  async batch(list) { sql.exec("BEGIN"); try { const out = list.map(s => s._sync()); sql.exec("COMMIT"); return out; } catch (e) { sql.exec("ROLLBACK"); throw e; } }
};

/* ---------- R2 look-alike on the disk ---------- */
const R2DIR = path.join(ROOT, "dev/.local-photos");
fs.mkdirSync(R2DIR, { recursive: true });
const fileOf = k => path.join(R2DIR, encodeURIComponent(k));
const PHOTOS = {
  async put(k, buf, o = {}) { fs.writeFileSync(fileOf(k), Buffer.from(buf)); fs.writeFileSync(fileOf(k) + ".meta", JSON.stringify(o.httpMetadata || {})); },
  async get(k, o = {}) {
    if (!fs.existsSync(fileOf(k))) return null;
    let b = fs.readFileSync(fileOf(k)); const meta = JSON.parse(fs.readFileSync(fileOf(k) + ".meta", "utf8")), size = b.length;
    if (o.range) b = b.subarray(o.range.offset, o.range.offset + o.range.length);
    return { body: b, size, httpMetadata: meta, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
  },
  async head(k) { if (!fs.existsSync(fileOf(k))) return null; return { size: fs.statSync(fileOf(k)).size, httpMetadata: JSON.parse(fs.readFileSync(fileOf(k) + ".meta", "utf8")) }; },
  async list({ prefix }) { return { objects: fs.readdirSync(R2DIR).filter(f => !f.endsWith(".meta")).map(decodeURIComponent).filter(k => k.startsWith(prefix)).map(key => ({ key })), truncated: false }; },
  async delete(keys) { [].concat(keys).forEach(k => { try { fs.unlinkSync(fileOf(k)); fs.unlinkSync(fileOf(k) + ".meta"); } catch {} }); }
};

const WHSEC = "whsec_local_test";
const env = {
  DB, PHOTOS,
  COACH_EMAILS: process.env.COACH_EMAILS || "jory@builtforlife.uk",
  EMAIL_FROM: "Built For Life <hello@builtforlife.uk>",
  DEMO_CODES: "1", AI_DAILY_LIMIT: "100", COACH_WHATSAPP: "447734432205",
  STRIPE_SECRET_KEY: "sk_test_local", STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_API: ORIGIN + "/__stripe",
  GEMINI_API_KEY: "local", GEMINI_API: ORIGIN + "/__gemini",
  RESEND_API_KEY: "re_local", RESEND_API: ORIGIN + "/__resend",
  FOOD_API: ORIGIN + "/__food"
};

/* ---------- pretend services ---------- */
const sessions = new Map(), subs = new Map(), mails = [], pushes = [];
async function sendHook(type, object) {
  const ev = JSON.stringify({ id: "evt_" + crypto.randomBytes(6).toString("hex"), type, data: { object } });
  const t = Math.floor(Date.now() / 1000), sig = crypto.createHmac("sha256", WHSEC).update(`${t}.${ev}`).digest("hex");
  const r = await fetch(ORIGIN + "/api/stripe-webhook", { method: "POST", headers: { "stripe-signature": `t=${t},v1=${sig}`, "content-type": "application/json" }, body: ev });
  console.log("  webhook", type, "→", r.status); return r.status;
}
async function readBody(req) { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); }
function nested(params) { // line_items[0][price_data][unit_amount]=… → objects
  const o = {};
  for (const [k, v] of params) { const parts = k.replace(/\]/g, "").split("["); let cur = o; parts.forEach((p, i) => { if (i === parts.length - 1) cur[p] = v; else cur = cur[p] = cur[p] || {}; }); }
  return o;
}
async function fakeStripe(req, res, url, raw) {
  const p = url.pathname.replace("/__stripe", "");
  const send = (o, s = 200) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (req.method === "POST" && p === "/v1/checkout/sessions") {
    const b = nested(new URLSearchParams(raw.toString())), id = "cs_test_" + crypto.randomBytes(8).toString("hex");
    const li = b.line_items["0"].price_data, sub = b.mode === "subscription";
    const s = { id, object: "checkout.session", mode: b.mode, url: `${ORIGIN}/__stripe/pay/${id}`, payment_status: "unpaid", status: "open", amount_total: +li.unit_amount, currency: "gbp",
      metadata: b.metadata || {}, client_reference_id: b.client_reference_id, customer_email: b.customer_email, success_url: b.success_url, cancel_url: b.cancel_url,
      payment_intent: sub ? null : "pi_test_" + id.slice(8), subscription: sub ? "sub_test_" + id.slice(8) : null, invoice: sub ? "in_test_" + id.slice(8) + "_1" : null, _name: li.product_data.name, _sub: sub ? (b.subscription_data || {}).metadata || {} : null };
    if (sub) subs.set(s.subscription, { id: s.subscription, status: "active", amount: +li.unit_amount, metadata: s._sub, n: 1 });
    sessions.set(id, s); return send(s);
  }
  const sm = /^\/v1\/subscriptions\/(.+)$/.exec(p);
  if (sm && req.method === "DELETE") { const x = subs.get(sm[1]); if (x) x.status = "canceled"; console.log("  subscription cancelled", sm[1]); return send(x || { error: { message: "No such subscription" } }, x ? 200 : 404); }
  // test helper: run the next monthly payment (?fail=1 to make it fail)
  const cm = /^\/charge\/(.+)$/.exec(p);
  if (cm) {
    const x = subs.get(cm[1]); if (!x || x.status !== "active") return send({ error: { message: "not active" } }, 400);
    x.n++; const fail = url.searchParams.get("fail") === "1";
    const inv = { id: `in_test_${x.id}_${x.n}`, object: "invoice", subscription: x.id, billing_reason: "subscription_cycle", amount_paid: fail ? 0 : x.amount, amount_due: x.amount, hosted_invoice_url: `${ORIGIN}/__stripe/invoice/${x.n}`, parent: { subscription_details: { metadata: x.metadata, subscription: x.id } } };
    if (fail) x.n--;
    return send({ hook: await sendHook(fail ? "invoice.payment_failed" : "invoice.paid", inv), n: x.n, status: x.status });
  }
  const m = /^\/v1\/checkout\/sessions\/(.+)$/.exec(p);
  if (req.method === "GET" && m) { const s = sessions.get(m[1]); return s ? send(s) : send({ error: { message: "No such session" } }, 404); }
  const pay = /^\/pay\/(.+)$/.exec(p);
  if (pay) {
    const s = sessions.get(pay[1]); if (!s) { res.writeHead(404); return res.end("No such session"); }
    if (req.method === "POST") {
      s.payment_status = "paid"; s.status = "complete";
      const ev = JSON.stringify({ id: "evt_" + crypto.randomBytes(6).toString("hex"), type: "checkout.session.completed", data: { object: s } });
      const t = Math.floor(Date.now() / 1000), sig = crypto.createHmac("sha256", WHSEC).update(`${t}.${ev}`).digest("hex");
      const skipHook = url.searchParams.get("nohook") === "1"; // test the "webhook is late" path
      if (!skipHook) { const r = await fetch(ORIGIN + "/api/stripe-webhook", { method: "POST", headers: { "stripe-signature": `t=${t},v1=${sig}`, "content-type": "application/json" }, body: ev }); console.log("  webhook →", r.status, await r.text()); }
      // Stripe also sends invoice.paid for the first monthly payment: the server must ignore it (no double count)
      if (!skipHook && s.subscription) await sendHook("invoice.paid", { id: s.invoice, object: "invoice", subscription: s.subscription, billing_reason: "subscription_create", amount_paid: s.amount_total, parent: { subscription_details: { metadata: s._sub, subscription: s.subscription } } });
      res.writeHead(303, { location: s.success_url.replace("{CHECKOUT_SESSION_ID}", s.id) }); return res.end();
    }
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Test payment</title><body style="font:16px system-ui;background:#f6f9fc;display:grid;place-items:center;min-height:100vh;margin:0">
      <form method=post style="background:#fff;padding:28px;border-radius:12px;box-shadow:0 4px 24px #0002;width:min(380px,90vw)"><p style="color:#635bff;font-weight:700;margin:0 0 6px">Pretend Stripe (local test)</p>
      <h1 style="font-size:20px;margin:0 0 4px">${s._name}</h1><p style="font-size:28px;margin:6px 0 18px">£${(s.amount_total / 100).toFixed(2)}</p>
      <p style="color:#666;font-size:14px">${s.customer_email}</p><button id=pay style="width:100%;padding:14px;border:0;border-radius:8px;background:#635bff;color:#fff;font-size:16px">Pay</button>
      <p><a id=cancel href="${s.cancel_url}">Cancel and go back</a></p></form>`);
  }
  send({ error: { message: "unknown" } }, 404);
}

/* ---------- static files + the API ---------- */
const TYPES = { ".webmanifest": "application/manifest+json", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  try {
    const raw = ["GET", "HEAD"].includes(req.method) ? null : await readBody(req);
    if (url.pathname.startsWith("/__stripe")) return await fakeStripe(req, res, url, raw);
    if (url.pathname.startsWith("/__gemini")) {
      const b = JSON.parse(raw.toString()), img = b.input.find(x => x.type === "image");
      await new Promise(r => setTimeout(r, 1500)); // pretend to think
      res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ output_image: { data: img.data, mime_type: "image/jpeg" } }));
    }
    // pretend Open Food Facts
    if (url.pathname.startsWith("/__food")) {
      const P = [{ code: "5000169005743", product_name: "Fage Total 0% Greek Yoghurt", brands: "Fage", serving_size: "170g pot", serving_quantity: 170, nutriments: { "energy-kcal_100g": 54, proteins_100g: 10.3, carbohydrates_100g: 3, fat_100g: 0 } },
        { code: "5010029000061", product_name: "Weetabix Original", brands: "Weetabix", serving_size: "2 biscuits", serving_quantity: 37.5, nutriments: { "energy-kcal_100g": 362, proteins_100g: 12, carbohydrates_100g: 69, fat_100g: 2 } }];
      res.writeHead(200, { "content-type": "application/json" });
      if (url.pathname.includes("/product/")) { const c = url.pathname.split("/").pop().replace(".json", ""), p = P.find(x => x.code === c); return res.end(JSON.stringify(p ? { status: 1, product: p } : { status: 0 })); }
      const q = (url.searchParams.get("search_terms") || "").toLowerCase();
      return res.end(JSON.stringify({ products: P.filter(p => p.product_name.toLowerCase().split(" ").some(w => q.includes(w.slice(0, 4)))) }));
    }
    if (url.pathname.startsWith("/__resend")) { const b = JSON.parse(raw.toString()); mails.unshift({ at: new Date().toISOString(), ...b }); console.log("  email →", b.to.join(", "), "·", b.subject); res.writeHead(200, { "content-type": "application/json" }); return res.end('{"id":"local"}'); }
    // pretend push service (Chrome/Apple/Mozilla would be here): keeps what the server sends, for tests
    if (url.pathname.startsWith("/__push/") && req.method === "POST") { pushes.push({ id: url.pathname.slice(8), headers: req.headers, body: raw.toString("base64") }); res.writeHead(201); return res.end(); }
    if (url.pathname === "/__pushes.json") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(pushes)); }
    if (url.pathname === "/__mails") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(`<title>Emails</title><body style="font:14px system-ui;padding:20px">${mails.map(m => `<details style="margin:0 0 10px"><summary><b>${m.subject}</b> → ${m.to.join(", ")} <small>${m.at}</small></summary>${m.html}</details>`).join("") || "No emails yet"}</body>`); }
    if (url.pathname === "/__mails.json") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(mails)); }
    if (url.pathname.startsWith("/api/")) {
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      const request = new Request(ORIGIN + req.url, { method: req.method, headers, body: raw && raw.length ? raw : undefined });
      const waits = [];
      const r = await onRequest({ request, env, params: {}, waitUntil: p => waits.push(Promise.resolve(p).catch(e => console.error(e))) });
      const out = Buffer.from(await r.arrayBuffer()), hs = {}; r.headers.forEach((v, k) => hs[k] = v);
      res.writeHead(r.status, hs); res.end(out);
      if (r.status >= 400) console.log("  ", req.method, url.pathname, r.status, out.toString().slice(0, 160));
      return;
    }
    // static site, with Cloudflare-style clean URLs
    let p = decodeURIComponent(url.pathname); if (p.endsWith("/")) p += "index.html";
    let f = path.join(ROOT, "site", path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
    if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
    if (!f.startsWith(path.join(ROOT, "site")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log(`Built For Life (local test) → ${ORIGIN}\n  coach login: ${env.COACH_EMAILS}\n  emails: ${ORIGIN}/__mails`));
