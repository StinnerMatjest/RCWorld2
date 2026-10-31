import type { Checklist, ChecklistDown, ChecklistItem, ChecklistQueue, ChecklistRideSeen, ChecklistSession } from "@/app/types";

/**
 * Checklist edits travel as small operations ("one more ride on item X",
 * "add this line to the food note") instead of the whole checklist. The server
 * applies them to the stored row, and the phone applies its unsent ones on top
 * of the last server copy. Two phones, a stale tab or a dropped connection can
 * then only ever touch the field that was actually changed, and changes made on
 * both phones at once add up instead of replacing each other.
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
  queues: ChecklistQueue[];
  downtime: ChecklistDown[];
  ride_seen: Record<string, ChecklistRideSeen>;
  /** Coaster item -> ride name in the live feeds, set by hand where the names differ ("" = not in the feeds). */
  links: Record<string, string>;
};

export type ChecklistItemPatch = { checked?: boolean; skipped?: boolean; rideCount?: number; photoV?: boolean };

export type ChecklistOp =
  | { id: string; t: "item"; item: string; set: ChecklistItemPatch; at: string }
  /** One ride more or less: adds to whatever the count is when it lands. */
  | { id: string; t: "ride"; item: string; delta: 1 | -1; at: string }
  /** A whole note (the review modal's editor). */
  | { id: string; t: "note"; key: string; value: string; at: string }
  /** One line added to the end of a note. */
  | { id: string; t: "line"; key: string; text: string; at: string }
  /** One line of a note changed (`to` empty: removed). */
  | { id: string; t: "lineEdit"; key: string; from: string; to: string; at: string }
  | { id: string; t: "qstart"; qid: string; item: string; board: number | null; at: string }
  | { id: string; t: "qboard"; qid: string; board: number | null; at: string }
  | { id: string; t: "qlog"; qid: string; real: number; board: number | null; at: string }
  | { id: string; t: "qcancel"; qid: string; at: string }
  /** Live ride status (server): a ride went down, came back up, or was seen open or closed. */
  | { id: string; t: "down"; did: string; ride: string; item: string | null; at: string }
  | { id: string; t: "up"; ride: string; tz?: string; at: string }
  | { id: string; t: "seen"; rides: Record<string, { open: boolean; refurb?: boolean }>; at: string }
  | { id: string; t: "link"; item: string; ride: string; at: string }
  | { id: string; t: "start" | "pause" | "resume"; at: string }
  | { id: string; t: "complete"; tz?: string; at: string };

const TIMER_OPS = new Set(["start", "pause", "resume"]);
export const MAX_NOTE_LENGTH = 20000;
const MAX_LINE_LENGTH = 2000;

/** The review categories the visit writes into on its own (keys as in RatingModal). */
export const RIDE_OPERATIONS = "rideOperations";
export const PARK_MANAGEMENT = "parkManagement";

/** A ride is "closed all day" once the live status showed it closed this often, over this long, and never open. */
const CLOSED_POLLS = 3;
const CLOSED_SPAN_MS = 60 * 60000;

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
    queues: Array.isArray(c.queues) ? c.queues : [],
    downtime: Array.isArray(c.downtime) ? c.downtime : [],
    ride_seen: c.ride_seen && typeof c.ride_seen === "object" ? c.ride_seen : {},
    links: c.live_links && typeof c.live_links === "object" ? c.live_links : {},
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

/** A coaster item's name ("Take picture of Toutatis" -> "Toutatis"). */
export const coasterName = (label: string) => label.replace(/^take (a )?picture of /i, "").trim();

/** A note's lines, as the checklist shows them. */
export function noteLines(note: string | undefined): string[] {
  return (note ?? "").split("\n").map(l => l.trim()).filter(Boolean);
}

/** The note with one more line at the end (a line already there is not added twice). */
function withLine(note: string | undefined, text: string): string {
  const cur = note ?? "";
  if (noteLines(cur).includes(text.trim())) return cur;
  return cur.trim() ? `${cur.replace(/\s+$/, "")}\n${text.trim()}` : text.trim();
}

/** Clock time in the park's (or the phone's) time zone. */
export function clockTime(iso: string, tz?: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, ...(tz ? { timeZone: tz } : {}) }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  }
}

const minutesBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Applies operations in order. Pure: returns a new state and never mutates the input. */
export function applyChecklistOps(state: ChecklistState, ops: readonly ChecklistOp[]): ChecklistState {
  if (ops.length === 0) return state;
  let items = state.items;
  let itemsCopied = false;
  let notes = state.notes;
  let sessions = state.sessions;
  let isFinished = state.is_finished;
  let timerChanged = false;
  let queues = state.queues;
  let downtime = state.downtime;
  let rideSeen = state.ride_seen;
  let links = state.links;

  const editItem = (id: string, fn: (i: ChecklistItem) => ChecklistItem) => {
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return;
    if (!itemsCopied) { items = items.slice(); itemsCopied = true; }
    items[idx] = fn({ ...items[idx] });
  };
  const addLine = (key: string, text: string) => { notes = { ...notes, [key]: withLine(notes[key], text) }; };
  const editQueue = (qid: string, fn: (q: ChecklistQueue) => ChecklistQueue) => {
    queues = queues.map(q => (q.id === qid ? fn({ ...q }) : q));
  };
  const isOpenQueue = (q: ChecklistQueue) => !q.cancelled && q.real == null;

  for (const op of ops) {
    switch (op.t) {
      case "item":
        editItem(op.item, (next) => {
          if (typeof op.set.checked === "boolean") next.checked = op.set.checked;
          if (typeof op.set.skipped === "boolean") next.skipped = op.set.skipped;
          if (typeof op.set.photoV === "boolean") next.photoV = op.set.photoV;
          if (typeof op.set.rideCount === "number") {
            next.rideCount = Math.max(0, Math.round(op.set.rideCount));
            next.rideCountLastModified = op.at;
          }
          return next;
        });
        break;
      case "ride":
        editItem(op.item, (next) => {
          next.rideCount = Math.max(0, (Number(next.rideCount) || 0) + op.delta);
          next.rideCountLastModified = op.at;
          return next;
        });
        break;
      case "note":
        notes = { ...notes, [op.key]: op.value };
        break;
      case "line":
        addLine(op.key, op.text);
        break;
      case "lineEdit": {
        const lines = (notes[op.key] ?? "").split("\n");
        const idx = lines.findIndex(l => l.trim() === op.from.trim());
        if (idx === -1) break;
        if (op.to.trim()) lines[idx] = op.to.trim();
        else lines.splice(idx, 1);
        notes = { ...notes, [op.key]: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
        break;
      }
      case "qstart":
        // One queue at a time: joining another line ends the one before without logging it.
        if (queues.some(q => q.id === op.qid)) break;
        queues = [...queues.map(q => (isOpenQueue(q) ? { ...q, cancelled: true } : q)), { id: op.qid, item: op.item, start: op.at, board: op.board }];
        break;
      case "qboard":
        editQueue(op.qid, (q) => ({ ...q, board: op.board }));
        break;
      case "qlog":
        editQueue(op.qid, (q) => (isOpenQueue(q) ? { ...q, real: op.real, board: op.board, end: op.at } : q));
        break;
      case "qcancel":
        editQueue(op.qid, (q) => (isOpenQueue(q) ? { ...q, cancelled: true } : q));
        break;
      case "down":
        if (downtime.some(d => d.ride === op.ride && !d.to)) break;
        downtime = [...downtime, { id: op.did, ride: op.ride, item: op.item, from: op.at }];
        break;
      case "up": {
        const open = downtime.find(d => d.ride === op.ride && !d.to);
        if (!open) break;
        downtime = downtime.map(d => (d === open ? { ...d, to: op.at } : d));
        // The breakdown goes straight into the ride operations note.
        addLine(RIDE_OPERATIONS, `${op.ride} was down for ${plural(minutesBetween(open.from, op.at), "minute")} (${clockTime(open.from, op.tz)}–${clockTime(op.at, op.tz)}).`);
        break;
      }
      case "seen": {
        const next = { ...rideSeen };
        for (const [ride, s] of Object.entries(op.rides)) {
          const cur: ChecklistRideSeen = { ...(next[ride] ?? { open: false, closedPolls: 0 }) };
          if (s.open) cur.open = true;
          else {
            cur.closedPolls += 1;
            cur.firstClosed = cur.firstClosed ?? op.at;
            cur.lastClosed = op.at;
            if (s.refurb) cur.refurb = true;
          }
          next[ride] = cur;
        }
        rideSeen = next;
        break;
      }
      case "link":
        links = { ...links, [op.item]: op.ride };
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
        // What the day's live data says, written into the notes once, as the visit ends.
        for (const d of downtime) {
          if (!d.to) addLine(RIDE_OPERATIONS, `${d.ride} went down at ${clockTime(d.from, op.tz)} and was still down when we left.`);
        }
        downtime = downtime.map(d => (d.to ? d : { ...d, to: op.at }));
        for (const [ride, s] of Object.entries(rideSeen)) {
          const span = s.firstClosed && s.lastClosed ? Date.parse(s.lastClosed) - Date.parse(s.firstClosed) : 0;
          if (!s.open && s.closedPolls >= CLOSED_POLLS && span >= CLOSED_SPAN_MS) {
            addLine(PARK_MANAGEMENT, s.refurb ? `${ride} was closed for refurbishment.` : `${ride} was closed all day.`);
          }
        }
        const timed = queues.filter(q => !q.cancelled && q.real != null && q.board != null && q.board > 0);
        const real = timed.reduce((a, q) => a + (q.real ?? 0), 0), board = timed.reduce((a, q) => a + (q.board ?? 0), 0);
        if (timed.length >= 2 && real > board * 1.05) {
          addLine(RIDE_OPERATIONS, `Real waits were ${Math.round((real / board - 1) * 100)}% longer than posted (${plural(timed.length, "queue")} timed).`);
        }
        queues = queues.map(q => (isOpenQueue(q) ? { ...q, cancelled: true } : q));
        break;
      }
    }
  }

  const rest = { items, notes, queues, downtime, ride_seen: rideSeen, links };
  if (!timerChanged) return { ...state, ...rest };
  return {
    ...rest,
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
const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const minutes = (v: unknown): number | null | undefined =>
  v === null ? null : typeof v === "number" && Number.isFinite(v) ? Math.min(600, Math.max(0, Math.round(v))) : undefined;
const NOTE_KEY = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const TZ = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;

/** Server-side validation. Returns null for anything malformed. */
export function parseChecklistOp(raw: unknown): ChecklistOp | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!str(o.id, 80)) return null;
  if (!isIso(o.at)) return null;
  const id = o.id, at = o.at;
  const tz = typeof o.tz === "string" && TZ.test(o.tz) && o.tz.length <= 60 ? o.tz : undefined;
  switch (o.t) {
    case "item": {
      if (!str(o.item, 120)) return null;
      const s = (o.set ?? {}) as Record<string, unknown>;
      const set: ChecklistItemPatch = {};
      if (typeof s.checked === "boolean") set.checked = s.checked;
      if (typeof s.skipped === "boolean") set.skipped = s.skipped;
      if (typeof s.photoV === "boolean") set.photoV = s.photoV;
      if (typeof s.rideCount === "number" && Number.isFinite(s.rideCount)) {
        set.rideCount = Math.min(999, Math.max(0, Math.round(s.rideCount)));
      }
      if (Object.keys(set).length === 0) return null;
      return { id, t: "item", item: o.item, set, at };
    }
    case "ride":
      if (!str(o.item, 120) || (o.delta !== 1 && o.delta !== -1)) return null;
      return { id, t: "ride", item: o.item, delta: o.delta, at };
    case "note":
      if (typeof o.key !== "string" || !NOTE_KEY.test(o.key) || typeof o.value !== "string") return null;
      return { id, t: "note", key: o.key, value: o.value.slice(0, MAX_NOTE_LENGTH), at };
    case "line":
      if (typeof o.key !== "string" || !NOTE_KEY.test(o.key) || !str(o.text, MAX_LINE_LENGTH) || !o.text.trim()) return null;
      return { id, t: "line", key: o.key, text: o.text, at };
    case "lineEdit":
      if (typeof o.key !== "string" || !NOTE_KEY.test(o.key) || !str(o.from, MAX_LINE_LENGTH) || typeof o.to !== "string" || o.to.length > MAX_LINE_LENGTH) return null;
      return { id, t: "lineEdit", key: o.key, from: o.from, to: o.to, at };
    case "qstart": {
      const board = minutes(o.board);
      if (!str(o.qid, 80) || !str(o.item, 120) || board === undefined) return null;
      return { id, t: "qstart", qid: o.qid, item: o.item, board, at };
    }
    case "qboard": {
      const board = minutes(o.board);
      if (!str(o.qid, 80) || board === undefined) return null;
      return { id, t: "qboard", qid: o.qid, board, at };
    }
    case "qlog": {
      const board = minutes(o.board), real = minutes(o.real);
      if (!str(o.qid, 80) || board === undefined || real == null) return null;
      return { id, t: "qlog", qid: o.qid, real, board, at };
    }
    case "qcancel":
      if (!str(o.qid, 80)) return null;
      return { id, t: "qcancel", qid: o.qid, at };
    case "down":
      if (!str(o.did, 80) || !str(o.ride, 120) || (o.item !== null && !str(o.item, 120))) return null;
      return { id, t: "down", did: o.did, ride: o.ride, item: (o.item as string | null), at };
    case "up":
      if (!str(o.ride, 120)) return null;
      return { id, t: "up", ride: o.ride, ...(tz ? { tz } : {}), at };
    case "seen": {
      if (!o.rides || typeof o.rides !== "object") return null;
      const rides: Record<string, { open: boolean; refurb?: boolean }> = {};
      for (const [k, v] of Object.entries(o.rides as Record<string, unknown>).slice(0, 200)) {
        if (!str(k, 120) || !v || typeof v !== "object") return null;
        const r = v as Record<string, unknown>;
        rides[k] = { open: r.open === true, ...(r.refurb === true ? { refurb: true } : {}) };
      }
      return { id, t: "seen", rides, at };
    }
    case "link":
      if (!str(o.item, 120) || typeof o.ride !== "string" || o.ride.length > 160) return null;
      return { id, t: "link", item: o.item, ride: o.ride, at };
    case "complete":
      return { id, t: "complete", ...(tz ? { tz } : {}), at };
  }
  if (typeof o.t === "string" && TIMER_OPS.has(o.t)) {
    return { id, t: o.t as "start" | "pause" | "resume", at };
  }
  return null;
}
