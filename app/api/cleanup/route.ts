import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { revalidateContent } from "@/app/lib/revalidate";
import { logChange } from "@/app/lib/changelog";
import { addSectionPhoto, CLEANUP_PEOPLE, creditTask, FRAMING_KINDS, wasCredited, loadCleanup, setCaption, setSectionFocus, type CleanupPerson, type CleanupTask } from "@/app/lib/cleanup";

// GET  /api/cleanup                                  -> CleanupData (open tasks, totals, parks, scores)
// POST /api/cleanup { action, key, person, ... }     -> { ok } (the page updates itself and refetches quietly)
//   done          the fix was saved through the page's own editor endpoint: credit it
//                 (framing kinds are marked as checked; others are verified first)
//   ok            "Looks right" / "Fine as it is": checked by eye, nothing changed
//   caption       { text }   set the caption (every row showing this photo)
//   section-focus { focus }  reframe one review-section photo
//   section-add   { url }    give a review section its first photo
// Writes are admin-only through the middleware; reads are gated here.

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await loadCleanup(), NO_STORE);
  } catch (err) {
    console.error("cleanup load failed", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

const FOCUS_RE = /^\d(\.\d+)? \d(\.\d+)? \d+(\.\d+)?$/;

export async function POST(req: NextRequest) {
  let body: { action?: string; key?: string; person?: string; text?: string; focus?: string; url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const { action, key } = body;
  const person = body.person as CleanupPerson;
  if (!(CLEANUP_PEOPLE as readonly string[]).includes(person)) return NextResponse.json({ error: "Pick who you are first" }, { status: 400 });
  if (!action || !key) return NextResponse.json({ error: "Missing action or key" }, { status: 400 });

  try {
    // The task as the server sees it now; every action works from this, never from what the page sent.
    const before = await loadCleanup();
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
    const framing = FRAMING_KINDS.includes(task.kind);

    if (action === "done") {
      if (!framing) {
        // Verified: credited only when the data now passes. The tasks list above is
        // computed after the save, so a passing task is simply no longer in it.
        return NextResponse.json({ ok: false, error: "Not fixed yet" }, { status: 409 });
      }
      await creditTask(key, task.kind, person, "saved", task.fingerprint);
    } else if (action === "ok") {
      if (task.kind === "curated-pick" || task.kind === "coaster-review" || task.kind === "coaster-photos") {
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
    } else if (action === "section-focus") {
      const focus = String(body.focus ?? "");
      if (task.kind !== "section-photo" || !task.section || !task.image || !FOCUS_RE.test(focus)) return NextResponse.json({ ok: false, error: "Bad framing" }, { status: 400 });
      const ok = await setSectionFocus(task.section.table, task.section.rowId, task.section.index, task.image, focus);
      if (!ok) return NextResponse.json({ ok: false, error: "That section changed meanwhile. Reload." }, { status: 409 });
      await creditTask(key, task.kind, person, "saved", task.fingerprint);
      logChange({ parkId: task.parkId, entityType: task.section.table === "parktexts" ? "park_text" : "coaster_text", entityId: task.section.rowId, label: task.coasterName ?? task.parkName, action: "update", summary: `Framed a photo in ${task.section.heading} (clean-up)` });
      revalidateContent();
    } else if (action === "section-add") {
      const url = String(body.url ?? "");
      if (task.kind !== "section-needs-photo" || !task.section || !/^https:\/\/\S+$/.test(url)) return NextResponse.json({ ok: false, error: "Pick a photo" }, { status: 400 });
      const ok = await addSectionPhoto(task.section.table, task.section.rowId, url);
      if (!ok) return NextResponse.json({ ok: false, error: "That section got a photo meanwhile. Reload." }, { status: 409 });
      await creditTask(key, task.kind, person, "photo-added");
      logChange({ parkId: task.parkId, entityType: task.section.table === "parktexts" ? "park_text" : "coaster_text", entityId: task.section.rowId, label: task.coasterName ?? task.parkName, action: "update", summary: `Added a photo to ${task.section.heading} (clean-up)` });
      revalidateContent();
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (err) {
    console.error("cleanup action failed", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
