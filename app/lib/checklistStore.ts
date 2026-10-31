import { pool } from "@/app/lib/db";
import { applyChecklistOps, stateFromChecklist, type ChecklistOp, type ChecklistState } from "@/app/lib/checklistOps";

// `rev` counts saved changes so a phone can tell a newer server copy from an
// older one that arrived late. `checklist_ops` keeps every change ever applied:
// it makes a resent change a no-op and lets lost notes be recovered by hand.
// queues / downtime / ride_seen / live_links hold the queue timer and the live
// ride status of a visit. Added in place; runs once per process.
let schemaReady: Promise<void> | null = null;
export function ensureChecklistSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`ALTER TABLE checklists ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 0`);
      await pool.query(`ALTER TABLE checklists
        ADD COLUMN IF NOT EXISTS queues JSONB,
        ADD COLUMN IF NOT EXISTS downtime JSONB,
        ADD COLUMN IF NOT EXISTS ride_seen JSONB,
        ADD COLUMN IF NOT EXISTS live_links JSONB`);
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

export const CHECKLIST_COLS = `id, title, slug, description, items, visit_start, visit_end, duration, is_finished, park_id,
  COALESCE(sessions, '[]'::jsonb) AS sessions, COALESCE(notes, '{}'::jsonb) AS notes, rev,
  COALESCE(queues, '[]'::jsonb) AS queues, COALESCE(downtime, '[]'::jsonb) AS downtime,
  COALESCE(ride_seen, '{}'::jsonb) AS ride_seen, COALESCE(live_links, '{}'::jsonb) AS live_links`;

export type ChecklistRow = Record<string, unknown> & { id: number };

function toIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return typeof v === "string" ? v : null;
}

export function normalizeChecklistRow(row: ChecklistRow): ChecklistRow {
  return { ...row, visit_start: toIso(row.visit_start), visit_end: toIso(row.visit_end) };
}

export type SaveResult = { status: number; body: Record<string, unknown> };

/**
 * Applies changes to a stored checklist. `build` gets the current state and the
 * ids of the given operations already applied, and returns the new state plus
 * what to log (null: nothing to do). Read, apply, then write only if nobody saved
 * in between (rev unchanged); if another phone keeps winning that race, lock the
 * row instead, which always goes through.
 */
export async function saveChecklist(
  slug: string,
  opIds: string[],
  clientId: string | null,
  build: (state: ChecklistState, seen: Set<string>, row: ChecklistRow) => { next: ChecklistState; logged: { op_id: string; op: unknown }[] } | null,
): Promise<SaveResult> {
  await ensureChecklistSchema();

  async function attempt(db: { query: typeof pool.query }, lock: boolean): Promise<SaveResult | null> {
    const cur = await db.query(
      `SELECT ${CHECKLIST_COLS},
              (SELECT COALESCE(array_agg(op_id), '{}') FROM checklist_ops
                WHERE checklist_id = checklists.id AND op_id = ANY($2::text[])) AS seen_ops
       FROM checklists WHERE slug = $1${lock ? " FOR UPDATE" : ""}`,
      [slug, opIds]
    );
    if (cur.rows.length === 0) return { status: 404, body: { error: "Checklist not found" } };
    const { seen_ops, ...rawRow } = cur.rows[0];
    const row = normalizeChecklistRow(rawRow as ChecklistRow);
    const built = build(stateFromChecklist(row), new Set<string>(seen_ops as string[]), row);
    if (!built) return { status: 200, body: { success: true, checklist: row } };
    const { next, logged } = built;

    const upd = await db.query(
      `WITH upd AS (
         UPDATE checklists
         SET items = $1::jsonb, notes = $2::jsonb, sessions = $3::jsonb,
             visit_start = $4, visit_end = $5, duration = $6, is_finished = $7,
             queues = $12::jsonb, downtime = $13::jsonb, ride_seen = $14::jsonb, live_links = $15::jsonb,
             rev = rev + 1
         WHERE id = $8 AND rev = $9
         RETURNING ${CHECKLIST_COLS}
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
        JSON.stringify(next.queues),
        JSON.stringify(next.downtime),
        JSON.stringify(next.ride_seen),
        JSON.stringify(next.links),
      ]
    );
    if (upd.rows.length === 0) return null; // someone saved first
    return { status: 200, body: { success: true, checklist: normalizeChecklistRow(upd.rows[0]) } };
  }

  for (let i = 0; i < 2; i++) {
    const res = await attempt(pool, false);
    if (res) return res;
  }
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const res = await attempt(db, true);
    await db.query("COMMIT");
    return res ?? { status: 503, body: { error: "Checklist busy, try again" } };
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

/** Applies operations, skipping any already applied (a phone resending a batch whose answer got lost). */
export function applyOpsToChecklist(slug: string, ops: ChecklistOp[], clientId: string | null): Promise<SaveResult> {
  return saveChecklist(slug, ops.map(o => o.id), clientId, (state, seen) => {
    const fresh = ops.filter(o => !seen.has(o.id));
    if (fresh.length === 0) return null;
    return { next: applyChecklistOps(state, fresh), logged: fresh.map(o => ({ op_id: o.id, op: o })) };
  });
}
