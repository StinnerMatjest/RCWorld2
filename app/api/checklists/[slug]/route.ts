import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import {
  applyChecklistOps,
  closedSessionsSeconds,
  parseChecklistOp,
  stateFromChecklist,
  type ChecklistOp,
  type ChecklistState,
} from "@/app/lib/checklistOps";
import type { ChecklistItem, ChecklistSession } from "@/app/types";

// `rev` counts saved changes so a phone can tell a newer server copy from an
// older one that arrived late. `checklist_ops` keeps every change ever applied:
// it makes a resent change a no-op and lets lost notes be recovered by hand.
// Added in place; runs once per process.
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`ALTER TABLE checklists ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 0`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS checklist_ops (
          id SERIAL PRIMARY KEY,
          checklist_id INTEGER NOT NULL,
          op_id TEXT NOT NULL,
          client_id TEXT,
          op JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (checklist_id, op_id)
        )`);
    })().catch((err) => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

const COLS = `id, title, slug, description, items, visit_start, visit_end, duration, is_finished, park_id,
  COALESCE(sessions, '[]'::jsonb) AS sessions, COALESCE(notes, '{}'::jsonb) AS notes, rev`;

type Row = Record<string, unknown> & { id: number };

function toIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return typeof v === "string" ? v : null;
}

function normalize(row: Row): Row {
  return { ...row, visit_start: toIso(row.visit_start), visit_end: toIso(row.visit_end) };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    await ensureSchema();
    const result = await pool.query(`SELECT ${COLS} FROM checklists WHERE slug = $1`, [slug]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json(
      { checklist: normalize(result.rows[0]) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error fetching checklist:", error);
    return NextResponse.json({ error: "Failed to fetch checklist" }, { status: 500 });
  }
}

/**
 * Old pages (still open on a phone from before this change) send their whole
 * checklist. Merge it so it can only add: notes fill empty categories or extend
 * the stored text, ride counts and ticks only go up, and the timer only moves
 * forward. A stale copy can no longer erase anything.
 */
function mergeLegacyBody(state: ChecklistState, body: Record<string, unknown>): ChecklistState {
  const notes = { ...state.notes };
  if (body.notes && typeof body.notes === "object") {
    for (const [key, raw] of Object.entries(body.notes as Record<string, unknown>)) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const stored = notes[key] ?? "";
      if (!stored.trim() || (raw.startsWith(stored) && raw.length > stored.length)) notes[key] = raw;
    }
  }

  let items = state.items;
  if (Array.isArray(body.items)) {
    const incoming = new Map((body.items as ChecklistItem[]).filter(i => i && typeof i.id === "string").map(i => [i.id, i]));
    items = state.items.map((item) => {
      const inc = incoming.get(item.id);
      if (!inc) return item;
      const next = { ...item };
      const incCount = Number(inc.rideCount) || 0;
      if (incCount > (item.rideCount || 0)) {
        next.rideCount = incCount;
        if (inc.rideCountLastModified) next.rideCountLastModified = inc.rideCountLastModified;
      }
      if (inc.checked && !item.checked) next.checked = true;
      if (inc.skipped && !item.skipped && !item.checked && !(item.rideCount || 0)) next.skipped = true;
      return next;
    });
  }

  let { sessions, is_finished, visit_end, visit_start, duration } = state;
  const incSessions = Array.isArray(body.sessions) ? (body.sessions as ChecklistSession[]) : null;
  const extendsTimer =
    !!incSessions && incSessions.length > 0 &&
    (incSessions.length > sessions.length ||
      (incSessions.length === sessions.length && !!incSessions[incSessions.length - 1]?.end && !sessions[sessions.length - 1]?.end));
  if (incSessions && extendsTimer && !state.is_finished) {
    sessions = incSessions;
    visit_start = sessions[0]?.start ?? visit_start;
    duration = closedSessionsSeconds(sessions);
  }
  if (body.is_finished === true && !state.is_finished && sessions.length > 0) {
    is_finished = true;
    visit_end = (typeof body.visit_end === "string" && body.visit_end) || sessions[sessions.length - 1]?.end || null;
    duration = closedSessionsSeconds(sessions) || Number(body.duration) || duration;
  }

  return { items, notes, sessions, visit_start, visit_end, duration, is_finished };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isOpsBody = Array.isArray(body.ops);
  const ops: ChecklistOp[] = [];
  if (isOpsBody) {
    for (const raw of body.ops as unknown[]) {
      const op = parseChecklistOp(raw);
      if (!op) return NextResponse.json({ error: "Invalid checklist change" }, { status: 400 });
      ops.push(op);
    }
  }
  const clientId = typeof body.client === "string" ? body.client.slice(0, 80) : null;

  await ensureSchema();

  // Read, apply, then write only if nobody saved in between (rev unchanged).
  // That is two round trips per save. If another phone keeps winning the race,
  // fall back to locking the row, which always goes through.
  async function attempt(db: { query: typeof pool.query }, lock: boolean): Promise<Response | null> {
    const cur = await db.query(
      `SELECT ${COLS},
              (SELECT COALESCE(array_agg(op_id), '{}') FROM checklist_ops
                WHERE checklist_id = checklists.id AND op_id = ANY($2::text[])) AS seen_ops
       FROM checklists WHERE slug = $1${lock ? " FOR UPDATE" : ""}`,
      [slug, ops.map(o => o.id)]
    );
    if (cur.rows.length === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }
    const { seen_ops, ...rawRow } = cur.rows[0];
    const row = normalize(rawRow as Row);
    const state = stateFromChecklist(row);

    let next: ChecklistState;
    let logged: { op_id: string; op: unknown }[];
    if (isOpsBody) {
      // A phone resends a batch when the answer to the first try got lost; skip what is already in.
      const done = new Set<string>(seen_ops as string[]);
      const fresh = ops.filter(o => !done.has(o.id));
      if (fresh.length === 0) return NextResponse.json({ success: true, checklist: row });
      next = applyChecklistOps(state, fresh);
      logged = fresh.map(o => ({ op_id: o.id, op: o }));
    } else {
      next = mergeLegacyBody(state, body);
      logged = [{ op_id: `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, op: { t: "legacy", body } }];
    }

    const upd = await db.query(
      `WITH upd AS (
         UPDATE checklists
         SET items = $1::jsonb, notes = $2::jsonb, sessions = $3::jsonb,
             visit_start = $4, visit_end = $5, duration = $6, is_finished = $7, rev = rev + 1
         WHERE id = $8 AND rev = $9
         RETURNING ${COLS}
       ), logged AS (
         INSERT INTO checklist_ops (checklist_id, op_id, client_id, op)
         SELECT $8, x->>'op_id', $10, x->'op' FROM jsonb_array_elements($11::jsonb) x
         WHERE EXISTS (SELECT 1 FROM upd)
         ON CONFLICT (checklist_id, op_id) DO NOTHING
       )
       SELECT * FROM upd`,
      [
        JSON.stringify(next.items),
        JSON.stringify(next.notes),
        JSON.stringify(next.sessions),
        next.visit_start,
        next.visit_end,
        Math.round(next.duration) || 0,
        next.is_finished,
        row.id,
        Number(row.rev) || 0,
        clientId,
        JSON.stringify(logged),
      ]
    );
    if (upd.rows.length === 0) return null; // someone saved first
    return NextResponse.json({ success: true, checklist: normalize(upd.rows[0]) });
  }

  try {
    for (let i = 0; i < 2; i++) {
      const res = await attempt(pool, false);
      if (res) return res;
    }
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const res = await attempt(db, true);
      await db.query("COMMIT");
      return res ?? NextResponse.json({ error: "Checklist busy, try again" }, { status: 503 });
    } catch (error) {
      await db.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      db.release();
    }
  } catch (error) {
    console.error("Error updating checklist:", error);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const query = "DELETE FROM checklists WHERE slug = $1 RETURNING id";
    const result = await pool.query(query, [slug]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting checklist:", error);
    return NextResponse.json({ error: "Failed to delete checklist" }, { status: 500 });
  }
}
