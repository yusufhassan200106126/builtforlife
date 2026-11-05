/* =========================================================
   Built For Life — checkout (demo)
   A live membership card fills in as they type; hold to pay.
   DEMO: paying records the order in the coach panel; nothing is charged.
   LIVE: when the hold completes, the server creates a Stripe Checkout page
   for the plan and we go there. Stripe sends them back here (?paid=…), the
   server confirms the payment and the order lands in the coach panel.
   ========================================================= */
window.BFL.ready.then(async function () {
  const B = window.BFL, $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, COARSE = matchMedia("(pointer:coarse)").matches;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const qs = new URLSearchParams(location.search);
  let plan = B.findPlan(qs.get("plan") || "") || B.findPlan("t12");
  let D = B.get();
  let leadId = qs.get("lead"), leadT = qs.get("t") || "";
  // came from a programme page instead of the result screen? use the questionnaire they did in this browser (last 60 days)
  if (!leadId) { try { const ll = JSON.parse(localStorage.getItem("bfl:lastLead") || "null"); if (ll && Date.now() - ll.at < 60 * 864e5) { leadId = ll.id; leadT = ll.t || ""; } } catch (e) {} }
  let lead = D.leads.find(l => l.id === leadId);
  if (B.live && leadId && leadT) { try { lead = await B.api("GET", `/api/lead/${encodeURIComponent(leadId)}?t=${encodeURIComponent(leadT)}`); } catch (e) { lead = null; leadId = null; leadT = ""; } }
  const len = w => w < 26 ? `${w} wks` : w === 26 ? "6 months" : "12 months";
  const steps = $$("#coSteps li");
  const setStep = n => steps.forEach((li, i) => { li.classList.toggle("on", i === n); li.classList.toggle("done", i < n); });

  if (document.referrer && new URL(document.referrer, location.href).origin === location.origin && !/checkout/.test(document.referrer)) $("#coBack").href = document.referrer;
  else $("#coBack").href = plan.programme === "Bridal Bootcamp" ? "bridal-bootcamp.html#plans" : "daily-wins.html#plans";

  /* ---------- money odometer ---------- */
  let shownPrice = 0;
  function rollPrice(to) {
    const from = shownPrice, t0 = performance.now(); shownPrice = to;
    const els = [$("#sTotal"), $("#payAmt")];
    if (reduce) { els.forEach(e => e.textContent = B.gbp(to)); return; }
    (function f(n) {
      const p = Math.min(1, (n - t0) / 900), v = from + (to - from) * easeOut(p);
      els.forEach(e => e.textContent = p < 1 ? B.gbp(Math.round(v)) : B.gbp(to));
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* ---------- plans ---------- */
  function fillPlans() {
    $("#plans").innerHTML = B.PLANS[plan.programme].map((p, i) => `<label style="--i:${i}"><input type="radio" name="plan" value="${p.id}" ${p.id === plan.id ? "checked" : ""}><span><b>${p.name}</b><small>${B.gbp(p.price)}</small></span></label>`).join("");
    $$('#plans input').forEach(r => r.addEventListener("change", () => {
      plan = B.findPlan(r.value); render(true);
      history.replaceState(null, "", `?plan=${plan.id}${lead ? "&lead=" + lead.id + (leadT ? "&t=" + encodeURIComponent(leadT) : "") : ""}`);
    }));
  }
  /* pay in full or monthly */
  let payId = "full";
  const opt = () => B.payOptions(plan).find(o => o.id === payId) || B.payOptions(plan)[0];
  function fillPay() {
    const os = B.payOptions(plan); if (!os.find(o => o.id === payId)) payId = "full";
    $("#payOpts").hidden = os.length < 2;
    $("#payOpts").innerHTML = os.map(o => `<button type="button" role="radio" aria-checked="${o.id === payId}" class="po ${o.id === payId ? "on" : ""}" data-pay="${o.id}">
      <b>${o.n === 1 ? "Pay in full" : `${o.n} monthly payments`}</b><span>${o.n === 1 ? B.gbp(o.each) : `${B.gbp(o.each)} a month`}</span>${o.n === 1 ? "" : `<small>No extra cost · ${B.gbp(plan.price)} in total</small>`}</button>`).join("");
    const o = opt();
    $("#sNote").textContent = o.n > 1 ? `Then ${B.gbp(o.each)} a month for ${o.n - 1} more month${o.n > 2 ? "s" : ""}. Stops by itself.` : "";
    document.querySelector(".hold-l").dataset.mo = o.n > 1 ? "1" : "";
  }
  $("#payOpts").addEventListener("click", e => { const b = e.target.closest("[data-pay]"); if (!b) return; payId = b.dataset.pay; fillPay(); rollPrice(opt().each); });
  function render(anim) {
    $("#cProg").textContent = plan.programme;
    $("#cPlan").textContent = plan.name;
    $("#cLen").textContent = len(plan.weeks);
    $("#cWedWrap").hidden = plan.programme !== "Bridal Bootcamp";
    fillPay(); rollPrice(opt().each);
    document.title = `Checkout · ${plan.name} · Built For Life`;
    if (anim && !reduce) { const c = $("#cardIn"); c.classList.remove("swap"); void c.offsetWidth; c.classList.add("swap"); }
  }
  fillPlans(); render(false);

  /* ---------- card follows the pointer ---------- */
  const card = $("#card"), inner = $("#cardIn");
  if (!COARSE && !reduce) {
    addEventListener("pointermove", e => {
      if (inner.classList.contains("flipping")) return;
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const k = Math.max(0, 1 - Math.hypot(x - .5, y - .5) / 1.6);
      inner.style.setProperty("--ry", ((x - .5) * 26 * k).toFixed(2) + "deg"); inner.style.setProperty("--rx", (-(y - .5) * 22 * k).toFixed(2) + "deg");
      $$(".shine").forEach(s => { s.style.setProperty("--sx", x * 100 + "%"); s.style.setProperty("--sy", y * 100 + "%"); });
    });
  } else if (!reduce) card.classList.add("float");

  /* ---------- live card text ---------- */
  const nameEl = $("#cName");
  let lastName = "";
  function syncName() {
    const v = $("#cNameIn").value.trim().toUpperCase().slice(0, 26);
    if (!v) { nameEl.textContent = "Your name"; lastName = ""; return; }
    nameEl.innerHTML = Array.from(v).map((ch, i) => `<span class="${i >= lastName.length || ch !== lastName[i] ? "new" : ""}">${B.esc(ch)}</span>`).join("");
    lastName = v;
  }
  $("#cNameIn").addEventListener("input", syncName);
  const fmtDay = v => new Date(v + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase();
  $("#cStartIn").addEventListener("input", e => $("#cStart").textContent = e.target.value ? fmtDay(e.target.value) : "Soon");
  const year = new Date().getFullYear();
  $("#cNum").textContent = `BFL ${String(Math.floor(1000 + Math.random() * 9000))} ···· ${year}`;

  // highlight the matching part of the card while typing
  $$("[data-hl]").forEach(inp => {
    if (inp.tagName !== "INPUT") return;
    const target = $(`.card3d [data-hl="${inp.dataset.hl}"]`);
    inp.addEventListener("focus", () => target && target.classList.add("hl"));
    inp.addEventListener("blur", () => target && target.classList.remove("hl"));
  });

  // section underline fills as each part is done
  function progress() {
    const fs = $$(".co-form fieldset");
    const okD = $("#cNameIn").value.trim().length > 1 && /^\S+@\S+\.\S+$/.test($("#cEmail").value.trim()) && $("#cPhone").value.replace(/\D/g, "").length >= 10;
    const okT = plan.programme !== "Bridal Bootcamp" || !!$("#cWed").value;
    fs[0].classList.toggle("ok", okD); fs[1].classList.toggle("ok", okT && okD); fs[2].classList.toggle("ok", $("#cTerms").checked);
    setStep(okD ? 2 : 1);
  }
  $("#coForm").addEventListener("input", progress);
  $("#coForm").addEventListener("change", progress);

  // prefill from the questionnaire
  const today = new Date(); today.setHours(0, 0, 0, 0);
  $("#cStartIn").min = $("#cWed").min = today.toISOString().slice(0, 10);
  if (lead) {
    $("#cNameIn").value = lead.name; $("#cEmail").value = lead.email; $("#cPhone").value = lead.phone;
    if (lead.weddingDate) $("#cWed").value = lead.weddingDate;
    setTimeout(syncName, 900);
    $("#sWhy").textContent = `Recommended for you, ${lead.name.split(" ")[0]}. Your card fills in as you go.`;
  }
  progress(); setStep(lead ? 2 : 1);

  /* ---------- validation ---------- */
  const err = $("#coErr");
  function valid() {
    err.textContent = "";
    $$(".f").forEach(f => f.classList.remove("bad"));
    const bad = (id, m) => { const p = $(id).parentElement; void p.offsetWidth; p.classList.add("bad"); $(id).focus(); err.textContent = m; return false; };
    if ($("#cNameIn").value.trim().length < 2) return bad("#cNameIn", "Please add your full name.");
    if (!/^\S+@\S+\.\S+$/.test($("#cEmail").value.trim())) return bad("#cEmail", "Please add a valid email address.");
    if ($("#cPhone").value.replace(/\D/g, "").length < 10) return bad("#cPhone", "Please add a mobile number Jory can WhatsApp.");
    if (plan.programme === "Bridal Bootcamp" && !$("#cWed").value) return bad("#cWed", "Please add your wedding date.");
    if (!$("#cTerms").checked) { err.textContent = "Please agree to the programme terms."; $("#cTerms").focus(); return false; }
    return true;
  }

  /* ---------- hold to pay ---------- */
  const btn = $("#coPay"), HOLD = reduce ? 1 : 1100;
  let holding = false, p = 0, last = 0, paid = false;
  function frame(now) {
    const dt = now - last; last = now;
    p = Math.max(0, Math.min(1, p + (holding ? dt / HOLD : -dt / 400)));
    btn.style.setProperty("--p", p.toFixed(3));
    if (navigator.vibrate && holding && Math.random() < .05) navigator.vibrate(8);
    if (p >= 1 && holding) { holding = false; pay(); return; }
    if (holding || p > 0) requestAnimationFrame(frame);
  }
  function start(e) {
    if (paid || btn.classList.contains("busy")) return;
    if (e) e.preventDefault();
    if (!valid()) return;
    holding = true; last = performance.now(); $(".hold-l").textContent = "Keep holding"; setStep(2); requestAnimationFrame(frame);
  }
  function stop() { if (!holding) return; holding = false; $(".hold-l").textContent = "Hold to pay"; }
  btn.addEventListener("pointerdown", start);
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => btn.addEventListener(ev, stop));
  btn.addEventListener("contextmenu", e => e.preventDefault());
  btn.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) start(e); });
  btn.addEventListener("keyup", e => { if (e.key === "Enter" || e.key === " ") stop(); });
  $("#coForm").addEventListener("submit", e => e.preventDefault());

  async function payLive() {
    paid = true; btn.classList.add("busy"); $(".hold-l").textContent = "Opening secure payment"; btn.style.setProperty("--p", 1);
    try {
      const r = await B.api("POST", "/api/checkout", {
        planId: plan.id, pay: payId, id: lead && lead.id, t: leadT, name: $("#cNameIn").value.trim(), email: $("#cEmail").value.trim(), phone: $("#cPhone").value.trim(),
        start: $("#cStartIn").value || null, wedding: plan.programme === "Bridal Bootcamp" ? $("#cWed").value || null : null
      });
      location.href = r.url;
    } catch (e) {
      paid = false; btn.classList.remove("busy"); btn.style.setProperty("--p", 0); p = 0; $(".hold-l").textContent = "Hold to pay";
      err.textContent = e.message || "We couldn't open the payment page. Please try again.";
    }
  }
  function pay() {
    if (B.live) return payLive();
    paid = true; btn.classList.add("busy"); $(".hold-l").textContent = "Processing"; btn.style.setProperty("--p", 1);
    setTimeout(() => {
      D = B.reload();
      const ref = "BFL-" + (1001 + (D.orders || []).length + Math.floor(Math.random() * 40));
      const name = $("#cNameIn").value.trim(), email = $("#cEmail").value.trim(), phone = $("#cPhone").value.trim();
      const startD = $("#cStartIn").value || null, wed = $("#cWed").value || null;
      let l = D.leads.find(x => x.id === (lead && lead.id)) || D.leads.find(x => x.email && x.email.toLowerCase() === email.toLowerCase());
      if (!l) {
        l = { id: "L" + Date.now().toString(36), created: new Date().toISOString(), status: "client", notes: "", name, phone, email, programme: plan.programme, plan: plan.name,
          weight: 0, target: 0, weeksNeeded: plan.weeks, weddingDate: wed, photo: B.silhouette(plan.programme === "Bridal Bootcamp" ? 340 : 210), noPhoto: true, noQuiz: true };
        D.leads.unshift(l);
      } else { l.status = "client"; l.plan = plan.name; l.programme = plan.programme; if (wed) l.weddingDate = wed; }
      const o = opt(), nowIso = new Date().toISOString();
      const order = { id: ref, created: nowIso, leadId: l.id, name, email, phone, planId: plan.id, plan: plan.name, programme: plan.programme, amount: o.each, total: plan.price, status: "paid", start: startD, weddingDate: wed,
        payType: o.n > 1 ? "monthly" : "full", instalments: o.n, each: o.each, paidCount: 1, payments: [{ at: nowIso, amount: o.each }], nextDue: o.n > 1 ? B.ymd(B.addDays(new Date(), 30)) : null };
      D.orders = D.orders || []; D.orders.unshift(order);
      if (!B.save()) { paid = false; btn.classList.remove("busy"); $(".hold-l").textContent = "Hold to pay"; err.textContent = "Your browser blocked saving. Please message Jory on WhatsApp."; return; }
      welcome(order, name, startD);
    }, reduce ? 200 : 1300);
  }

  function welcome(order, name, startD) {
    // flip the card to its paid back
    $("#cbRef").textContent = order.id; $("#cbAmt").textContent = B.gbp(order.amount);
    inner.classList.add("flipping"); inner.style.setProperty("--rx", "0deg"); inner.style.setProperty("--ry", "0deg"); inner.style.setProperty("--flip", "180deg");
    card.classList.remove("float");
    burst();
    $("#coMain").hidden = true; $("#coDone").hidden = false; $("#co").classList.add("done"); setStep(3);
    $$("#coNext li").forEach((li, i) => li.style.setProperty("--i", i));
    $("#dName").textContent = name.split(" ")[0] + ".";
    $("#dRef").textContent = order.id; $("#dPlan").textContent = order.plan; $("#dAmt").textContent = "· " + B.gbp(order.amount) + (order.instalments > 1 ? ` (payment 1 of ${order.instalments})` : "");
    $("#dPortal").href = "portal.html?email=" + encodeURIComponent(order.email); $("#dEmail").textContent = order.email;
    $("#dWa").href = "https://wa.me/447734432205?text=" + encodeURIComponent(`Hi Jory, I've just signed up to the ${order.plan} (order ${order.id}). Looking forward to getting started!`);
    // countdown to day one
    const days = startD ? Math.max(0, Math.round((new Date(startD + "T00:00:00") - today) / 864e5)) : 7;
    $("#cdLbl").textContent = startD ? (days === 1 ? "day until day one" : "days until day one") : "days, give or take, until day one";
    const cd = $("#cdNum"), from = Math.max(days + 30, 60), t0 = performance.now() + 1400;
    (function f(n) { const q = Math.max(0, Math.min(1, (n - t0) / 1500)); cd.textContent = Math.round(from + (days - from) * easeOut(q)); if (q < 1) requestAnimationFrame(f); })(performance.now());
    scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  /* ---------- live: payment wording, and coming back from Stripe ---------- */
  if (B.live) {
    const box = $(".co-pay");
    box.innerHTML = `<div class="pay-row"><span class="demo-tag">${B.cfg.stripeTest ? "Test mode" : "Stripe"}</span><span class="cards" aria-hidden="true"><i>VISA</i><i>MC</i><i>AMEX</i><i>Pay</i></span></div>
      <p>When you hold to pay you'll go to Stripe's secure payment page, then come straight back here. Card details never touch this website.</p>
      ${B.cfg.stripeTest ? `<p class="co-pay-sub">Testing: use card 4242 4242 4242 4242, any future date and any CVC. Nothing is charged.</p>` : ""}
      ${B.cfg.stripe ? "" : `<p class="co-pay-sub">Payments aren't switched on yet.</p>`}`;
    if (qs.get("cancelled")) { err.textContent = "Payment cancelled. You haven't been charged."; setStep(2); }
    const sid = qs.get("paid"), oid = qs.get("o");
    if (sid && oid) {
      paid = true; btn.classList.add("busy"); btn.style.setProperty("--p", 1); $(".hold-l").textContent = "Confirming your payment";
      let order = null;
      for (let i = 0; i < 20 && !order; i++) {
        try { const r = await B.api("GET", `/api/order-status?o=${encodeURIComponent(oid)}&s=${encodeURIComponent(sid)}`); if (r.status === "paid") order = r.order; } catch (e) { if (e.status === 404) break; }
        if (!order) await new Promise(r => setTimeout(r, 1500));
      }
      if (order) {
        plan = B.findPlan(order.planId) || plan; fillPlans(); render(false);
        $("#cNameIn").value = order.name; syncName();
        history.replaceState(null, "", location.pathname + "?done=" + encodeURIComponent(order.id));
        welcome(order, order.name, order.start);
      } else {
        btn.classList.remove("busy"); $(".hold-l").textContent = "Hold to pay";
        err.textContent = "We're still confirming your payment with the bank. You'll get an email as soon as it's through, or message Jory on WhatsApp.";
      }
    }
  }

  /* ---------- celebration burst ---------- */
  function burst() {
    if (reduce) return;
    const c = $("#burst"), ctx = c.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const r = card.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    const cols = ["#E3242B", "#F2F0EB", "#B5161C", "#ffffff"], parts = [];
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 11;
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, w: 4 + Math.random() * 8, h: 6 + Math.random() * 14, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % 4], plate: i % 9 === 0 });
    }
    const t0 = performance.now();
    (function f(n) {
      const t = (n - t0) / 1000; ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(p => {
        p.vy += .32; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - t / 2.6); ctx.fillStyle = p.c;
        if (p.plate) { ctx.beginPath(); ctx.arc(0, 0, p.w * 1.3, 0, 7); ctx.fill(); ctx.fillStyle = "#0a0a0a"; ctx.beginPath(); ctx.arc(0, 0, p.w * .4, 0, 7); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < 2.8) requestAnimationFrame(f); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }
});
