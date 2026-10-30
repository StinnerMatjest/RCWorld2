"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { parseFocusStr } from "@/app/components/FocusedImage";
import type { CoasterGalleryImage } from "@/app/components/coasterpage/coasterPageTypes";
import LivePreview, { focusValue, previewViewport, type Lift } from "./LivePreview";
import { fmtDate, photoSources, PLACE_TITLE, send, thumb, type CleanupTask, type FramePlace, type FrameSlot, type PhotoUse, type SlotView } from "./shared";

const CoasterStripEditor = dynamic(() => import("@/app/components/coasterpage/CoasterStripEditor"), { ssr: false });

const CENTRE = "0.5000 0.5000 1.000";
const isVideo = (p: string) => /\.(mp4|webm|mov|ogg)$/i.test(p);

/** Values being edited, by task and slot: a place and the other places of its photo share one save. */
export type Values = Record<string, string>;
export const vkey = (t: CleanupTask, s: FrameSlot) => `${t.key}|${s.id}`;
export const startValue = (s: FrameSlot) => s.value || s.fallback || CENTRE;

export function Btn({ children, onClick, primary, disabled, title, submit, small }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; title?: string; submit?: boolean; small?: boolean }) {
  return (
    <button type={submit ? "submit" : "button"} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${small ? "px-3.5 py-2 text-[13px]" : "px-5 py-2.5 text-sm"} ${primary ? "bg-brand text-white hover:bg-brand-light" : "border border-slate-700 text-slate-200 hover:border-slate-500"}`}>
      {children}
    </button>
  );
}

/**
 * The runner's two arrows: a bar with a point at the end it goes to, forward
 * (orange: save and on to the next task) and back (to the last task, as it was).
 */
export function ArrowBtn({ dir, children, onClick, disabled, title, submit, small }: { dir: "next" | "back"; children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string; submit?: boolean; small?: boolean }) {
  const pt = small ? 16 : 22;
  const clip = dir === "next"
    ? `polygon(0 0, calc(100% - ${pt}px) 0, 100% 50%, calc(100% - ${pt}px) 100%, 0 100%)`
    : `polygon(${pt}px 0, 100% 0, 100% 100%, ${pt}px 100%, 0 50%)`;
  const next = dir === "next";
  return (
    <button type={submit ? "submit" : "button"} onClick={onClick} disabled={disabled} title={title} style={{ clipPath: clip }}
      className={`inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${small ? "h-11 text-sm" : "h-14 text-base"} ${next ? `rounded-l-xl bg-brand text-white hover:bg-brand-light ${small ? "pl-5 pr-8" : "min-w-[200px] pl-7 pr-11"}` : `rounded-r-xl bg-slate-700 text-slate-100 hover:bg-slate-600 ${small ? "pl-7 pr-4" : "pl-10 pr-6"}`}`}>
      {children}
    </button>
  );
}

/** Width and height of an element, kept up to date. */
export function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => setSize((o) => (o.w === el.clientWidth && o.h === el.clientHeight ? o : { w: el.clientWidth, h: el.clientHeight }));
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** A photo with no text on it (list photos): a plain frame of its shape, dragged with object-position. */
function PlainFrame({ photo, size, aspect, value, onChange, maxW, maxH, label }: { photo: string; size?: { w: number; h: number }; aspect: string; value: string; onChange: (v: string) => void; maxW: number; maxH: number; label: React.ReactNode }) {
  const ref = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [a, b] = aspect.split("/").map(parseFloat);
  const w = Math.min(maxW, maxH * (a / b));
  const { cx, cy } = parseFocusStr(value);
  const src = photoSources(photo, size);
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex min-h-[24px] items-center justify-between gap-3 text-sm">{label}</figcaption>
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
        {/* The frame is cover-cropped: the photo is drawn at least as wide as the frame and as wide as its height needs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={ref} src={src.src} srcSet={src.srcSet} sizes={`${Math.ceil(Math.max(w, (w * b / a) * ((size?.w ?? 4) / (size?.h ?? 3))))}px`} alt="" draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${cx * 100}% ${cy * 100}%` }} />
      </div>
    </figure>
  );
}

// ─── change photo ────────────────────────────────────────────────────────────

type Candidate = { id: number; path: string; title?: string; description?: string; featured?: boolean; visit_date?: string };
/** Which screens a new cover photo is for. */
type For = "both" | "phone" | "desktop";

/**
 * Pick another photo for this place from the park's or coaster's gallery and
 * save it through the endpoint the page's own editor uses. A cover's photo can
 * change for phones, for desktops, or both. Returns the key the place has afterwards.
 */
function ChangePhoto({ task, place, onClose, onChanged }: { task: CleanupTask; place: FramePlace; onClose: () => void; onChanged: (newKey: string) => void }) {
  const ch = place.change!;
  const cover = ch.t === "park-header" || ch.t === "coaster-header";
  const phoneSlot = place.slots.find((s) => s.kind === "cover-phone");
  const desktopSlot = place.slots.find((s) => s.kind === "cover-desktop");
  const [forWhat, setFor] = useState<For>("both");
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

  const desktopNow = desktopSlot?.photo ?? task.image ?? null;
  const phoneNow = phoneSlot?.photo ?? desktopNow;
  // What the chosen screens show now (not offered again).
  const isNow = (p: string) => (forWhat === "phone" ? p === phoneNow : forWhat === "desktop" ? p === desktopNow : p === desktopNow && p === phoneNow);

  // Swap one curated image for another, as the curated picker saves: the picks in
  // page order, then the gallery order refilled so the new photo takes the old one's place.
  const swapPick = async (apiUrl: string, oldId: number, newId: number) => {
    const all = rows.map((r) => r.id);
    const order = rows.filter((r) => r.featured && !isVideo(r.path)).map((r) => r.id).map((id) => (id === oldId ? newId : id));
    await send(apiUrl, "PATCH", { featuredIds: order });
    const picked = new Set(order);
    const slots = all.map((id, i) => (picked.has(id) ? i : -1)).filter((i) => i >= 0);
    const next = [...all];
    slots.forEach((slot, k) => { next[slot] = order[k]; });
    if (next.some((id, i) => id !== all[i])) await send(apiUrl, "PUT", { reorderedIds: next });
  };

  const save = async () => {
    if (!sel) return;
    setBusy(true); setError(null);
    try {
      let key = task.key;
      if (ch.t === "park-header") {
        // The phone photo and its framing after the change. A desktop-only change keeps what
        // phones show now, framed as now (a phone framing frames whatever photo phones show).
        const phoneValue = phoneSlot ? phoneSlot.value ?? phoneSlot.fallback ?? null : null;
        const after = forWhat === "both" ? { photo: null, focus: null }
          : forWhat === "phone" ? { photo: sel.path === desktopNow ? null : sel.path, focus: null }
          : { photo: phoneNow === sel.path ? null : phoneNow, focus: phoneValue };
        const desktopPath = forWhat === "phone" ? desktopNow : sel.path;
        const desktopFocus = forWhat === "phone" ? desktopSlot?.value ?? null : CENTRE;
        if (ch.visitId) {
          await send(`/api/visits/${ch.visitId}/header`, "PATCH", { imagepath: desktopPath, focus: desktopFocus, imagepathMobile: after.photo, focusMobile: after.focus });
          key = `cover:visit:${ch.visitId}`;
        } else {
          await send(`/api/park/${ch.parkId}`, "PATCH", { ...(forWhat === "phone" ? {} : { imagepath: desktopPath, headerFocus: desktopFocus }), imagepathMobile: after.photo, headerFocusMobile: after.focus });
          key = `cover:park:${ch.parkId}`;
        }
      } else if (ch.t === "coaster-header") {
        const api = `/api/coasters/${ch.coasterId}/gallery`;
        if (forWhat === "phone") {
          await send(api, "PATCH", sel.path === desktopNow ? { phoneCover: false } : { phoneCover: true, imageId: sel.id });
        } else {
          const headerRow = rows.find((r) => r.path === desktopNow);
          await send(api, "PATCH", { imageId: sel.id });
          if (forWhat === "both") { if (ch.phonePhoto) await send(api, "PATCH", { phoneCover: false }); }
          // Desktop only: phones keep the photo they show now (the old cover becomes their own).
          else if (!ch.phonePhoto && headerRow) await send(api, "PATCH", { phoneCover: true, imageId: headerRow.id });
          else if (ch.phonePhoto === sel.path) await send(api, "PATCH", { phoneCover: false });
        }
      } else if (ch.t === "card") {
        await send(`/api/park/${ch.parkId}`, "PATCH", { cardImagepath: sel.path === ch.headerPath ? null : sel.path, imageFocus: CENTRE });
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

  const seg = (v: For, text: string) => (
    <button key={v} type="button" onClick={() => { setFor(v); setSel(null); }}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors cursor-pointer ${forWhat === v ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}>{text}</button>
  );
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 md:items-center md:p-6" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-5 py-3">
          <h2 className="text-base font-bold text-white">Change photo · {PLACE_TITLE[place.kind].toLowerCase()}</h2>
          {cover && <div className="flex rounded-xl bg-slate-800 p-1">{seg("both", "Phone and desktop")}{seg("phone", "Phone")}{seg("desktop", "Desktop")}</div>}
          <button type="button" onClick={onClose} className="ml-auto rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer" aria-label="Close">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {photos === null ? <p className="p-6 text-center text-sm text-slate-500">Loading photos…</p> : !photos.length ? <p className="p-6 text-center text-sm text-slate-500">No other photos to pick from.</p> : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {photos.map((p) => {
                const now = isNow(p.path);
                return (
                  <button key={p.id} type="button" disabled={now} onClick={() => setSel(p)} title={p.description || p.title}
                    className={`relative aspect-square overflow-hidden rounded-xl border-2 ${sel?.id === p.id ? "border-brand" : "border-transparent"} ${now ? "cursor-default opacity-40" : "cursor-pointer hover:border-slate-500"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(p.path)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {now && <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10px] font-bold text-white">Now</span>}
                    {!now && p.visit_date && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{fmtDate(p.visit_date)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-800 px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs text-slate-500">{error ?? (forWhat === "phone" ? "Phones show this photo; desktops keep theirs." : forWhat === "desktop" ? "Desktops show this photo; phones keep theirs." : "Saved at once; the framing starts at the centre.")}</p>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary onClick={save} disabled={!sel || busy}>{busy ? "Saving…" : "Use this photo"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── a place's previews ──────────────────────────────────────────────────────

/**
 * Every view of every framing of a place, on the real pages: phones at their
 * real size where it fits, desktops in the rest of the row. Previews are keyed
 * by page and screen, so the next place on the same page reuses the loaded page.
 */
/** How far a preview may be enlarged past the page's own size to fill the screen. */
const MAX_UP = 2.5;
type Box = { w: number; h: number };
/**
 * Sizes for the previews of one row so they fill the room: all as tall as fits,
 * side by side. A phone frame never ends up smaller than its real size while
 * the height allows it (a tall phone beside a wide desktop): then the phones
 * come at their real size and the desktops share what is left of the row
 * (resting the mouse on one shows it big).
 */
function fitRow(frames: Box[], screens: ("phone" | "desktop")[], W: number, H: number, gap = 24): Box[] {
  const n = frames.length, gaps = gap * (n - 1);
  const ar = frames.map((f) => f.w / f.h);
  const capped = (h: number, idx: number[]) => Math.max(80, Math.min(h, ...idx.map((i) => frames[i].h * MAX_UP)));
  const all = frames.map((_, i) => i);
  const h = capped(Math.min(H, (W - gaps) / ar.reduce((a, b) => a + b, 0)), all);
  const even = frames.map((_, i) => ({ w: ar[i] * h, h }));
  if (all.every((i) => screens[i] !== "phone" || even[i].h >= Math.min(frames[i].h, H) - 0.5)) return even;
  const out = frames.map(() => ({ w: 0, h: 0 }));
  let used = 0;
  all.filter((i) => screens[i] === "phone").forEach((i) => {
    const sc = Math.min(1, H / frames[i].h);
    out[i] = { w: frames[i].w * sc, h: frames[i].h * sc };
    used += out[i].w;
  });
  const desks = all.filter((i) => screens[i] !== "phone");
  if (desks.length) {
    const hd = capped(Math.min(H, (W - used - gaps) / desks.reduce((a, i) => a + ar[i], 0)), desks);
    desks.forEach((i) => { out[i] = { w: ar[i] * hd, h: hd }; });
  }
  return out;
}

function SlotPreviews({ task, values, onValue, width, maxH, phoneScreen, fill = false }: {
  task: CleanupTask; values: Values; onValue: (t: CleanupTask, s: FrameSlot, v: string) => void; width: number; maxH: number;
  /** A cover with its own phone photo shows a way back to the desktop one. */
  phoneScreen?: React.ReactNode;
  /** Enlarge the previews to fill width x maxH (one screen on desktop). */
  fill?: boolean;
}) {
  const place = task.place!;
  const views: { s: FrameSlot; v: SlotView | null }[] = place.slots.flatMap((s): { s: FrameSlot; v: SlotView | null }[] => (s.views.length ? s.views.map((v) => ({ s, v })) : [{ s, v: null }]));
  const phones = views.filter((x) => x.v?.screen === "phone").length;
  const desktops = views.filter((x) => x.v?.screen === "desktop").length;
  const narrow = width < 760;
  const phoneW = narrow ? width : Math.min(400, maxH * 0.8);
  const desktopW = narrow ? width : Math.max(280, (width - phones * (Math.min(phoneW, maxH * 0.8) + 24) - 24 * Math.max(0, desktops - 1)) / Math.max(1, desktops));
  // Each frame's size on its page, as the previews report it; until then a typical one.
  const [frames, setFrames] = useState<Record<string, Box>>({});
  const viewKey = (v: SlotView) => `${v.screen}|${v.page.split("#")[0]}|${v.target}`;
  const live = views.filter((x): x is { s: FrameSlot; v: SlotView } => !!x.v);
  // Resting the mouse on a preview opens it big over the stage, to place the photo exactly;
  // moving out of it (or Esc) closes it. The preview itself moves, so its page stays loaded.
  const rootRef = useRef<HTMLDivElement>(null);
  const [big, setBig] = useState<{ key: string; at: Lift } | null>(null);
  const openT = useRef<number | undefined>(undefined), closeT = useRef<number | undefined>(undefined);
  const openBig = (k: string, box: Box) => {
    const r = rootRef.current?.getBoundingClientRect(); if (!r) return;
    const area = rootRef.current!.closest("[data-lift-area]")?.getBoundingClientRect();
    const left = Math.max(8, (area?.left ?? r.left) - 12), top = Math.max(8, (area?.top ?? r.top) - 12);
    const at = { left, top, width: r.right + 12 - left, height: window.innerHeight - top - 12 };
    // Only when the window shows it clearly bigger (a card already as tall as the screen allows stays put).
    const f = frames[k];
    if (f && Math.min(3, (at.width - 32) / f.w, (at.height - 64) / f.h) < (box.w / f.w) * 1.15) return;
    setBig({ key: k, at });
  };
  useEffect(() => {
    if (!big) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setBig(null); };
    // A drag that ends outside the window closes it too (leaving it mid-drag does not).
    const up = (e: PointerEvent) => {
      const a = big.at;
      if (e.clientX < a.left || e.clientX > a.left + a.width || e.clientY < a.top || e.clientY > a.top + a.height) setBig(null);
    };
    window.addEventListener("keydown", esc);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("keydown", esc); window.removeEventListener("pointerup", up); };
  }, [big]);
  useEffect(() => () => { window.clearTimeout(openT.current); window.clearTimeout(closeT.current); }, []);
  const boxes = fill && !narrow && live.length === views.length
    ? fitRow(live.map(({ v }) => frames[viewKey(v)] ?? (v.screen === "phone" ? { w: 384, h: 480 } : { w: 1600, h: 600 })), live.map(({ v }) => v.screen), width, maxH)
    : null;
  const label = (s: FrameSlot, v: SlotView | null) => {
    const multi = s.views.length > 1;
    const screen = v ? (v.screen === "phone" ? "Phone" : "Desktop") : s.label;
    const own = s.kind === "cover-phone" && s.photo !== task.image;
    return (
      <span className="min-w-0 truncate">
        <span className="font-bold text-white">{multi && v?.where ? `${v.where} · ${screen.toLowerCase()}` : multi ? screen : s.label}</span>
        {multi && <span className="ml-1.5 text-slate-500">· same framing</span>}
        {own && <span className="ml-1.5 text-slate-400">· its own photo</span>}
        {own && phoneScreen}
      </span>
    );
  };
  return (
    <div ref={rootRef} className={`flex gap-6 ${narrow ? "flex-col" : `flex-row flex-wrap items-start ${fill ? "justify-end" : ""}`}`}>
      {views.map(({ s, v }, vi) => {
        const k = vkey(task, s);
        const value = values[k] ?? startValue(s);
        const set = (val: string) => onValue(task, s, val);
        if (!v) return <PlainFrame key={k} photo={s.photo} size={s.size} aspect={s.aspect ?? "4 / 3"} value={value} onChange={set} maxW={narrow ? width : 560} maxH={maxH} label={label(s, v)} />;
        const box = boxes?.[vi];
        const bk = viewKey(v);
        const lifted = !!box && big?.key === bk;
        return (
          // The wrapper keeps the preview's place while it is lifted; leaving it (the lifted window is inside it) closes.
          <div key={`${v.screen}|${v.page.split("#")[0]}`} style={box ? { width: box.w, minHeight: box.h + 32 } : undefined}
            onMouseEnter={() => window.clearTimeout(closeT.current)}
            onMouseMove={(e) => {
              if (!box || lifted || e.buttons) return;
              window.clearTimeout(openT.current);
              openT.current = window.setTimeout(() => openBig(bk, box), 450);
            }}
            // Dragging in the small preview right away keeps it small.
            onPointerDown={() => window.clearTimeout(openT.current)}
            onMouseLeave={(e) => {
              window.clearTimeout(openT.current);
              if (lifted && e.buttons === 0) closeT.current = window.setTimeout(() => setBig(null), 120);
            }}>
          <LivePreview
            page={v.page}
            target={v.target}
            viewport={previewViewport(v.screen)}
            photo={s.photo}
            size={s.size}
            value={value}
            onChange={set}
            maxZoom={s.maxZoom}
            minAspect={s.minAspect}
            maxW={box ? box.w : v.screen === "phone" ? phoneW : desktopW}
            maxH={box ? box.h : maxH}
            maxScale={box ? MAX_UP : 1}
            onFrame={(w, h) => setFrames((m) => (m[viewKey(v)]?.w === w && m[viewKey(v)]?.h === h ? m : { ...m, [viewKey(v)]: { w, h } }))}
            lift={lifted ? big!.at : null}
            label={label(s, v)}
          />
          </div>
        );
      })}
    </div>
  );
}

// ─── the photo elsewhere on the site ─────────────────────────────────────────

type Use = { id: string; title: string; sub: string; place?: CleanupTask; read?: PhotoUse; photo: string };

function statusOf(u: Use, values: Values) {
  if (u.read) return { text: "Set on the page", cls: "text-slate-500" };
  const slots = u.place!.place!.slots;
  const changed = slots.some((s) => (values[vkey(u.place!, s)] ?? startValue(s)) !== startValue(s));
  if (changed) return { text: "Changed", cls: "text-orange-300" };
  return slots.every((s) => s.done) ? { text: "✓ Checked", cls: "text-green-300" } : { text: "Not checked", cls: "text-orange-300" };
}

/**
 * This place and every other place its photo is shown, one under the other:
 * the other framings (adjustable here, saved with this place) and the frames
 * the pages draw by themselves (review sections, gallery tiles). The chosen
 * one shows in the middle, on the real page.
 */
function UsesList({ here, uses, sel, onSel, values }: { here: Use; uses: Use[]; sel: string | null; onSel: (id: string | null) => void; values: Values }) {
  const item = (u: Use, on: boolean, st: { text: string; cls: string }, onClick: () => void) => (
    <button key={u.id} type="button" onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border p-2 pr-3 text-left transition-colors cursor-pointer ${on ? "border-brand bg-brand/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb(u.photo)} alt="" loading="lazy" className="h-16 w-16 flex-none rounded-lg object-cover" />
      <span className="min-w-0">
        <span className="block text-[14px] font-bold leading-snug text-white">{u.title}</span>
        <span className="block truncate text-xs text-slate-400">{u.sub}</span>
        <span className={`block text-[11px] font-bold ${st.cls}`}>{st.text}</span>
      </span>
    </button>
  );
  return (
    <div className="space-y-2">
      {item(here, sel === null, { text: "Framing now", cls: "text-brand" }, () => onSel(null))}
      {uses.length > 0 && <p className="px-1 pt-3 text-xs font-bold text-slate-400">Elsewhere on the site · {uses.length}</p>}
      {uses.map((u) => item(u, sel === u.id, statusOf(u, values), () => onSel(sel === u.id ? null : u.id)))}
    </div>
  );
}

/** A use the page draws by itself: its frame on the phone and the desktop page, as visitors see it. */
function ReadPreviews({ use, width, maxH }: { use: PhotoUse; width: number; maxH: number }) {
  const narrow = width < 760;
  const phoneW = narrow ? width : Math.min(400, maxH * 0.8);
  return (
    <div className={`flex gap-6 ${narrow ? "flex-col" : "flex-row items-start"}`}>
      {(["phone", "desktop"] as const).map((screen) => (
        <LivePreview key={`${screen}|${use.page.split("#")[0]}`} page={use.page} target={use.target} viewport={previewViewport(screen)}
          maxW={narrow ? width : screen === "phone" ? phoneW : Math.max(280, width - phoneW - 24)} maxH={maxH}
          label={<span className="font-bold text-white">{screen === "phone" ? "Phone" : "Desktop"} <span className="font-normal text-slate-500">· as the page draws it</span></span>}
          badge={<a href={use.page} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-400 hover:text-white">Change it on the page ↗</a>} />
      ))}
    </div>
  );
}

// ─── a place ─────────────────────────────────────────────────────────────────

export function PlaceFramer({ task, related, readUses, busy, onSave, onChanged, onePager = false, advances = true, side = null, back = null }: {
  task: CleanupTask;
  /** Other framing places of this place's photos (open or done). */
  related: CleanupTask[];
  /** Frames the pages draw by themselves for these photos. */
  readUses: PhotoUse[];
  busy: boolean;
  onSave: (items: { task?: string; slot: string; value?: string }[]) => void;
  onChanged: (newKey: string | null) => void;
  /** Desktop: everything on one screen, the previews sized to the room left. */
  onePager?: boolean;
  /** A save moves on to the next task (not when looking at a finished one again). */
  advances?: boolean;
  /** The runner's left column: the list of where the photo is shown goes there. */
  side?: HTMLElement | null;
  /** The runner's back arrow, first in the bar. */
  back?: React.ReactNode;
}) {
  const place = task.place!;
  const [values, setValues] = useState<Values>({});
  const [changing, setChanging] = useState(false);
  const [picker, setPicker] = useState<CoasterGalleryImage[] | null>(null);
  const [dropping, setDropping] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useSize(stageRef);
  // One framer for every task, so the next place on the same page keeps the loaded page; what
  // was being edited here goes with the task.
  useEffect(() => { setValues({}); setChanging(false); setPicker(null); setDropping(false); setSel(null); }, [task.key]);
  const all = useMemo(() => [task, ...related], [task, related]);
  const changedSlots = all.flatMap((t) => t.place!.slots.filter((s) => values[vkey(t, s)] !== undefined && values[vkey(t, s)] !== startValue(s)).map((s) => ({ t, s })));
  const anyChanged = changedSlots.length > 0;
  const todo = place.slots.filter((s) => !s.done);
  const save = () => {
    const items: { task?: string; slot: string; value?: string }[] = [];
    // This place: changed framings are saved, the others checked as they are.
    for (const s of place.slots) {
      const v = values[vkey(task, s)];
      if (v !== undefined && v !== startValue(s)) items.push({ slot: s.id, value: v });
      else if (!s.done) items.push({ slot: s.id });
    }
    // Other places of the photo: only what was changed here.
    for (const { t, s } of changedSlots) if (t !== task) items.push({ task: t.key, slot: s.id, value: values[vkey(t, s)] });
    onSave(items);
  };
  const onValue = (t: CleanupTask, s: FrameSlot, v: string) => setValues((m) => (m[vkey(t, s)] === v ? m : { ...m, [vkey(t, s)]: v }));

  // Room per frame: on one screen, the height left over (less the label row); else a share of
  // the window. Phones keep their real size where it fits, desktops take the rest of the row.
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const maxH = onePager ? Math.max(200, stage.h - 36) : Math.max(260, Math.min(560, vh * 0.58));
  const width = stage.w;
  const ch = place.change;
  const phoneOwn = ch && (ch.t === "park-header" || ch.t === "coaster-header") ? ch.phonePhoto : null;

  // The other uses of this place's photos.
  const uses: Use[] = useMemo(() => {
    const photos = new Set(place.slots.map((s) => s.photo));
    const fromPlaces: Use[] = related.map((r) => ({
      id: r.key, place: r, photo: r.place!.slots.find((s) => photos.has(s.photo))?.photo ?? r.image ?? "",
      title: PLACE_TITLE[r.place!.kind], sub: [r.place!.title, r.place!.subtitle].filter(Boolean).join(" · "),
    }));
    const fromPages: Use[] = readUses.map((u) => ({ id: `${u.page}|${u.target}`, read: u, photo: u.target.replace(/^(section|tile):/, ""), title: u.label, sub: u.where }));
    return [...fromPlaces, ...fromPages];
  }, [place, related, readUses]);
  const here: Use = { id: task.key, place: task, photo: task.image ?? "", title: PLACE_TITLE[place.kind], sub: [place.title, place.subtitle].filter(Boolean).join(" · ") };
  const shown = uses.find((u) => u.id === sel) ?? null;

  // Back to the desktop photo on phones.
  const dropPhone = async () => {
    if (!ch || (ch.t !== "park-header" && ch.t !== "coaster-header") || !ch.phonePhoto) return;
    setDropping(true);
    try {
      const desktop = place.slots.find((s) => s.kind === "cover-desktop");
      if (ch.t === "coaster-header") await send(`/api/coasters/${ch.coasterId}/gallery`, "PATCH", { phoneCover: false });
      else if (ch.visitId) await send(`/api/visits/${ch.visitId}/header`, "PATCH", { imagepath: desktop?.photo ?? task.image, focus: desktop?.value ?? null, imagepathMobile: null, focusMobile: null });
      else await send(`/api/park/${ch.parkId}`, "PATCH", { imagepathMobile: null, headerFocusMobile: null });
      onChanged(ch.t === "park-header" && ch.visitId ? `cover:visit:${ch.visitId}` : task.key);
    } catch {
      setDropping(false);
    }
  };
  const dropLink = phoneOwn ? (
    <button type="button" onClick={dropPhone} disabled={dropping} className="ml-2 text-xs font-bold text-blue-400 hover:text-blue-300 disabled:opacity-40 cursor-pointer">
      {dropping ? "…" : "Use the desktop photo"}
    </button>
  ) : null;
  const openPicker = async () => {
    if (ch?.t !== "coaster-curated") return;
    const d = await fetch(`/api/coasters/${ch.coasterId}/gallery`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    setPicker(d.gallery ?? []);
  };

  const hint = (
    <p className="text-xs text-slate-500">
      {place.slots.some((s) => s.maxZoom > 1) ? "Drag to move · scroll or pinch to zoom" : "Drag to move"}
      {onePager && <span className="mt-1 block">Rest the mouse on a preview to see it big</span>}
      {place.note && <span className="mt-1 block">{place.note}</span>}
    </p>
  );
  return (
    <div className={onePager ? "flex h-full min-h-0 flex-col" : ""}>
      <div className={onePager ? "flex min-h-0 flex-1" : ""}>
        {/* The stage: this place's previews stay loaded while another use is looked at. */}
        <div ref={stageRef} className={`relative min-w-0 ${onePager ? "min-h-0 flex-1" : ""}`}>
          <div className={shown ? "pointer-events-none absolute inset-x-0 top-0 opacity-0" : ""} aria-hidden={!!shown}>
            <SlotPreviews task={task} values={values} onValue={onValue} width={width} maxH={maxH} phoneScreen={dropLink} fill={onePager} />
          </div>
          {shown && (shown.place
            ? <SlotPreviews key={shown.id} task={shown.place} values={values} onValue={onValue} width={width} maxH={maxH} fill={onePager} />
            : <ReadPreviews key={shown.id} use={shown.read!} width={width} maxH={maxH} />)}
          {!onePager && <div className="mt-3">{hint}</div>}
        </div>
        {side
          ? createPortal(<div className="flex flex-col gap-4"><UsesList here={here} uses={uses} sel={sel} onSel={setSel} values={values} />{hint}</div>, side)
          : !onePager && uses.length > 0 && (
            <aside className="mt-8">
              <UsesList here={here} uses={uses} sel={sel} onSel={setSel} values={values} />
            </aside>
          )}
      </div>

      <div className={`z-40 flex items-center gap-2.5 ${onePager ? "mt-4 shrink-0" : "fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0f172a]/95 px-4 py-3 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"}`}>
        {back}
        {ch && <Btn onClick={() => setChanging(true)}>Change photo</Btn>}
        {ch?.t === "coaster-curated" && <Btn onClick={openPicker}>Picks</Btn>}
        {anyChanged && <button type="button" onClick={() => setValues({})} className="px-2 text-sm text-slate-400 hover:text-white cursor-pointer">Reset</button>}
        <span className="flex-1" />
        {advances && (anyChanged || todo.length > 0)
          ? <ArrowBtn dir="next" onClick={save} disabled={busy} small={!onePager}>{busy ? "Saving…" : anyChanged ? "Save" : "Looks right"}<span className="text-xl leading-none">→</span></ArrowBtn>
          : <Btn primary onClick={save} disabled={busy || (!anyChanged && !todo.length)}>{busy ? "Saving…" : anyChanged ? "Save" : todo.length ? "✓ Looks right" : "✓ Checked"}</Btn>}
      </div>

      {changing && <ChangePhoto task={task} place={place} onClose={() => setChanging(false)} onChanged={(k) => { setChanging(false); onChanged(k); }} />}
      {picker && ch?.t === "coaster-curated" && (
        <CoasterStripEditor coasterId={ch.coasterId} coasterName={task.coasterName ?? ""} gallery={picker}
          onClose={() => setPicker(null)} onSaved={() => { setPicker(null); onChanged(null); }} />
      )}
    </div>
  );
}
