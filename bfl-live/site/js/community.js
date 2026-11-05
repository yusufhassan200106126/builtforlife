/* =========================================================
   Built For Life — challenges + leaderboards
   Scores a challenge from what clients log. Used by the coach panel,
   the portal (demo) and the server (live), so everyone sees the same board.
   ========================================================= */
(function (root) {
  const METRICS = {
    workouts: { label: "Workouts done", unit: "workouts" },
    checkins: { label: "Check-ins sent", unit: "check-ins" },
    habits: { label: "Habits ticked", unit: "habits" },
    steps: { label: "Steps", unit: "steps" },
    food: { label: "Days food logged", unit: "days" }
  };
  const inRange = (d, ch) => d && d.slice(0, 10) >= ch.start && d.slice(0, 10) <= ch.end;
  const shortName = n => { const p = String(n || "").trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? " " + p[1][0].toUpperCase() + "." : "") : "Member"; };
  const isMember = (D, l) => l.status === "client" || (D.orders || []).some(o => o.leadId === l.id && /^(paid|overdue)$/.test(o.status));

  function scoreOf(ch, D, leadId) {
    const m = ch.metric;
    if (m === "workouts") return (D.workouts || []).filter(w => w.leadId === leadId && w.done && inRange(w.doneAt || w.date, ch)).length;
    if (m === "checkins") return (D.checkins || []).filter(c => c.leadId === leadId && inRange(c.at, ch)).length;
    const days = Object.keys(D.food || {}).filter(k => k.startsWith(leadId + "|") && inRange(k.split("|")[1], ch)).map(k => D.food[k]);
    if (m === "habits") return days.reduce((n, f) => n + Object.values(f.habits || {}).filter(v => v === true || (+v || 0) > 0).length, 0);
    if (m === "steps") return days.reduce((n, f) => n + (+((f.habits || {}).steps) || 0), 0);
    if (m === "food") return days.filter(f => (f.kcal || 0) > 0 || (f.protein || 0) > 0 || (f.items || []).length).length;
    return 0;
  }
  /* the leaderboard: everyone in the challenge who hasn't opted out, best first */
  function board(ch, D) {
    const people = (D.leads || []).filter(l => isMember(D, l) && l.community !== false && (!ch.members || ch.members === "all" || (ch.members || []).includes(l.id)));
    return people.map(l => ({ id: l.id, name: shortName(l.name), score: scoreOf(ch, D, l.id) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((r, i, arr) => ({ ...r, rank: i && arr[i - 1].score === r.score ? null : i + 1 }))
      .map((r, i, arr) => ({ ...r, rank: r.rank || arr.slice(0, i).reverse().find(x => x.rank).rank }));
  }
  const status = (ch, today) => today < ch.start ? "soon" : today > ch.end ? "ended" : "live";

  root.BFLCommunity = { METRICS, board, scoreOf, shortName, status };
})(typeof window !== "undefined" ? window : globalThis);
