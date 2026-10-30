"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { parseFocusStr } from "@/app/components/FocusedImage";
import type { CoasterGalleryImage } from "@/app/components/coasterpage/coasterPageTypes";
import LivePreview, { focusValue, previewViewport } from "./LivePreview";
import { api, send, fmtDate, PLACE_TITLE, thumb, type CleanupPerson, type CleanupTask, type FramePlace, type FrameSlot, type SlotView } from "./shared";

const CoasterStripEditor = dynamic(() => import("@/app/components/coasterpage/CoasterStripEditor"), { ssr: false });

const CENTRE = "0.5000 0.5000 1.000";
const isVideo = (p: string) => /\.(mp4|webm|mov|ogg)$/i.test(p);

function Btn({ children, onClick, primary, disabled, title, submit }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; title?: string; submit?: boolean }) {
  return (
    <button type={submit ? "submit" : "button"} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${primary ? "bg-brand text-white hover:bg-brand-light" : "border border-slate-700 text-slate-200 hover:border-slate-500"}`}>
      {children}
    </button>
  );
}

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Status({ slot, changed }: { slot: FrameSlot; changed: boolean }) {
  const cls = "rounded-full px-2 py-0.5 text-[11px] font-bold";
  if (changed) return <span className={`${cls} bg-brand/20 text-orange-200`}>Changed</span>;
  if (slot.done) return <span className={`${cls} bg-green-500/15 text-green-300`}>✓ Checked</span>;
  if (slot.fresh) return <span className={`${cls} bg-brand/15 text-orange-300`} title={slot.fallbackFrom ? `Not set yet: shows the ${slot.fallbackFrom} framing` : "Not set yet: shows the centre"}>New</span>;
  return <span className={`${cls} bg-slate-800 text-slate-300`}>Framed before</span>;
}

/** A photo with no text on it (list photos): a plain frame of its shape, dragged with object-position. */
function PlainFrame({ photo, aspect, value, onChange, maxW, maxH, label, badge }: { photo: string; aspect: string; value: string; onChange: (v: string) => void; maxW: number; maxH: number; label: React.ReactNode; badge: React.ReactNode }) {
  const ref = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [a, b] = aspect.split("/").map(parseFloat);
  const w = Math.min(maxW, maxH * (a / b));
  const { cx, cy } = parseFocusStr(value);
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex min-h-[24px] items-center justify-between gap-3 text-sm">{label}{badge}</figcaption>
      <div className="relative cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-slate-900 active:cursor-grabbing" style={{ width: w, aspectRatio: aspect }}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx, cy }; e.preventDefault(); }}
        onPointerMove={(e) => {
          const d = drag.current, img = ref.current; if (!d || !img || !img.naturalWidth) return;
          const W = img.clientWidth, H = img.clientHeight, s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
          const ox = img.naturalWidth * s - W, oy = img.naturalHeight * s - H;
          const nx = ox > 0.5 ? Math.max(0, Math.min(1, d.cx - (e.clientX - d.x) / ox)) : d.cx;
          const ny = oy > 0.5 ? Math.max(0, Math.min(1, d.cy - (e.clientY - d.y) / oy)) : d.cy;
          onChange(focusValue(nx, ny, 1));
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={ref} src={thumb(photo, 1200)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${cx * 100}% ${cy * 100}%` }} />
      </div>
    </figure>
  );
}

// ─── change photo ────────────────────────────────────────────────────────────

type Candidate = { id: number; path: string; title?: string; description?: string; featured?: boolean; visit_date?: string };

/**
 * Pick another photo for this place from the park's or coaster's gallery and
 * save it through the endpoint the page's own editor uses. Returns the key
 * the place has afterwards.
 */
function ChangePhoto({ task, place, onClose, onChanged }: { task: CleanupTask; place: FramePlace; onClose: () => void; onChanged: (newKey: string) => void }) {
  const ch = place.change!;
  const [photos, setPhotos] = useState<Candidate[] | null>(null);
  const [rows, setRows] = useState<CoasterGalleryImage[]>([]);
  const [sel, setSel] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpoint = ch.t === "park-header" || ch.t === "card" ? `/api/park/${ch.parkId}/gallery`
    : ch.t === "coaster-header" || ch.t === "coaster-curated" ? `/api/coasters/${ch.coasterId}/gallery`
    : `/api/visits/${ch.visitId}/gallery`;
  useEffect(() => {
    fetch(endpoint, { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const g = ((d.gallery ?? []) as CoasterGalleryImage[]).filter((x) => x.path && !isVideo(x.path));
      setRows(d.gallery ?? []);
      // Curated: the photos not picked yet. Covers and cards: every photo.
      setPhotos((ch.t === "curated" || ch.t === "coaster-curated" ? g.filter((x) => !x.featured) : g) as Candidate[]);
    }).catch(() => setPhotos([]));
  }, [endpoint, ch.t]);

  // Swap one curated image for another, as the curated picker saves: the picks in
  // page order, then the gallery order refilled so the new photo takes the old one's place.
  const swapPick = async (api: string, oldId: number, newId: number) => {
    const all = rows.map((r) => r.id);
    const order = rows.filter((r) => r.featured && !isVideo(r.path)).map((r) => r.id).map((id) => (id === oldId ? newId : id));
    await send(api, "PATCH", { featuredIds: order });
    const picked = new Set(order);
    const slots = all.map((id, i) => (picked.has(id) ? i : -1)).filter((i) => i >= 0);
    const next = [...all];
    slots.forEach((slot, k) => { next[slot] = order[k]; });
    if (next.some((id, i) => id !== all[i])) await send(api, "PUT", { reorderedIds: next });
  };

  const save = async () => {
    if (!sel) return;
    setBusy(true); setError(null);
    try {
      let key = task.key;
      if (ch.t === "park-header") {
        if (ch.visitId) { await send(`/api/visits/${ch.visitId}/header`, "PATCH", { imagepath: sel.path, focus: CENTRE, focusMobile: null }); key = `cover:visit:${ch.visitId}`; }
        else { await send(`/api/park/${ch.parkId}`, "PATCH", { imagepath: sel.path, headerFocus: CENTRE, headerFocusMobile: null }); key = `cover:park:${ch.parkId}`; }
      } else if (ch.t === "card") {
        await send(`/api/park/${ch.parkId}`, "PATCH", { cardImagepath: sel.path === ch.headerPath ? null : sel.path, imageFocus: CENTRE });
      } else if (ch.t === "coaster-header") {
        await send(`/api/coasters/${ch.coasterId}/gallery`, "PATCH", { imageId: sel.id });
      } else if (ch.t === "curated") {
        await swapPick(`/api/visits/${ch.visitId}/gallery`, ch.rowId, sel.id);
        key = `curated:${sel.id}`;
      } else if (ch.t === "coaster-curated") {
        await swapPick(`/api/coasters/${ch.coasterId}/gallery`, ch.rowId, sel.id);
        key = `coaster-curated:${ch.coasterId}:${sel.id}`;
      }
      onChanged(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not saved");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 md:items-center md:p-6" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-3">
          <h2 className="text-base font-bold text-white">Change photo · {PLACE_TITLE[place.kind].toLowerCase()}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer" aria-label="Close">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {photos === null ? <p className="p-6 text-center text-sm text-slate-500">Loading photos…</p> : !photos.length ? <p className="p-6 text-center text-sm text-slate-500">No other photos to pick from.</p> : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {photos.map((p) => {
                const current = p.path === task.image;
                return (
                  <button key={p.id} type="button" disabled={current} onClick={() => setSel(p)} title={p.description || p.title}
                    className={`relative aspect-square overflow-hidden rounded-xl border-2 ${sel?.id === p.id ? "border-brand" : "border-transparent"} ${current ? "cursor-default opacity-40" : "cursor-pointer hover:border-slate-500"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(p.path)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {current && <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10px] font-bold text-white">Now</span>}
                    {!current && p.visit_date && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{fmtDate(p.visit_date)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-800 px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs text-slate-500">{error ?? "Saved at once; the framing starts at the centre."}</p>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary onClick={save} disabled={!sel || busy}>{busy ? "Saving…" : "Use this photo"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── a place's framings ──────────────────────────────────────────────────────

function PlaceFramer({ task, busy, onSave, onChanged }: {
  task: CleanupTask;
  busy: boolean;
  onSave: (items: { slot: string; value?: string }[]) => void;
  onChanged: (newKey: string | null) => void;
}) {
  const place = task.place!;
  const start = useMemo(() => Object.fromEntries(place.slots.map((s) => [s.id, s.value || s.fallback || CENTRE])), [task.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [values, setValues] = useState<Record<string, string>>(start);
  const [changing, setChanging] = useState(false);
  const [picker, setPicker] = useState<CoasterGalleryImage[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const changed = (s: FrameSlot) => values[s.id] !== start[s.id];
  const anyChanged = place.slots.some(changed);
  const todo = place.slots.filter((s) => changed(s) || !s.done);
  const save = () => onSave(todo.map((s) => (changed(s) ? { slot: s.id, value: values[s.id] } : { slot: s.id })));

  // Room per frame: phones keep their real size where it fits, desktops take the rest.
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const maxH = Math.max(260, Math.min(560, vh * 0.58));
  const views: { s: FrameSlot; v: SlotView | null }[] = place.slots.flatMap((s): { s: FrameSlot; v: SlotView | null }[] => (s.views.length ? s.views.map((v) => ({ s, v })) : [{ s, v: null }]));
  const phones = views.filter((x) => x.v?.screen === "phone").length;
  const narrow = width < 760;
  const phoneW = narrow ? width : Math.min(400, (width - 24 * (views.length - 1)) / Math.max(1, views.length));
  const desktopW = narrow ? width : Math.max(280, width - phones * (Math.min(phoneW, maxH * 0.8) + 24));
  const label = (s: FrameSlot, screen?: string) => {
    const multi = s.views.length > 1;
    const text = multi ? (screen === "phone" ? "Phone" : "Desktop") : s.label;
    return <span className="font-bold text-white">{text}{multi && <span className="ml-1.5 font-normal text-slate-500">· same framing</span>}</span>;
  };
  const ch = place.change;
  const coasterNoPicks = ch?.t === "coaster-curated" && !ch.picked;
  const openPicker = async () => {
    if (ch?.t !== "coaster-curated") return;
    const d = await fetch(`/api/coasters/${ch.coasterId}/gallery`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    setPicker(d.gallery ?? []);
  };

  return (
    <div>
      <div ref={wrapRef} className={`flex gap-6 ${narrow ? "flex-col" : "flex-row flex-wrap items-start"}`}>
        {views.map(({ s, v }) => {
          const badge = <Status slot={s} changed={changed(s)} />;
          const set = (val: string) => setValues((m) => (m[s.id] === val ? m : { ...m, [s.id]: val }));
          if (!v) return <PlainFrame key={s.id} photo={task.image!} aspect={s.aspect ?? "4 / 3"} value={values[s.id]} onChange={set} maxW={narrow ? width : 560} maxH={maxH} label={label(s)} badge={badge} />;
          return (
            <LivePreview
              key={`${task.key}|${s.id}|${v.screen}`}
              page={v.page}
              target={v.target}
              viewport={previewViewport(v.screen)}
              photo={task.image!}
              value={values[s.id]}
              onChange={set}
              maxZoom={s.maxZoom}
              clampAspect={s.clampAspect}
              maxW={v.screen === "phone" ? phoneW : desktopW}
              maxH={maxH}
              label={label(s, v.screen)}
              badge={badge}
            />
          );
        })}
      </div>

      <div className="mt-3 text-xs text-slate-500">
        {place.slots.some((s) => s.maxZoom > 1) ? "Drag to move · scroll or pinch to zoom" : "Drag to move"}
        {place.note && <span className="block mt-1">{place.note}</span>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 border-t border-white/10 bg-[#0f172a]/95 px-4 py-3 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        {ch && !coasterNoPicks && <Btn onClick={() => setChanging(true)}>Change photo</Btn>}
        {coasterNoPicks && <Btn onClick={openPicker}>Pick curated images</Btn>}
        {anyChanged && <button type="button" onClick={() => setValues(start)} className="px-2 text-sm text-slate-400 hover:text-white cursor-pointer">Undo</button>}
        <span className="flex-1" />
        <Btn primary onClick={save} disabled={busy || !todo.length}>{busy ? "Saving…" : anyChanged ? "Save" : "✓ Looks right"}</Btn>
      </div>

      {changing && <ChangePhoto task={task} place={place} onClose={() => setChanging(false)} onChanged={(k) => { setChanging(false); onChanged(k); }} />}
      {picker && ch?.t === "coaster-curated" && (
        <CoasterStripEditor coasterId={ch.coasterId} coasterName={task.coasterName ?? ""} gallery={picker}
          onClose={() => setPicker(null)} onSaved={() => { setPicker(null); onChanged(null); }} />
      )}
    </div>
  );
}

// ─── caption ─────────────────────────────────────────────────────────────────

function CaptionFixer({ task, busy, onSave, onOk }: { task: CleanupTask; busy: boolean; onSave: (text: string) => void; onOk: () => void }) {
  const cur = task.caption?.current ?? "";
  const [text, setText] = useState(task.caption?.why === "No caption" ? "" : cur);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, [task.key]);
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
      <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(task.image, 1200)} alt="" className="max-h-[60vh] w-auto max-w-full object-contain" />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) onSave(text.trim()); }}>
        <p className="text-sm text-slate-400">{task.caption?.why}{cur ? <> · now “<span className="text-slate-200">{cur}</span>”</> : null}</p>
        <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
          placeholder="What's in the photo?"
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-[15px] text-white outline-none focus:border-brand" />
        <div className="mt-4 flex flex-wrap gap-2.5">
          {cur && <Btn onClick={onOk} disabled={busy}>Fine as it is</Btn>}
          <Btn primary submit disabled={busy || !text.trim() || text.trim() === cur}>{busy ? "Saving…" : "Save caption"}</Btn>
        </div>
      </form>
    </div>
  );
}

// ─── curated pick ────────────────────────────────────────────────────────────

function CuratedPick({ task, busy, onPicked }: { task: CleanupTask; busy: boolean; onPicked: () => void }) {
  const [gallery, setGallery] = useState<CoasterGalleryImage[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setGallery(null);
    fetch(`/api/visits/${task.visitId}/gallery`, { cache: "no-store" }).then((r) => r.json()).then((d) => setGallery(d.gallery ?? [])).catch(() => setGallery([]));
  }, [task.visitId, task.key]);
  const photos = (gallery ?? []).filter((g) => !isVideo(g.path));
  return (
    <div>
      <p className="text-sm text-slate-400">Nothing is picked, so the page shows the first 12 of {task.choices ?? photos.length} photos.</p>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {photos.slice(0, 16).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={thumb(p.path)} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-xl object-cover opacity-80" />
        ))}
      </div>
      <div className="mt-5"><Btn primary onClick={() => setOpen(true)} disabled={busy || !gallery}>Pick curated images</Btn></div>
      {open && gallery && (
        <CoasterStripEditor coasterId={0} coasterName={task.parkName} gallery={gallery} endpoint={`/api/visits/${task.visitId}/gallery`}
          focusEditing emptyNote="Nothing picked: the page shows the first 12 photos." onClose={() => setOpen(false)} onSaved={onPicked} />
      )}
    </div>
  );
}

// ─── runner ──────────────────────────────────────────────────────────────────

export default function TaskRunner({ queue, startKey, random, title, person, onDone, onReload, onExit, pickRandom, needPerson }: {
  queue: CleanupTask[];
  startKey?: string;
  /** Hand out a fresh random task after each one instead of walking the queue. */
  random?: boolean;
  /** What is being worked through ("Front page cards", "Bakken", "Random fixes"). */
  title: string;
  person: CleanupPerson | null;
  /** The task is done: the page updates its numbers at once. credits = how many framings were credited. */
  onDone: (t: CleanupTask, credits: number) => void;
  /** Reload everything (after a photo change); resolves with the fresh tasks. */
  onReload: () => Promise<CleanupTask[]>;
  onExit: () => void;
  pickRandom: (not: Set<string>) => CleanupTask | null;
  needPerson: () => void;
}) {
  const [key, setKey] = useState<string | undefined>(startKey ?? queue[0]?.key);
  const skipped = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const task = key ? queue.find((t) => t.key === key) : undefined;
  const idx = task ? queue.findIndex((t) => t.key === task.key) : -1;

  useEffect(() => { setError(null); window.scrollTo({ top: 0 }); }, [key]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  // Warm the pages of the next tasks, so their previews come up quickly.
  useEffect(() => {
    if (random || idx < 0) return;
    const pages = new Set(queue.slice(idx + 1, idx + 3).flatMap((t) => t.place?.slots.flatMap((s) => s.views.map((v) => v.page)) ?? []));
    pages.forEach((p) => { void fetch(`${p.split("#")[0]}${p.includes("?") ? "&" : "?"}framing-preview=1`, { credentials: "same-origin" }).catch(() => {}); });
  }, [idx, queue, random]);

  const advance = (from: CleanupTask) => {
    if (random) { const n = pickRandom(new Set([...skipped.current, from.key])); setKey(n?.key); return; }
    const at = queue.findIndex((t) => t.key === from.key);
    const after = queue.slice(at + 1).find((t) => !skipped.current.has(t.key));
    setKey(after?.key ?? queue.find((t) => t.key !== from.key && !skipped.current.has(t.key))?.key);
  };
  const skip = () => { if (!task) return; skipped.current.add(task.key); advance(task); };
  const run = async (fn: () => Promise<unknown>, credits: number) => {
    if (!task) return;
    if (!person) { needPerson(); return; }
    setBusy(true); setError(null);
    try {
      await fn();
      if (credits) setToast(`+${credits} ${person}`);
      const done = task;
      advance(done);
      onDone(done, credits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  const changedPhoto = async (newKey: string | null) => {
    const fresh = await onReload();
    if (newKey && fresh.some((t) => t.key === newKey)) setKey(newKey);
    else if (task && !fresh.some((t) => t.key === task.key)) setKey(fresh.find((t) => !skipped.current.has(t.key))?.key);
  };

  if (!task) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-10">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>
        <div className="mt-16 text-center">
          <p className="text-2xl font-bold text-white">Nothing left here</p>
          <div className="mt-6"><Btn primary onClick={onExit}>Back to the overview</Btn></div>
        </div>
      </div>
    );
  }

  const place = task.place;
  const kindLabel = place ? PLACE_TITLE[place.kind] : task.kind === "caption" ? "Caption" : "Curated images to pick";
  const heading = place ? place.title : task.coasterName ?? task.parkName;
  const sub = place ? place.subtitle : task.coasterName ? task.parkName : task.visitDate ? fmtDate(task.visitDate) : undefined;
  const credits = place ? place.slots.filter((s) => !s.done).length : 1;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-4 md:px-10 md:pb-16">
      <div className="flex items-center gap-4 whitespace-nowrap text-sm">
        <button onClick={onExit} className="text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>
        <span className="hidden min-w-0 truncate text-slate-500 sm:block">{title}{!random && idx >= 0 ? ` · ${idx + 1} of ${queue.length}` : ""}</span>
        <span className="flex-1" />
        <Link href={task.pageUrl} target="_blank" className="whitespace-nowrap text-slate-400 hover:text-white">Open page ↗</Link>
        <button type="button" onClick={skip} className="whitespace-nowrap text-slate-400 hover:text-white cursor-pointer">Skip ›</button>
      </div>

      <div className="mb-5 mt-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">{kindLabel}</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight text-white md:text-3xl">{heading}</h1>
        {sub && <p className="mt-0.5 text-sm text-slate-400">{sub}</p>}
      </div>

      {place && (
        <PlaceFramer key={task.key} task={task} busy={busy}
          onSave={(items) => run(() => api("place", task.key, person!, { items }), credits)}
          onChanged={(k) => { void changedPhoto(k); }} />
      )}
      {task.kind === "caption" && (
        <CaptionFixer key={task.key} task={task} busy={busy}
          onSave={(text) => run(() => api("caption", task.key, person!, { text }), 1)}
          onOk={() => run(() => api("ok", task.key, person!), 1)} />
      )}
      {task.kind === "curated-pick" && (
        <CuratedPick key={task.key} task={task} busy={busy} onPicked={() => run(() => api("done", task.key, person!), 1)} />
      )}

      {error && <p className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</p>}

      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-xs rounded-2xl border border-green-800 bg-green-950/95 px-4 py-2.5 text-center text-sm font-bold text-green-100 shadow-2xl md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}
