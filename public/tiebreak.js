// Parkrating tiebreak: the phone app. Served by app/tiebreak/route.ts, talks to /api/tiebreak.
// Two people, two phones, same room. Pick in secret, reveal together, place what you agree on
// into one shared list, and move things up or down until the list is right.
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");
  const NAMES = ["Jannik", "Nicklas"];
  const R2 = "https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/";
  const thumb = (u, w) => { if (!u) return ""; const base = u.startsWith("http") ? u : R2 + u; return base.replace(/\.(jpe?g|png|webp)$/i, "") + "-w" + (w || 480) + ".webp"; };
  const m = ft => ft == null ? null : Math.round(ft * 0.3048);
  const kmh = mph => mph == null ? null : Math.round(mph * 1.609344);
  const fmtScore = s => String(Number(s)).replace(/\.0$/, "");
  const recent = d => (Date.now() - new Date(d).getTime()) / 1000 < 12;
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  let me = localStorage.getItem("tiebreak-name") || "";
  let state = null, score = null, timer = null, busy = false;
  let placing = null;              // { id, cavedBy } while choosing where a coaster goes
  let actionSeq = 0, lastActionDone = 0, lastKey = "";  // actions bump the sequence so stale polls are dropped; lastKey skips no-op re-renders
  const seenReveal = {};           // score -> "round:revealed" we last animated

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
    score = mm ? Number(mm[1]) : null; placing = null; lastKey = "";
    state = null; app.innerHTML = '<div class="wrap hint" style="padding-top:40px">Loading…</div>';
    tick();
  }
  window.addEventListener("hashchange", route);

  // ---- polling
  async function tick() {
    clearTimeout(timer);
    if (!me) { renderName(); return; }
    try {
      // a poll is only trusted if no action started or finished while it was in flight
      const seq = actionSeq, started = Date.now();
      const fresh = () => seq === actionSeq && started > lastActionDone && !busy;
      if (score === null) { const d = await get(); if (d && fresh()) { state = d; renderHome(); } }
      else { const d = await get("?score=" + score); if (d && fresh()) { state = d; renderGroup(); } }
    } catch (e) { /* keep the last render */ }
    timer = setTimeout(tick, score === null ? 4000 : 1000);
  }
  setInterval(() => { if (me) api({ action: "hello", name: me }).catch(() => {}); }, 5000);

  // ---- who are you
  function renderName() {
    app.innerHTML = '<div class="wrap"><div class="card login"><h1><span>Parkrating</span> tiebreak</h1><p>Who is holding this phone?</p>'
      + '<div class="names">' + NAMES.map(n => '<button onclick="window.__tb.setName(\'' + n + '\')">' + n + '</button>').join("") + '</div>'
      + '<details class="other"><summary>Someone else</summary><input id="nm" placeholder="Name"><button class="sec" style="width:100%;margin-top:8px" onclick="window.__tb.setName(document.getElementById(\'nm\').value)">Use this name</button></details></div></div>';
  }
  function setName(v) { v = (v || "").trim(); if (!v) return; me = v.slice(0, 40); localStorage.setItem("tiebreak-name", me); api({ action: "hello", name: me }).catch(() => {}); tick(); }
  function changeName() { localStorage.removeItem("tiebreak-name"); me = ""; renderName(); }

  function topbar(title, back) {
    // the two of you always; anyone else only while they are actually here (old test names stay hidden)
    const ps = (state && state.players) || [];
    const others = [...new Set([...NAMES.filter(n => n !== me), ...ps.filter(p => recent(p.last_seen) && !NAMES.includes(p.name)).map(p => p.name).filter(n => n !== me)])].slice(0, 3);
    const seen = Object.fromEntries(((state && state.players) || []).map(p => [p.name, p.last_seen]));
    const dots = others.map(n => '<span class="chip"><span class="dot ' + (seen[n] && recent(seen[n]) ? "on" : "") + '"></span>' + esc(n) + '</span>').join("");
    return '<div class="top">' + (back ? '<a class="back" href="#/">‹</a>' : "") + '<div class="ttl">' + title + '</div><div class="who">' + dots + '<span class="me" onclick="window.__tb.changeName()" title="Change name">' + esc(me) + '</span></div></div>';
  }

  // ---- home: the score groups
  function renderHome() {
    const groups = state.groups || [];
    const open = groups.filter(g => g.placed < g.count), done = groups.filter(g => g.placed >= g.count);
    const row = g => { const pct = Math.round(100 * g.placed / g.count); const lo = g.above + 1, hi = g.above + g.count;
      return '<a class="grp ' + (g.placed >= g.count ? "done" : "") + '" href="#/g/' + fmtScore(g.score) + '"><div class="sc">' + fmtScore(g.score) + '</div><div class="nm"><b>' + g.count + ' coasters</b><small>' + (g.placed >= g.count ? "settled" : g.placed + " placed · " + (g.count - g.placed) + " to go") + ' · ranks ' + lo + '–' + hi + '</small><div class="bar"><i style="width:' + pct + '%"></i></div></div><div class="chev">›</div></a>'; };
    const log = (state.log || []).slice(0, 8);
    app.innerHTML = topbar('<span>Tiebreak</span> · tied scores', false) + '<div class="wrap">'
      + '<p class="hint" style="text-align:left;margin:4px 0 14px">Pick a score. Each of you picks a coaster in secret, you reveal together, and the one you agree on goes into the shared list. Move things up and down until the list is right; the site\'s ranking follows.</p>'
      + '<h2>To settle</h2><div>' + (open.map(row).join("") || '<div class="hint">Everything is settled.</div>') + '</div>'
      + (done.length ? '<h2>Settled</h2><div>' + done.map(row).join("") + '</div>' : "")
      + '<h2>Scoreboard</h2>' + statsHtml(stats(state.log || []))
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
    const t = l.result === "match" ? "<b>match</b> on " : l.result === "caved" ? "<b>" + esc(l.caved_by) + " caved</b>, placed " : l.result === "split" ? "<b>split</b> " + who.map(esc).join(" vs ") + ", picked again" : l.result === "auto" ? "last one standing: " : "placed ";
    return '<div>' + fmtScore(l.score) + ' · ' + t + (l.coaster ? "<b>" + esc(l.coaster) + "</b>" : "") + '</div>';
  }

  // ---- one group
  function renderKey() {
    const g = state.group, ps = (state.players || []).map(p => p.name + ":" + (recent(p.last_seen) ? 1 : 0)).sort().join(",");
    return JSON.stringify([g.round, g.revealed, g.picks, state.candidates.map(c => c.id + ":" + c.tie_rank), (state.log || []).length, ps, placing && placing.id, me]);
  }
  function renderGroup() {
    const rkey = renderKey(); if (rkey === lastKey) return; lastKey = rkey;
    const g = state.group, all = state.candidates, above = state.above;
    const n = all.length, open = all.filter(c => c.tie_rank == null), placed = all.filter(c => c.tie_rank != null).sort((a, b) => a.tie_rank - b.tie_rank);
    const picks = g.picks || {}, names = Object.keys(picks), mine = picks[me];
    const revealed = g.revealed;
    const byId = Object.fromEntries(all.map(c => [c.id, c]));

    // the reveal moment, once per round, on both phones
    const key = g.round + ":" + revealed;
    if (revealed && names.length >= 2 && seenReveal[score] !== key) { seenReveal[score] = key; drama(names, picks, byId); }
    if (!revealed) { seenReveal[score] = key; if (placing) placing = null; }

    // who has picked
    const everyone = [...new Set([...NAMES, me, ...names])];
    const chips = everyone.map(nm => '<span class="chip ' + (picks[nm] != null ? "ok" : "wait") + '">' + esc(nm) + '</span>').join("");

    // candidates
    const tag = c => {
      if (!revealed) return c.id === mine ? '<span class="tick">YOUR PICK</span>' : "";
      const who = names.filter(nm => picks[nm] === c.id); if (!who.length) return "";
      return '<span class="tick ' + (who.length > 1 ? "rev-ab" : who[0] === me ? "rev-a" : "rev-b") + '">' + esc(who.join(" + ")) + '</span>';
    };
    const cand = c => '<div class="cand ' + (c.id === mine ? "mine" : "") + '" onclick="window.__tb.pick(' + c.id + ')">'
      + '<div class="th" style="background-image:url(\'' + thumb(c.image, 480) + '\')"></div>'
      + '<div class="tx"><b>' + esc(c.name) + '</b><small>' + esc(c.park) + ' · ' + esc(c.country) + (c.year ? ' · ' + c.year : "") + '</small>'
      + '<div class="st">' + [c.manufacturer, c.inversions != null ? c.inversions + " inv" : null, kmh(c.speed) != null ? kmh(c.speed) + " km/h" : null, m(c.height) != null ? m(c.height) + " m" : null, c.ridecount ? c.ridecount + " rides" : null].filter(Boolean).map(esc).join(" · ") + '</div></div>'
      + '<div class="info" onclick="event.stopPropagation();window.__tb.sheet(' + c.id + ')">i</div>' + tag(c) + '</div>';

    // the shared list, with up/down and remove
    const pl = (c, i) => '<div class="pl"><div class="rk">' + c.tie_rank + '</div><div class="nm">' + esc(c.name) + '<small>' + esc(c.park) + ' · #' + (above + c.tie_rank) + ' overall</small></div>'
      + '<div class="mv"><button ' + (i === 0 ? "disabled" : "") + ' onclick="window.__tb.move(' + c.id + ',-1)" title="Up">▲</button><button ' + (i === placed.length - 1 ? "disabled" : "") + ' onclick="window.__tb.move(' + c.id + ',1)" title="Down">▼</button></div>'
      + '<button class="x" title="Take it back out" onclick="window.__tb.unplace(' + c.id + ',\'' + esc(c.name).replace(/'/g, "\\'") + '\')">✕</button></div>';
    const listHtml = placed.length ? '<div class="placed">' + placed.map(pl).join("") + (open.length ? '<div class="hint" style="padding:6px 0 0">' + open.length + ' still to place</div>' : "") + '</div>' : '<div class="hint" style="text-align:left">Nothing placed yet. The first one you agree on starts the list.</div>';

    // action bar
    let act = "";
    if (placing) {
      const c = byId[placing.id];
      const slot = (pos, label) => '<button class="slot" onclick="window.__tb.placeAt(' + pos + ')">' + label + '</button>';
      act = '<div class="verdict place">Where does <b>' + esc(c ? c.name : "") + '</b> go?</div><div class="slots">' + slot(1, "At the top")
        + placed.map((p, i) => slot(i + 2, "Below " + (i + 1) + ". " + esc(p.name))).join("") + '</div><div class="btns"><button class="sec" onclick="window.__tb.cancelPlace()">Back</button></div>';
    } else if (!open.length) act = '<div class="verdict match">SETTLED</div><div class="hint">All ' + n + ' placed. Ranks ' + (above + 1) + ' to ' + (above + n) + ' on the site. Use the arrows above if something still looks wrong.</div><div class="btns"><button class="danger" onclick="window.__tb.reset()">Start this group over</button></div>';
    else if (!revealed) {
      const can = names.length >= 2;
      act = '<div class="hint">Round ' + g.round + ' · pick the coaster to place next</div>'
        + '<div class="btns">' + (mine != null ? '<button class="sec" onclick="window.__tb.pick(null)">Clear my pick</button>' : "") + '<button ' + (can ? "" : "disabled") + ' onclick="window.__tb.reveal()">Reveal' + (can ? "" : " (waiting for " + (names.length ? "the other pick" : "both picks") + ")") + '</button></div>';
    } else {
      const vals = names.map(nm => picks[nm]); const unanimous = vals.every(v => v === vals[0]);
      const pk = names.map(nm => '<div class="pk ' + (nm === me ? "a" : "b") + '"><small>' + esc(nm) + '</small><b>' + esc(byId[picks[nm]] ? byId[picks[nm]].name : "?") + '</b></div>').join("");
      if (unanimous) act = '<div class="verdict match">MATCH</div><div class="picks">' + pk + '</div><div class="btns"><button class="sec" onclick="window.__tb.again()">Pick again</button><button onclick="window.__tb.startPlace(' + vals[0] + ',null)">Place ' + esc(byId[vals[0]] ? byId[vals[0]].name : "") + '</button></div>';
      else {
        const uniq = [...new Set(vals)];
        act = '<div class="verdict split">SPLIT</div><div class="picks">' + pk + '</div><div class="btns">' + uniq.map(id => { const cavers = names.filter(nm => picks[nm] !== id);
          return '<button class="sec" style="line-height:1.2" onclick="window.__tb.startPlace(' + id + ',\'' + esc(cavers.join(" + ")).replace(/'/g, "\\'") + '\')">Place ' + esc(byId[id] ? byId[id].name : "?") + '<br><small style="font-weight:500;color:var(--muted)">' + esc(cavers.join(" + ")) + ' caves</small></button>'; }).join("")
          + '</div><div class="btns"><button class="sec" onclick="window.__tb.again()">Argue, then pick again</button></div><div class="hint">Caving goes on the scoreboard.</div>';
      }
    }

    app.innerHTML = topbar('<span>' + fmtScore(g.score) + '</span> · ' + n + ' coasters', true) + '<div class="wrap">'
      + '<div class="hdr"><div class="sc">' + fmtScore(g.score) + '</div><div class="sub">' + placed.length + ' of ' + n + ' placed · ranks ' + (above + 1) + '–' + (above + n) + ' on the site</div></div>'
      + '<h2 style="margin-top:6px">The list</h2>' + listHtml
      + (open.length ? '<h2>Still to place</h2><div class="round"><b>Round ' + g.round + '</b>' + chips + '</div><div class="list">' + open.map(cand).join("") + '</div>' : "")
      + '<h2>Scoreboard for ' + fmtScore(g.score) + '</h2>' + statsHtml(stats(state.log || []))
      + ((state.log || []).length ? '<h2>Rounds</h2><div class="log">' + state.log.slice(0, 12).map(logLine).join("") + '</div>' : "")
      + '</div><div class="act"><div class="in">' + act + '</div></div>';
  }

  // ---- the reveal: a short, tense sequence on both phones
  function drama(names, picks, byId) {
    const ov = $("#overlay"); if (!ov) return;
    const vals = names.map(nm => picks[nm]); const match = vals.every(v => v === vals[0]);
    const card = (nm, cls) => '<div class="ov-card ' + cls + '"><small>' + esc(nm) + '</small><b>' + esc(byId[picks[nm]] ? byId[picks[nm]].name : "?") + '</b></div>';
    ov.innerHTML = '<div class="ov-in"><div class="ov-t">Revealing<span class="dots"><i>.</i><i>.</i><i>.</i></span></div><div class="ov-cards">' + card(names[0], "hide") + card(names[1] || "", "hide") + '</div><div class="stamp hide ' + (match ? "match" : "split") + '">' + (match ? "MATCH" : "SPLIT") + '</div><div class="ov-hint">tap to continue</div></div>';
    ov.classList.add("on"); buzz(30);
    const cards = ov.querySelectorAll(".ov-card"), stamp = ov.querySelector(".stamp");
    const t = [];
    t.push(setTimeout(() => { cards[0].classList.remove("hide"); buzz(20); }, 1400));
    t.push(setTimeout(() => { cards[1] && cards[1].classList.remove("hide"); buzz(20); }, 2300));
    t.push(setTimeout(() => { stamp.classList.remove("hide"); buzz(match ? [60, 50, 60, 50, 120] : [250]); }, 3200));
    const close = () => { t.forEach(clearTimeout); ov.classList.remove("on"); ov.innerHTML = ""; };
    ov.onclick = close; t.push(setTimeout(close, 6500));
  }

  // ---- actions
  async function act(body) { if (busy) return; busy = true; actionSeq++; try { const d = await api({ score, ...body }); lastActionDone = Date.now(); if (d && d.group) { state = { ...state, ...d }; renderGroup(); } return d; } catch (e) { lastActionDone = Date.now(); } finally { busy = false; } }
  const A = {
    setName, changeName,
    pick: id => {
      if (state.group.revealed) return;
      const next = id === state.group.picks[me] ? null : id;
      const picks = { ...state.group.picks }; if (next === null) delete picks[me]; else picks[me] = next;
      state = { ...state, group: { ...state.group, picks } }; renderGroup();   // show it at once
      act({ action: "pick", name: me, coasterId: next });
    },
    reveal: () => act({ action: "reveal" }),
    again: () => act({ action: "again" }),
    startPlace: (id, cavedBy) => {
      const placed = state.candidates.filter(c => c.tie_rank != null);
      if (!placed.length) { act({ action: "lock", coasterId: id, position: 1, cavedBy: cavedBy || null }).then(() => toast("Placed")); return; }
      placing = { id, cavedBy: cavedBy || null }; renderGroup();
    },
    cancelPlace: () => { placing = null; renderGroup(); },
    placeAt: pos => { const p = placing; placing = null; act({ action: "lock", coasterId: p.id, position: pos, cavedBy: p.cavedBy }).then(() => toast("Placed")); },
    move: (id, dir) => act({ action: "move", coasterId: id, dir }),
    unplace: (id, name) => { if (confirm("Take " + name + " back out of the list?")) act({ action: "unplace", coasterId: id }); },
    reset: () => { if (confirm("Clear the whole list for this score and start over?")) act({ action: "reset" }); },
    sheet: id => openSheet(id),
  };
  window.__tb = A;
  window.__tbDebug = () => ({ me, score, group: state && state.group, cands: state && state.candidates && state.candidates.map(c => c.id) });

  // ---- stats sheet for one coaster
  function closeSheet() { $("#sheet").classList.remove("open"); $("#sheet-bg").classList.remove("open"); }
  window.closeSheet = closeSheet;
  (function swipeToClose() {
    const sh = $("#sheet"); let y0 = null;
    sh.addEventListener("touchstart", e => { y0 = sh.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    sh.addEventListener("touchmove", e => { if (y0 !== null && e.touches[0].clientY - y0 > 70) { y0 = null; closeSheet(); } }, { passive: true });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
  })();
  async function openSheet(id) {
    const c = (state.candidates || []).find(x => x.id === id); if (!c) return;
    const sh = $("#sheet");
    const spec = (v, l) => v == null || v === "" ? "" : '<div class="spec"><b>' + esc(v) + '</b><small>' + l + '</small></div>';
    sh.innerHTML = '<div class="grab"></div><button class="close" onclick="closeSheet()" aria-label="Close">✕</button>'
      + (c.image ? '<div class="ph" style="background-image:url(\'' + thumb(c.image, 1200) + '\')"></div><div class="sc">' + fmtScore(c.rating) + '</div>' : '<div class="ph" style="height:70px;background:var(--el)"></div><div class="sc" style="top:30px">' + fmtScore(c.rating) + '</div>')
      + '<div class="bd"><h3>' + esc(c.name) + '</h3><div class="sub">' + esc(c.park) + ' · ' + esc(c.country) + (c.year ? ' · opened ' + c.year : "") + '</div>'
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
