"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Checklist } from "@/app/types";
import {
  applyChecklistOps,
  stateFromChecklist,
  type ChecklistItemPatch,
  type ChecklistOp,
  type ChecklistState,
} from "@/app/lib/checklistOps";

/**
 * Keeps a checklist in sync across phones and bad park reception.
 *
 * Every tap or keystroke becomes a small operation that is written to this
 * phone's storage first and only removed once the server has confirmed it, so
 * a dead connection, a killed tab or switching to the camera can't lose it.
 * What the page shows is the latest server copy with the unconfirmed
 * operations applied on top. The server copy is refreshed every few seconds
 * while the page is open, so a second phone's ride counts and notes show up.
 */

export type SyncStatus = "saved" | "saving" | "offline" | "unauthorized";

const POLL_MS = 8000;
const NOTE_DEBOUNCE_MS = 700;
const RETRY_STEPS_MS = [2000, 4000, 8000, 15000];

type Snapshot = { state: ChecklistState; rev: number };
// Omit that keeps the union apart, so each operation keeps its own fields.
type OpInput = ChecklistOp extends infer O ? (O extends ChecklistOp ? Omit<O, "id" | "at"> : never) : never;

function outboxKey(slug: string) {
  return `pr-checklist-outbox:${slug}`;
}

function readOutbox(slug: string): ChecklistOp[] {
  try {
    const raw = window.localStorage.getItem(outboxKey(slug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(slug: string, ops: ChecklistOp[]) {
  try {
    if (ops.length === 0) window.localStorage.removeItem(outboxKey(slug));
    else window.localStorage.setItem(outboxKey(slug), JSON.stringify(ops));
  } catch {
    // Storage full or blocked: the operations still live in memory and get sent.
  }
}

function randomId() {
  try {
    return crypto.randomUUID().slice(0, 13);
  } catch {
    return Math.random().toString(36).slice(2, 15);
  }
}

export function useChecklistSync(checklist: Checklist) {
  const slug = checklist.slug;
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    state: stateFromChecklist(checklist),
    rev: Number(checklist.rev) || 0,
  }));
  const snapshotRef = useRef(snapshot);
  const outboxRef = useRef<ChecklistOp[]>([]);
  const [outboxVersion, setOutboxVersion] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("saved");

  const clientIdRef = useRef<string>("");
  const opCounterRef = useRef(0);
  const flushingRef = useRef(false);
  const flushAgainRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryStepRef = useRef(0);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unauthorizedRef = useRef(false);

  const bump = useCallback(() => setOutboxVersion(v => v + 1), []);

  const acceptServerCopy = useCallback((row: Checklist | undefined) => {
    if (!row) return;
    const rev = Number(row.rev) || 0;
    if (rev < snapshotRef.current.rev) return; // an older answer that arrived late
    const next = { state: stateFromChecklist(row), rev };
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  /** Current truth for this phone: server copy plus everything not yet confirmed. */
  const current = useCallback(
    () => applyChecklistOps(snapshotRef.current.state, outboxRef.current),
    []
  );

  const flush = useCallback(async (opts?: { keepalive?: boolean }) => {
    if (flushingRef.current) { flushAgainRef.current = true; return; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    const batch = outboxRef.current.slice();
    if (batch.length === 0) { setStatus(unauthorizedRef.current ? "unauthorized" : "saved"); return; }

    flushingRef.current = true;
    let ok = false;
    try {
      const body = JSON.stringify({ ops: batch, client: clientIdRef.current });
      const res = await fetch(`/api/checklists/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        // Lets the save finish while the phone switches to the camera or locks.
        keepalive: !!opts?.keepalive && body.length < 60000,
      });
      if (res.status === 401) {
        unauthorizedRef.current = true;
        setStatus("unauthorized");
        return; // keep everything on the phone until someone logs in
      }
      if (res.status === 404) {
        outboxRef.current = [];
        writeOutbox(slug, []);
        ok = true;
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sent = new Set(batch.map(o => o.id));
      outboxRef.current = outboxRef.current.filter(o => !sent.has(o.id));
      writeOutbox(slug, outboxRef.current);
      unauthorizedRef.current = false;
      acceptServerCopy(data.checklist);
      retryStepRef.current = 0;
      ok = true;
    } catch {
      if (!unauthorizedRef.current) setStatus("offline");
      const delay = RETRY_STEPS_MS[Math.min(retryStepRef.current, RETRY_STEPS_MS.length - 1)];
      retryStepRef.current += 1;
      retryTimerRef.current = setTimeout(() => { retryTimerRef.current = null; void flush(); }, delay);
    } finally {
      flushingRef.current = false;
      bump();
      if (ok) {
        if (outboxRef.current.length > 0 || flushAgainRef.current) {
          flushAgainRef.current = false;
          void flush();
        } else {
          setStatus("saved");
        }
      } else {
        flushAgainRef.current = false;
      }
    }
  }, [slug, acceptServerCopy, bump]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/checklists/${slug}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      acceptServerCopy(data.checklist);
    } catch {
      // Offline: the next poll tries again.
    }
  }, [slug, acceptServerCopy]);

  const enqueue = useCallback((op: OpInput, opts?: { debounce?: number }) => {
    const full = {
      ...op,
      id: `${clientIdRef.current}-${(opCounterRef.current += 1).toString(36)}-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
    } as ChecklistOp;

    const ops = outboxRef.current;
    // Typing produces one operation per keystroke. A note carries the whole
    // text, so a newer one replaces the older unconfirmed one for the same
    // category (if that one is mid-flight it still lands, and this follows it).
    if (full.t === "note") {
      for (let i = ops.length - 1; i >= 0; i--) {
        const o = ops[i];
        if (o.t === "note" && o.key === full.key) { ops.splice(i, 1); break; }
      }
    }
    ops.push(full);
    writeOutbox(slug, ops);
    bump();
    setStatus(s => (s === "unauthorized" || s === "offline" ? s : "saving"));

    if (noteTimerRef.current) { clearTimeout(noteTimerRef.current); noteTimerRef.current = null; }
    if (opts?.debounce) {
      noteTimerRef.current = setTimeout(() => { noteTimerRef.current = null; void flush(); }, opts.debounce);
    } else {
      void flush();
    }
  }, [slug, bump, flush]);

  // Pick up anything a previous visit to this page left unsent, then get the
  // newest server copy (the props can be a cached copy after back navigation).
  useEffect(() => {
    clientIdRef.current = randomId();
    outboxRef.current = readOutbox(slug);
    bump();
    void refresh();
    if (outboxRef.current.length > 0) void flush();
    // Warn before anything is typed when this phone can't save.
    fetch("/api/authenticate", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d && d.admin === false) { unauthorizedRef.current = true; setStatus("unauthorized"); }
      })
      .catch(() => {});
  }, [slug, bump, refresh, flush]);

  // Poll while visible; sync on return to the tab, on reconnect and when leaving.
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && !flushingRef.current) void refresh();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        if (outboxRef.current.length > 0) void flush();
      } else if (outboxRef.current.length > 0) {
        if (noteTimerRef.current) { clearTimeout(noteTimerRef.current); noteTimerRef.current = null; }
        void flush({ keepalive: true });
      }
    };
    const onOnline = () => { retryStepRef.current = 0; void flush(); void refresh(); };
    const onPageHide = () => { if (outboxRef.current.length > 0) void flush({ keepalive: true }); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    };
  }, [refresh, flush]);

  const view = useMemo(
    () => applyChecklistOps(snapshot.state, outboxRef.current),
    // outboxVersion changes whenever the outbox does
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, outboxVersion]
  );

  const actions = useMemo(() => ({
    setItem(item: string, set: ChecklistItemPatch) {
      enqueue({ t: "item", item, set });
    },
    changeRideCount(item: string, delta: number) {
      const found = current().items.find(i => i.id === item);
      if (!found) return;
      enqueue({ t: "item", item, set: { rideCount: Math.max(0, (found.rideCount || 0) + delta) } });
    },
    toggleSkip(item: string) {
      const found = current().items.find(i => i.id === item);
      if (!found) return;
      enqueue({ t: "item", item, set: { skipped: !found.skipped } });
    },
    setNote(key: string, value: string) {
      enqueue({ t: "note", key, value }, { debounce: NOTE_DEBOUNCE_MS });
    },
    timer(t: "start" | "pause" | "resume" | "complete") {
      enqueue({ t });
    },
    flushNow() {
      if (noteTimerRef.current) { clearTimeout(noteTimerRef.current); noteTimerRef.current = null; }
      void flush();
    },
    /** Send everything waiting and resolve once the server has it (or after `maxMs`). */
    async flushAndWait(maxMs = 4000) {
      if (noteTimerRef.current) { clearTimeout(noteTimerRef.current); noteTimerRef.current = null; }
      const t0 = Date.now();
      await flush();
      while (outboxRef.current.length > 0 && Date.now() - t0 < maxMs) {
        await new Promise((r) => setTimeout(r, 150));
        if (!flushingRef.current) await flush();
      }
      return outboxRef.current.length === 0;
    },
    retryAfterLogin() {
      unauthorizedRef.current = false;
      setStatus(outboxRef.current.length > 0 ? "saving" : "saved");
      retryStepRef.current = 0;
      void flush();
    },
  }), [enqueue, current, flush]);

  return { view, status, pending: outboxRef.current.length, actions };
}
