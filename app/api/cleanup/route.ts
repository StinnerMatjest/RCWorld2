import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { revalidateContent } from "@/app/lib/revalidate";
import { logChange } from "@/app/lib/changelog";
import {
  CHECKABLE_KINDS, CLEANUP_PEOPLE, creditTask, keepUndo, takeUndo, wasCredited, loadCleanup, reopenTask, setCaption, undoOps, writeSlot,
  type CleanupData, type CleanupPerson, type CleanupTask, type UndoOp,
} from "@/app/lib/cleanup";

// GET  /api/cleanup                                  -> CleanupData (open and done tasks, points, parks, scores, uses)
// POST /api/cleanup { action, key, person, ... }     -> { ok, undo? } (the page updates itself and refetches quietly)
//   place     { items: [{ task?, slot, value? }] }  framings of this place (and of other places of the same
//                                                    photo, by task key): with value saved where the site
//                                                    reads it, without value checked as is ("Looks right")
//   ok                                             a caption, a review short on photos or a review not
//                                                    to be written: fine as it is
//   caption   { text }                             set the caption (every row showing this photo)
//   done                                           a curated pick saved through the picker: credit it once
//   reopen                                         a finished task back on the list (its credit goes too)
//   undo      { token }                            take back a save made a moment ago
// Writes are admin-only through the middleware; reads are gated here.

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// Working out every task takes a couple of seconds, too slow to repeat on each
// save. Saves look their task up in the last list (at most two minutes old) and
// keep it current; every write still checks the photo is where the list says,
// and a credit is only logged once per framing and photo (creditTask).
let snapshot: { at: number; data: CleanupData } | null = null;
async function freshList(): Promise<CleanupData> {
  const data = await loadCleanup();
  snapshot = { at: Date.now(), data };
  return data;
}
const recentList = () => (snapshot && Date.now() - snapshot.at < 120_000 ? Promise.resolve(snapshot.data) : freshList());
const findTask = (d: CleanupData, key: string): CleanupTask | undefined => d.tasks.find((t) => t.key === key) ?? d.done.find((t) => t.key === key);
/** Keep the last list current: a task that is now finished moves to the done list. */
function settle(task: CleanupTask, person: CleanupPerson) {
  if (!snapshot) return;
  const d = snapshot.data;
  if (!d.tasks.some((t) => t.key === task.key)) return;
  d.tasks = d.tasks.filter((t) => t.key !== task.key);
  d.done = [{ ...task, doneAt: new Date().toISOString(), doneBy: person }, ...d.done.filter((t) => t.key !== task.key)];
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await freshList(), NO_STORE);
  } catch (err) {
    console.error("cleanup load failed", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

/** "x y zoom", each a plain decimal: x and y in 0..1, zoom 1..4. */
const VALUE_RE = /^(0(\.\d+)?|1(\.0+)?) (0(\.\d+)?|1(\.0+)?) [1-4](\.\d+)?$/;

export async function POST(req: NextRequest) {
  let body: { action?: string; key?: string; person?: string; text?: string; items?: unknown; token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const { action, key } = body;
  const person = body.person as CleanupPerson;
  if (!(CLEANUP_PEOPLE as readonly string[]).includes(person)) return NextResponse.json({ error: "Pick who you are first" }, { status: 400 });

  try {
    if (action === "undo") {
      const ops = body.token ? await takeUndo(body.token, person as CleanupPerson) : null;
      if (!ops) return NextResponse.json({ ok: false, error: "Too late to undo" }, { status: 409 });
      const parkId = await undoOps(ops);
      if (ops.some((o) => o.t === "slot" || o.t === "caption")) {
        revalidateContent();
        logChange({ parkId, entityType: "image", entityId: null, label: null, action: "update", summary: "Undid a clean-up save", details: {} });
      }
      snapshot = null;
      return NextResponse.json({ ok: true }, NO_STORE);
    }
    if (!action || !key) return NextResponse.json({ error: "Missing action or key" }, { status: 400 });

    // The task as the server sees it; every action works from this, never from what the page sent.
    // "done" checks a fix saved elsewhere, so it needs the list as it is right now.
    const before = action === "done" ? await freshList() : await recentList();
    const task = findTask(before, key);
    if (!task) {
      // A curated pick saved through the picker passes now: credit it once.
      if (action === "done" && /^(curated|coaster)-pick:/.test(key) && !(await wasCredited(key))) {
        await creditTask(key, key.startsWith("coaster") ? "coaster-pick" : "curated-pick", person, "picked");
        return NextResponse.json({ ok: true }, NO_STORE);
      }
      return NextResponse.json({ ok: false, error: "That changed meanwhile. Reload." }, { status: 409 });
    }
    const isOpen = before.tasks.some((t) => t.key === key);

    if (action === "reopen") {
      if (isOpen) return NextResponse.json({ ok: true, already: true }, NO_STORE);
      await reopenTask(task.place ? task.place.slots.map((s) => `frame:${s.id}`) : [task.key]);
      snapshot = null;
      return NextResponse.json({ ok: true }, NO_STORE);
    }

    if (action === "place") {
      const items = Array.isArray(body.items) ? (body.items as { task?: unknown; slot?: unknown; value?: unknown }[]) : [];
      // Check everything before writing anything.
      const work = items.map((it) => {
        const t = it.task == null ? task : findTask(before, String(it.task));
        return { task: t, slot: t?.place?.slots.find((s) => s.id === it.slot), value: it.value == null ? null : String(it.value) };
      });
      if (!work.length || work.some((w) => !w.task?.place || !w.slot)) return NextResponse.json({ ok: false, error: "That place changed. Reload." }, { status: 409 });
      if (work.some((w) => w.value !== null && !VALUE_RE.test(w.value))) return NextResponse.json({ ok: false, error: "Bad framing" }, { status: 400 });
      const ops: UndoOp[] = [];
      let wrote = false, credited = 0;
      for (const { task: t, slot, value } of work) {
        const s = slot!, place = t!.place!;
        if (value !== null) {
          // Formats without zoom store 1.
          const v = s.maxZoom <= 1 ? value.replace(/ [\d.]+$/, " 1") : value;
          const old = s.value;
          const res = await writeSlot(s.photo, s.target, v);
          if (!res.ok) {
            await undoOps(ops); // nothing half-saved
            snapshot = null;
            return NextResponse.json({ ok: false, error: "That photo changed meanwhile. Reload." }, { status: 409 });
          }
          ops.push({ t: "slot", photo: s.photo, target: s.target, old });
          wrote = true;
          // A framing already checked can be adjusted again without a second credit.
          if (!s.done) { const c = await creditTask(`frame:${s.id}`, s.kind, person, "saved", s.photo); ops.push(...c.ops); if (c.credited) credited++; }
          logChange({
            parkId: res.parkId ?? t!.parkId, entityType: "image", entityId: t!.imageId ?? null,
            label: t!.coasterName ?? place.title, action: "update",
            summary: `Framed ${place.kind.replace("-", " ")} · ${s.label.toLowerCase()} (clean-up)`, details: { focus: { old, new: v } },
          });
          s.value = v;
          s.fresh = false;
        } else if (!s.done) {
          const c = await creditTask(`frame:${s.id}`, s.kind, person, "looks-right", s.photo);
          ops.push(...c.ops); if (c.credited) credited++;
        }
        s.done = true;
      }
      if (wrote) revalidateContent();
      for (const t of new Set(work.map((w) => w.task!))) if (t.place!.slots.every((s) => s.done)) settle(t, person);
      return NextResponse.json({ ok: true, credited, undo: await keepUndo(person as CleanupPerson, ops) }, NO_STORE);
    }

    if (action === "ok") {
      // A review not published yet leaves the list by being published, never by a check.
      if (!CHECKABLE_KINDS.includes(task.kind) || (task.kind === "park-review" && task.draft)) return NextResponse.json({ ok: false, error: "This one needs doing" }, { status: 400 });
      if (!isOpen) return NextResponse.json({ ok: true, already: true }, NO_STORE);
      const c = await creditTask(key, task.kind, person, "looks-right", task.fingerprint);
      settle(task, person);
      return NextResponse.json({ ok: true, credited: c.credited ? 1 : 0, undo: await keepUndo(person as CleanupPerson, c.ops) }, NO_STORE);
    }
    if (action === "caption") {
      const text = String(body.text ?? "").trim().slice(0, 300);
      if (task.kind !== "caption" || !text || !task.image) return NextResponse.json({ ok: false, error: "Write a caption" }, { status: 400 });
      const from = task.caption?.current ?? "";
      const n = await setCaption(task.image, from, text);
      if (!n) return NextResponse.json({ ok: false, error: "That photo changed meanwhile. Reload." }, { status: 409 });
      const ops: UndoOp[] = [{ t: "caption", path: task.image, from, to: text }];
      // A caption fixed again later (from the done list) earns no second credit.
      let credited = 0;
      if (isOpen) { const c = await creditTask(key, task.kind, person, "caption"); ops.push(...c.ops); credited = c.credited ? 1 : 0; }
      logChange({ parkId: task.parkId, entityType: "image", entityId: task.imageId ?? null, label: task.parkName, action: "update", summary: `Caption "${text}" (clean-up)`, details: { description: { old: from, new: text } } });
      revalidateContent();
      task.caption = { current: text, why: "" };
      task.fingerprint = text;
      settle(task, person);
      return NextResponse.json({ ok: true, credited, undo: await keepUndo(person as CleanupPerson, ops) }, NO_STORE);
    }
    if (action === "done") {
      // Verified: a fix saved elsewhere passes only when the task is no longer open.
      if (isOpen) return NextResponse.json({ ok: false, error: "Not fixed yet" }, { status: 409 });
      if (!(await wasCredited(key))) await creditTask(key, task.kind, person, "picked");
      return NextResponse.json({ ok: true }, NO_STORE);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("cleanup action failed", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
