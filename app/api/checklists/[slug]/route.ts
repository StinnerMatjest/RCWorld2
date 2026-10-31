import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import {
  closedSessionsSeconds,
  parseChecklistOp,
  type ChecklistOp,
  type ChecklistState,
} from "@/app/lib/checklistOps";
import { applyOpsToChecklist, CHECKLIST_COLS, ensureChecklistSchema, normalizeChecklistRow, saveChecklist, type ChecklistRow } from "@/app/lib/checklistStore";
import type { ChecklistItem, ChecklistSession } from "@/app/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    await ensureChecklistSchema();
    const result = await pool.query(`SELECT ${CHECKLIST_COLS} FROM checklists WHERE slug = $1`, [slug]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json(
      { checklist: normalizeChecklistRow(result.rows[0] as ChecklistRow) },
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

  return { ...state, items, notes, sessions, visit_start, visit_end, duration, is_finished };
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

  try {
    const res = isOpsBody
      ? await applyOpsToChecklist(slug, ops, clientId)
      : await saveChecklist(slug, [], clientId, (state) => ({
          next: mergeLegacyBody(state, body),
          logged: [{ op_id: `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, op: { t: "legacy", body } }],
        }));
    return NextResponse.json(res.body, { status: res.status });
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
