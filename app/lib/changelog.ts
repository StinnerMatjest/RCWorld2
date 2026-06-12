import { pool } from "@/app/lib/db";

// Site-wide changelog. Every content mutation (ratings, texts, images, parks,
// coasters) calls logChange() after a successful write. Entries are admin-only
// and power /changelog with its park filter.

export type ChangeAction = "create" | "update" | "delete" | "publish" | "unpublish";

export type EntityType =
  | "park"
  | "rating"
  | "park_text"
  | "image"
  | "coaster"
  | "coaster_text"
  | "coaster_spec"
  | "coaster_highlight";

export type FieldDiff = Record<string, { old: unknown; new: unknown }>;

export type ChangeEntry = {
  parkId?: number | null;
  entityType: EntityType;
  entityId?: number | null;
  /** Name snapshot ("Phantasialand", "Taron") so entries survive deletes. */
  label?: string | null;
  action: ChangeAction;
  /** Human-readable line shown in the timeline. */
  summary: string;
  /** Structured old/new values for changed fields. */
  details?: object | null;
};

// Fire-and-forget: a failed log write must never fail the actual save.
export function logChange(entry: ChangeEntry): void {
  pool
    .query(
      `INSERT INTO changelog (park_id, entity_type, entity_id, entity_label, action, summary, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.parkId ?? null,
        entry.entityType,
        entry.entityId ?? null,
        entry.label ?? null,
        entry.action,
        entry.summary,
        entry.details ? JSON.stringify(entry.details) : null,
      ]
    )
    .catch((err) => console.error("changelog write failed:", err));
}

/**
 * Compare an existing row against incoming values and return only the fields
 * that actually changed. Keys are the incoming (camelCase) names; pass a map
 * when the DB column is spelled differently. Incoming `undefined` means
 * "not part of this save" and is skipped.
 */
export function diffFields(
  oldRow: Record<string, unknown>,
  incoming: Record<string, unknown>,
  columnMap: Record<string, string> = {}
): FieldDiff {
  const diff: FieldDiff = {};
  for (const [key, newVal] of Object.entries(incoming)) {
    if (newVal === undefined) continue;
    const oldVal = oldRow[columnMap[key] ?? key.toLowerCase()];
    if (!sameValue(oldVal, newVal)) diff[key] = { old: oldVal ?? null, new: newVal };
  }
  return diff;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  // pg returns numerics as strings and dates as Date objects; compare loosely.
  if (a instanceof Date || b instanceof Date) {
    return new Date(a as string).getTime() === new Date(b as string).getTime();
  }
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

/** "food 7 → 8, rideOperations 6 → 7" — values trimmed so long text stays readable. */
export function describeDiff(diff: FieldDiff): string {
  return Object.entries(diff)
    .map(([field, { old, new: next }]) => `${field} ${short(old)} → ${short(next)}`)
    .join(", ");
}

function short(value: unknown): string {
  if (value == null || value === "") return "∅";
  const s = String(value);
  return s.length > 40 ? s.slice(0, 37) + "…" : s;
}

export async function getParkName(parkId: number): Promise<string | null> {
  try {
    const r = await pool.query(`SELECT name FROM parks WHERE id = $1`, [parkId]);
    return r.rows[0]?.name ?? null;
  } catch {
    return null;
  }
}

/** Resolve a coaster's name and owning park in one query. */
export async function getCoasterContext(
  coasterId: number
): Promise<{ name: string | null; parkId: number | null; parkName: string | null }> {
  try {
    const r = await pool.query(
      `SELECT c.name, c.park_id, p.name AS park_name
       FROM rollercoasters c LEFT JOIN parks p ON p.id = c.park_id
       WHERE c.id = $1`,
      [coasterId]
    );
    const row = r.rows[0];
    return {
      name: row?.name ?? null,
      parkId: row?.park_id ?? null,
      parkName: row?.park_name ?? null,
    };
  } catch {
    return { name: null, parkId: null, parkName: null };
  }
}
