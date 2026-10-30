"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CropEditor, HeaderFace, CardFace, ScaledLayer } from "@/app/components/parkpage/ParkHeaderModal";
import { parseFocusStr } from "@/app/components/FocusedImage";
import type { CoasterGalleryImage } from "@/app/components/coasterpage/coasterPageTypes";
import type { CleanupPark } from "@/app/lib/cleanup";
import type { Visit } from "@/app/types";
import FramePreview from "./FramePreview";
import { api, KIND_LABEL, openSlots, pageUrl, SLOT_SHORT, slotSummary, taskTitle, taskWhere, thumb, type CleanupPerson, type CleanupTask, type FrameSlot, type SlotKind } from "./shared";

const CoasterStripEditor = dynamic(() => import("@/app/components/coasterpage/CoasterStripEditor"), { ssr: false });

const CENTRE = "0.5000 0.5000 1.000";
const ratioOf = (a: string) => { const [w, h] = a.split("/").map(parseFloat); return w / h; };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const SLOT_ORDER: SlotKind[] = ["hero-phone", "hero-desktop", "card", "curated", "coaster-strip", "section", "section-phone", "section-desktop", "break-phone", "break-desktop", "tile", "list-item", "list-cover"];
const SLOT_GROUP: Record<SlotKind, number> = {
  "hero-phone": 0, "hero-desktop": 0, card: 1, curated: 2, "coaster-strip": 2, section: 3, "section-phone": 3, "section-desktop": 3,
  "break-phone": 4, "break-desktop": 4, tile: 5, "list-item": 6, "list-cover": 6,
};
/** Heroes first, then card, curated, review, tiles, lists; within a group the formats of one page stay together. */
function orderSlots(raw: FrameSlot[]): FrameSlot[] {
  const first = new Map<string, number>();
  raw.forEach((s, i) => { if (!first.has(s.where)) first.set(s.where, i); });
  return [...raw].sort((a, b) => SLOT_GROUP[a.kind] - SLOT_GROUP[b.kind] || first.get(a.where)! - first.get(b.where)! || SLOT_ORDER.indexOf(a.kind) - SLOT_ORDER.indexOf(b.kind));
}

function useWindowSize() {
  const [win, setWin] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const set = () => setWin({ w: document.documentElement.clientWidth, h: window.innerHeight });
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);
  return win;
}

/**
 * The frame a format is drawn in, in CSS px. Heroes follow the page's own rule
 * (ParkHero: 4:5 capped at 82vh on phones, 21:9 capped at 68vh from 1024 px),
 * at this screen's size when it is that kind of screen, so the editor shows
 * exactly the band the page shows here.
 */
function realFrame(slot: FrameSlot, win: { w: number; h: number } | null): { w: number; h: number; aspect: string; yours?: boolean } {
  if (slot.kind === "hero-desktop") {
    if (win && win.w >= 1024) { const h = Math.round(Math.min((win.w * 9) / 21, win.h * 0.68)); return { w: win.w, h, aspect: `${win.w} / ${h}`, yours: true }; }
    return { w: 1440, h: 617, aspect: "1440 / 617" };
  }
  if (slot.kind === "hero-phone") {
    if (win && win.w < 640) { const h = Math.round(Math.min((win.w * 5) / 4, win.h * 0.82)); return { w: win.w, h, aspect: `${win.w} / ${h}`, yours: true }; }
    return { w: 384, h: 480, aspect: "4 / 5" };
  }
  if (slot.kind === "card") return { w: 400, h: 500, aspect: slot.aspect };
  const r = ratioOf(slot.aspect);
  return { w: 400, h: 400 / r, aspect: slot.aspect };
}

/** Draws children at a real page size, shrunk to whatever width this box has. */
function Scaled({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => setBoxW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="absolute inset-0 overflow-hidden">{boxW > 0 && <ScaledLayer w={w} h={h} scale={boxW / w}>{children}</ScaledLayer>}</div>;
}

/** What the page draws over the photo in this format, so the crop is judged with it. */
function SlotFace({ slot, frame, park }: { slot: FrameSlot; frame: { w: number; h: number }; park?: CleanupPark }) {
  if (slot.face === "hero") {
    const coaster = slot.target.t === "coaster-hero";
    return (
      <Scaled w={frame.w} h={frame.h}>
        <HeaderFace parkName={slot.faceText ?? ""} city={coaster ? park?.name : undefined} country={park?.country} phone={slot.kind === "hero-phone"} overall={slot.faceRating ?? null} />
      </Scaled>
    );
  }
  if (slot.face === "card") return <Scaled w={frame.w} h={frame.h}><CardFace parkName={slot.faceText ?? ""} parkCountry={park?.country} rating={(slot.faceVisit ?? null) as unknown as Visit | null} /></Scaled>;
  if (slot.face === "caption" && slot.faceText) {
    return <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-10 text-[13px] font-medium text-white line-clamp-3">{slot.faceText}</div>;
  }
  return null;
}

/**
 * Drag to set where an object-fit: cover photo sits in its frame (CSS
 * object-position), the way review photos, gallery tiles and list images are
 * drawn. No zoom: those formats have none.
 */
function PositionEditor({ src, aspect, value, onChange, className = "", children }: {
  src: string; aspect: string; value: string; onChange: (v: string) => void; className?: string; children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const nat = useRef<{ w: number; h: number } | null>(null);
  const { cx, cy } = parseFocusStr(value);
  const cur = useRef({ cx, cy });
  cur.current = { cx, cy };
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; });
  // A photo with the frame's own shape has nothing to move: say so instead of a dead drag.
  const [fits, setFits] = useState(false);
  const measure = () => {
    const el = ref.current; if (!el || !nat.current) return;
    const bw = el.clientWidth, bh = el.clientHeight;
    const s = Math.max(bw / nat.current.w, bh / nat.current.h);
    setFits(nat.current.w * s - bw < 1 && nat.current.h * s - bh < 1);
  };
  const measureRef = useRef(measure);
  measureRef.current = measure;
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) { nat.current = { w: img.naturalWidth, h: img.naturalHeight }; measureRef.current(); }
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => measureRef.current()); ro.observe(el);
    let drag: { x: number; y: number; cx: number; cy: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, ...cur.current }; el.setPointerCapture(e.pointerId); e.preventDefault(); };
    const move = (e: PointerEvent) => {
      if (!drag || !nat.current) return;
      const bw = el.clientWidth, bh = el.clientHeight;
      const s = Math.max(bw / nat.current.w, bh / nat.current.h);
      const ox = nat.current.w * s - bw, oy = nat.current.h * s - bh;
      const nx = ox > 0.5 ? clamp01(drag.cx - (e.clientX - drag.x) / ox) : drag.cx;
      const ny = oy > 0.5 ? clamp01(drag.cy - (e.clientY - drag.y) / oy) : drag.cy;
      change.current(`${nx.toFixed(4)} ${ny.toFixed(4)} 1`);
    };
    const up = () => { drag = null; };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <div ref={ref} className={`relative overflow-hidden bg-slate-900 cursor-grab active:cursor-grabbing select-none touch-none ${className}`} style={{ aspectRatio: aspect, containerType: "inline-size" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt="" draggable={false}
        onLoad={(e) => { nat.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }; measure(); }}
        className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none" style={{ objectPosition: `${cx * 100}% ${cy * 100}%` }} />
      {fits && <span className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-2.5 py-1 text-[11px] font-bold text-white">Fits this frame exactly · nothing to move</span>}
      {children && <div className="absolute inset-0 pointer-events-none">{children}</div>}
    </div>
  );
}

/** A read-only frame of one format, drawn with the page's rule for that format. */
function SlotPreview({ slot, src, value, aspect, className = "" }: { slot: FrameSlot; src: string; value: string; aspect: string; className?: string }) {
  if (slot.mode === "focus") return <FramePreview src={src} focus={value} aspect={aspect} className={className} />;
  const { cx, cy } = parseFocusStr(value);
  return (
    <div className={`relative overflow-hidden bg-slate-950 ${className}`} style={{ aspectRatio: aspect }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${cx * 100}% ${cy * 100}%` }} />
    </div>
  );
}

function Btn({ children, onClick, primary, disabled, title, submit }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; title?: string; submit?: boolean }) {
  return (
    <button type={submit ? "submit" : "button"} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex flex-1 md:flex-none items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${primary ? "bg-brand text-white hover:bg-brand-light" : "border border-slate-700 text-slate-200 hover:border-slate-500"}`}>
      {children}
    </button>
  );
}

function SlotStatus({ slot, small }: { slot: FrameSlot; small?: boolean }) {
  const cls = small ? "inline-block px-1.5 py-0.5 text-[9px]" : "inline-block px-2.5 py-1 text-xs";
  if (slot.done) return <span className={`rounded-full bg-green-500/15 font-bold text-green-300 ${cls}`}>✓ {small ? "Done" : "Checked"}</span>;
  if (slot.fresh) return <span className={`rounded-full bg-brand/15 font-bold text-orange-300 ${cls}`}>{small ? "New" : slot.fallbackFrom ? `Never set · starts from the ${slot.fallbackFrom.toLowerCase()} framing` : "Never framed · shows the centre"}</span>;
  return <span className={`rounded-full bg-slate-800 font-bold text-slate-300 ${cls}`}>{small ? "Check" : "Framed before · check it"}</span>;
}

// ─── one photo, every format it is shown in ─────────────────────────────────

function PhotoFramer({ task, only, park, busy, act }: {
  task: CleanupTask;
  only?: SlotKind[];
  park?: CleanupPark;
  busy: boolean;
  /** Save or check one format; `last` = no open format left in scope after this one. */
  act: (slot: FrameSlot, action: "frame" | "ok", value: string | undefined, last: boolean) => Promise<boolean>;
}) {
  const win = useWindowSize();
  const slots = useMemo(() => orderSlots(task.slots ?? []), [task.slots]);
  const inScope = (s: FrameSlot) => !only || only.includes(s.kind);
  const [activeId, setActiveId] = useState<string | undefined>(() => (slots.find((s) => !s.done && inScope(s)) ?? slots.find((s) => !s.done) ?? slots[0])?.id);
  const initial = useMemo(() => Object.fromEntries(slots.map((s) => [s.id, s.value || s.fallback || CENTRE])), [task.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [resets, setResets] = useState(0);
  const active = slots.find((s) => s.id === activeId) ?? slots[0];
  if (!active || !task.image) return null;

  const big = thumb(task.image, 1920);
  const small = thumb(task.image, 480);
  const mid = thumb(task.image, 1200);
  const frame = realFrame(active, win);
  const ratio = ratioOf(frame.aspect);
  const value = values[active.id] ?? CENTRE;
  const setVal = (id: string, v: string) => setValues((m) => (m[id] === v ? m : { ...m, [id]: v }));

  const nextAfter = (id: string) => {
    const at = slots.findIndex((s) => s.id === id);
    const open = slots.filter((s) => s.id !== id && !s.done && inScope(s));
    return open.find((s) => slots.indexOf(s) > at) ?? open[0];
  };
  const go = async (action: "frame" | "ok") => {
    const n = nextAfter(active.id);
    const ok = await act(active, action, action === "frame" ? value : undefined, !n);
    if (ok && n) setActiveId(n.id);
  };
  const undo = () => { setVal(active.id, initial[active.id]); setTouched((t) => ({ ...t, [active.id]: false })); setResets((r) => r + 1); };

  // The formats as a compact strip on phones and a list beside the editor on desktop.
  const list = (horizontal: boolean) => slots.map((s) => {
    const r = ratioOf(realFrame(s, win).aspect);
    const boxW = horizontal ? 46 : 132, boxH = horizontal ? 46 : 54;
    const w = Math.min(boxW, boxH * r);
    const on = s.id === active.id;
    return (
      <button key={s.id} type="button" onClick={() => setActiveId(s.id)}
        className={`flex items-center text-left cursor-pointer rounded-xl border transition-colors ${on ? "border-brand bg-brand/10" : "border-white/5 hover:border-white/20"} ${!inScope(s) && !on ? "opacity-60" : ""} ${horizontal ? "w-[156px] flex-none gap-2 p-1.5" : "w-full gap-3 p-2"}`}>
        <div className="flex flex-none items-center justify-center" style={{ width: boxW, height: boxH }}>
          <div style={{ width: w }}><SlotPreview slot={s} src={small} value={values[s.id] ?? CENTRE} aspect={realFrame(s, win).aspect} className="rounded-md" /></div>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate font-bold text-white ${horizontal ? "text-[11px]" : "text-[13px]"}`}>{SLOT_SHORT[s.kind]}</div>
          <div className={`truncate text-slate-500 ${horizontal ? "text-[10px]" : "text-[11px]"}`}>{horizontal ? s.where.split(" · ")[0] : s.where}</div>
          <div className={horizontal ? "mt-0.5" : "mt-1"}><SlotStatus slot={s} small /></div>
        </div>
      </button>
    );
  });

  const hint = active.mode === "focus" ? `Drag${active.maxZoom > 1 ? " · scroll or pinch to zoom" : ""}` : "Drag to move";
  // Tall and square shapes get their buttons beside the editor on desktop, so nothing falls below the fold.
  const tallish = ratio < 1.8;
  const head = (
    <div className="min-w-0">
      <h2 className="text-base font-bold text-white md:text-xl">{active.label}</h2>
      <p className="text-sm text-slate-400">{active.where}{frame.yours ? " · at this screen's size" : ""}</p>
      <div className="mt-2"><SlotStatus slot={active} /></div>
    </div>
  );
  const previews = (active.previews?.length ?? 0) > 0 ? (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">The same framing on other screens</p>
      <div className="flex flex-wrap items-end gap-3">
        {active.previews!.map((p) => (
          <figure key={p.aspect} style={{ width: Math.min(tallish ? 140 : 300, (tallish ? 150 : 110) * ratioOf(p.aspect)) }}>
            <SlotPreview slot={active} src={mid} value={value} aspect={p.aspect} className="rounded-xl" />
            <figcaption className="mt-1 text-[11px] text-slate-500">{p.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  ) : null;
  const buttons = (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 border-t border-white/10 bg-[#0f172a]/95 px-4 py-3 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <Btn onClick={() => go("ok")} disabled={busy || !!touched[active.id]} title="Nothing to change: mark it checked">✓ Looks right</Btn>
      <Btn primary onClick={() => go("frame")} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
      {touched[active.id] && <button type="button" onClick={undo} className="px-2 text-sm text-slate-400 hover:text-white cursor-pointer">Undo</button>}
    </div>
  );
  return (
    <div className="grid gap-6 pb-20 md:pb-0 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
      <div className="min-w-0">
        <div id="cleanup-strip" className="-mx-4 mb-4 flex scroll-mt-2 gap-2 overflow-x-auto px-4 pb-1 lg:hidden">{list(true)}</div>

        <div className={tallish ? "flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6" : "flex flex-col gap-4"}>
          <div className={tallish ? "lg:hidden" : ""}>{head}</div>
        {/* Phones: as big as fits between the format strip and the Save bar. Desktop: about 60% of the window tall. */}
        <div className="mx-auto w-full min-w-0 max-w-[var(--ed-m)] md:max-w-[var(--ed-d)] lg:mx-0"
          style={{ "--ed-m": `calc((100svh - 260px) * ${ratio.toFixed(4)})`, "--ed-d": `calc(${tallish ? 62 : 56}vh * ${ratio.toFixed(4)})` } as React.CSSProperties}>
          {active.mode === "focus" ? (
            <CropEditor
              key={`${active.id}-${resets}`}
              src={big}
              aspectRatio={frame.aspect}
              focusStr={value}
              maxZoom={active.maxZoom}
              clampAspect={active.clampAspect}
              onChange={(v) => setVal(active.id, v)}
              onCommit={(v) => { setVal(active.id, v); setTouched((t) => ({ ...t, [active.id]: true })); }}
              className="w-full rounded-2xl"
              style={{ aspectRatio: frame.aspect, containerType: "inline-size" } as React.CSSProperties}
            >
              <SlotFace slot={active} frame={frame} park={park} />
            </CropEditor>
          ) : (
            <PositionEditor key={`${active.id}-${resets}`} src={big} aspect={frame.aspect} value={value} className="w-full rounded-2xl"
              onChange={(v) => { setVal(active.id, v); setTouched((t) => ({ ...t, [active.id]: true })); }} />
          )}
          <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">{hint}</p>
        </div>
          {tallish ? (
            <div className="flex min-w-0 flex-col gap-5 lg:w-[300px] lg:flex-none">
              <div className="hidden lg:block">{head}</div>
              {buttons}
              {previews}
            </div>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">{previews ?? <span />}{buttons}</div>
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">This photo on the site · {slots.length} {slots.length === 1 ? "place" : "places"}</p>
        <div className="flex max-h-[75vh] flex-col gap-1.5 overflow-y-auto pr-1">{list(false)}</div>
      </aside>
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

export default function TaskRunner({ queue, startKey, random, only, person, openCount, parks, onDone, onSlot, onExit, pickRandom, needPerson }: {
  queue: CleanupTask[];
  startKey?: string;
  /** Hand out a fresh random task after each one instead of walking the queue. */
  random?: boolean;
  /** Only these formats count for this list (a category); the others still show. */
  only?: SlotKind[];
  person: CleanupPerson | null;
  openCount: number;
  parks: Map<number, CleanupPark>;
  onDone: (t: CleanupTask) => void;
  onSlot: (t: CleanupTask, slotId: string) => void;
  onExit: () => void;
  pickRandom: (not: Set<string>) => CleanupTask | null;
  needPerson: () => void;
}) {
  const [key, setKey] = useState<string | undefined>(startKey ?? queue[0]?.key);
  const skipped = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ main: string; sub: string } | null>(null);
  const byKey = useMemo(() => new Map(queue.map((t) => [t.key, t])), [queue]);
  const task = key ? byKey.get(key) : undefined;
  const idx = task ? queue.findIndex((t) => t.key === task.key) : -1;
  const upcoming = random ? [] : queue.slice(idx + 1).filter((t) => !skipped.current.has(t.key)).slice(0, 14);

  // A new task starts at the top; on phones a photo starts at its format strip, so the editor and Save fit on screen.
  useEffect(() => {
    setError(null);
    const strip = document.getElementById("cleanup-strip");
    if (strip && window.innerWidth < 1024) strip.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0 });
  }, [key]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const advance = (from: CleanupTask) => {
    if (random) { const n = pickRandom(new Set([...skipped.current, from.key])); setKey(n?.key); return; }
    const at = queue.findIndex((t) => t.key === from.key);
    const after = queue.slice(at + 1).find((t) => !skipped.current.has(t.key));
    setKey(after?.key ?? queue.find((t) => t.key !== from.key && !skipped.current.has(t.key))?.key);
  };
  const skip = () => { if (!task) return; skipped.current.add(task.key); advance(task); };
  const run = async (fn: () => Promise<unknown>) => {
    if (!task) return;
    if (!person) { needPerson(); return; }
    setBusy(true); setError(null);
    try {
      await fn();
      setToast({ main: `+1 ${person}`, sub: `${Math.max(0, openCount - 1)} left` });
      const done = task;
      advance(done);
      onDone(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  const act = async (slot: FrameSlot, action: "frame" | "ok", value: string | undefined, last: boolean) => {
    if (!task) return false;
    if (!person) { needPerson(); return false; }
    setBusy(true); setError(null);
    try {
      await api(action, task.key, person, { slot: slot.id, ...(value ? { value } : {}) });
      setToast(slot.done ? { main: "Saved", sub: SLOT_SHORT[slot.kind] } : { main: `+1 ${person}`, sub: `${SLOT_SHORT[slot.kind]} ${action === "frame" ? "saved" : "checked"}` });
      const t = task;
      if (last) advance(t);
      onSlot(t, slot.id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
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

  const photo = task.kind === "photo";
  const stateChip = task.kind === "caption" ? <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-orange-300">{task.caption?.why}</span> : null;
  const park = task.parkId != null ? parks.get(task.parkId) : undefined;

  return (
    <div className="mx-auto max-w-[1560px] px-4 pb-16 pt-4 md:px-12">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>
        <span className="text-xs text-slate-500">{random ? "Random quick fixes" : `${queue.length - skipped.current.size} in this list`} · {openCount} open</span>
      </div>

      <div className="mt-4 mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">{KIND_LABEL[task.kind]}{photo ? ` · ${openSlots(task, only).length || openSlots(task).length} to do` : ""}</p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight text-white md:text-[34px]">{taskTitle(task, only)}</h1>
          <p className="mt-1 text-sm text-slate-400 md:text-[15px]">{taskWhere(task)}{photo && openSlots(task, only).length ? ` · ${slotSummary(task, only)}` : ""}</p>
          {stateChip && <div className="mt-3">{stateChip}</div>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href={pageUrl(task)} target="_blank" className="font-bold uppercase tracking-widest text-brand text-xs hover:text-brand-light">Open page ↗</Link>
          <button type="button" onClick={skip} className="rounded-xl border border-slate-700 px-4 py-2 font-bold text-slate-300 hover:border-slate-500 cursor-pointer">Skip</button>
        </div>
      </div>

      {photo && <PhotoFramer key={task.key} task={task} only={only} park={park} busy={busy} act={act} />}
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
                <div className="mt-1.5 truncate text-xs text-slate-300">{t.coasterName ?? (t.kind === "photo" ? t.parkName : t.label) ?? t.parkName}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-green-800 bg-green-950/95 px-4 py-3 text-sm text-green-100 shadow-2xl md:bottom-8 lg:inset-x-auto lg:bottom-auto lg:right-8 lg:top-28">
          <b className="text-white">{toast.main}</b> · {toast.sub}
        </div>
      )}
    </div>
  );
}
