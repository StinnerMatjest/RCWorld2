import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { applyChecklistOps, coasterName, stateFromChecklist, type ChecklistOp, type ChecklistState } from "@/app/lib/checklistOps";
import { CHECKLIST_COLS, ensureChecklistSchema, normalizeChecklistRow, saveChecklist, type ChecklistRow } from "@/app/lib/checklistStore";
import { matchCoasters, parkFeed, type FeedRide, type ParkFeed } from "@/app/lib/parkLive";
import type { ChecklistItem } from "@/app/types";

// GET /api/checklists/[slug]/live
//   -> { waits, status, tz, rides: [{ name, wait, status }], coasters: { [item]: { ride, wait, status } } }
// Posted waits and ride status for the visit's park (app/lib/parkLive.ts), with
// each coaster of the checklist matched to its ride in the feeds.
//
// While a visit runs, a request with the admin cookie also writes what the status
// shows into the checklist (app/lib/checklistOps.ts): a breakdown of a ride that
// was seen running (it goes into the ride operations note once the ride is back),
// and what each ride was seen as (rides never open go into park management when
// the visit is completed). Only ThemeParks.wiki tells a breakdown from a closure,
// so only its status is recorded.

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
/** How often, per checklist, the open/closed sighting of every ride is written. */
const SEEN_EVERY_MS = 5 * 60000;
const lastSeenWrite = new Map<string, number>();

function visitRunning(state: ChecklistState): boolean {
  const last = state.sessions[state.sessions.length - 1];
  return !state.is_finished && !!last && !last.end;
}

/** The status changes worth writing for this state, as operations (none: nothing to write). */
function statusOps(state: ChecklistState, feed: ParkFeed, nameOf: Map<string, string>, itemOf: Map<string, string>, withSeen: boolean): ChecklistOp[] {
  const at = new Date().toISOString();
  const stamp = Date.now().toString(36);
  const ops: ChecklistOp[] = [];
  const byName = new Map<string, FeedRide>(feed.rides.map(r => [nameOf.get(r.name) ?? r.name, r]));
  if (withSeen) {
    const rides: Record<string, { open: boolean; refurb?: boolean }> = {};
    for (const [name, r] of byName) rides[name] = { open: r.status === "open", ...(r.status === "refurb" ? { refurb: true } : {}) };
    ops.push({ id: `live-seen-${stamp}`, t: "seen", rides, at });
  }
  let n = 0;
  for (const [name, r] of byName) {
    const open = state.downtime.find(d => d.ride === name && !d.to);
    // A breakdown counts only for a ride seen running this visit: some parks report
    // rides that have not opened yet (or have closed for the night) as down.
    if (r.status === "down" && !open && state.ride_seen[name]?.open) {
      ops.push({ id: `live-down-${stamp}-${n++}`, t: "down", did: `d${stamp}${n}`, ride: name, item: itemOf.get(name) ?? null, at });
    } else if (r.status !== "down" && open) {
      ops.push({ id: `live-up-${stamp}-${n++}`, t: "up", ride: name, ...(feed.tz ? { tz: feed.tz } : {}), at });
    }
  }
  return ops;
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    await ensureChecklistSchema();
    const res = await pool.query(`SELECT ${CHECKLIST_COLS} FROM checklists WHERE slug = $1`, [slug]);
    if (!res.rows.length) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    const row = normalizeChecklistRow(res.rows[0] as ChecklistRow);
    const state = stateFromChecklist(row);
    let parkName = String(row.title ?? "").replace(/\s+\d{4}\s+visit$/i, "").trim();
    if (row.park_id) {
      const p = await pool.query<{ name: string }>(`SELECT name FROM parks WHERE id = $1`, [row.park_id]);
      if (p.rows[0]?.name) parkName = p.rows[0].name;
    }

    const feed = await parkFeed(parkName);
    const coasters = (state.items as ChecklistItem[]).filter(i => i.isCoaster && !i.isExtra).map(i => ({ item: i.id, name: coasterName(i.label) }));
    const matched = matchCoasters(coasters, feed.rides.map(r => r.name), state.links);
    const feedByName = new Map(feed.rides.map(r => [r.name, r]));
    const out: Record<string, { ride: string | null; wait: number | null; status: string | null }> = {};
    const nameOf = new Map<string, string>(), itemOf = new Map<string, string>();
    for (const c of coasters) {
      const ride = matched[c.item];
      const r = ride ? feedByName.get(ride) : undefined;
      out[c.item] = { ride: ride ?? null, wait: r?.wait ?? null, status: r?.status ?? null };
      if (ride) { nameOf.set(ride, c.name); itemOf.set(c.name, c.item); }
    }

    if (feed.status === "themeparks.wiki" && visitRunning(state) && (await isAdminRequest(req))) {
      const withSeen = Date.now() - (lastSeenWrite.get(slug) ?? 0) >= SEEN_EVERY_MS;
      if (statusOps(state, feed, nameOf, itemOf, withSeen).length) {
        // Worked out again on the stored copy at write time, so two phones asking at once write it once.
        await saveChecklist(slug, [], null, (fresh) => {
          if (!visitRunning(fresh)) return null;
          const ops = statusOps(fresh, feed, nameOf, itemOf, withSeen);
          return ops.length ? { next: applyChecklistOps(fresh, ops), logged: ops.map(o => ({ op_id: o.id, op: o })) } : null;
        });
        if (withSeen) lastSeenWrite.set(slug, Date.now());
      }
    }

    return NextResponse.json({ waits: feed.waits, status: feed.status, tz: feed.tz, rides: feed.rides, coasters: out }, NO_STORE);
  } catch (error) {
    console.error("Live ride data failed:", error);
    return NextResponse.json({ waits: null, status: null, tz: null, rides: [], coasters: {} }, NO_STORE);
  }
}
