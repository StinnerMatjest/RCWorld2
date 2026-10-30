"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { CoasterGalleryImage } from "@/app/components/coasterpage/coasterPageTypes";
import { Btn, PlaceFramer } from "./PlaceFramer";
import { api, fmtDate, photoSources, taskName, taskTitle, thumb, type CleanupData, type CleanupPerson, type CleanupTask } from "./shared";

const CoasterStripEditor = dynamic(() => import("@/app/components/coasterpage/CoasterStripEditor"), { ssr: false });

const isVideo = (p: string) => /\.(mp4|webm|mov|ogg)$/i.test(p);

// ─── caption ─────────────────────────────────────────────────────────────────

function CaptionFixer({ task, busy, onSave, onOk, fill = false }: { task: CleanupTask; busy: boolean; onSave: (text: string) => void; onOk: () => void; /** Fill the room left on one screen. */ fill?: boolean }) {
  const cur = task.caption?.current ?? "";
  const [text, setText] = useState(task.caption?.why === "No caption" ? "" : cur);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [task.key]);
  const src = photoSources(task.image!, task.size);
  return (
    <div className={`grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start ${fill ? "h-full" : ""}`}>
      <div className={`flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950 ${fill ? "h-full" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src.src} srcSet={src.srcSet} sizes="(min-width: 768px) 60vw, 100vw" alt="" className={`w-auto max-w-full object-contain ${fill ? "max-h-full" : "max-h-[60vh]"}`} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) onSave(text.trim()); }}>
        <p className="text-sm text-slate-400">{task.caption?.why || "Caption"}{cur ? <> · now “<span className="text-slate-200">{cur}</span>”</> : null}</p>
        <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
          placeholder="What's in the photo?"
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-[15px] text-white outline-none focus:border-brand" />
        <div className="mt-4 flex flex-wrap gap-2.5">
          {cur && task.caption?.why && <Btn onClick={onOk} disabled={busy}>Fine as it is</Btn>}
          <Btn primary submit disabled={busy || !text.trim() || text.trim() === cur}>{busy ? "Saving…" : "Save caption"}</Btn>
        </div>
      </form>
    </div>
  );
}

// ─── curated pick ────────────────────────────────────────────────────────────

/** Nothing picked for a park's newest visit or a coaster: the page shows a fallback; pick with the site's own picker. */
function CuratedPick({ task, busy, onPicked }: { task: CleanupTask; busy: boolean; onPicked: () => void }) {
  const [gallery, setGallery] = useState<CoasterGalleryImage[] | null>(null);
  const [open, setOpen] = useState(false);
  const coaster = task.kind === "coaster-pick";
  const endpoint = coaster ? `/api/coasters/${task.coasterId}/gallery` : `/api/visits/${task.visitId}/gallery`;
  useEffect(() => {
    setGallery(null);
    fetch(endpoint, { cache: "no-store" }).then((r) => r.json()).then((d) => setGallery(d.gallery ?? [])).catch(() => setGallery([]));
  }, [endpoint, task.key]);
  const photos = (gallery ?? []).filter((g) => !isVideo(g.path));
  return (
    <div>
      <p className="text-sm text-slate-400">
        {coaster
          ? `Nothing is picked, so the coaster page shows all ${task.choices ?? photos.length} photos in its strip.`
          : `Nothing is picked, so the park page shows the first 12 of ${task.choices ?? photos.length} photos.`}
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {photos.slice(0, 16).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={thumb(p.path)} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-xl object-cover opacity-80" />
        ))}
      </div>
      <div className="mt-5"><Btn primary onClick={() => setOpen(true)} disabled={busy || !gallery}>Pick Curated Gallery</Btn></div>
      {open && gallery && (
        coaster
          ? <CoasterStripEditor coasterId={task.coasterId!} coasterName={task.coasterName ?? ""} gallery={gallery} onClose={() => setOpen(false)} onSaved={onPicked} />
          : <CoasterStripEditor coasterId={0} coasterName={task.parkName} gallery={gallery} endpoint={endpoint}
              focusEditing emptyNote="Nothing picked: the page shows the first 12 photos." onClose={() => setOpen(false)} onSaved={onPicked} />
      )}
    </div>
  );
}

// ─── runner ──────────────────────────────────────────────────────────────────

type Toast = { text: string; undo?: string; at: number };

/**
 * Desktop screens big enough to work on one screen without scrolling: the
 * runner takes the height left under the site header and sizes the previews
 * to it, with the save bar and Up next always in view.
 */
function useOnePager(ref: React.RefObject<HTMLElement | null>): number | null {
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (min-height: 640px)");
    const measure = () => {
      const el = ref.current;
      if (!el || !mq.matches) { setH(null); return; }
      const top = el.getBoundingClientRect().top + window.scrollY;
      setH(Math.max(560, window.innerHeight - top));
    };
    measure();
    window.addEventListener("resize", measure);
    mq.addEventListener("change", measure);
    return () => { window.removeEventListener("resize", measure); mq.removeEventListener("change", measure); };
  }, [ref]);
  return h;
}
/** A framing saved (with value) or checked as it is, by task and slot. */
export type SavedItem = { task: string; slot: string; value?: string };

export default function TaskRunner({ queue, startKey, title, person, data, onDone, onReload, onExit, needPerson }: {
  /** The tasks to work through, in order (random fixes come shuffled). */
  queue: CleanupTask[];
  startKey?: string;
  /** What is being worked through ("Frontpage", "Bakken", "Random fixes", "Done"). */
  title: string;
  person: CleanupPerson | null;
  /** Everything, for the other places of a photo and tasks opened from the done list. */
  data: CleanupData;
  /** A save: the page updates at once (framings saved or checked, tasks finished, credits). */
  onDone: (done: CleanupTask[], credits: number, items?: SavedItem[]) => void;
  /** Reload everything (after a photo change or an undo); resolves with the fresh data. */
  onReload: () => Promise<CleanupData | null>;
  onExit: () => void;
  needPerson: () => void;
}) {
  const [key, setKey] = useState<string | undefined>(startKey ?? queue[0]?.key);
  const skipped = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onePagerH = useOnePager(rootRef);
  const onePager = onePagerH != null;
  // The task the last save was for: an undo comes back to it.
  const undoKey = useRef<string | undefined>(undefined);
  const find = (k?: string) => (k ? queue.find((t) => t.key === k) ?? data.tasks.find((t) => t.key === k) ?? data.done.find((t) => t.key === k) : undefined);
  const task = find(key);
  const idx = task ? queue.findIndex((t) => t.key === task.key) : -1;
  const isDone = !!task && data.done.some((t) => t.key === task.key) && !data.tasks.some((t) => t.key === task.key);

  useEffect(() => { setError(null); window.scrollTo({ top: 0 }); }, [key]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.undo ? 8000 : 2400); return () => clearTimeout(t); }, [toast]);

  // The other framing places of this photo, and the frames its pages draw by themselves.
  const related = useMemo(() => {
    if (!task?.place) return [];
    const photos = new Set(task.place.slots.map((s) => s.photo));
    return [...data.tasks, ...data.done].filter((t) => t.key !== task.key && t.place?.slots.some((s) => photos.has(s.photo)));
  }, [task, data]);
  const readUses = useMemo(() => (task?.place ? [...new Set(task.place.slots.map((s) => s.photo))].flatMap((p) => data.uses[p] ?? []) : []), [task, data]);

  // Warm the pages of the next tasks, so their previews come up quickly.
  useEffect(() => {
    if (idx < 0) return;
    const pages = new Set(queue.slice(idx + 1, idx + 3).flatMap((t) => t.place?.slots.flatMap((s) => s.views.map((v) => v.page)) ?? []));
    pages.forEach((p) => { void fetch(`${p.split("#")[0]}${p.includes("?") ? "&" : "?"}framing-preview=1`, { credentials: "same-origin" }).catch(() => {}); });
  }, [idx, queue]);

  const next = (from: CleanupTask, gone: Set<string>) => {
    const at = queue.findIndex((t) => t.key === from.key);
    const ok = (t: CleanupTask) => t.key !== from.key && !skipped.current.has(t.key) && !gone.has(t.key);
    return (queue.slice(at + 1).find(ok) ?? queue.find(ok))?.key;
  };
  const skip = () => { if (!task) return; skipped.current.add(task.key); setKey(next(task, new Set())); };
  const run = async (fn: () => Promise<{ credited?: number; undo?: string }>, finished: CleanupTask[], items?: SavedItem[]) => {
    if (!task) return;
    if (!person) { needPerson(); return; }
    setBusy(true); setError(null);
    try {
      const r = await fn();
      const credits = r.credited ?? 0;
      setToast({ text: credits ? `Saved · +${credits} ${person}` : "Saved", undo: r.undo, at: Date.now() });
      const gone = new Set(finished.map((t) => t.key));
      undoKey.current = task.key;
      if (!isDone) setKey(next(task, gone));
      onDone(finished, credits, items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  const undo = async () => {
    if (!toast?.undo || !person) return;
    const token = toast.undo;
    setToast(null);
    try {
      await api("undo", undefined, person, { token });
      const fresh = await onReload();
      // Back to what was just saved, as it was before.
      const lastKey = undoKey.current;
      if (fresh && lastKey && (fresh.tasks.some((t) => t.key === lastKey) || fresh.done.some((t) => t.key === lastKey))) setKey(lastKey);
      setToast({ text: "Undone", at: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo");
    }
  };
  const changedPhoto = async (newKey: string | null) => {
    const fresh = await onReload();
    if (!fresh) return;
    const has = (k: string) => fresh.tasks.some((t) => t.key === k) || fresh.done.some((t) => t.key === k);
    if (newKey && has(newKey)) setKey(newKey);
    else if (task && !has(task.key)) setKey(fresh.tasks.find((t) => !skipped.current.has(t.key))?.key);
  };

  const upcoming = useMemo(() => {
    const at = idx < 0 ? -1 : idx;
    return queue.slice(at + 1).filter((t) => !skipped.current.has(t.key) && t.key !== key).slice(0, 14);
  }, [queue, idx, key]);

  if (!task) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-10">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>
        <div className="mt-16 text-center">
          <p className="text-2xl font-bold text-white">Nothing left here</p>
          <div className="mt-6"><Btn primary onClick={onExit}>Back to the overview</Btn></div>
        </div>
        {toast && <ToastBar toast={toast} onUndo={undo} />}
      </div>
    );
  }

  const place = task.place;
  const heading = taskName(task);
  const sub = place ? place.subtitle : task.coasterName ? task.parkName : task.visitDate ? fmtDate(task.visitDate) : undefined;
  const done = data.done.find((t) => t.key === task.key);

  return (
    <div ref={rootRef} className={`mx-auto max-w-[1880px] px-4 pt-4 md:px-10 ${onePager ? "flex flex-col pb-4" : "pb-28 md:pb-16"}`} style={onePager ? { height: onePagerH } : undefined}>
      <div className="flex shrink-0 items-center gap-4 whitespace-nowrap text-sm">
        <button onClick={onExit} className="text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>
        <span className="hidden min-w-0 truncate text-slate-500 sm:block">{title}{idx >= 0 ? ` · ${idx + 1} of ${queue.length}` : ""}</span>
        <span className="flex-1" />
        {error && <span className="min-w-0 truncate rounded-lg bg-red-950/60 px-3 py-1 text-red-300">{error}</span>}
        <Link href={task.pageUrl} target="_blank" className="whitespace-nowrap text-slate-400 hover:text-white">Open page ↗</Link>
        {!isDone && <button type="button" onClick={skip} className="whitespace-nowrap text-slate-400 hover:text-white cursor-pointer">Skip ›</button>}
      </div>

      <div className={`shrink-0 ${onePager ? "mb-4 mt-2 flex items-baseline gap-3" : "mb-5 mt-4"}`}>
        <p className="text-[13px] font-bold text-brand">{taskTitle(task)}{done && <span className="ml-2 font-normal text-green-300">✓ Done by {done.doneBy}, {fmtDate(done.doneAt)}</span>}</p>
        <h1 className={`font-bold leading-tight text-white ${onePager ? "min-w-0 truncate text-2xl" : "mt-1 text-2xl md:text-3xl"}`}>{heading}</h1>
        {sub && <p className={`text-sm text-slate-400 ${onePager ? "truncate" : "mt-0.5"}`}>{sub}</p>}
      </div>

      <div className={onePager ? "min-h-0 flex-1" : ""}>
        {place && (
          <PlaceFramer task={task} related={related} readUses={readUses} busy={busy} onePager={onePager}
            onSave={(items) => {
              const saved: SavedItem[] = items.map((i) => ({ task: i.task ?? task.key, slot: i.slot, value: i.value }));
              const finished = [task, ...related].filter((t) => t.place!.slots.every((s) => s.done || saved.some((i) => i.task === t.key && i.slot === s.id)));
              void run(() => api("place", task.key, person!, { items }), finished, saved);
            }}
            onChanged={(k) => { void changedPhoto(k); }} />
        )}
        {task.kind === "caption" && (
          <CaptionFixer key={task.key} task={task} busy={busy} fill={onePager}
            onSave={(text) => void run(() => api("caption", task.key, person!, { text }), [task])}
            onOk={() => void run(() => api("ok", task.key, person!), [task])} />
        )}
        {(task.kind === "curated-pick" || task.kind === "coaster-pick") && (
          <CuratedPick key={task.key} task={task} busy={busy} onPicked={() => void run(() => api("done", task.key, person!), [task])} />
        )}
      </div>

      {upcoming.length > 0 && (
        <div className={`shrink-0 ${onePager ? "mt-4 border-t border-white/10 pt-3" : "mt-12"}`}>
          <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-bold text-white">Up next</h2><span className="text-xs text-slate-500">Tap one to jump to it</span></div>
          <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
            {upcoming.map((t) => (
              <button key={t.key} type="button" onClick={() => setKey(t.key)} className={`group flex-none text-left cursor-pointer ${onePager ? "w-[76px]" : "w-[96px] md:w-[120px]"}`}>
                <div className="aspect-[4/5] overflow-hidden rounded-lg bg-slate-800 ring-brand transition group-hover:ring-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.image && <img src={thumb(t.image)} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />}
                </div>
                <div className="mt-1 truncate text-[11px] font-semibold text-slate-200">{taskName(t)}</div>
                {!onePager && <div className="truncate text-[11px] text-slate-500">{taskTitle(t)}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && <ToastBar toast={toast} onUndo={undo} />}
    </div>
  );
}

/** "Saved · +2 Jannik  Undo", for a few seconds after a save. */
function ToastBar({ toast, onUndo }: { toast: Toast; onUndo: () => void }) {
  return (
    <div key={toast.at} className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm shadow-2xl backdrop-blur md:bottom-8 lg:bottom-auto lg:left-auto lg:right-8 lg:top-8 lg:mx-0 lg:w-80">
      <span className="min-w-0 flex-1 truncate font-bold text-white">{toast.text}</span>
      {toast.undo && <button type="button" onClick={onUndo} className="font-bold text-brand hover:text-brand-light cursor-pointer">Undo</button>}
    </div>
  );
}
