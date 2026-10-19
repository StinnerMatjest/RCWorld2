// Parkrating tiebreak: the phone app. Served by app/tiebreak/route.ts, talks to /api/tiebreak.
// Two people, two phones, same room. Pick in secret, reveal together, drag what you agree on into
// one shared draft list, move things up or down, and submit the list to the site when it is right.
//
// Phases on the group screen:  pick (candidates shown)  ->  decide (reveal result, candidates hidden)
//                              ->  place (the new coaster is a draggable row in the list)  ->  pick again
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");
  const NAMES = ["Jannik", "Nicklas"];
  const R2 = "https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/";
  const thumb = (u, w) => { if (!u) return ""; const base = u.startsWith("http") ? u : R2 + u; return base.replace(/\.(jpe?g|png|webp)$/i, "") + "-w" + (w || 480) + ".webp"; };
  // the database stores feet and mph; shown as they are
  const ft = v => v == null ? null : Math.round(v) + " ft";
  const mph = v => v == null ? null : Math.round(v) + " mph";
  const fmtScore = s => String(Number(s)).replace(/\.0$/, "");
  const park = p => String(p || "").replace("Disneyland Paris - ", "DLP · ");
  const recent = d => (Date.now() - new Date(d).getTime()) / 1000 < 12;
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const when = d => { const t = new Date(d); return t.toLocaleDateString() + " " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
  // the site's rating colours (app/utils/design.ts)
  const col = s => { s = Number(s); return s >= 11 ? "#FCD34D" : s >= 10 ? "#F472B6" : s >= 9 ? "#C4B5FD" : s >= 8 ? "#60A5FA" : s >= 7 ? "#4ADE80" : s >= 6 ? "#BEF264" : s >= 5 ? "#FDE047" : s >= 4 ? "#FB923C" : s >= 3 ? "#F87171" : s >= 1.5 ? "#E64558" : "#9B7E83"; };

  let me = localStorage.getItem("tiebreak-name") || "";
  let state = null, score = null, timer = null, busy = false;
  let placing = null;              // { id, cavedBy } while dragging a coaster into the list
  let dragging = false;            // no repaint while a finger is on a row
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
    // the two of you always; anyone else only while they are actually here
    const ps = (state && state.players) || [];
    const others = [...new Set([...NAMES.filter(n => n !== me), ...ps.filter(p => recent(p.last_seen) && !NAMES.includes(p.name)).map(p => p.name).filter(n => n !== me)])].slice(0, 3);
    const seen = Object.fromEntries(ps.map(p => [p.name, p.last_seen]));
    const dots = others.map(n => '<span class="chip"><span class="dot ' + (seen[n] && recent(seen[n]) ? "on" : "") + '"></span>' + esc(n) + '</span>').join("");
    return '<div class="top">' + (back ? '<a class="back" href="#/">‹</a>' : "") + '<div class="ttl">' + title + '</div><div class="who">' + dots + '<span class="me" onclick="window.__tb.changeName()" title="Change name">' + esc(me) + '</span></div></div>';
  }

  // ---- home: the score groups
  function renderHome() {
    const groups = state.groups || [];
    const open = groups.filter(g => g.placed < g.count), done = groups.filter(g => g.placed >= g.count);
    const row = g => { const pct = Math.round(100 * g.placed / g.count), c = col(g.score), left = g.count - g.placed, done = g.placed >= g.count;
      const status = done ? (g.published === g.count && g.submitted_at ? "on the site" : "ready to submit") : (left === g.count ? "all " + left : left) + " to settle";
      const thumbs = (g.thumbs || []).slice(0, 5).map(t => '<i style="background-image:url(\'' + thumb(t, 480) + '\')"></i>').join("") + (g.count > 5 ? '<i class="more">+' + (g.count - 5) + '</i>' : "");
      return '<a class="grp ' + (done ? "done" : "") + '" href="#/g/' + fmtScore(g.score) + '"><div class="row"><div class="sc" style="color:' + c + '">' + fmtScore(g.score) + '</div><div class="nm"><b>' + g.count + ' coasters</b><small>' + status + '</small></div></div><div class="thumbs">' + thumbs + '</div><div class="bar"><i style="width:' + pct + '%;background:' + c + '"></i></div></a>'; };
    const s = stats(state.log || []);
    app.innerHTML = topbar('<span>Tiebreak</span>', false) + '<div class="wrap">'
      + '<div class="hl"><small>Parkrating · admin</small>Tied scores</div>'
      + '<div>' + (open.map(row).join("") || '<div class="hint" style="text-align:left">Nothing tied. Go ride something.</div>') + '</div>'
      + (done.length ? '<h2>Settled</h2><div>' + done.map(row).join("") + '</div>' : "")
      + (s.rounds ? '<h2>Scoreboard</h2>' + statsHtml(s) : "")
      + '</div>';
  }
  function stats(log) {
    const s = { rounds: 0, match: 0, split: 0, caved: {} };
    log.forEach(l => { if (l.result === "auto" || l.result === "submit") return; s.rounds++; if (l.result === "match") s.match++; if (l.result === "split") s.split++; if (l.result === "caved" && l.caved_by) s.caved[l.caved_by] = (s.caved[l.caved_by] || 0) + 1; });
    return s;
  }
  function statsHtml(s) {
    const pct = s.rounds ? Math.round(100 * s.match / s.rounds) : 0;
    const caved = Object.entries(s.caved).map(([n, c]) => '<div class="stat"><b>' + c + '</b><small>' + esc(n) + ' caved</small></div>').join("");
    return '<div class="stats"><div class="stat"><b>' + pct + '%</b><small>agreed first try</small></div><div class="stat"><b>' + s.match + '</b><small>matches</small></div><div class="stat"><b>' + s.split + '</b><small>no match, re-picked</small></div>' + caved + '</div>';
  }
  function logLine(l) {
    const who = Object.keys(l.picks || {});
    const t = l.result === "match" ? "<b>match</b> on " : l.result === "caved" ? "<b>" + esc(l.caved_by) + " caved</b>, listed " : l.result === "split" ? "<b>no match</b> " + who.map(esc).join(" vs ") + ", picked again" : l.result === "auto" ? "last one standing: " : l.result === "submit" ? "<b>submitted to the site</b>" : "listed ";
    return '<div>' + fmtScore(l.score) + ' · ' + t + (l.coaster ? "<b>" + esc(l.coaster) + "</b>" : "") + '</div>';
  }

  // ---- one group
  function renderKey() {
    const g = state.group, ps = (state.players || []).map(p => p.name + ":" + (recent(p.last_seen) ? 1 : 0)).sort().join(",");
    return JSON.stringify([g.round, g.revealed, g.picks, g.order, g.submitted_at, state.candidates.map(c => c.id + ":" + c.tie_rank), (state.log || []).length, ps, placing && placing.id, me]);
  }
  function renderGroup() {
    if (dragging) return;
    const rkey = renderKey(); if (rkey === lastKey) return; lastKey = rkey;
    const g = state.group, all = state.candidates, above = state.above;
    const byId = Object.fromEntries(all.map(c => [c.id, c]));
    const order = (g.order || []).filter(id => byId[id]);
    const n = all.length, placed = order.map(id => byId[id]), open = all.filter(c => !order.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
    const published = all.filter(c => c.tie_rank != null).sort((a, b) => a.tie_rank - b.tie_rank).map(c => c.id);
    const dirty = JSON.stringify(order) !== JSON.stringify(published);
    const picks = g.picks || {}, names = Object.keys(picks), mine = picks[me];
    const revealed = g.revealed;
    if (placing && (!byId[placing.id] || order.includes(placing.id))) placing = null;   // the other phone listed it meanwhile
    const phase = placing ? "place" : revealed && names.length >= 2 ? "decide" : "pick";

    // the reveal moment, once per round, on both phones
    const key = g.round + ":" + revealed;
    if (revealed && names.length >= 2 && seenReveal[score] !== key) { seenReveal[score] = key; drama(names, picks, byId); }
    if (!revealed) { seenReveal[score] = key; }

    const everyone = [...new Set([...NAMES, me, ...names])];
    const chips = everyone.map(nm => '<span class="chip ' + (picks[nm] != null ? "ok" : "wait") + '">' + esc(nm) + '</span>').join("");

    // candidates still to list (pick phase only)
    const stat = (v, unit, label) => v == null ? "" : '<div><b>' + esc(v) + (unit ? '<i>' + unit + '</i>' : "") + '</b><small>' + label + '</small></div>';
    const cand = c => '<div class="cand ' + (c.id === mine ? "mine" : "") + '" onclick="window.__tb.pick(' + c.id + ')">'
      + '<div class="th" style="background-image:url(\'' + thumb(c.image, 480) + '\')"></div>'
      + '<div class="tx"><div><b>' + esc(c.name) + '</b><small><em>' + esc(park(c.park)) + '</em> · ' + esc(c.country) + (c.manufacturer ? ' · ' + esc(c.manufacturer) : "") + (c.year ? ' ' + c.year : "") + '</small></div>'
      + '<div class="specs4">' + stat(c.inversions, "", "inv") + stat(c.speed != null ? Math.round(c.speed) : null, "mph", "speed") + stat(c.height != null ? Math.round(c.height) : null, "ft", "height") + stat(c.ridecount || null, "", c.ridecount === 1 ? "ride" : "rides") + '</div></div>'
      + '<div class="info" onclick="event.stopPropagation();window.__tb.sheet(' + c.id + ')">i</div>' + (c.id === mine ? '<span class="tick">YOUR PICK</span>' : "") + '</div>';

    // the draft list; while placing, the new coaster sits in it as a draggable row (at the bottom to start)
    const rowOf = (c, i, total, extra) => '<div class="pl ' + (extra || "") + '" data-id="' + c.id + '"><div class="rk" style="color:' + (extra ? "#fff" : col(g.score)) + '">' + (i + 1) + '</div><div class="nm">' + esc(c.name) + '<small>' + esc(park(c.park)) + ' · #' + (above + i + 1) + (extra ? "" : c.tie_rank === i + 1 ? "" : c.tie_rank == null ? " · new" : " · was #" + (above + c.tie_rank)) + '</small></div>'
      + (extra ? '<div class="grip">⋮⋮</div>' : '<div class="mv"><button ' + (i === 0 ? "disabled" : "") + ' onclick="window.__tb.move(' + c.id + ',-1)" title="Up">▲</button><button ' + (i === total - 1 ? "disabled" : "") + ' onclick="window.__tb.move(' + c.id + ',1)" title="Down">▼</button></div>'
      + '<button class="x" title="Take it back out" onclick="window.__tb.unplace(' + c.id + ',\'' + esc(c.name).replace(/'/g, "\\'") + '\')">✕</button>') + '</div>';
    let listHtml;
    if (phase === "place") {
      const rows = placed.map((c, i) => rowOf(c, i, placed.length + 1, "")).join("") + rowOf(byId[placing.id], placed.length, placed.length + 1, "new");
      listHtml = '<div class="placed" id="placed">' + rows + '</div>';
    } else {
      const banner = dirty
        ? '<div class="banner dirty"><div>Not on the site yet</div><button onclick="window.__tb.submit()">Submit to site</button></div>'
        : (placed.length ? '<div class="banner ok">On the site' + (g.submitted_at ? '<small>' + when(g.submitted_at) + '</small>' : "") + '</div>' : "");
      listHtml = (placed.length ? '<div class="placed" id="placed">' + placed.map((c, i) => rowOf(c, i, placed.length, "")).join("") + '</div>' : "") + banner;
    }

    // action bar
    let act = "";
    if (phase === "place") {
      const c = byId[placing.id];
      act = '<div class="verdict place">Drag <b>' + esc(c.name) + '</b> into place</div><div class="btns"><button class="sec" onclick="window.__tb.cancelPlace()">Back</button><button onclick="window.__tb.placeDone()">Done</button></div>';
    } else if (!open.length) {
      act = '<div class="verdict match">LIST COMPLETE</div>' + (dirty ? '<div class="btns"><button onclick="window.__tb.submit()">Submit to site</button></div>' : "")
        + '<div class="btns"><button class="danger" onclick="window.__tb.reset()">Start this group over</button></div>';
    } else if (phase === "pick") {
      const can = names.length >= 2;
      act = '<div class="verdict round">Round ' + g.round + '</div>'
        + '<div class="btns">' + (mine != null ? '<button class="sec" onclick="window.__tb.pick(null)">Clear my pick</button>' : "") + '<button ' + (can ? "" : "disabled") + ' onclick="window.__tb.reveal()">Reveal</button></div>';
    } else {
      const vals = names.map(nm => picks[nm]); const unanimous = vals.every(v => v === vals[0]);
      const pk = names.map(nm => '<div class="pk ' + (nm === me ? "a" : "b") + '"><small>' + esc(nm) + '</small><b>' + esc(byId[picks[nm]] ? byId[picks[nm]].name : "?") + '</b></div>').join("");
      if (unanimous) act = '<div class="verdict match">MATCH</div><div class="picks">' + pk + '</div><div class="btns"><button class="sec" onclick="window.__tb.again()">Pick again</button><button onclick="window.__tb.startPlace(' + vals[0] + ',null)">List ' + esc(byId[vals[0]] ? byId[vals[0]].name : "") + '</button></div>';
      else {
        const uniq = [...new Set(vals)];
        act = '<div class="verdict split">NO MATCH</div><div class="picks">' + pk + '</div><div class="slots">' + uniq.map(id => { const cavers = names.filter(nm => picks[nm] !== id);
          return '<button class="slot" onclick="window.__tb.startPlace(' + id + ',\'' + esc(cavers.join(" + ")).replace(/'/g, "\\'") + '\')">Go with <b>' + esc(byId[id] ? byId[id].name : "?") + '</b><small>' + esc(cavers.join(" + ")) + ' caves</small></button>'; }).join("")
          + '</div><div class="btns"><button class="sec" onclick="window.__tb.again()">Argue, then pick again</button></div>';
      }
    }

    const s = stats(state.log || []);
    app.innerHTML = topbar('<span>Tiebreak</span>', true) + '<div class="wrap">'
      + '<div class="ghead"><div class="sc" style="color:' + col(g.score) + '">' + fmtScore(g.score) + '</div><div class="hl"><small>' + n + ' coasters · ' + placed.length + ' listed · #' + (above + 1) + '–' + (above + n) + '</small>Tied at ' + fmtScore(g.score) + '</div></div>'
      + (placed.length || phase === "place" ? '<h2 style="margin-top:0">The list</h2>' : "") + listHtml
      + (phase === "pick" && open.length ? '<h2>Still to list</h2><div class="round"><b>Round ' + g.round + '</b>' + chips + '</div><div class="list">' + open.map(cand).join("") + '</div>' : "")
      + (phase === "pick" && s.rounds ? '<h2>Scoreboard</h2>' + statsHtml(s) + '<h2>Rounds</h2><div class="log">' + state.log.filter(l => l.result !== "submit").slice(0, 10).map(logLine).join("") + '</div>' : "")
      + '</div><div class="act"><div class="in">' + act + '</div></div>';
    if (phase === "place") { const row = $("#placed .pl.new"); if (row) { bindDrag(row); row.scrollIntoView({ block: "center" }); } }
  }

  // ---- dragging the new row up and down the list (same feel as the park rank lane: the new one lifts, the others shift)
  function bindDrag(row) {
    const box = row.parentElement;
    const renumber = () => [...box.querySelectorAll(".pl")].forEach((r, i) => { r.querySelector(".rk").textContent = i + 1; });
    row.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault(); row.setPointerCapture(e.pointerId);
      dragging = true; row.classList.add("lift"); buzz(10);
      const startY = e.clientY; let shift = 0;
      const step = row.offsetHeight + 6;   // row + gap
      const mv = ev => {
        const dy = ev.clientY - startY;
        row.style.transform = "translateY(" + (dy + shift) + "px) scale(1.03)";
        const r = row.getBoundingClientRect(), mid = r.top + r.height / 2;
        const prev = row.previousElementSibling, next = row.nextElementSibling;
        if (prev && prev.classList.contains("pl")) { const pr = prev.getBoundingClientRect(); if (mid < pr.top + pr.height / 2) { box.insertBefore(row, prev); shift += step; row.style.transform = "translateY(" + (dy + shift) + "px) scale(1.03)"; renumber(); buzz(8); return; } }
        if (next && next.classList.contains("pl")) { const nr = next.getBoundingClientRect(); if (mid > nr.top + nr.height / 2) { box.insertBefore(next, row); shift -= step; row.style.transform = "translateY(" + (dy + shift) + "px) scale(1.03)"; renumber(); buzz(8); } }
      };
      const up = () => { row.removeEventListener("pointermove", mv); row.removeEventListener("pointerup", up); row.removeEventListener("pointercancel", up);
        row.style.transform = ""; row.classList.remove("lift"); dragging = false; renumber(); };
      row.addEventListener("pointermove", mv); row.addEventListener("pointerup", up); row.addEventListener("pointercancel", up);
    });
  }
  function dropIndex() { const rows = [...document.querySelectorAll("#placed .pl")]; const i = rows.findIndex(r => r.classList.contains("new")); return i < 0 ? rows.length : i; }

  // ---- the reveal: a short, tense sequence on both phones; Skip jumps to the end, Continue closes
  function drama(names, picks, byId) {
    const ov = $("#overlay"); if (!ov) return;
    const vals = names.map(nm => picks[nm]); const match = vals.every(v => v === vals[0]);
    const card = (nm, cls) => '<div class="ov-card ' + cls + '"><small>' + esc(nm) + '</small><b>' + esc(byId[picks[nm]] ? byId[picks[nm]].name : "?") + '</b></div>';
    ov.innerHTML = '<button class="ov-skip" id="ov-skip">Skip</button><div class="ov-in"><div class="ov-t">Revealing<span class="dots"><i>.</i><i>.</i><i>.</i></span></div><div class="ov-cards">' + card(names[0], "hide") + card(names[1] || "", "hide") + '</div><div class="stamp hide ' + (match ? "match" : "split") + '">' + (match ? "MATCH" : "NO MATCH") + '</div><button class="ov-btn hide" id="ov-go">Continue</button></div>';
    ov.classList.add("on"); buzz(30);
    const cards = ov.querySelectorAll(".ov-card"), stamp = ov.querySelector(".stamp"), go = ov.querySelector("#ov-go"), skip = ov.querySelector("#ov-skip");
    const t = [];
    t.push(setTimeout(() => { cards[0].classList.remove("hide"); buzz(20); }, 1400));
    t.push(setTimeout(() => { cards[1] && cards[1].classList.remove("hide"); buzz(20); }, 2300));
    t.push(setTimeout(() => { stamp.classList.remove("hide"); buzz(match ? [60, 50, 60, 50, 120] : [250]); }, 3200));
    t.push(setTimeout(() => { go.classList.remove("hide"); skip.classList.add("hide"); }, 4000));
    const stop = e => { if (e) { e.preventDefault(); e.stopPropagation(); } t.forEach(clearTimeout); };
    const showAll = e => { stop(e); ov.querySelectorAll(".hide").forEach(x => x.classList.remove("hide")); skip.classList.add("hide"); };
    const close = e => { stop(e); ov.classList.remove("on"); ov.innerHTML = ""; };
    // preventDefault on touchend stops the follow-up click from landing on whatever is underneath
    skip.addEventListener("touchend", showAll, { passive: false }); skip.addEventListener("click", showAll);
    go.addEventListener("touchend", close, { passive: false }); go.addEventListener("click", close);
    ov.addEventListener("touchend", e => e.preventDefault(), { passive: false });
    t.push(setTimeout(close, 12000));
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
      if (!(state.group.order || []).length) { act({ action: "lock", coasterId: id, position: 1, cavedBy: cavedBy || null }).then(() => toast("Listed")); return; }
      placing = { id, cavedBy: cavedBy || null }; renderGroup();
    },
    cancelPlace: () => { placing = null; renderGroup(); },
    placeDone: () => { const p = placing; if (!p) return; const pos = dropIndex() + 1; placing = null; act({ action: "lock", coasterId: p.id, position: pos, cavedBy: p.cavedBy }).then(() => toast("Listed at " + pos)); },
    move: (id, dir) => act({ action: "move", coasterId: id, dir }),
    unplace: (id, name) => { if (confirm("Take " + name + " back out of the list?")) act({ action: "unplace", coasterId: id }); },
    submit: () => { if (confirm("Put this order on the site? Coaster pages and rankings update right away.")) act({ action: "submit" }).then(() => toast("On the site")); },
    reset: () => { if (confirm("Clear this group's list, its order on the site and its history, and start over?")) act({ action: "reset" }); },
    sheet: id => openSheet(id),
  };
  window.__tb = A;
  window.__tbDebug = () => ({ me, score, group: state && state.group, placing });

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
      + '<div class="bd"><h3>' + esc(c.name) + '</h3><div class="sub">' + esc(park(c.park)) + ' · ' + esc(c.country) + (c.year ? ' · opened ' + c.year : "") + '</div>'
      + '<div class="specs">' + spec(c.manufacturer, "make") + spec(c.model, "model") + spec(c.type, "type") + spec(ft(c.height), "height") + spec(mph(c.speed), "speed") + spec(c.length != null ? Math.round(c.length).toLocaleString("en") + " ft" : null, "length") + spec(c.inversions, "inversions") + spec(c.gforce ? c.gforce + " g" : null, "g-force") + spec(c.duration ? Math.round(c.duration) + " s" : null, "duration") + spec(c.ridecount, "our rides") + spec(c.last_visit ? new Date(c.last_visit).getFullYear() : null, "last visit") + spec(c.isbestcoaster ? "yes" : null, "park's best") + '</div>'
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
