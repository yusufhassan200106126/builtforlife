/* =========================================================
   Built For Life — client risk alerts
   Spots clients who are drifting so Jory can step in before they give up:
     • haven't trained for 7+ days
     • have missed 2+ weekly check-ins
     • haven't logged food or workouts for 5+ days
     • have stopped replying to Jory
   Used by the coach panel and by the server's daily email (same rules).
   ========================================================= */
(function (root) {
  const DAY = 864e5;
  const days = (a, b) => Math.floor((b - a) / DAY);
  const t = s => (s ? new Date(s.length === 10 ? s + "T12:00:00" : s).getTime() : 0);
  const ymd = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const RULES = { noTraining: 7, missedCheckins: 2, notLogging: 5, noReplyHours: 72, grace: 3 };

  function isMember(D, l) { return l.status === "client" || (D.orders || []).some(o => o.leadId === l.id && /^(paid|overdue)$/.test(o.status)); }
  function planStart(D, l) {
    const o = (D.orders || []).filter(o => o.leadId === l.id && /^(paid|overdue)$/.test(o.status)).sort((a, b) => t(b.created) - t(a.created))[0];
    return o ? t(o.start || o.created) : t(l.created);
  }

  /* one client → their risk */
  function client(D, l, now) {
    now = now || Date.now();
    const start = planStart(D, l), since = days(start, now), today = ymd(now);
    const ws = (D.workouts || []).filter(w => w.leadId === l.id);
    const cs = (D.checkins || []).filter(c => c.leadId === l.id).sort((a, b) => t(a.at) - t(b.at));
    const ms = (D.messages || []).filter(m => m.leadId === l.id).sort((a, b) => t(a.at) - t(b.at));
    const food = Object.keys(D.food || {}).filter(k => k.startsWith(l.id + "|") && ((D.food[k].protein || 0) > 0 || (D.food[k].water || 0) > 0 || (D.food[k].kcal || 0) > 0 || Object.values(D.food[k].habits || {}).some(Boolean))).map(k => k.split("|")[1]).sort();
    const seen = (D.presence || {})[l.id] || null;

    const lastTrain = Math.max(0, ...ws.filter(w => w.done).map(w => t(w.doneAt || w.date)));
    const lastCheck = cs.length ? t(cs[cs.length - 1].at) : 0;
    const lastLog = Math.max(0, lastTrain, ...ws.map(w => t(w.lastAt)), lastCheck, food.length ? t(food[food.length - 1]) : 0);
    const missedW = ws.filter(w => !w.done && w.date < today && t(w.date) > now - 14 * DAY).length;
    const reasons = [];
    let score = 0;

    if (since >= RULES.grace) {
      // 1. not training
      const planned = ws.some(w => w.date <= today);
      const dT = days(lastTrain || start, now);
      if (planned && dT >= RULES.noTraining) {
        reasons.push({ key: "train", days: dT, text: lastTrain ? `No workout for ${plural(dT, "day")}` : `Hasn't done a workout yet (${plural(dT, "day")} in)`, extra: missedW ? `${plural(missedW, "planned session")} missed` : "" });
        score += dT >= 14 ? 4 : 3;
      }
      // 2. missed check-ins (weekly)
      const missed = Math.floor(days(lastCheck || start, now) / 7);
      if (missed >= RULES.missedCheckins) {
        reasons.push({ key: "checkin", days: days(lastCheck || start, now), text: `Missed ${missed} check-ins`, extra: lastCheck ? `Last one ${plural(days(lastCheck, now), "day")} ago` : "Never checked in" });
        score += missed >= 3 ? 3 : 2;
      }
      // 3. not logging food or workouts
      const dL = days(lastLog || start, now);
      if (dL >= RULES.notLogging) {
        reasons.push({ key: "log", days: dL, text: lastLog ? `Nothing logged for ${plural(dL, "day")}` : "Hasn't logged any food or workouts", extra: food.length ? `Last food log ${plural(days(t(food[food.length - 1]), now), "day")} ago` : "No food logged yet" });
        score += 2;
      }
    }
    // 4. stopped replying (any time: unanswered messages from Jory)
    let lastClient = 0; ms.forEach(m => { if (m.from === "client") lastClient = t(m.at); });
    const unanswered = ms.filter(m => m.from === "coach" && t(m.at) > lastClient);
    if (unanswered.length) {
      const h = (now - t(unanswered[0].at)) / 36e5;
      if (h >= RULES.noReplyHours || (unanswered.length >= 2 && h >= 48)) {
        const read = unanswered.some(m => m.readByClient);
        reasons.push({ key: "reply", days: Math.floor(h / 24), text: `No reply to ${unanswered.length > 1 ? plural(unanswered.length, "message") : "your message"} for ${plural(Math.floor(h / 24), "day")}`, extra: read ? "They've read it" : "Not opened yet" });
        score += 3;
      }
    }
    if (seen && days(t(seen), now) >= 7 && reasons.length) { score += 1; }

    const snoozed = l.riskSnooze && t(l.riskSnooze) > now;
    const level = score >= 5 ? "high" : score >= 2 ? "medium" : "ok";
    return {
      lead: l, level, score, reasons, snoozed, since,
      last: { train: lastTrain || null, checkin: lastCheck || null, log: lastLog || null, seen: seen ? t(seen) : null },
      nudge: nudge(l, reasons)
    };
  }

  /* a friendly message Jory can send (he can edit it first) */
  function nudge(l, reasons) {
    const first = String(l.name || "").split(" ")[0] || "there", k = reasons.map(r => r.key);
    if (k.includes("reply")) return `Hey ${first}, just checking in. No pressure at all, how are things going? If the plan isn't fitting your week right now, tell me and we'll adjust it together.`;
    if (k.includes("train")) return `Hey ${first}, I noticed you haven't trained for a few days. Totally normal to have a dip. Shall we do a shorter 20-minute session this week to get the ball rolling again? Tell me which day suits.`;
    if (k.includes("checkin")) return `Hey ${first}, I haven't had a check-in from you for a couple of weeks. It only takes 2 minutes and it's how I keep your plan right for you. Can you send one today?`;
    if (k.includes("log")) return `Hey ${first}, how's the week been? Even a quick protein and water log each day helps me see what's working. Anything getting in the way I can help with?`;
    return `Hey ${first}, how are you getting on this week?`;
  }

  /* everyone → sorted list of clients who need attention */
  function assess(D, now) {
    now = now || Date.now();
    return (D.leads || []).filter(l => isMember(D, l)).map(l => client(D, l, now))
      .filter(r => r.level !== "ok")
      .sort((a, b) => (a.snoozed - b.snoozed) || (b.score - a.score) || a.lead.name.localeCompare(b.lead.name));
  }

  root.BFLRisk = { assess, client, RULES, isMember };
})(typeof window !== "undefined" ? window : globalThis);
