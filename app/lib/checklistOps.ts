import type { Checklist, ChecklistItem, ChecklistSession } from "@/app/types";

/**
 * Checklist edits travel as small operations ("ride count of item X is now 3",
 * "note for food is now …") instead of the whole checklist. The server applies
 * them to the stored row, and the phone applies its unsent ones on top of the
 * last server copy. Two phones, a stale tab or a dropped connection can then
 * only ever touch the field that was actually changed: the old full-state save
 * let any out-of-date copy wipe notes and ride counts written elsewhere.
 *
 * Shared by the API route and the checklist page so both sides agree exactly.
 */

export type ChecklistState = {
  items: ChecklistItem[];
  notes: Record<string, string>;
  sessions: ChecklistSession[];
  visit_start: string | null;
  visit_end: string | null;
  duration: number;
  is_finished: boolean;
};

export type ChecklistItemPatch = { checked?: boolean; skipped?: boolean; rideCount?: number };

export type ChecklistOp =
  | { id: string; t: "item"; item: string; set: ChecklistItemPatch; at: string }
  | { id: string; t: "note"; key: string; value: string; at: string }
  | { id: string; t: "start" | "pause" | "resume" | "complete"; at: string };

const TIMER_OPS = new Set(["start", "pause", "resume", "complete"]);
export const MAX_NOTE_LENGTH = 20000;

/** The editable part of a stored checklist, with old start/end-only rows migrated to sessions. */
export function stateFromChecklist(c: Partial<Checklist>): ChecklistState {
  let sessions: ChecklistSession[] = Array.isArray(c.sessions) ? c.sessions : [];
  if (sessions.length === 0 && c.visit_start) {
    sessions = [{ start: c.visit_start, end: c.is_finished ? (c.visit_end ?? null) : null }];
  }
  const notes: Record<string, string> = {};
  if (c.notes && typeof c.notes === "object") {
    for (const [k, v] of Object.entries(c.notes)) if (typeof v === "string") notes[k] = v;
  }
  return {
    items: Array.isArray(c.items) ? c.items : [],
    notes,
    sessions,
    visit_start: c.visit_start ?? sessions[0]?.start ?? null,
    visit_end: c.visit_end ?? null,
    duration: Number(c.duration) || 0,
    is_finished: !!c.is_finished,
  };
}

/** Seconds spent in closed sessions (a running session is counted live by the page). */
export function closedSessionsSeconds(sessions: ChecklistSession[]): number {
  let sum = 0;
  for (const s of sessions) {
    if (!s.end) continue;
    sum += Math.max(0, Math.floor((Date.parse(s.end) - Date.parse(s.start)) / 1000));
  }
  return sum;
}

function laterIso(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/** Applies operations in order. Pure: returns a new state and never mutates the input. */
export function applyChecklistOps(state: ChecklistState, ops: readonly ChecklistOp[]): ChecklistState {
  if (ops.length === 0) return state;
  let items = state.items;
  let itemsCopied = false;
  let notes = state.notes;
  let sessions = state.sessions;
  let isFinished = state.is_finished;
  let timerChanged = false;

  for (const op of ops) {
    switch (op.t) {
      case "item": {
        const idx = items.findIndex(i => i.id === op.item);
        if (idx === -1) break;
        if (!itemsCopied) { items = items.slice(); itemsCopied = true; }
        const next: ChecklistItem = { ...items[idx] };
        if (typeof op.set.checked === "boolean") next.checked = op.set.checked;
        if (typeof op.set.skipped === "boolean") next.skipped = op.set.skipped;
        if (typeof op.set.rideCount === "number") {
          next.rideCount = Math.max(0, Math.round(op.set.rideCount));
          next.rideCountLastModified = op.at;
        }
        items[idx] = next;
        break;
      }
      case "note":
        notes = { ...notes, [op.key]: op.value };
        break;
      case "start":
        if (sessions.length === 0) {
          sessions = [{ start: op.at, end: null }];
          isFinished = false;
          timerChanged = true;
        }
        break;
      case "pause": {
        const last = sessions[sessions.length - 1];
        if (last && !last.end && !isFinished) {
          sessions = [...sessions.slice(0, -1), { ...last, end: laterIso(op.at, last.start) }];
          timerChanged = true;
        }
        break;
      }
      case "resume": {
        const last = sessions[sessions.length - 1];
        if (last && last.end && !isFinished) {
          sessions = [...sessions, { start: laterIso(op.at, last.end), end: null }];
          timerChanged = true;
        }
        break;
      }
      case "complete": {
        const last = sessions[sessions.length - 1];
        if (isFinished || !last) break;
        if (!last.end) sessions = [...sessions.slice(0, -1), { ...last, end: laterIso(op.at, last.start) }];
        isFinished = true;
        timerChanged = true;
        break;
      }
    }
  }

  if (!timerChanged) return { ...state, items, notes };
  return {
    items,
    notes,
    sessions,
    visit_start: sessions[0]?.start ?? null,
    visit_end: isFinished ? (sessions[sessions.length - 1]?.end ?? null) : null,
    duration: closedSessionsSeconds(sessions),
    is_finished: isFinished,
  };
}

function isIso(v: unknown): v is string {
  return typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
}

/** Server-side validation. Returns null for anything malformed. */
export function parseChecklistOp(raw: unknown): ChecklistOp | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 80) return null;
  if (!isIso(o.at)) return null;
  if (o.t === "item") {
    if (typeof o.item !== "string" || o.item.length > 120) return null;
    const s = (o.set ?? {}) as Record<string, unknown>;
    const set: ChecklistItemPatch = {};
    if (typeof s.checked === "boolean") set.checked = s.checked;
    if (typeof s.skipped === "boolean") set.skipped = s.skipped;
    if (typeof s.rideCount === "number" && Number.isFinite(s.rideCount)) {
      set.rideCount = Math.min(999, Math.max(0, Math.round(s.rideCount)));
    }
    if (Object.keys(set).length === 0) return null;
    return { id: o.id, t: "item", item: o.item, set, at: o.at };
  }
  if (o.t === "note") {
    if (typeof o.key !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(o.key)) return null;
    if (typeof o.value !== "string") return null;
    return { id: o.id, t: "note", key: o.key, value: o.value.slice(0, MAX_NOTE_LENGTH), at: o.at };
  }
  if (typeof o.t === "string" && TIMER_OPS.has(o.t)) {
    return { id: o.id, t: o.t as "start" | "pause" | "resume" | "complete", at: o.at };
  }
  return null;
}
