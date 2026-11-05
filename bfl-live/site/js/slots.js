/* =========================================================
   Built For Life — free booking slots
   Works out which session times a client can book from their coach's
   booking hours, minus anything already in the diary. Used by the
   client portal, the coach panel and the server (same rules everywhere).
   All times are UK local time ("YYYY-MM-DD" + "HH:MM").
   ========================================================= */
(function (root) {
  const DEFAULTS = {
    on: false, mins: 60, step: 30, notice: 12, ahead: 14, where: "Gym", auto: true,
    days: { 1: { on: true, start: "07:00", end: "20:00" }, 2: { on: true, start: "07:00", end: "20:00" }, 3: { on: true, start: "07:00", end: "20:00" },
      4: { on: true, start: "07:00", end: "20:00" }, 5: { on: true, start: "07:00", end: "18:00" }, 6: { on: true, start: "08:00", end: "12:00" }, 0: { on: false, start: "09:00", end: "12:00" } }
  };
  const hm = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const clock = n => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const addDay = (s, n) => { const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + n)); return d.toISOString().slice(0, 10); };
  const dow = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))).getUTCDay();
  const cfgOf = c => { const x = Object.assign({}, DEFAULTS, c || {}); x.days = Object.assign({}, DEFAULTS.days, (c && c.days) || {}); return x; };

  /* now: { date: "YYYY-MM-DD", min: minutes past midnight } in UK time */
  function slots(cfg, events, now, daysAhead) {
    const c = cfgOf(cfg); if (!c.on) return [];
    const busy = (events || []).filter(e => e && e.status !== "cancelled" && e.status !== "declined" && !e.allDay && e.time);
    const len = +c.mins || 60, step = +c.step || 30, earliest = now.min + (+c.notice || 0) * 60, out = [];
    for (let i = 0; i <= (daysAhead || c.ahead || 14); i++) {
      const date = addDay(now.date, i), w = c.days[dow(date)]; if (!w || !w.on) continue;
      const s0 = hm(w.start), s1 = hm(w.end), taken = busy.filter(e => e.date === date).map(e => [hm(e.time), hm(e.time) + (+e.mins || 60)]);
      const times = [];
      for (let t = s0; t + len <= s1; t += step) {
        if (i * 1440 + t < earliest) continue;                       // not enough notice
        if (taken.some(([a, b]) => t < b && a < t + len)) continue;  // clashes with the diary
        times.push(clock(t));
      }
      if (times.length) out.push({ date, times });
    }
    return out;
  }
  const isFree = (cfg, events, now, date, time) => slots(cfg, events, now).some(d => d.date === date && d.times.includes(time));
  /* hours before a session starts */
  const hoursUntil = (now, date, time) => { let days = 0, d = now.date; while (d < date && days < 400) { d = addDay(d, 1); days++; } return (days * 1440 + hm(time) - now.min) / 60; };

  root.BFLSlots = { DEFAULTS, cfgOf, slots, isFree, hoursUntil, hm, clock, addDay };
})(typeof window !== "undefined" ? window : globalThis);
