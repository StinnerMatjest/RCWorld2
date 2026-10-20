import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { revalidateContent } from "@/app/lib/revalidate";
import { additions, candidates, coasterDetail, countAbove, ensureTiebreak, getGroup, logAuto, logFor, move, newRound, overview, place, players, reorder, resetGroup, seen, setPlacing, submit, sweepStale, unplace } from "@/app/lib/tiebreakStore";

// Live tiebreak tool (UI: app/tiebreak/route.ts + public/tiebreak.js).
// GET  /api/tiebreak                 -> { groups, players, log }           (home)
// GET  /api/tiebreak?score=7         -> { group (with draft order), candidates (with published tie_rank), above, players, log }
// GET  /api/tiebreak?coaster=123      -> { highlights, texts, photos, parkRank, parkTotal, visits, lastVisit }   (the stats sheet)
// POST /api/tiebreak  JSON { action, ... }  (admin cookie, enforced by middleware)
//   hello   { name }                                   presence heartbeat
//   pick    { score, name, coasterId }                 your hidden pick (null clears it)
//   reveal  { score }                                  needs two picks
//   lock    { score, coasterId, position?, cavedBy? }  put it into the DRAFT list (1 = top, default bottom),
//                                                      log match / caved / lock, next round
//   again   { score }                                  split, nobody caves: log it, next round
//   move    { score, coasterId, dir }                  one step up (-1) or down (+1) in the draft
//   reorder { score, order: [ids] }                    the whole draft order after a drag
//   placing { score, name, coasterId|null, position }  live marker: "name is dragging coasterId to position" (null clears)
//   unplace { score, coasterId }                       take a coaster back out of the draft
//   submit  { score }                                  publish the draft to the site (tie_rank) and revalidate
//   reset   { score }                                  clear draft, published order and the group's history
// Only submit and reset touch what the site shows.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

function parseScore(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 11 ? n : null;
}

async function groupPayload(score: number) {
  const [group, cands, above, ps, log] = await Promise.all([getGroup(score), candidates(score), countAbove(score), players(), logFor(score)]);
  return { group, candidates: cands, above, players: ps, log };
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  await ensureTiebreak();
  const c = Number(req.nextUrl.searchParams.get("coaster"));
  if (c) return NextResponse.json(await coasterDetail(c), NO_STORE);
  const s = req.nextUrl.searchParams.get("score");
  if (s === null) {
    await sweepStale();
    const [groups, ps, log, adds] = await Promise.all([overview(), players(), logFor(null), additions()]);
    return NextResponse.json({ groups, players: ps, log, additions: adds }, NO_STORE);
  }
  const score = parseScore(s);
  if (score === null) return bad("Bad score");
  return NextResponse.json(await groupPayload(score), NO_STORE);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return unauthorized();
  await ensureTiebreak();
  let body: any;
  try { body = await req.json(); } catch { return bad("Bad JSON"); }
  const action = String(body.action || "");
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";

  if (action === "hello") {
    if (!name) return bad("Name required");
    await seen(name);
    return NextResponse.json({ ok: true }, NO_STORE);
  }

  const score = parseScore(body.score);
  if (score === null) return bad("Bad score");
  const g = await getGroup(score);
  const idOf = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  switch (action) {
    case "pick": {
      if (!name) return bad("Name required");
      if (g.revealed) return bad("Already revealed, start a new round");
      // atomic jsonb merge / remove: two phones tapping at the same moment must not lose a pick
      if (body.coasterId === null || body.coasterId === undefined) {
        await pool.query(`UPDATE tiebreak_groups SET picks = picks - $2::text, updated_at = now() WHERE score = $1`, [score, name]);
      } else {
        const id = idOf(body.coasterId); if (id === null) return bad("Bad coasterId");
        const ok = await pool.query(`SELECT 1 FROM rollercoasters WHERE id = $1 AND rating = $2`, [id, score]);
        if (!ok.rowCount || g.order.includes(id)) return bad("Not a candidate in this group");
        await pool.query(`UPDATE tiebreak_groups SET picks = picks || $2::jsonb, updated_at = now() WHERE score = $1 AND revealed = false`, [score, JSON.stringify({ [name]: id })]);
      }
      await seen(name);
      break;
    }
    case "reveal": {
      if (Object.keys(g.picks).length < 2) return bad("Both of you need to pick first");
      await pool.query(`UPDATE tiebreak_groups SET revealed = true, updated_at = now() WHERE score = $1`, [score]);
      break;
    }
    case "lock": {
      const id = idOf(body.coasterId); if (id === null) return bad("coasterId required");
      const position = body.position == null ? null : idOf(body.position);
      const vals = Object.values(g.picks);
      const unanimous = vals.length >= 2 && vals.every(v => v === vals[0]) && vals[0] === id;
      const cavedBy = typeof body.cavedBy === "string" && body.cavedBy ? body.cavedBy.slice(0, 40) : null;
      const { slot, auto, already } = await place(score, id, position);
      if (!already) {   // a second phone pressing Done for the same coaster changes nothing
        await newRound(score, { result: unanimous ? "match" : cavedBy ? "caved" : "lock", coasterId: id, cavedBy });
        if (auto) await logAuto(score, auto);
      }
      return NextResponse.json({ ok: true, slot, auto, already, ...(await groupPayload(score)) }, NO_STORE);
    }
    case "again": {
      await newRound(score, Object.keys(g.picks).length >= 2 ? { result: "split" } : null);
      break;
    }
    case "reorder": {
      if (!Array.isArray(body.order)) return bad("order required");
      await reorder(score, body.order);
      break;
    }
    case "placing": {
      if (body.coasterId === null || body.coasterId === undefined) await setPlacing(score, null);
      else {
        const id = idOf(body.coasterId); if (id === null) return bad("Bad coasterId");
        // first phone to claim a coaster places it; the other one watches the ghost
        if (g.placing && g.placing.id === id && g.placing.by !== name) break;
        await setPlacing(score, { id, pos: Math.max(1, Number(body.position) || 1), by: name || "?" });
      }
      break;
    }
    case "move": {
      const id = idOf(body.coasterId); if (id === null) return bad("coasterId required");
      await move(score, id, Number(body.dir) < 0 ? -1 : 1);
      break;
    }
    case "unplace": {
      const id = idOf(body.coasterId); if (id === null) return bad("coasterId required");
      await unplace(score, id);
      await pool.query(`UPDATE tiebreak_groups SET picks = '{}'::jsonb, revealed = false, updated_at = now() WHERE score = $1`, [score]);
      break;
    }
    case "submit": {
      await submit(score);
      revalidateContent();
      break;
    }
    case "reset": {
      await resetGroup(score);
      revalidateContent();
      break;
    }
    default:
      return bad("Unknown action");
  }
  return NextResponse.json({ ok: true, ...(await groupPayload(score)) }, NO_STORE);
}
