// Parkrating tiebreak: the phone app. Served by app/tiebreak/route.ts, talks to /api/tiebreak.
// Two people, two phones, same room. Pick in secret, reveal together, lock what you agree on.
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");
  const R2 = "https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/";
  const thumb = (u, w) => { if (!u) return ""; const base = u.startsWith("http") ? u : R2 + u; return base.replace(/\.(jpe?g|png|webp)$/i, "") + "-w" + (w || 480) + ".webp"; };
  const m = ft => ft == null ? null : Math.round(ft * 0.3048);
  const kmh = mph => mph == null ? null : Math.round(mph * 1.609344);
  const fmtScore = s => String(Number(s)).replace(/\.0$/, "");
  const ago = d => { const s = (Date.now() - new Date(d).getTime()) / 1000; return s < 12; };

  let me = localStorage.getItem("tiebreak-name") || "";
  let state = null, score = null, timer = null, busy = false;

  async function api(body) {
    const r = await fetch("/api/tiebreak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || ("Error " + r.status)); throw new Error(j.error || r.status); }
    return j;
  }
  async function get(q) { const r = await fetch("/api/tiebreak" + (q || ""), { cache: "no-store" }); if (r.status === 401) { location.reload(); return null; } return r.json(); }
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 1800); }

  // ---- routing: #/  (groups)   #/g/7  (one score group)
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const mm = h.match(/^g\/([\d.]+)/);
    score = mm ? Number(mm[1]) : null;
    state = null; app.innerHTML = '<div class="wrap hint" style="padding-top:40px">Loading…</div>';
    tick();
  }
  window.addEventListener("hashchange", route);

  // ---- polling
  async function tick() {
    clearTimeout(timer);
    if (!me) { renderName(); return; }
    try {
      if (score === null) { const d = await get(); if (d) { state = d; renderHome(); } }
      else { const d = await get("?score=" + score); if (d) { state = d; renderGroup(); } }
    } catch (e) { /* keep the last render */ }
    timer = setTimeout(tick, score === null ? 4000 : 1500);
  }
  setInterval(() => { if (me) api({ action: "hello", name: me }).catch(() => {}); }, 5000);

  // ---- who are you
  function renderName() {
    app.innerHTML = '<div class="wrap"><div class="card login"><h1><span>Parkrating</span> tiebreak</h1><p>Who are you? Your picks are stored under this name, and the other phone sees when you have picked.</p>'
      + '<input id="nm" placeholder="Your name" autocomplete="given-name"><button style="width:100%;margin-top:12px" onclick="window.__tb.setName()">Let\'s go</button></div></div>';
    setTimeout(() => $("#nm") && $("#nm").focus(), 50);
  }
  function setName() { const v = ($("#nm").value || "").trim(); if (!v) return; me = v.slice(0, 40); localStorage.setItem("tiebreak-name", me); api({ action: "hello", name: me }).catch(() => {}); tick(); }
  function changeName() { localStorage.removeItem("tiebreak-name"); me = ""; renderName(); }

  function topbar(title, back) {
    const others = (state && state.players || []).filter(p => p.name !== me);
    const dots = others.slice(0, 3).map(p => '<span class="chip" title="' + esc(p.name) + '"><span class="dot ' + (ago(p.last_seen) ? "on" : "") + '"></span>' + esc(p.name) + '</span>').join("");
    return '<div class="top">' + (back ? '<a class="back" href="#/">‹</a>' : "") + '<div class="ttl">' + title + '</div><div class="who">' + dots + '<span class="me" onclick="window.__tb.changeName()" title="Change name">' + esc(me) + '</span></div></div>';
  }

  // ---- home: the score groups
  function renderHome() {
    const groups = state.groups || [];
    const open = groups.filter(g => g.placed < g.count), done = groups.filter(g => g.placed >= g.count);
    const row = g => { const pct = Math.round(100 * g.placed / g.count); const lo = g.above + 1, hi = g.above + g.count;
      return '<a class="grp ' + (g.placed >= g.count ? "done" : "") + '" href="#/g/' + fmtScore(g.score) + '"><div class="sc">' + fmtScore(g.score) + '</div><div class="nm"><b>' + g.count + ' coasters</b><small>' + (g.placed >= g.count ? "settled" : g.placed + " placed · " + (g.count - g.placed) + " to go") + ' · ranks ' + lo + '–' + hi + '</small><div class="bar"><i style="width:' + pct + '%"></i></div></div><div class="chev">›</div></a>'; };
    const log = (state.log || []).slice(0, 8);
    const st = stats(state.log || []);
    app.innerHTML = topbar('<span>Tiebreak</span> · tied scores', false) + '<div class="wrap">'
      + '<p class="hint" style="text-align:left;margin:4px 0 14px">Pick a score. Each of you picks the best (or worst) of that group in secret, then you reveal. Agree and lock it in; the site\'s ranking follows.</p>'
      + '<h2>To settle</h2><div>' + (open.map(row).join("") || '<div class="hint">Everything is settled.</div>') + '</div>'
      + (done.length ? '<h2>Settled</h2><div>' + done.map(row).join("") + '</div>' : "")
      + '<h2>Scoreboard</h2>' + statsHtml(st)
      + (log.length ? '<h2>Latest</h2><div class="log">' + log.map(logLine).join("") + '</div>' : "")
      + '</div>';
  }
  function stats(log) {
    const s = { rounds: 0, match: 0, split: 0, caved: {} };
    log.forEach(l => { if (l.result === "auto") return; s.rounds++; if (l.result === "match") s.match++; if (l.result === "split") s.split++; if (l.result === "caved" && l.caved_by) s.caved[l.caved_by] = (s.caved[l.caved_by] || 0) + 1; });
    return s;
  }
  function statsHtml(s) {
    const pct = s.rounds ? Math.round(100 * s.match / s.rounds) : 0;
    const caved = Object.entries(s.caved).map(([n, c]) => '<div class="stat"><b>' + c + '</b><small>' + esc(n) + ' caved</small></div>').join("");
    return '<div class="stats"><div class="stat"><b>' + pct + '%</b><small>agreed first try</small></div><div class="stat"><b>' + s.match + '</b><small>matches</small></div><div class="stat"><b>' + s.split + '</b><small>splits</small></div>' + caved + '</div>';
  }
  function logLine(l) {
    const who = Object.keys(l.picks || {});
    const t = l.result === "match" ? "<b>match</b> on " : l.result === "caved" ? "<b>" + esc(l.caved_by) + " caved</b>, locked " : l.result === "split" ? "<b>split</b> " + who.map(esc).join(" vs ") + ", picked again" : l.result === "auto" ? "last one standing: " : "locked ";
    return '<div>' + fmtScore(l.score) + ' · ' + l.mode + ' · ' + t + (l.coaster ? "<b>" + esc(l.coaster) + "</b>" : "") + '</div>';
  }

  // ---- one group
  function renderGroup() {
    const g = state.group, all = state.candidates, above = state.above;
    const n = all.length, open = all.filter(c => c.tie_rank == null), placed = all.filter(c => c.tie_rank != null);
    const picks = g.picks || {}, names = Object.keys(picks), mine = picks[me];
    const mode = g.mode, revealed = g.revealed;
    const others = names.filter(x => x !== me);
    const byId = Object.fromEntries(all.map(c => [c.id, c]));
    const st = stats(state.log || []);
    const slotLabel = c => "#" + (above + c.tie_rank) + " overall";

    // chips: who has picked
    const everyone = [...new Set([me, ...(state.players || []).filter(p => ago(p.last_seen) || picks[p.name] != null).map(p => p.name), ...names])];
    const chips = everyone.map(nm => '<span class="chip ' + (picks[nm] != null ? "ok" : "wait") + '">' + esc(nm) + '</span>').join("");

    // candidates
    const revealTag = c => {
      if (!revealed) return c.id === mine ? '<span class="tick">YOUR PICK</span>' : "";
      const who = names.filter(nm => picks[nm] === c.id); if (!who.length) return "";
      const cls = who.length > 1 ? "rev-ab" : who[0] === me ? "rev-a" : "rev-b";
      return '<span class="tick ' + cls + '">' + esc(who.join(" + ")) + '</span>';
    };
    const cand = c => '<div class="cand ' + (c.id === mine ? "mine" : "") + (revealed ? " " + (names.some(nm => picks[nm] === c.id) ? "rev" : "") : "") + '" data-id="' + c.id + '" onclick="window.__tb.pick(' + c.id + ')">'
      + '<div class="th" style="background-image:url(\'' + thumb(c.image, 480) + '\')"></div>'
      + '<div class="tx"><b>' + esc(c.name) + '</b><small>' + esc(c.park) + ' · ' + esc(c.country) + (c.year ? ' · ' + c.year : "") + '</small>'
      + '<div class="st">' + [c.manufacturer, c.inversions != null ? c.inversions + " inv" : null, kmh(c.speed) != null ? kmh(c.speed) + " km/h" : null, m(c.height) != null ? m(c.height) + " m" : null, c.ridecount ? c.ridecount + " rides" : null].filter(Boolean).map(esc).join(" · ") + '</div></div>'
      + '<div class="info" onclick="event.stopPropagation();window.__tb.sheet(' + c.id + ')">i</div>' + revealTag(c) + '</div>';

    // placed: best from the top, worst from the bottom, a gap between
    const best = placed.filter(c => c.tie_rank <= Math.ceil(n / 2) && !isWorstSlot(c, n, placed)).sort((a, b) => a.tie_rank - b.tie_rank);
    const worst = placed.filter(c => !best.includes(c)).sort((a, b) => a.tie_rank - b.tie_rank);
    const pl = (c, w) => '<div class="pl ' + (w ? "worst" : "") + '"><div class="rk">' + c.tie_rank + '</div><div class="nm">' + esc(c.name) + '<small>' + esc(c.park) + ' · ' + slotLabel(c) + '</small></div>'
      + '<button class="x" title="Take it back out" onclick="window.__tb.unplace(' + c.id + ',\'' + esc(c.name).replace(/'/g, "\\'") + '\')">✕</button></div>';
    const placedHtml = placed.length ? '<div class="placed">' + best.map(c => pl(c, false)).join("") + (best.length && worst.length ? '<div class="gap"></div>' : "") + (open.length && (best.length || worst.length) ? '<div class="hint" style="padding:2px 0">' + open.length + ' still open</div>' : "") + worst.map(c => pl(c, true)).join("") + '</div>' : '<div class="hint" style="text-align:left">Nothing placed yet.</div>';

    // action bar
    let act = "";
    if (!open.length) act = '<div class="verdict match">SETTLED</div><div class="hint">All ' + n + ' placed. Ranks ' + (above + 1) + ' to ' + (above + n) + ' on the site.</div><div class="btns"><button class="danger" onclick="window.__tb.reset()">Start this group over</button></div>';
    else if (!revealed) {
      const can = names.length >= 2;
      act = '<div class="hint">Round ' + g.round + ' · ' + (mode === "best" ? "Which is the <b>best</b> of these?" : "Which is the <b>worst</b> of these?") + '</div>'
        + '<div class="btns">' + (mine != null ? '<button class="sec" onclick="window.__tb.pick(null)">Clear my pick</button>' : "") + '<button ' + (can ? "" : "disabled") + ' onclick="window.__tb.reveal()">Reveal' + (can ? "" : " (waiting for " + (names.length ? "the other pick" : "both picks") + ")") + '</button></div>';
    } else {
      const vals = names.map(nm => picks[nm]); const unanimous = vals.every(v => v === vals[0]);
      const pk = names.map((nm, i) => '<div class="pk ' + (nm === me ? "a" : "b") + '"><small>' + esc(nm) + '</small><b>' + esc(byId[picks[nm]] ? byId[picks[nm]].name : "?") + '</b></div>').join("");
      if (unanimous) act = '<div class="verdict match">MATCH</div><div class="picks">' + pk + '</div><div class="btns"><button class="sec" onclick="window.__tb.again()">Pick again</button><button onclick="window.__tb.lock(' + vals[0] + ')">Lock in ' + esc(byId[vals[0]] ? byId[vals[0]].name : "") + '</button></div>';
      else {
        const uniq = [...new Set(vals)];
        act = '<div class="verdict split">SPLIT</div><div class="picks">' + pk + '</div><div class="btns">' + uniq.map(id => { const owner = names.filter(nm => picks[nm] === id); const cavers = names.filter(nm => picks[nm] !== id);
          return '<button class="sec" style="line-height:1.2" onclick="window.__tb.lock(' + id + ',\'' + esc(cavers.join(" + ")).replace(/'/g, "\\'") + '\')">Lock ' + esc(byId[id] ? byId[id].name : "?") + '<br><small style="font-weight:500;color:var(--muted)">' + esc(cavers.join(" + ")) + ' caves</small></button>'; }).join("")
          + '</div><div class="btns"><button class="sec" onclick="window.__tb.again()">Argue, then pick again</button></div><div class="hint">Caving goes on the scoreboard.</div>';
      }
    }

    app.innerHTML = topbar('<span>' + fmtScore(g.score) + '</span> · ' + n + ' coasters', true) + '<div class="wrap">'
      + '<div class="hdr"><div class="sc">' + fmtScore(g.score) + '</div><div class="sub">' + placed.length + ' of ' + n + ' placed · ranks ' + (above + 1) + '–' + (above + n) + ' on the site</div></div>'
      + (open.length ? '<div class="seg"><button class="' + (mode === "best" ? "on" : "") + '" onclick="window.__tb.mode(\'best\')">Best</button><button class="' + (mode === "worst" ? "on worst" : "") + '" onclick="window.__tb.mode(\'worst\')">Worst</button></div>'
        + '<div class="round"><b>Round ' + g.round + '</b>' + chips + '</div>'
        + '<div class="list">' + open.map(cand).join("") + '</div>' : "")
      + '<h2>Agreed order</h2>' + placedHtml
      + '<h2>Scoreboard for ' + fmtScore(g.score) + '</h2>' + statsHtml(st)
      + ((state.log || []).length ? '<h2>Rounds</h2><div class="log">' + state.log.slice(0, 12).map(logLine).join("") + '</div>' : "")
      + '</div><div class="act"><div class="in">' + act + '</div></div>';
  }
  // a placed coaster belongs to the "worst" pile when its slot was filled from the bottom:
  // slots above it are empty while slots below it are full
  function isWorstSlot(c, n, placed) {
    const used = new Set(placed.map(p => p.tie_rank));
    let belowFull = true; for (let k = c.tie_rank + 1; k <= n; k++) if (!used.has(k)) { belowFull = false; break; }
    let aboveFull = true; for (let k = 1; k < c.tie_rank; k++) if (!used.has(k)) { aboveFull = false; break; }
    return belowFull && !aboveFull;
  }

  // ---- actions
  async function act(body) { if (busy) return; busy = true; try { const d = await api({ score, ...body }); if (d && d.group) { state = { ...state, ...d }; renderGroup(); } } catch (e) {} finally { busy = false; } }
  const A = {
    setName, changeName,
    pick: id => {
      if (state.group.revealed) return;
      const next = id === state.group.picks[me] ? null : id;
      // show it at once, the server confirms a moment later
      const picks = { ...state.group.picks }; if (next === null) delete picks[me]; else picks[me] = next;
      state = { ...state, group: { ...state.group, picks } }; renderGroup();
      act({ action: "pick", name: me, coasterId: next });
    },
    mode: mode => { if (mode === state.group.mode) return; act({ action: "mode", mode }); },
    reveal: () => act({ action: "reveal" }),
    again: () => act({ action: "again" }),
    lock: (id, cavedBy) => act({ action: "lock", coasterId: id, cavedBy: cavedBy || null }).then(() => toast("Locked in")),
    unplace: (id, name) => { if (confirm("Take " + name + " back out of the agreed order?")) act({ action: "unplace", coasterId: id }); },
    reset: () => { if (confirm("Clear the whole order for this score and start over?")) act({ action: "reset" }); },
    sheet: id => openSheet(id),
  };
  window.__tb = A;
  window.closeSheet = () => { $("#sheet").classList.remove("open"); $("#sheet-bg").classList.remove("open"); };

  // ---- stats sheet for one coaster
  async function openSheet(id) {
    const c = (state.candidates || []).find(x => x.id === id); if (!c) return;
    const sh = $("#sheet");
    const spec = (v, l) => v == null || v === "" ? "" : '<div class="spec"><b>' + esc(v) + '</b><small>' + l + '</small></div>';
    sh.innerHTML = (c.image ? '<div class="ph" style="background-image:url(\'' + thumb(c.image, 1200) + '\')"></div><div class="sc">' + fmtScore(c.rating) + '</div>' : '<div class="ph" style="height:64px;background:var(--el)"></div><div class="sc" style="top:24px">' + fmtScore(c.rating) + '</div>') + '<div class="bd">'
      + '<h3>' + esc(c.name) + '</h3><div class="sub">' + esc(c.park) + ' · ' + esc(c.country) + (c.year ? ' · opened ' + c.year : "") + '</div>'
      + '<div class="specs">' + spec(c.manufacturer, "make") + spec(c.model, "model") + spec(c.type, "type") + spec(m(c.height) != null ? m(c.height) + " m" : null, "height") + spec(kmh(c.speed) != null ? kmh(c.speed) + " km/h" : null, "speed") + spec(m(c.length) != null ? m(c.length).toLocaleString("en") + " m" : null, "length") + spec(c.inversions, "inversions") + spec(c.gforce ? c.gforce + " g" : null, "g-force") + spec(c.duration ? Math.round(c.duration) + " s" : null, "duration") + spec(c.ridecount, "our rides") + spec(c.last_visit ? new Date(c.last_visit).getFullYear() : null, "last visit") + spec(c.isbestcoaster ? "yes" : null, "park's best") + '</div>'
      + (c.notes ? '<p class="hint" style="text-align:left">' + esc(c.notes) + '</p>' : "")
      + '<div class="rev" id="rev">Loading our review…</div>'
      + '<div class="links"><a href="/coasters/' + esc(c.slug) + '" target="_blank"><button class="sec sm">Open coaster page</button></a><button class="sm" onclick="closeSheet()">Close</button></div></div>';
    sh.classList.add("open"); $("#sheet-bg").classList.add("open"); sh.scrollTop = 0;
    try {
      const r = await fetch("/api/coasters/" + c.id + "/text"); const j = await r.json(); const texts = (j.texts || []);
      $("#rev").innerHTML = texts.length ? texts.map(t => '<h4>' + esc(t.headline || "") + '</h4><p class="' + (t.isSpoiler ? "spoil" : "") + '" onclick="this.classList.add(\'show\')">' + esc(t.text || "") + '</p>').join("") : '<p class="hint" style="text-align:left">No written review yet.</p>';
    } catch (e) { $("#rev").innerHTML = ""; }
  }

  route();
})();
