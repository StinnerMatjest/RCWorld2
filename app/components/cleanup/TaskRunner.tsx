"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { CoasterGalleryImage } from "@/app/components/coasterpage/coasterPageTypes";
import { ArrowBtn, Btn, PlaceFramer } from "./PlaceFramer";
import { api, fmtDate, photoSources, taskName, taskTitle, thumb, type CleanupData, type CleanupPerson, type CleanupTask } from "./shared";

const CoasterStripEditor = dynamic(() => import("@/app/components/coasterpage/CoasterStripEditor"), { ssr: false });

const isVideo = (p: string) => /\.(mp4|webm|mov|ogg)$/i.test(p);

// ─── caption ─────────────────────────────────────────────────────────────────

function CaptionFixer({ task, busy, onSave, onOk, fill = false, back = null }: { task: CleanupTask; busy: boolean; onSave: (text: string) => void; onOk: () => void; /** Fill the room left on one screen. */ fill?: boolean; back?: React.ReactNode }) {
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
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {back}
          {cur && task.caption?.why && <Btn onClick={onOk} disabled={busy}>Fine as it is</Btn>}
          <span className="flex-1" />
          <ArrowBtn dir="next" submit disabled={busy || !text.trim() || text.trim() === cur} small={!fill}>{busy ? "Saving…" : "Save"}<span className="text-xl leading-none">→</span></ArrowBtn>
        </div>
      </form>
    </div>
  );
}

// ─── curated pick ────────────────────────────────────────────────────────────

/** Nothing picked for a park's newest visit or a coaster: the page shows a fallback; pick with the site's own picker. */
function CuratedPick({ task, busy, onPicked, fill = false, back = null }: { task: CleanupTask; busy: boolean; onPicked: () => void; /** Fill the room left on one screen (the photos scroll inside it). */ fill?: boolean; back?: React.ReactNode }) {
  const [gallery, setGallery] = useState<CoasterGalleryImage[] | null>(null);
  const [open, setOpen] = useState(false);
  const coaster = task.kind === "coaster-pick";
  const endpoint = coaster ? `/api/coasters/${task.coasterId}/gallery` : `/api/visits/${task.visitId}/gallery`;
  useEffect(() => {
    setGallery(null);
    fetch(endpoint, { cache: "no-store" }).then((r) => r.json()).then((d) => setGallery(d.gallery ?? [])).catch(() => setGallery([]));
  }, [endpoint, task.key]);
  const photos = (gallery ?? []).filter((g) => !isVideo(g.path));
  const n = task.choices ?? photos.length;
  // What the page shows while nothing is picked: the coaster strip all photos, the park the first 12.
  const now = coaster ? `the coaster page shows all ${n} photos in its strip` : n <= 12 ? `the park page shows all ${n} photos` : `the park page shows the first 12 of ${n} photos`;
  return (
    <div className={fill ? "flex h-full min-h-0 flex-col" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {back}
        <p className="min-w-0 flex-1 text-base text-slate-300">Nothing is picked, so {now}.</p>
        <Btn primary onClick={() => setOpen(true)} disabled={busy || !gallery}>Pick Curated Gallery</Btn>
      </div>
      <div className={`mt-4 ${fill ? "min-h-0 flex-1 overflow-y-auto pr-1" : ""}`}>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
          {(gallery === null ? Array.from({ length: Math.min(12, n) }, () => null) : photos).map((p, i) => (
            p
              // eslint-disable-next-line @next/next/no-img-element
              ? <img key={p.id} src={thumb(p.path)} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-xl object-cover" />
              : <div key={i} className="aspect-[4/5] w-full animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
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
const ONE_PAGER = "(min-width: 1024px) and (min-height: 640px)";
function useOnePager(ref: React.RefObject<HTMLElement | null>): number | null {
  // The runner only mounts in the browser: start in the right layout (the height is measured next).
  const [h, setH] = useState<number | null>(() => (typeof window !== "undefined" && window.matchMedia(ONE_PAGER).matches ? window.innerHeight - 120 : null));
  useLayoutEffect(() => {
    const mq = window.matchMedia(ONE_PAGER);
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

/** A task left behind: the back arrow returns to it, taking back its save if it was saved. */
type Step = { key: string; undo?: string };

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
  // The left column, where a framing puts the list of where its photo is shown.
  const [side, setSide] = useState<HTMLDivElement | null>(null);
  // The tasks left behind, oldest first.
  const [trail, setTrail] = useState<Step[]>([]);
  const find = (k?: string) => (k ? queue.find((t) => t.key === k) ?? data.tasks.find((t) => t.key === k) ?? data.done.find((t) => t.key === k) : undefined);
  const task = find(key);
  const idx = task ? queue.findIndex((t) => t.key === task.key) : -1;
  const finished = (k: string) => data.done.some((t) => t.key === k) && !data.tasks.some((t) => t.key === k);
  const isDone = !!task && finished(task.key);

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
  /** On to another task, leaving this one on the trail. */
  const go = (k: string | undefined, step?: Step) => {
    if (task && (k !== task.key || step?.undo)) setTrail((h) => [...h, step ?? { key: task.key }]);
    setKey(k);
  };
  const skip = () => { if (!task) return; skipped.current.add(task.key); go(next(task, new Set())); };
  const run = async (fn: () => Promise<{ credited?: number; undo?: string }>, finishedNow: CleanupTask[], items?: SavedItem[]) => {
    if (!task) return;
    if (!person) { needPerson(); return; }
    setBusy(true); setError(null);
    try {
      const r = await fn();
      const credits = r.credited ?? 0;
      setToast({ text: credits ? `Saved · +${credits} ${person}` : "Saved", undo: r.undo, at: Date.now() });
      const gone = new Set(finishedNow.map((t) => t.key));
      go(isDone ? task.key : next(task, gone), { key: task.key, undo: r.undo });
      onDone(finishedNow, credits, items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  // Back to the last task left behind, as it was: its save is taken back.
  const back = async () => {
    const last = trail[trail.length - 1];
    if (!last || busy) return;
    setTrail((h) => h.slice(0, -1));
    setToast(null); setError(null);
    if (last.undo && person) {
      setBusy(true);
      try {
        await api("undo", undefined, person, { token: last.undo });
        await onReload();
        setToast({ text: "Undone", at: Date.now() });
      } catch (e) {
        await onReload();
        setError(e instanceof Error && e.message !== "Too late to undo" ? e.message : "Too late to take that save back; it stays saved");
      } finally {
        setBusy(false);
      }
    }
    setKey(last.key);
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

  // The strip: the last tasks left behind (finished ones ticked green), this one, then what is next.
  const strip = useMemo(() => {
    const seen = new Set<string>([key ?? ""]);
    const past: CleanupTask[] = [];
    for (let i = trail.length - 1; i >= 0 && past.length < 6; i--) {
      const k = trail[i].key;
      if (seen.has(k)) continue;
      seen.add(k);
      const t = find(k);
      if (t) past.unshift(t);
    }
    return [
      ...past.map((t) => ({ t, at: finished(t.key) ? "done" as const : "past" as const })),
      ...(task ? [{ t: task, at: "now" as const }] : []),
      ...upcoming.filter((t) => !seen.has(t.key)).map((t) => ({ t, at: "next" as const })),
    ];
  }, [trail, task, upcoming, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const stripRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLButtonElement>(null);
  // Keep this task in view in the strip, with the one before it.
  useEffect(() => {
    const box = stripRef.current, el = nowRef.current;
    if (!box || !el) return;
    const from = (el.previousElementSibling as HTMLElement | null) ?? el;
    if (onePager) box.scrollTo({ top: from.offsetTop - box.offsetTop, behavior: "smooth" });
    else box.scrollTo({ left: from.offsetLeft - box.offsetLeft, behavior: "smooth" });
  }, [key, onePager, strip.length]);

  if (!task) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-10">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Admin</button>
        <div className="mt-16 text-center">
          <p className="text-2xl font-bold text-white">Nothing left here</p>
          <div className="mt-6 flex justify-center gap-3">
            {trail.length > 0 && <ArrowBtn dir="back" onClick={() => void back()} disabled={busy}><span className="text-xl leading-none">←</span>Back</ArrowBtn>}
            <Btn primary onClick={onExit}>Back to the overview</Btn>
          </div>
        </div>
        {toast && <ToastBar toast={toast} />}
      </div>
    );
  }

  const place = task.place;
  const heading = taskName(task);
  const detail: { label?: string; value: string } | null = place?.category
    ? { label: place.category.label, value: place.category.value }
    : place?.subtitle ? { value: place.subtitle }
    : task.coasterName ? { value: task.parkName }
    : task.visitDate ? { label: "Visit", value: fmtDate(task.visitDate) } : null;
  const done = data.done.find((t) => t.key === task.key);
  const lastName = trail.length ? (() => { const t = find(trail[trail.length - 1].key); return t ? taskName(t) : null; })() : null;
  const backBtn = (
    <ArrowBtn dir="back" onClick={() => void back()} disabled={busy || !trail.length} small={!onePager}
      title={trail.length ? `Back to ${lastName ?? "the last task"}${trail[trail.length - 1].undo ? ", taking back its save" : ""}` : "Nothing to go back to"}>
      <span className="text-xl leading-none">←</span>Back
    </ArrowBtn>
  );

  // What is being edited, unmistakably: the park or coaster, the kind of task, and where.
  const head = (
    <>
      <button onClick={onExit} className="self-start text-sm text-slate-400 hover:text-white cursor-pointer">‹ Admin</button>
      <h1 className={`mt-2 font-bold leading-[1.05] tracking-tight text-white ${onePager ? "line-clamp-3 break-words text-[44px]" : "truncate text-4xl"}`}>{heading}</h1>
      <p className="mt-2.5 text-2xl font-semibold leading-tight text-slate-100">{taskTitle(task)}</p>
      {detail && (
        <p className="mt-1.5 text-lg leading-tight text-slate-300">
          {detail.label && <span className="mr-2 text-slate-500">{detail.label}</span>}{detail.value}
        </p>
      )}
      {done && <p className="mt-1.5 text-sm text-green-300">✓ Done by {done.doneBy}, {fmtDate(done.doneAt)}</p>}
    </>
  );
  const links = (
    <div className={`flex items-center gap-5 whitespace-nowrap text-sm ${onePager ? "" : "justify-end"}`}>
      <Link href={task.pageUrl} target="_blank" className="text-slate-400 hover:text-white">Open page ↗</Link>
      {!isDone && <button type="button" onClick={skip} className="text-slate-400 hover:text-white cursor-pointer">Skip ›</button>}
    </div>
  );
  const count = (
    <>
      {idx >= 0 && (
        <p className="text-4xl font-bold leading-none tabular-nums text-white">
          {idx + 1}<span className="text-2xl text-slate-500"> / {queue.length}</span>
        </p>
      )}
      <p className="mt-1.5 text-sm text-slate-400">{title}</p>
      {error && <p className={`mt-2 text-sm text-red-300 ${onePager ? "" : "max-w-sm truncate"}`}>{error}</p>}
    </>
  );
  const body = (
    <>
      {place && (
        <PlaceFramer task={task} related={related} readUses={readUses} busy={busy} onePager={onePager} advances={!isDone}
          side={onePager ? side : null} back={backBtn}
          onSave={(items) => {
            const saved: SavedItem[] = items.map((i) => ({ task: i.task ?? task.key, slot: i.slot, value: i.value }));
            const fin = [task, ...related].filter((t) => t.place!.slots.every((s) => s.done || saved.some((i) => i.task === t.key && i.slot === s.id)));
            void run(() => api("place", task.key, person!, { items }), fin, saved);
          }}
          onChanged={(k) => { void changedPhoto(k); }} />
      )}
      {task.kind === "caption" && (
        <CaptionFixer key={task.key} task={task} busy={busy} fill={onePager} back={backBtn}
          onSave={(text) => void run(() => api("caption", task.key, person!, { text }), [task])}
          onOk={() => void run(() => api("ok", task.key, person!), [task])} />
      )}
      {(task.kind === "curated-pick" || task.kind === "coaster-pick") && (
        <CuratedPick key={task.key} task={task} busy={busy} fill={onePager} back={backBtn} onPicked={() => void run(() => api("done", task.key, person!), [task])} />
      )}
    </>
  );
  // A tile of the strip: finished ones washed green with a tick, this one ringed.
  const tile = ({ t, at }: (typeof strip)[number]) => (
    <button key={t.key} ref={at === "now" ? nowRef : undefined} type="button" onClick={() => at !== "now" && go(t.key)}
      className={`group block text-left ${onePager ? "w-full" : "w-[150px] flex-none md:w-[176px]"} ${at === "now" ? "cursor-default" : "cursor-pointer"}`}>
      <div className={`relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-800 ring-brand transition ${at === "now" ? "ring-[3px]" : "group-hover:ring-2"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {t.image && <img src={thumb(t.image)} alt="" loading="lazy" className={`h-full w-full object-cover transition-opacity ${at === "past" ? "opacity-50" : "opacity-90 group-hover:opacity-100"}`} />}
        {at === "done" && (
          <span className="absolute inset-0 flex items-center justify-center bg-green-600/45">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-xl font-bold text-white shadow-lg">✓</span>
          </span>
        )}
      </div>
      <div className={`mt-1.5 truncate text-[13px] font-semibold ${at === "done" ? "text-green-300" : at === "now" ? "text-brand" : at === "past" ? "text-slate-500" : "text-slate-100"}`}>{taskName(t)}</div>
    </button>
  );

  if (onePager) {
    return (
      <div ref={rootRef} className="mx-auto flex max-w-[1880px] gap-8 px-4 pb-4 pt-4 md:px-10" style={{ height: onePagerH }}>
        {/* The left column and the stage: a preview rested on opens big over both. */}
        <div data-lift-area className="flex min-w-0 flex-1 gap-8">
          <aside className="flex w-[320px] shrink-0 flex-col">
            {head}
            <div className="mt-5">{links}</div>
            <div className="mt-4">{count}</div>
            <div ref={setSide} className="mt-6 min-h-0 flex-1 overflow-y-auto border-t border-white/10 pr-1 pt-5" />
          </aside>
          <main className="min-h-0 min-w-0 flex-1">{body}</main>
        </div>
        <aside className="flex w-[184px] shrink-0 flex-col">
          <h2 className="mb-3 text-base font-bold text-white">Up next</h2>
          <div ref={stripRef} className="relative min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {strip.map(tile)}
          </div>
        </aside>
        {toast && <ToastBar toast={toast} />}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mx-auto max-w-[1880px] px-4 pb-28 pt-4 md:px-10 md:pb-16">
      <div className="flex shrink-0 items-start gap-6">
        <div className="min-w-0 flex-1">{head}</div>
        <div className="shrink-0 text-right">{links}<div className="mt-3">{count}</div></div>
      </div>
      <div className="mt-6">{body}</div>
      {strip.length > 1 && (
        <div className="mt-12">
          <div className="mb-2 flex items-baseline justify-between"><h2 className="text-base font-bold text-white">Up next</h2><span className="text-xs text-slate-500">Tap one to jump to it</span></div>
          <div ref={stripRef} className="relative -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
            {strip.map(tile)}
          </div>
        </div>
      )}
      {toast && <ToastBar toast={toast} />}
    </div>
  );
}

/** "Saved · +2 Jannik", for a few seconds after a save (the back arrow takes it back). */
function ToastBar({ toast }: { toast: Toast }) {
  return (
    <div key={toast.at} className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm shadow-2xl backdrop-blur md:bottom-8 lg:bottom-auto lg:left-auto lg:right-8 lg:top-8 lg:mx-0 lg:w-80">
      <span className="min-w-0 flex-1 truncate font-bold text-white">{toast.text}</span>
    </div>
  );
}
