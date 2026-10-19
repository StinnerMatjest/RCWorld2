// Parkrating tiebreak: the phone app. Served by app/tiebreak/route.ts, talks to /api/tiebreak.
// Two people, two phones, same room. Pick in secret, reveal together, drag what you agree on into
// one shared draft list, and submit the list to the site when the group is complete.
//
// Phases on the group screen:
//   pick    candidates shown, each phone picks in secret
//   decide  revealed; MATCH goes straight to placing, NO MATCH asks who gives way
//   place   the new coaster is a draggable row in the list on the placer's phone...
//   watch   ...and a ghost row that follows along on the other phone
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");
  const NAMES = ["Jannik", "Nicklas"];
  const R2 = "https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/";
  const thumb = (u, w) => { if (!u) return ""; const base = u.startsWith("http") ? u : R2 + u; return base.replace(/\.(jpe?g|png|webp)$/i, "") + "-w" + (w || 480) + ".webp"; };
  const fmtScore = s => String(Number(s)).replace(/\.0$/, "");
  const park = p => String(p || "").replace("Disneyland Paris - ", "DLP · ");
  const recent = d => (Date.now() - new Date(d).getTime()) / 1000 < 12;
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const when = d => { const t = new Date(d); return t.toLocaleDateString() + " " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
  // the site's rating colours (app/utils/design.ts)
  const col = s => { s = Number(s); return s >= 11 ? "#FCD34D" : s >= 10 ? "#F472B6" : s >= 9 ? "#C4B5FD" : s >= 8 ? "#60A5FA" : s >= 7 ? "#4ADE80" : s >= 6 ? "#BEF264" : s >= 5 ? "#FDE047" : s >= 4 ? "#FB923C" : s >= 3 ? "#F87171" : s >= 1.5 ? "#E64558" : "#9B7E83"; };

  let me = localStorage.getItem("tiebreak-name") || "";
  let state = null, score = null, timer = null, busy = false;
  let placing = null;              // { id, cavedBy } while this phone drags a coaster into the list
  let showSettled = false;
  let dragging = false;            // no repaint while a finger is on a row
  let actionSeq = 0, lastActionDone = 0, lastKey = "";
  const seenReveal = {}, autoPlaced = {};   // per score: "round:revealed" animated / round auto-placed on a match

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

  function topbar(back) {
    const ps = (state && state.players) || [];
    const others = [...new Set([...NAMES.filter(n => n !== me), ...ps.filter(p => recent(p.last_seen) && !NAMES.includes(p.name)).map(p => p.name).filter(n => n !== me)])].slice(0, 3);
    const seen = Object.fromEntries(ps.map(p => [p.name, p.last_seen]));
    const dots = others.map(n => '<span class="chip"><span class="dot ' + (seen[n] && recent(seen[n]) ? "on" : "") + '"></span>' + esc(n) + '</span>').join("");
    return '<div class="top">' + (back ? '<a class="back" href="#/">‹</a>' : "") + '<div class="ttl"><span>Tiebreak</span></div><div class="who">' + dots + '<span class="me" onclick="window.__tb.changeName()" title="Change name">' + esc(me) + '</span></div></div>';
  }

  // ---- home: the tied scores
  function renderHome() {
    const groups = state.groups || [];
    const open = groups.filter(g => g.placed < g.count), done = groups.filter(g => g.placed >= g.count);
    const row = g => { const pct = Math.round(100 * g.placed / g.count), c = col(g.score), left = g.count - g.placed, isDone = g.placed >= g.count;
      const status = isDone ? (g.published === g.count && g.submitted_at ? "on the site" : "ready to submit") : g.submitted_at ? left + " new to place" : (left === g.count ? "all " + left : left) + " to settle";
      const strip = (g.thumbs || []).slice(0, 6).map(t => '<i style="background-image:url(\'' + thumb(t, 480) + '\')"></i>').join("");
      return '<a class="grp ' + (isDone ? "done" : g.submitted_at ? "fresh" : "") + '" href="#/g/' + fmtScore(g.score) + '"><div class="strip">' + strip + '</div><div class="shade"></div><div class="row"><div class="sc" style="color:' + c + '">' + fmtScore(g.score) + '</div><div class="nm"><b>' + g.count + ' coasters</b><small>' + status + '</small></div></div><div class="bar"><i style="width:' + pct + '%;background:' + c + '"></i></div></a>'; };
    const s = stats(state.log || []);
    const adds = state.additions || [];
    const add = a => '<a class="add" href="#/g/' + fmtScore(a.score) + '"><div class="th" style="background-image:url(\'' + thumb(a.image, 480) + '\')"></div><div class="tx"><b>' + esc(a.name) + '</b><small>' + esc(park(a.park)) + '</small></div><div class="chg">' + (a.from != null ? '<span class="from">' + fmtScore(a.from) + '</span> → <span style="color:' + col(a.score) + '">' + fmtScore(a.score) + '</span>' : 'new at <span style="color:' + col(a.score) + '">' + fmtScore(a.score) + '</span>') + '</div></a>';
    app.innerHTML = topbar(false) + '<div class="wrap">'
      + '<div class="hl"><small>Parkrating · admin</small>Tied scores</div>'
      + (adds.length ? '<h2 style="margin-top:0">New additions</h2><div class="adds">' + adds.map(add).join("") + '</div><h2>To settle</h2>' : "")
      + '<div>' + (open.map(row).join("") || '<div class="hint" style="text-align:left">Nothing to settle.</div>') + '</div>'
      + (done.length ? '<button class="sec sm settled-toggle" onclick="window.__tb.toggleSettled()">' + done.length + ' settled · ' + (showSettled ? "hide" : "show") + '</button>' + (showSettled ? '<div style="margin-top:10px">' + done.map(row).join("") + '</div>' : "") : "")
      + (s.rounds ? '<h2>Scoreboard</h2>' + statsHtml(s) : "")
      + '</div>';
  }
  function stats(log) {
    const s = { rounds: 0, match: 0, disagree: 0 };
    log.forEach(l => { if (l.result === "auto" || l.result === "submit") return; s.rounds++; if (l.result === "match") s.match++; if (l.result === "split" || l.result === "caved") s.disagree++; });
    return s;
  }
  function statsHtml(s) {
    const pct = s.rounds ? Math.round(100 * s.match / s.rounds) : 0;
    return '<div class="stats"><div class="stat"><b>' + pct + '%</b><small>agreed first try</small></div><div class="stat"><b>' + s.match + '</b><small>matches</small></div><div class="stat"><b>' + s.disagree + '</b><small>times we disagreed</small></div></div>';
  }
  function logLine(l) {
    const who = Object.keys(l.picks || {});
    const t = l.result === "match" ? "<b>match</b> on " : l.result === "caved" ? "<b>" + esc(l.caved_by) + " caved</b>, listed " : l.result === "split" ? "<b>no match</b> " + who.map(esc).join(" vs ") + ", picked again" : l.result === "auto" ? "last one standing: " : l.result === "submit" ? "<b>submitted to the site</b>" : "listed ";
    return '<div>' + t + (l.coaster ? "<b>" + esc(l.coaster) + "</b>" : "") + '</div>';
  }

  // ---- one group
  function renderKey() {
    const g = state.group, ps = (state.players || []).map(p => p.name + ":" + (recent(p.last_seen) ? 1 : 0)).sort().join(",");
    return JSON.stringify([g.round, g.revealed, g.picks, g.order, g.placing, g.submitted_at, state.candidates.map(c => c.id + ":" + c.tie_rank), (state.log || []).length, ps, placing && placing.id, placing && placing.pos, me]);
  }
  function renderGroup() {
    if (dragging) return;
    const g = state.group, all = state.candidates, above = state.above;
    const byId = Object.fromEntries(all.map(c => [c.id, c]));
    const order = (g.order || []).filter(id => byId[id]);
    const n = all.length, placed = order.map(id => byId[id]), open = all.filter(c => !order.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
    const published = all.filter(c => c.tie_rank != null).sort((a, b) => a.tie_rank - b.tie_rank).map(c => c.id);
    const dirty = JSON.stringify(order) !== JSON.stringify(published);
    const picks = g.picks || {}, names = Object.keys(picks), mine = picks[me];
    const revealed = g.revealed && names.length >= 2;
    const vals = names.map(nm => picks[nm]), unanimous = revealed && vals.every(v => v === vals[0]);
    if (placing && (!byId[placing.id] || order.includes(placing.id))) placing = null;        // listed meanwhile
    const live = g.placing && byId[g.placing.id] && !order.includes(g.placing.id) ? g.placing : null;  // someone is dragging
    if (placing && live && live.by !== me) placing = null;                                      // the other phone got there first
    const phase = placing ? "place" : live && live.by !== me ? "watch" : revealed ? "decide" : "pick";

    // the reveal moment, once per round, on both phones
    const key = g.round + ":" + g.revealed;
    if (revealed && seenReveal[score] !== key) { seenReveal[score] = key; drama(names, picks, byId); }
    if (!g.revealed) seenReveal[score] = key;
    // a match needs no button: straight to placing (the server hands the drag to the first phone that asks)
    if (unanimous && phase === "decide" && autoPlaced[score] !== g.round) { autoPlaced[score] = g.round; A.startPlace(vals[0], null); }

    const rkey = renderKey(); if (rkey === lastKey) return; lastKey = rkey;

    const everyone = [...new Set([...NAMES, me, ...names])];
    const chips = everyone.map(nm => '<span class="chip ' + (picks[nm] != null ? "ok" : "wait") + '">' + esc(nm) + '</span>').join("");

    // candidates still to list (pick phase only)
    const stat = (v, label) => '<div><b>' + (v == null ? "–" : esc(v)) + '</b><span class="lb">' + label + '</span></div>';
    const cand = c => '<div class="cand ' + (c.id === mine ? "mine" : "") + '" onclick="window.__tb.pick(' + c.id + ')">'
      + '<div class="hd"><div class="th" style="background-image:url(\'' + thumb(c.image, 480) + '\')"></div>'
      + '<div class="tx"><b>' + esc(c.name) + '</b><span class="ln"><em>' + esc(park(c.park)) + '</em> · ' + (c.manufacturer ? esc(c.manufacturer) : esc(c.country)) + (c.year ? ' ' + c.year : "") + '</span></div></div>'
      + '<div class="specs4">' + stat(c.inversions, "inv") + stat(c.speed != null ? Math.round(c.speed) : null, "mph") + stat(c.height != null ? Math.round(c.height) : null, "ft") + stat(c.ridecount, c.ridecount === 1 ? "ride" : "rides") + '</div>'
      + '<div class="info" onclick="event.stopPropagation();window.__tb.sheet(' + c.id + ')">i</div>' + (c.id === mine ? '<span class="tick">YOUR PICK</span>' : g.submitted_at ? '<span class="tick new">NEW</span>' : "") + '</div>';

    // the draft list
    const rowOf = (c, i, kind) => '<div class="pl ' + kind + '" data-id="' + c.id + '"><div class="rk" style="color:' + (kind ? "" : col(g.score)) + '">' + (i + 1) + '</div><div class="th" style="background-image:url(\'' + thumb(c.image, 480) + '\')"></div><div class="nm">' + esc(c.name) + '<small>' + (kind === "ghost" ? esc(live.by) + " is placing…" : esc(park(c.park))) + '</small></div>'
      + (kind === "new" ? '<div class="grip">⠿</div>' : kind === "ghost" ? "" : '<div class="grip">⠿</div><button class="x" title="Take it back out" onclick="window.__tb.unplace(' + c.id + ',\'' + esc(c.name).replace(/'/g, "\\'") + '\')">✕</button>') + '</div>';
    const complete = !open.length;
    const bigOf = (c, i) => '<div class="pl bc" data-id="' + c.id + '"><div class="img" style="background-image:url(\'' + thumb(c.image, 1200) + '\')"></div><div class="rk" style="color:' + col(g.score) + '">' + (i + 1) + '</div><div class="grip">⠿</div><div class="bot"><b>' + esc(c.name) + '</b><small>' + esc(park(c.park)) + (c.manufacturer ? ' · ' + esc(c.manufacturer) : "") + '</small></div><button class="x" title="Take it back out" onclick="window.__tb.unplace(' + c.id + ',\'' + esc(c.name).replace(/'/g, "\\'") + '\')">✕</button></div>';
    let rows = placed.map((c, i) => complete && !placing ? bigOf(c, i) : rowOf(c, i, ""));
    if (phase === "place") rows.splice(Math.min(Math.max((placing.pos || rows.length + 1) - 1, 0), rows.length), 0, rowOf(byId[placing.id], 0, "new"));
    if (phase === "watch") rows.splice(Math.min(live.pos - 1, rows.length), 0, rowOf(byId[live.id], 0, "ghost"));
    rows = rows.map((h, i) => h.replace(/<div class="rk"([^>]*)>\d+<\/div>/, '<div class="rk"$1>' + (i + 1) + '</div>'));
    const listHtml = (rows.length ? '<div class="placed' + (complete && !placing ? " big" : "") + '" id="placed">' + rows.join("") + '</div>' : "")
      + (complete && dirty ? '<div class="btns" style="margin-top:14px"><button style="width:100%;padding:16px;font-size:16px" onclick="window.__tb.submit()">Submit to site</button></div>' : "");

    // action bar
    let act = "";
    if (phase === "place") act = '<div class="verdict place">Drag <b>' + esc(byId[placing.id].name) + '</b> into place</div><div class="btns"><button class="sec" onclick="window.__tb.cancelPlace()">Back</button><button onclick="window.__tb.placeDone()">Done</button></div>';
    else if (phase === "watch") act = '<div class="verdict place"><b>' + esc(live.by) + '</b> is placing ' + esc(byId[live.id].name) + '</div>';
    else if (complete) act = '<div class="verdict ' + (dirty ? "match" : "onsite") + '">' + (dirty ? "LIST COMPLETE" : "ON THE SITE" + (g.submitted_at ? '<small>' + when(g.submitted_at) + '</small>' : "")) + '</div><div class="btns">' + (dirty ? '<button onclick="window.__tb.submit()">Submit to site</button>' : "") + '<button class="danger" onclick="window.__tb.reset()">Start over</button></div>';
    else if (phase === "pick") {
      const can = names.length >= 2;
      act = '<div class="verdict round">Round ' + g.round + '</div><div class="btns">' + (mine != null ? '<button class="sec" onclick="window.__tb.pick(null)">Clear my pick</button>' : "") + '<button ' + (can ? "" : "disabled") + ' onclick="window.__tb.reveal()">Reveal</button></div>';
    } else {
      const pk = names.map(nm => '<div class="pk ' + (nm === me ? "a" : "b") + '"><small>' + esc(nm) + '</small><b>' + esc(byId[picks[nm]] ? byId[picks[nm]].name : "?") + '</b></div>').join("");
      if (unanimous) act = '<div class="verdict match">MATCH</div><div class="picks">' + pk + '</div>';
      else {
        const uniq = [...new Set(vals)];
        act = '<div class="verdict split">NO MATCH</div><div class="picks">' + pk + '</div><div class="slots">' + uniq.map(id => { const cavers = names.filter(nm => picks[nm] !== id);
          return '<button class="slot" onclick="window.__tb.startPlace(' + id + ',\'' + esc(cavers.join(" + ")).replace(/'/g, "\\'") + '\')">Go with <b>' + esc(byId[id] ? byId[id].name : "?") + '</b><small>' + esc(cavers.join(" + ")) + ' caves</small></button>'; }).join("")
          + '</div><div class="btns"><button class="sec" onclick="window.__tb.again()">Argue, then pick again</button></div>';
      }
    }

    const s = stats(state.log || []);
    app.innerHTML = topbar(true) + '<div class="wrap">'
      + '<div class="ghead"><div class="sc" style="color:' + col(g.score) + '">' + fmtScore(g.score) + '</div><div class="hl">Tied at ' + fmtScore(g.score) + '</div></div>'
      + (rows.length ? '<h2 style="margin-top:0">' + (complete ? "The final list" : "The list") + '</h2>' : "") + listHtml
      + (phase === "pick" && open.length ? '<h2>Still to list</h2><div class="round"><b>Round ' + g.round + '</b>' + chips + '</div><div class="list">' + open.map(cand).join("") + '</div>' : "")
      + (phase === "pick" && s.rounds ? '<h2>Scoreboard</h2>' + statsHtml(s) + '<h2>Rounds</h2><div class="log">' + state.log.filter(l => l.result !== "submit").slice(0, 10).map(logLine).join("") + '</div>' : "")
      + '</div><div class="act"><div class="in">' + act + '</div></div>';
    if (phase === "place") { const row = $("#placed .pl.new"); if (row) { bindDrag(row, row, () => { if (placing) placing.pos = dropIndex() + 1; sendPlacing(); }); row.scrollIntoView({ block: "center" }); } }
    else if (phase === "pick" || complete) document.querySelectorAll("#placed .pl").forEach(r => { const grip = r.querySelector(".grip"); if (grip) bindDrag(r, grip, () => A.reorder()); });
  }

  // ---- dragging a row up and down the list: the row lifts, the others shift (same feel as the park rank lane)
  function bindDrag(row, handle, onDrop) {
    const box = row.parentElement;
    const renumber = () => [...box.querySelectorAll(".pl")].forEach((r, i) => { r.querySelector(".rk").textContent = i + 1; });
    handle.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault(); handle.setPointerCapture(e.pointerId);
      dragging = true; row.classList.add("lift"); buzz(10);
      const startY = e.clientY; let shift = 0, moved = false;
      const step = row.offsetHeight + (parseFloat(getComputedStyle(box).rowGap) || 6);
      const place = dy => { row.style.transform = "translateY(" + (dy + shift) + "px) scale(1.02)"; };
      const mv = ev => {
        const dy = ev.clientY - startY; place(dy);
        const r = row.getBoundingClientRect(), mid = r.top + r.height / 2;
        const prev = row.previousElementSibling, next = row.nextElementSibling;
        if (prev && prev.classList.contains("pl")) { const pr = prev.getBoundingClientRect(); if (mid < pr.top + pr.height / 2) { box.insertBefore(row, prev); shift += step; place(dy); renumber(); moved = true; buzz(8); if (onDrop) onDrop(true); return; } }
        if (next && next.classList.contains("pl")) { const nr = next.getBoundingClientRect(); if (mid > nr.top + nr.height / 2) { box.insertBefore(next, row); shift -= step; place(dy); renumber(); moved = true; buzz(8); if (onDrop) onDrop(true); } }
      };
      const up = () => { handle.removeEventListener("pointermove", mv); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up);
        row.style.transform = ""; row.classList.remove("lift"); dragging = false; renumber(); if (moved && onDrop) onDrop(false); };
      handle.addEventListener("pointermove", mv); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
    });
  }
  const listIds = () => [...document.querySelectorAll("#placed .pl")].map(r => Number(r.dataset.id));
  function dropIndex() { const rows = [...document.querySelectorAll("#placed .pl")]; const i = rows.findIndex(r => r.classList.contains("new")); return i < 0 ? rows.length : i; }
  // tell the other phone where the new row is now (throttled; fire and forget)
  let placingT = null;
  function sendPlacing() { if (!placing) return; clearTimeout(placingT); placingT = setTimeout(() => { if (placing) api({ action: "placing", score, name: me, coasterId: placing.id, position: dropIndex() + 1 }).catch(() => {}); }, 120); }

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
    skip.addEventListener("touchend", showAll, { passive: false }); skip.addEventListener("click", showAll);
    go.addEventListener("touchend", close, { passive: false }); go.addEventListener("click", close);
    ov.addEventListener("touchend", e => e.preventDefault(), { passive: false });
    t.push(setTimeout(close, 12000));
  }

  // ---- actions
  async function act(body) { if (busy) return; busy = true; actionSeq++; try { const d = await api({ score, ...body }); lastActionDone = Date.now(); if (d && d.group) { state = { ...state, ...d }; renderGroup(); } return d; } catch (e) { lastActionDone = Date.now(); } finally { busy = false; } }
  const A = {
    setName, changeName,
    toggleSettled: () => { showSettled = !showSettled; renderHome(); },
    pick: id => {
      if (state.group.revealed) return;
      const next = id === state.group.picks[me] ? null : id;
      const picks = { ...state.group.picks }; if (next === null) delete picks[me]; else picks[me] = next;
      state = { ...state, group: { ...state.group, picks } }; renderGroup();
      act({ action: "pick", name: me, coasterId: next });
    },
    reveal: () => act({ action: "reveal" }),
    again: () => act({ action: "again" }),
    startPlace: async (id, cavedBy) => {
      const order = state.group.order || [];
      if (!order.length) { act({ action: "lock", coasterId: id, position: 1, cavedBy: cavedBy || null }).then(() => toast("Listed")); return; }
      // claim the drag; if the other phone was first, we watch instead
      const d = await act({ action: "placing", name: me, coasterId: id, position: order.length + 1 });
      if (d && d.group && d.group.placing && d.group.placing.by === me) { placing = { id, cavedBy: cavedBy || null, pos: order.length + 1 }; lastKey = ""; renderGroup(); }
    },
    cancelPlace: () => { const p = placing; placing = null; lastKey = ""; act({ action: "placing", name: me, coasterId: null }); if (!p) renderGroup(); },
    placeDone: () => { const p = placing; if (!p) return; const pos = dropIndex() + 1; placing = null; act({ action: "lock", coasterId: p.id, position: pos, cavedBy: p.cavedBy }).then(() => toast("Listed at " + pos)); },
    reorder: () => act({ action: "reorder", order: listIds() }),
    unplace: (id, name) => { if (confirm("Take " + name + " back out of the list?")) act({ action: "unplace", coasterId: id }); },
    submit: () => { if (confirm("Put this order on the site?")) act({ action: "submit" }).then(() => toast("On the site")); },
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
    const ft = v => v == null ? null : Math.round(v) + " ft", mph = v => v == null ? null : Math.round(v) + " mph";
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
