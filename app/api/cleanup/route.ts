import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { revalidateContent } from "@/app/lib/revalidate";
import { logChange } from "@/app/lib/changelog";
import { addSectionPhoto, CLEANUP_PEOPLE, creditTask, wasCredited, loadCleanup, setCaption, writeSlot, type CleanupData, type CleanupPerson, type CleanupTask } from "@/app/lib/cleanup";

// GET  /api/cleanup                                  -> CleanupData (open tasks, totals, parks, scores)
// POST /api/cleanup { action, key, person, ... }     -> { ok } (the page updates itself and refetches quietly)
//   frame        { slot, value }  save one format's framing of a photo, where the site reads it
//   ok           { slot? }        "Looks right": checked by eye, nothing changed
//                                 (a photo's format with slot; a caption or a section without slot)
//   caption      { text }         set the caption (every row showing this photo)
//   section-add  { url }          give a review section its first photo
//   done                          a curated pick saved through the picker: credit it once
// Writes are admin-only through the middleware; reads are gated here.

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// Working out every task takes a couple of seconds, too slow to repeat on each
// save. Saves look their task up in the last list (at most two minutes old) and
// keep it current; every write still checks the photo is where the list says,
// and a credit is only logged once per format and photo (creditTask).
let snapshot: { at: number; data: CleanupData } | null = null;
async function freshList(): Promise<CleanupData> {
  const data = await loadCleanup();
  snapshot = { at: Date.now(), data };
  return data;
}
const recentList = () => (snapshot && Date.now() - snapshot.at < 120_000 ? Promise.resolve(snapshot.data) : freshList());
/** Take a task out of the last list once it is done. */
const dropTask = (key: string) => { if (snapshot) snapshot.data.tasks = snapshot.data.tasks.filter((t) => t.key !== key); };

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
const entityOf = (table: "parktexts" | "coastertext") => (table === "parktexts" ? "park_text" : "coaster_text") as "park_text" | "coaster_text";

export async function POST(req: NextRequest) {
  let body: { action?: string; key?: string; person?: string; text?: string; value?: string; slot?: string; url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const { action, key } = body;
  const person = body.person as CleanupPerson;
  if (!(CLEANUP_PEOPLE as readonly string[]).includes(person)) return NextResponse.json({ error: "Pick who you are first" }, { status: 400 });
  if (!action || !key) return NextResponse.json({ error: "Missing action or key" }, { status: 400 });

  try {
    // The task as the server sees it; every action works from this, never from what the page sent.
    // "done" checks a fix saved elsewhere, so it needs the list as it is right now.
    const before = action === "done" ? await freshList() : await recentList();
    const task: CleanupTask | undefined = before.tasks.find((t) => t.key === key);
    if (!task) {
      // A curated pick saved through the picker passes now: credit it once.
      if (action === "done" && key.startsWith("curated-pick:") && !(await wasCredited(key))) {
        await creditTask(key, "curated-pick", person, "picked");
        return NextResponse.json({ ok: true }, NO_STORE);
      }
      // Otherwise it was already done (for instance by the other person a moment ago).
      return NextResponse.json({ ok: true, already: true }, NO_STORE);
    }

    if (task.kind === "photo") {
      const url = task.image!;
      const slot = task.slots?.find((s) => s.id === body.slot);
      if (!slot) return NextResponse.json({ ok: false, error: "That format is gone. Reload." }, { status: 409 });
      if (action === "frame") {
        const value = String(body.value ?? "");
        if (!VALUE_RE.test(value)) return NextResponse.json({ ok: false, error: "Bad framing" }, { status: 400 });
        // Position formats have no zoom.
        const v = slot.mode === "position" ? value.replace(/ [\d.]+$/, " 1") : value;
        const res = await writeSlot(url, slot, v);
        if (!res.ok) return NextResponse.json({ ok: false, error: "That photo changed meanwhile. Reload." }, { status: 409 });
        // A format already checked can be adjusted again without a second credit.
        if (!slot.done) await creditTask(`frame:${slot.id}`, slot.kind, person, "saved", url);
        logChange({
          parkId: res.parkId ?? task.parkId, entityType: slot.target.t === "section" ? entityOf(slot.target.table) : "image",
          entityId: slot.target.t === "section" ? slot.target.rowId : null, label: slot.where, action: "update",
          summary: `Framed ${slot.label.toLowerCase()} (clean-up)`, details: { focus: { old: slot.value, new: v } },
        });
        revalidateContent();
        slot.value = v;
        slot.fresh = false;
      } else if (action === "ok") {
        if (!slot.done) await creditTask(`frame:${slot.id}`, slot.kind, person, "looks-right", url);
      } else {
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      }
      slot.done = true;
      if (task.slots!.every((s) => s.done)) dropTask(task.key);
      return NextResponse.json({ ok: true }, NO_STORE);
    }

    if (action === "ok") {
      if (task.kind !== "caption" && task.kind !== "section-needs-photo") {
        return NextResponse.json({ ok: false, error: "This one needs doing" }, { status: 400 });
      }
      await creditTask(key, task.kind, person, "looks-right", task.fingerprint);
    } else if (action === "caption") {
      const text = String(body.text ?? "").trim().slice(0, 300);
      if (task.kind !== "caption" || !text || !task.image) return NextResponse.json({ ok: false, error: "Write a caption" }, { status: 400 });
      const n = await setCaption(task.image, task.caption?.current ?? "", text);
      if (!n) return NextResponse.json({ ok: false, error: "That photo changed meanwhile. Reload." }, { status: 409 });
      await creditTask(key, task.kind, person, "caption");
      logChange({ parkId: task.parkId, entityType: "image", entityId: task.imageId ?? null, label: task.parkName, action: "update", summary: `Caption "${text}" (clean-up)`, details: { description: { old: task.caption?.current ?? "", new: text } } });
      revalidateContent();
    } else if (action === "section-add") {
      const url = String(body.url ?? "");
      if (task.kind !== "section-needs-photo" || !task.section || !/^https:\/\/\S+$/.test(url)) return NextResponse.json({ ok: false, error: "Pick a photo" }, { status: 400 });
      const ok = await addSectionPhoto(task.section.table, task.section.rowId, url);
      if (!ok) return NextResponse.json({ ok: false, error: "That section got a photo meanwhile. Reload." }, { status: 409 });
      await creditTask(key, task.kind, person, "photo-added");
      logChange({ parkId: task.parkId, entityType: entityOf(task.section.table), entityId: task.section.rowId, label: task.coasterName ?? task.parkName, action: "update", summary: `Added a photo to ${task.section.heading} (clean-up)` });
      revalidateContent();
    } else if (action === "done") {
      // Verified: a fix saved elsewhere passes only when the task is gone from the list.
      return NextResponse.json({ ok: false, error: "Not fixed yet" }, { status: 409 });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    dropTask(key);
    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (err) {
    console.error("cleanup action failed", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
