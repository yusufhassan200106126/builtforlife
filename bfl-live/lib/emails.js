/* =========================================================
   Built For Life — email designs
   Every email the site sends is built here, in the brand:
   black, bone and red, the "B" mark, big condensed headings.
   Written as old-school tables with inline styles so it looks
   right in Gmail, Apple Mail, Outlook and on phones.
   ========================================================= */
const RED = "#E3242B", BLACK = "#0A0A0A", CARD = "#141414", LINE = "#262626", BONE = "#F2F0EB", MUTED = "#9A9690";
const HEAD = "'Arial Narrow','Helvetica Neue Condensed',Impact,'Arial Black',Arial,sans-serif";
const BODY = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- building blocks ---------- */
export const p = (html, o = {}) => `<p style="margin:0 0 16px;font-family:${BODY};font-size:${o.size || 16}px;line-height:1.6;color:${o.color || "#D9D6CF"}">${html}</p>`;
export const kicker = t => `<p style="margin:0 0 14px;font-family:${MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${RED};font-weight:bold">&#9632;&nbsp; ${esc(t)}</p>`;
export function button(label, url, o = {}) {
  const bg = o.ghost ? "transparent" : RED, bd = o.ghost ? BONE : RED;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${o.margin || "8px 0 8px"}"><tr><td bgcolor="${bg}" style="background:${bg};border:2px solid ${bd}">
    <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:15px 26px;font-family:${HEAD};font-size:15px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none">${esc(label)} &nbsp;&rarr;</a></td></tr></table>`;
}
export function rows(list) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border-top:1px solid ${LINE}">
    ${list.filter(r => r && r[1] != null && r[1] !== "").map(([k, v]) => `<tr><td style="padding:12px 12px 12px 0;border-bottom:1px solid ${LINE};font-family:${MONO};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};width:38%;vertical-align:top">${esc(k)}</td><td style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${BODY};font-size:15px;color:${BONE};vertical-align:top">${esc(v)}</td></tr>`).join("")}</table>`;
}
export function stats(list) { // [[big, label, red?]]
  const w = Math.floor(100 / list.length);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px"><tr>
    ${list.map(([v, l, hot], i) => `<td width="${w}%" style="padding:16px 14px;background:${hot ? "#2a0e10" : "#1B1B1B"};border-left:3px solid ${hot ? RED : "#333"};${i ? "border-left-width:3px;" : ""}vertical-align:top">
      <div style="font-family:${HEAD};font-size:34px;line-height:1;font-weight:bold;color:${hot ? "#ff6b70" : BONE}">${esc(v)}</div>
      <div style="margin-top:6px;font-family:${MONO};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED}">${esc(l)}</div></td>${i < list.length - 1 ? `<td width="8" style="font-size:0">&nbsp;</td>` : ""}`).join("")}
  </tr></table>`;
}
export const quote = (text, who) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px"><tr><td style="border-left:4px solid ${RED};background:#1B1B1B;padding:18px 20px">
  <p style="margin:0;font-family:${BODY};font-size:17px;line-height:1.55;color:${BONE}">&ldquo;${esc(text)}&rdquo;</p>${who ? `<p style="margin:10px 0 0;font-family:${MONO};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED}">${esc(who)}</p>` : ""}</td></tr></table>`;
export function steps(list) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px">${list.map(([t, d], i) => `<tr>
    <td width="44" style="vertical-align:top;padding:0 0 16px"><div style="width:32px;height:32px;line-height:32px;text-align:center;border:2px solid ${RED};font-family:${MONO};font-size:12px;font-weight:bold;color:${BONE}">0${i + 1}</div></td>
    <td style="vertical-align:top;padding:4px 0 16px;font-family:${BODY};font-size:15px;line-height:1.5;color:#D9D6CF"><b style="color:${BONE}">${esc(t)}</b> ${esc(d)}</td></tr>`).join("")}</table>`;
}
export function code(c) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px"><tr>${String(c).split("").map(d => `<td style="padding:0 6px 0 0"><div style="width:46px;height:60px;line-height:60px;text-align:center;background:#1F1F1F;border-bottom:3px solid ${RED};font-family:${HEAD};font-size:34px;font-weight:bold;color:#fff">${esc(d)}</div></td>`).join("")}</tr></table>`;
}
/* a person card used in the morning email */
export function personAlert(name, level, reasons, url) {
  const hot = level === "high";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px"><tr><td style="background:${hot ? "#22100F" : "#1B1B1B"};border-left:4px solid ${hot ? RED : "#F2B84B"};padding:16px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:${HEAD};font-size:19px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;color:${BONE}">${esc(name)}</td>
      <td align="right" style="font-family:${MONO};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${hot ? "#ff6b70" : "#F2B84B"};font-weight:bold">${hot ? "High risk" : "Watch"}</td></tr></table>
    ${reasons.map(r => `<p style="margin:8px 0 0;font-family:${BODY};font-size:14px;line-height:1.45;color:#D9D6CF">&#8226;&nbsp; ${esc(r)}</p>`).join("")}
    <p style="margin:12px 0 0"><a href="${esc(url)}" style="font-family:${MONO};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${RED};text-decoration:none;font-weight:bold">Send a nudge &rarr;</a></p>
  </td></tr></table>`;
}

/* ---------- the frame every email sits in ---------- */
export function layout({ site, title, preheader, kick, intro, body, cta, hero, foot, accent }) {
  const year = new Date().getFullYear();
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(title)}</title>
<style>@media (max-width:620px){.wrap{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}.h1{font-size:40px!important;line-height:1!important}}a{color:${RED}}</style></head>
<body style="margin:0;padding:0;background:${BLACK}" bgcolor="${BLACK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BLACK}">${esc(preheader || "")}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BLACK}" style="background:${BLACK}"><tr><td align="center" style="padding:28px 12px 40px">
  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
    <!-- logo -->
    <tr><td class="pad" style="padding:0 6px 22px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${RED}" width="38" height="38" align="center" style="background:${RED};width:38px;height:38px;font-family:${HEAD};font-size:24px;font-weight:bold;color:#fff;line-height:38px">B</td>
        <td style="padding-left:12px;font-family:${HEAD};font-size:19px;font-weight:bold;letter-spacing:1px;color:#fff">BUILT <span style="color:${RED}">FOR</span> LIFE</td>
      </tr></table></td></tr>
    <!-- card -->
    <tr><td bgcolor="${CARD}" style="background:${CARD};border-top:4px solid ${accent || RED}">
      ${hero ? `<img src="${esc(hero)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0">` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="pad" style="padding:38px 44px 34px">
        ${kick ? kicker(kick) : ""}
        <h1 class="h1" style="margin:0 0 20px;font-family:${HEAD};font-size:48px;line-height:.98;font-weight:bold;letter-spacing:-.5px;text-transform:uppercase;color:#fff">${title}</h1>
        ${intro ? p(intro, { size: 17, color: "#E6E3DD" }) : ""}
        ${body || ""}
        ${cta ? button(cta.label, cta.url, { margin: "14px 0 4px" }) : ""}
      </td></tr></table>
    </td></tr>
    <!-- red strip -->
    <tr><td bgcolor="${RED}" style="background:${RED};padding:14px 44px;font-family:${HEAD};font-size:14px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#fff" class="pad">Personal training for life.</td></tr>
    <!-- footer -->
    <tr><td class="pad" style="padding:24px 44px 0;font-family:${BODY};font-size:12.5px;line-height:1.6;color:${MUTED}">
      ${foot ? `<p style="margin:0 0 12px">${foot}</p>` : ""}
      <p style="margin:0 0 12px"><a href="${esc(site)}" style="color:${BONE};text-decoration:none">builtforlife.uk</a> &nbsp;&middot;&nbsp; <a href="https://wa.me/447734432205" style="color:${BONE};text-decoration:none">WhatsApp Jory</a> &nbsp;&middot;&nbsp; <a href="https://www.instagram.com/builtforlife_uk" style="color:${BONE};text-decoration:none">Instagram</a> &nbsp;&middot;&nbsp; <a href="${esc(site)}/privacy.html" style="color:${BONE};text-decoration:none">Privacy</a></p>
      <p style="margin:0;font-family:${MONO};font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#5f5c57">&copy; ${year} Built For Life UK</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/* =========================================================
   THE EMAILS
   ========================================================= */
export const T = {
  loginCode: ({ site, first, code: c, coach }) => ({
    subject: `${c} is your Built For Life login code`,
    html: layout({ site, title: "Your login<br>code", kick: coach ? "Coach panel" : "My Built For Life", preheader: `Your code is ${c}. It works for 10 minutes.`,
      intro: `Hi ${esc(first || "there")}, here's your code to log in${coach ? " to the coach panel" : " to your portal"}.`,
      body: code(c) + p("It works for 10 minutes. If you didn't ask for it, you can ignore this email: nobody can log in without it.", { size: 14, color: MUTED }) })
  }),

  welcome: ({ site, first, plan, orderId, amount, email, wa }) => ({
    subject: `Welcome to the team, ${first}`,
    html: layout({ site, hero: `${site}/assets/coaching.jpg`, kick: `Payment confirmed · ${orderId}`, title: `Welcome to<br>the team, <span style="color:${RED}">${esc(first)}.</span>`, preheader: `You're in. Here's what happens next with Jory.`,
      intro: `You've just made the best decision for future you. Your <b style="color:#fff">${esc(plan)}</b> is confirmed.`,
      body: rows([["Plan", plan], ["Order", orderId], ["Paid", amount]]) +
        `<p style="margin:6px 0 14px;font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED}">What happens next</p>` +
        steps([["Jory messages you", "on WhatsApp within 24 hours."], ["Kick-off call", "to set your goals and starting point."], ["Your plan lands", "in your portal: training, food targets and weekly check-ins."], ["Day one.", "Week by week, towards future you."]]),
      cta: { label: "Open my portal", url: `${site}/portal.html?email=${encodeURIComponent(email)}` },
      foot: `Log in to your portal with this email address: we'll send you a code, no password needed. Questions? <a href="https://wa.me/${wa}" style="color:${BONE}">Message Jory on WhatsApp</a>.` })
  }),

  coachMessage: ({ site, first, text, photo }) => ({
    subject: `Jory sent you a message`,
    html: layout({ site, kick: "New message", title: "Jory's been<br>in touch", preheader: String(text || "Sent you a photo").slice(0, 90),
      intro: `Hi ${esc(first || "there")}, you've got a new message in your portal.`,
      body: quote(text || "Sent you a photo", "Jory · Built For Life") + (photo ? p("There's a photo with it too.", { size: 14, color: MUTED }) : ""),
      cta: { label: "Reply to Jory", url: `${site}/portal.html#chat` },
      foot: "You get these when Jory messages you and you're not in the app. Replies go straight to his phone." })
  }),

  checkinReminder: ({ site, first, days }) => ({
    subject: `${first}, your weekly check-in is due`,
    html: layout({ site, kick: "Weekly check-in", title: "Two minutes.<br>That's all.", preheader: "Weight, a photo and how the week went. Jory uses it to keep your plan right.",
      intro: `Hi ${esc(first || "there")}, it's been ${days} days since your last check-in. It's how Jory keeps your plan right for you, so let's keep the streak alive.`,
      body: steps([["Step on the scales", "first thing, same as last time."], ["Snap a photo", "same spot, same light."], ["Tell Jory how it went", "energy, sleep and food."]]),
      cta: { label: "Do my check-in", url: `${site}/portal.html#checkin` } })
  }),

  paymentFailed: ({ site, first, amount, plan, url }) => ({
    subject: `Your ${amount} payment didn't go through`,
    html: layout({ site, accent: "#F2B84B", kick: "Payment problem", title: "Quick one about<br>your payment", preheader: "Your monthly payment didn't go through. It only takes a minute to sort.",
      intro: `Hi ${esc(first || "there")}, this month's ${esc(amount)} payment for your <b style="color:#fff">${esc(plan)}</b> didn't go through. It's usually an expired card or a bank check. Your plan carries on as normal.`,
      body: p("Tap below to pay securely with Stripe, or reply to this email if anything's changed.", { size: 15 }),
      cta: url ? { label: "Pay now", url } : { label: "Message Jory", url: "https://wa.me/447734432205" } })
  }),

  /* ----- to Jory ----- */
  booking: ({ site, kind, status, name, when, where }) => ({
    subject: kind === "cancelled" ? `Cancelled: ${name} · ${when}` : status === "requested" ? `Booking request: ${name} · ${when}` : `New booking: ${name} · ${when}`,
    html: layout({ site, accent: kind === "cancelled" ? "#F2B84B" : RED, kick: kind === "cancelled" ? "Session cancelled" : status === "requested" ? "Booking request" : "New booking", title: kind === "cancelled" ? `${esc(String(name).split(" ")[0])} cancelled` : `${esc(String(name).split(" ")[0])} booked<br><span style="color:${RED}">a session.</span>`,
      preheader: `${name} · ${when}`, body: rows([["Client", name], ["When", when], ["Where", where]]) + (status === "requested" && kind !== "cancelled" ? p("Confirm or decline it in your diary.", { size: 15 }) : ""),
      cta: { label: "Open the diary", url: `${site}/admin.html#diary` } })
  }),
  paymentFailedCoach: ({ site, name, amount, plan, n, of }) => ({
    subject: `Payment failed: ${name} · ${amount}`,
    html: layout({ site, accent: "#F2B84B", kick: "Payment failed", title: `${esc(String(name).split(" ")[0])}'s payment<br><span style="color:${RED}">bounced.</span>`, preheader: `${name}'s monthly payment (${n} of ${of}) didn't go through.`,
      intro: `Monthly payment ${n} of ${of} for the ${esc(plan)} didn't go through. They've been emailed a link to pay. Stripe will also retry automatically.`,
      body: rows([["Client", name], ["Amount", amount], ["Payment", `${n} of ${of}`]]),
      cta: { label: "Open payments", url: `${site}/admin.html#payments` } })
  }),
  newLead: ({ site, l }) => ({
    subject: `New sign-up: ${l.name} (${l.programme})`,
    html: layout({ site, kick: "New sign-up", title: `${esc(l.name.split(" ")[0])} just met<br><span style="color:${RED}">future them.</span>`, preheader: `${l.name} · ${l.programme} · ${l.weight} → ${l.target} kg`,
      intro: `${esc(l.name)} finished the Future You questionnaire. Strike while it's warm: a message in the next hour makes all the difference.`,
      body: stats([[`${l.weight}`, "kg now"], [`${l.target}`, "kg target", true], [`${l.weeksNeeded || "—"}`, "weeks needed"]]) +
        rows([["Programme", l.programme], ["Recommended", l.plan], ["Wedding", l.weddingDate], ["In their words", l.goal], ["Phone", l.phone], ["Email", l.email]]),
      cta: { label: "Open in the coach panel", url: `${site}/admin.html#leads` } })
  }),

  payment: ({ site, o }) => ({
    subject: `Paid: ${o.name} · ${o.plan} · ${o.amountText}`,
    html: layout({ site, accent: "#5FD18B", kick: `New payment · ${o.id}`, title: `<span style="color:${RED}">${esc(o.amountText)}</span><br>just landed`, preheader: `${o.name} bought the ${o.plan}.`,
      intro: `<b style="color:#fff">${esc(o.name)}</b> has joined the ${esc(o.plan)}. Book their kick-off call and get their plan in.`,
      body: rows([["Client", o.name], ["Plan", o.plan], ["Amount", o.amountText], ["Wants to start", o.start], ["Wedding", o.weddingDate], ["Phone", o.phone], ["Email", o.email]]),
      cta: { label: "Open payments", url: `${site}/admin.html#payments` } })
  }),

  clientMessage: ({ site, name, text }) => ({
    subject: `New message from ${name}`,
    html: layout({ site, kick: "New message", title: `${esc(String(name).split(" ")[0])}<br>messaged you`, preheader: String(text || "Sent a photo").slice(0, 90),
      body: quote(text || "Sent a photo", name),
      cta: { label: "Reply in the coach panel", url: `${site}/admin.html#messages` },
      foot: "At most one email per client every 30 minutes, so you're not flooded." })
  }),

  digest: ({ site, date, risks, y }) => ({
    subject: risks.length ? `${risks.length} client${risks.length === 1 ? "" : "s"} need${risks.length === 1 ? "s" : ""} you today` : `Your morning briefing: everyone's on track`,
    html: layout({ site, kick: `Morning briefing · ${date}`, title: risks.length ? `${risks.length} need<br><span style="color:${RED}">a nudge.</span>` : `All on<br><span style="color:${RED}">track.</span>`,
      preheader: risks.length ? risks.slice(0, 3).map(r => r.name).join(", ") + " have gone quiet." : "Nobody has gone quiet. Here's yesterday at a glance.",
      intro: risks.length ? "These clients have gone quiet. A quick message today can stop them giving up." : "Nobody's gone quiet. Here's yesterday at a glance.",
      body: stats([[y.signups, "New sign-ups"], [y.revenue, "Taken"], [y.unread, "Unread messages", y.unread > 0], [y.checkins, "Check-ins"]]) +
        (risks.length ? `<p style="margin:10px 0 14px;font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED}">Clients at risk</p>` + risks.slice(0, 12).map(r => personAlert(r.name, r.level, r.reasons, `${site}/admin.html#risk`)).join("") : ""),
      cta: { label: "Open the coach panel", url: `${site}/admin.html#${risks.length ? "risk" : "dashboard"}` },
      foot: "Turn this email off in the coach panel → Settings → Notifications." })
  })
};
