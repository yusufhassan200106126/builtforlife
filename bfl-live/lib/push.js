/* =========================================================
   Built For Life — web push notifications
   Standard Web Push (works on Android, desktop, and iPhone once the app
   is added to the Home Screen). The signing keys are made automatically
   the first time and kept in the database, so there's nothing to set up.
   Encryption: RFC 8291 (aes128gcm). Sign-in to push services: VAPID (RFC 8292).
   ========================================================= */
import { Buffer } from "node:buffer";

const b64u = buf => Buffer.from(buf).toString("base64url");
const unb64u = s => new Uint8Array(Buffer.from(String(s), "base64url"));
const enc = s => new TextEncoder().encode(s);
const cat = (...a) => { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

/* ---------- the site's push keys (made once, stored in D1) ---------- */
let cached = null;
export async function vapid(env) {
  if (cached) return cached;
  const row = await env.DB.prepare(`SELECT v FROM secrets WHERE k = 'vapid'`).first();
  let jwk;
  if (row) jwk = JSON.parse(row.v);
  else {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
    await env.DB.prepare(`INSERT INTO secrets (k, v) VALUES ('vapid', ?) ON CONFLICT(k) DO NOTHING`).bind(JSON.stringify(jwk)).run();
    const again = await env.DB.prepare(`SELECT v FROM secrets WHERE k = 'vapid'`).first(); // in case two requests raced
    jwk = JSON.parse(again.v);
  }
  const priv = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const pub = cat(new Uint8Array([4]), unb64u(jwk.x), unb64u(jwk.y)); // uncompressed public key
  cached = { priv, pub, pubB64: b64u(pub) };
  return cached;
}

async function vapidHeader(env, endpoint, contact) {
  const v = await vapid(env), aud = new URL(endpoint).origin;
  const head = b64u(enc(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.priv, enc(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.pubB64}`;
}

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

/* encrypt one message for one browser (RFC 8291) */
export async function encrypt(p256dh, auth, payload) {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(enc("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(enc(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

/* send a notification to a list of saved subscriptions; removes ones that have expired */
export async function sendTo(env, subs, msg) {
  const contact = "mailto:" + (String(env.COACH_EMAILS || "").split(",")[0].trim() || "hello@builtforlife.uk");
  const payload = JSON.stringify(msg);
  let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      const body = await encrypt(s.p256dh, s.auth, payload);
      const r = await fetch(s.endpoint, { method: "POST", headers: { TTL: "86400", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: await vapidHeader(env, s.endpoint, contact) }, body });
      if (r.status === 404 || r.status === 410) await env.DB.prepare(`DELETE FROM push_subs WHERE endpoint = ?`).bind(s.endpoint).run();
      else if (r.ok) sent++;
      else console.error("push", r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.error("push error", e); }
  }));
  return sent;
}
