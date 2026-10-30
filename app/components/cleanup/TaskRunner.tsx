"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { CropEditorProps } from "@/app/components/parkpage/ParkHeaderModal";
import type { CoasterGalleryImage } from "@/app/components/coasterpage/coasterPageTypes";
import FramePreview from "./FramePreview";
import { api, isFraming, KIND_GROUP, KIND_LABEL, pageUrl, saveFraming, taskTitle, taskWhere, thumb, type CleanupPerson, type CleanupTask } from "./shared";

const CropEditor = dynamic<CropEditorProps>(() => import("@/app/components/parkpage/ParkHeaderModal").then((m) => m.CropEditor), { ssr: false });
const CoasterStripEditor = dynamic(() => import("@/app/components/coasterpage/CoasterStripEditor"), { ssr: false });

const DEFAULT = "0.5000 0.5000 1.000";

function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const set = () => setWide(mq.matches); set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return wide;
}

/** What the page draws over the photo, so the crop is judged with it. */
function Face({ task, frame }: { task: CleanupTask; frame: "Phone" | "Desktop" }) {
  const hero = task.kind === "park-hero" || task.kind === "visit-hero" || task.kind === "coaster-hero";
  const tag = <span className="absolute left-2.5 top-2.5 rounded-full bg-slate-950/65 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">{frame}</span>;
  if (hero) {
    const name = task.kind === "coaster-hero" ? task.coasterName : task.parkName;
    return <>
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#0f172a] via-[#0f172a]/65 to-transparent" />
      <div className="absolute bottom-[8%] left-[5%] right-[5%] font-bold leading-[0.95] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]" style={{ fontSize: frame === "Phone" ? "11cqw" : "4.2cqw" }}>{name}</div>
      {tag}
    </>;
  }
  if (task.kind === "park-card") {
    return <>
      <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute left-[6%] top-[5%] right-[6%] font-bold text-white drop-shadow" style={{ fontSize: "7.5cqw" }}>{task.parkName}</div>
      <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/70 to-transparent" />
      <span className="absolute left-2.5 bottom-2.5 rounded-full bg-slate-950/65 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">{frame}</span>
    </>;
  }
  if (task.kind === "curated-photo" && task.label) {
    return <>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-10 text-[13px] font-medium text-white">{task.label}</div>
      {tag}
    </>;
  }
  return tag;
}

function Btn({ children, onClick, primary, disabled, title, submit }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; title?: string; submit?: boolean }) {
  return (
    <button type={submit ? "submit" : "button"} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex flex-1 md:flex-none items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${primary ? "bg-brand text-white hover:bg-brand-light" : "border border-slate-700 text-slate-200 hover:border-slate-500"}`}>
      {children}
    </button>
  );
}

// ─── framing ─────────────────────────────────────────────────────────────────

function FramingFixer({ task, wide, busy, onSave, onOk }: { task: CleanupTask; wide: boolean; busy: boolean; onSave: (focus: string[]) => void; onOk: () => void }) {
  const frames = task.frames ?? [];
  const separate = task.kind === "coaster-hero";
  const [focus, setFocus] = useState<string>(task.focus || DEFAULT);
  const [focuses, setFocuses] = useState<string[]>(() => frames.map((f) => f.focus || DEFAULT));
  const src = task.image ? thumb(task.image, 1920) : "";
  const preview = task.image ? thumb(task.image, 1200) : "";
  const order = wide ? [...frames].sort((a, b) => (a.name === "Desktop" ? -1 : b.name === "Desktop" ? 1 : 0)) : [...frames].sort((a, b) => (a.name === "Phone" ? -1 : b.name === "Phone" ? 1 : 0));
  const primary = order[0];
  const maxZoom = task.kind === "curated-photo" ? 1 : 4;
  const narrow = task.kind === "park-card" || task.kind === "curated-photo";

  const cell = (f: (typeof frames)[number], i: number) => {
    const idx = frames.indexOf(f);
    const editable = separate || f === primary;
    const width = narrow ? (wide ? (f.name === "Desktop" ? 320 : 240) : undefined) : undefined;
    // Never taller than about 60% of the window, so the buttons stay in view.
    const [aw, ah] = f.aspect.split("/").map((x) => parseFloat(x));
    const maxW = aw && ah ? `calc(60vh * ${(aw / ah).toFixed(4)})` : undefined;
    return (
      <div key={f.name} className="min-w-0" style={width ? { width } : { maxWidth: maxW }}>
        {editable ? (
          <CropEditor
            key={`${task.key}-${f.name}`}
            src={src}
            aspectRatio={f.aspect}
            focusStr={separate ? focuses[idx] : focus}
            onCommit={(v) => (separate ? setFocuses((a) => a.map((x, j) => (j === idx ? v : x))) : setFocus(v))}
            onChange={(v) => (separate ? setFocuses((a) => a.map((x, j) => (j === idx ? v : x))) : setFocus(v))}
            clampAspect={f.clampAspect}
            maxZoom={maxZoom}
            className="w-full rounded-2xl"
            style={{ aspectRatio: f.aspect, containerType: "inline-size" } as React.CSSProperties}
          >
            <Face task={task} frame={f.name} />
            {i === 0 && <span className="absolute right-3 top-3 text-[9px] font-bold uppercase tracking-widest text-white/55">Drag{maxZoom > 1 ? " · scroll or pinch to zoom" : ""}</span>}
          </CropEditor>
        ) : (
          <FramePreview src={preview} focus={focus} aspect={f.aspect} className="rounded-2xl">
            <Face task={task} frame={f.name} />
          </FramePreview>
        )}
        {!editable && <p className="mt-1.5 text-[11px] text-slate-500">Follows the {primary.name.toLowerCase()} frame: one framing for both.</p>}
      </div>
    );
  };

  const grid = narrow
    ? "flex flex-wrap items-start gap-4"
    : wide && order.length > 1 ? "grid items-start gap-4 grid-cols-[3fr_1fr]" : "grid gap-4";
  return (
    <>
      <div className={grid} style={!narrow && wide && order.length > 1 && task.kind === "section-photo" ? { gridTemplateColumns: "2fr 1fr" } : undefined}>
        {order.map(cell)}
      </div>
      <div className="mt-5 flex flex-wrap gap-2.5 md:justify-end">
        <Btn onClick={onOk} disabled={busy} title="Nothing to change: mark it checked">✓ Looks right as is</Btn>
        <Btn primary onClick={() => onSave(separate ? focuses : [focus])} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
      </div>
    </>
  );
}

// ─── caption ─────────────────────────────────────────────────────────────────

function CaptionFixer({ task, busy, onSave, onOk }: { task: CleanupTask; busy: boolean; onSave: (text: string) => void; onOk: () => void }) {
  const cur = task.caption?.current ?? "";
  const [text, setText] = useState(task.caption?.why === "No caption" ? "" : cur);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, [task.key]);
  return (
    <div className="grid gap-5 md:grid-cols-[3fr_2fr] md:items-start">
      <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950" style={{ maxHeight: "62vh" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(task.image, 1200)} alt="" className="max-h-[62vh] w-auto max-w-full object-contain" />
      </div>
      <div>
        <p className="text-sm text-slate-400">{task.caption?.why}{cur ? <> · now <span className="text-slate-200">“{cur}”</span></> : null}</p>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) onSave(text.trim()); }}>
          <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
            placeholder="What's in the photo? For example: Tower of Terror at dusk"
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-[15px] text-white outline-none focus:border-brand" />
          <p className="mt-2 text-xs text-slate-500">Shown under the photo in the deck and the viewer, and read by Google as its description.</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {cur && <Btn onClick={onOk} disabled={busy}>Fine as it is</Btn>}
            <Btn primary submit disabled={busy || !text.trim() || text.trim() === cur}>{busy ? "Saving…" : "Save caption"}</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── review section without a photo ──────────────────────────────────────────

type Pickable = { id: number; path: string; description?: string; title?: string };
function SectionPhotoFixer({ task, busy, onAdd, onOk }: { task: CleanupTask; busy: boolean; onAdd: (url: string) => void; onOk: () => void }) {
  const [photos, setPhotos] = useState<Pickable[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    setPhotos(null); setSel(null);
    const url = task.section?.table === "coastertext" ? `/api/coasters/${task.coasterId}/gallery` : `/api/visits/${task.visitId}/gallery`;
    fetch(url).then((r) => r.json()).then((d) => setPhotos(((d.gallery ?? []) as Pickable[]).filter((g) => g.path && !/\.(mp4|webm|mov|ogg)$/i.test(g.path)))).catch(() => setPhotos([]));
  }, [task.key, task.section?.table, task.coasterId, task.visitId]);
  return (
    <div>
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{task.section?.heading}</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-slate-300">{task.section?.excerpt}</p>
      </div>
      <p className="mb-2 mt-5 text-sm text-slate-400">Tap the photo that belongs here. Its framing then shows up under Review photos.</p>
      {photos === null ? <p className="text-sm text-slate-500">Loading photos…</p> : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setSel(p.path)} title={p.description || p.title}
              className={`relative aspect-[3/2] overflow-hidden rounded-xl border-2 cursor-pointer ${sel === p.path ? "border-brand" : "border-transparent hover:border-slate-500"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(p.path)} alt="" loading="lazy" className="h-full w-full object-cover" />
              {p.description && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] text-white/90 line-clamp-1">{p.description}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2.5 md:justify-end">
        <Btn onClick={onOk} disabled={busy} title="This section is better without a photo">No photo needed</Btn>
        <Btn primary onClick={() => sel && onAdd(sel)} disabled={busy || !sel}>{busy ? "Saving…" : "Add this photo"}</Btn>
      </div>
    </div>
  );
}

// ─── curated pick ────────────────────────────────────────────────────────────

function CuratedFixer({ task, busy, onPicked }: { task: CleanupTask; busy: boolean; onPicked: () => void }) {
  const [gallery, setGallery] = useState<CoasterGalleryImage[] | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => fetch(`/api/visits/${task.visitId}/gallery`).then((r) => r.json()).then((d) => setGallery(d.gallery ?? [])).catch(() => setGallery([]));
  useEffect(() => { setGallery(null); load(); }, [task.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const photos = (gallery ?? []).filter((g) => !/\.(mp4|webm|mov|ogg)$/i.test(g.path));
  return (
    <div>
      <p className="text-sm text-slate-400">Until photos are picked, the page shows the first 12 of {task.choices ?? photos.length}. Pick the ones that sell the park, in the order they should appear.</p>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {photos.slice(0, 16).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={thumb(p.path)} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-xl object-cover opacity-80" />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2.5 md:justify-end">
        <Btn primary onClick={() => setOpen(true)} disabled={busy || !gallery}>Pick photos</Btn>
      </div>
      {open && gallery && (
        <CoasterStripEditor
          coasterId={0}
          coasterName={task.parkName}
          gallery={gallery}
          endpoint={`/api/visits/${task.visitId}/gallery`}
          focusEditing
          emptyNote="Nothing picked: the page shows the first 12 photos."
          onClose={() => setOpen(false)}
          onSaved={onPicked}
        />
      )}
    </div>
  );
}

// ─── runner ──────────────────────────────────────────────────────────────────

export default function TaskRunner({ queue, startKey, random, person, openCount, onDone, onExit, pickRandom, needPerson }: {
  queue: CleanupTask[];
  startKey?: string;
  /** Hand out a fresh random task after each one instead of walking the queue. */
  random?: boolean;
  person: CleanupPerson | null;
  openCount: number;
  onDone: (t: CleanupTask) => void;
  onExit: () => void;
  pickRandom: (not: Set<string>) => CleanupTask | null;
  needPerson: () => void;
}) {
  const wide = useWide();
  const [key, setKey] = useState<string | undefined>(startKey ?? queue[0]?.key);
  const skipped = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const byKey = useMemo(() => new Map(queue.map((t) => [t.key, t])), [queue]);
  const task = key ? byKey.get(key) : undefined;
  const idx = task ? queue.indexOf(task) : -1;
  const upcoming = random ? [] : queue.slice(idx + 1).filter((t) => !skipped.current.has(t.key)).slice(0, 14);

  useEffect(() => { setError(null); window.scrollTo({ top: 0 }); }, [key]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const advance = (from: CleanupTask) => {
    if (random) { const n = pickRandom(new Set([...skipped.current, from.key])); setKey(n?.key); return; }
    const after = queue.slice(queue.indexOf(from) + 1).find((t) => !skipped.current.has(t.key));
    setKey(after?.key ?? queue.find((t) => t.key !== from.key && !skipped.current.has(t.key))?.key);
  };
  const skip = () => { if (!task) return; skipped.current.add(task.key); advance(task); };
  const run = async (fn: () => Promise<unknown>) => {
    if (!task) return;
    if (!person) { needPerson(); return; }
    setBusy(true); setError(null);
    try {
      await fn();
      setToast(`+1 ${person} · ${Math.max(0, openCount - 1)} left`);
      const done = task;
      advance(done);
      onDone(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (!task) {
    return (
      <div className="mx-auto max-w-[1560px] px-4 pb-16 pt-6 md:px-12">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>
        <div className="mt-16 text-center">
          <p className="text-3xl font-bold text-white">All done here</p>
          <p className="mt-2 text-slate-400">Nothing left in this list.</p>
          <div className="mt-6"><Btn primary onClick={onExit}>Back to the overview</Btn></div>
        </div>
      </div>
    );
  }

  const stateChip = isFraming(task.kind)
    ? task.state === "never" ? <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-orange-300">Never framed · shows the centre</span>
      : <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">Framed before · check it</span>
    : task.kind === "caption" ? <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-orange-300">{task.caption?.why}</span> : null;

  return (
    <div className="mx-auto max-w-[1560px] px-4 pb-16 pt-4 md:px-12">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>
        <span className="text-xs text-slate-500">{random ? "Random quick fixes" : `${queue.length - skipped.current.size} in this list`} · {openCount} open</span>
      </div>

      <div className="mt-4 mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">{KIND_GROUP[task.kind]} · {KIND_LABEL[task.kind]}</p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight text-white md:text-[34px]">{taskTitle(task)}</h1>
          <p className="mt-1 text-sm text-slate-400 md:text-[15px]">{taskWhere(task)}{task.kind === "section-photo" && task.section ? ` · ${task.section.heading}` : ""}</p>
          {stateChip && <div className="mt-3">{stateChip}</div>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href={pageUrl(task)} target="_blank" className="font-bold uppercase tracking-widest text-brand text-xs hover:text-brand-light">Open page ↗</Link>
          <button type="button" onClick={skip} className="rounded-xl border border-slate-700 px-4 py-2 font-bold text-slate-300 hover:border-slate-500 cursor-pointer">Skip</button>
        </div>
      </div>

      {task.kind === "section-photo" && task.section?.excerpt && (
        <p className="mb-4 line-clamp-2 max-w-3xl text-sm text-slate-500">“{task.section.excerpt}”</p>
      )}

      {isFraming(task.kind) && (
        <FramingFixer key={task.key} task={task} wide={wide} busy={busy}
          onSave={(f) => run(() => saveFraming(task, f, person!))}
          onOk={() => run(() => api("ok", task.key, person!))} />
      )}
      {task.kind === "caption" && (
        <CaptionFixer key={task.key} task={task} busy={busy}
          onSave={(text) => run(() => api("caption", task.key, person!, { text }))}
          onOk={() => run(() => api("ok", task.key, person!))} />
      )}
      {task.kind === "section-needs-photo" && (
        <SectionPhotoFixer key={task.key} task={task} busy={busy}
          onAdd={(url) => run(() => api("section-add", task.key, person!, { url }))}
          onOk={() => run(() => api("ok", task.key, person!))} />
      )}
      {task.kind === "curated-pick" && (
        <CuratedFixer key={task.key} task={task} busy={busy} onPicked={() => run(() => api("done", task.key, person!))} />
      )}

      {error && <p className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</p>}

      {upcoming.length > 0 && (
        <div className="mt-10">
          <div className="mb-2.5 flex items-baseline justify-between"><h2 className="text-base font-bold text-white">Up next</h2><span className="text-xs text-slate-500">Tap one to jump to it</span></div>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {upcoming.map((t) => (
              <button key={t.key} type="button" onClick={() => setKey(t.key)} className="w-[96px] flex-none text-left cursor-pointer md:w-[120px]">
                <div className="aspect-[4/5] overflow-hidden rounded-xl bg-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.image && <img src={thumb(t.image)} alt="" loading="lazy" className="h-full w-full object-cover opacity-85" />}
                </div>
                <div className="mt-1.5 truncate text-xs text-slate-300">{t.coasterName ?? t.label ?? t.parkName}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-md rounded-2xl border border-green-800 bg-green-950/95 px-4 py-3 text-sm text-green-100 shadow-2xl md:bottom-8">
          <b className="text-white">{toast.split(" · ")[0]}</b> · {toast.split(" · ")[1]}
        </div>
      )}
    </div>
  );
}
