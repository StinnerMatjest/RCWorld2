"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { parseFocusStr, splitMedia } from "../FocusedImage";
import { splitFocusPair, withPhoneOf } from "@/app/lib/framing";
import {
  sectionImageFrame,
  normalizeSectionLayout,
  resolveSectionLayout,
  usesLegacyRow,
  SECTION_LAYOUT_LABELS,
  SECTION_IMAGE_ASPECT,
  MAX_SECTION_IMAGES,
  layoutOptionsFor,
  type SectionLayout,
} from "@/app/utils/sectionImageAspect";
import { SectionBody, isVideoUrl, mediaCaptions } from "./SectionBody";
import { SectionImage } from "../SectionImage";
import LazyVideo from "../LazyVideo";
import { ImagePickerGrid, SectionImageCropper } from "../editor/SectionMediaEditor";
import { markdownToHtml, htmlToMarkdown, SPOILER_CLASS } from "../editor/reviewMarkdown";
import { countTextStats } from "../editor/MarkdownEditor";
import ImageUploaderModal from "../ImageUploaderModal";
import { getRatingColor } from "@/app/utils/design";
import type { Visit } from "@/app/types";
import type { VisitGalleryImage } from "./VisitGallery";
import { useScrollLock } from "@/app/hooks/useScrollLock";

/**
 * Full-screen review editor that writes on the page itself. Left: the sections.
 * The rest is the review as the park page shows it; the section being written
 * is editable in place: its text (a contenteditable that round-trips to the
 * stored markdown, see editor/reviewMarkdown.ts), its score, its photos (hover
 * for Position / Replace / remove, drag to reorder, a caption under each) and
 * its layout. Replace or an empty slot opens the gallery over the page.
 * Unsaved work is kept in the browser until it is saved. Ctrl+S saves.
 */
interface ParkTextsModalProps {
  rating: Visit;
  explanations: Record<string, string>;
  sectionImages: Record<string, string>;
  sectionLayouts?: Record<string, string>;
  sectionSpoilers?: Record<string, boolean>;
  galleryImages: VisitGalleryImage[];
  parkId: number;
  parkName?: string;
  ratingId: number;
  /** Called after an image caption was saved or a photo uploaded, so the page can re-fetch gallery data. */
  onGalleryUpdate?: () => void;
  onClose: () => void;
  onSave?: (updatedText: Record<string, string>, updatedImages: Record<string, string>, updatedLayouts: Record<string, string>, updatedSpoilers: Record<string, boolean>) => void;
}

const CATEGORIES = [
  "description",
  "bestCoaster",
  "coasterDepth",
  "waterRides",
  "flatridesAndDarkrides",
  "parkAppearance",
  "parkPracticality",
  "food",
  "snacksAndDrinks",
  "rideOperations",
  "parkManagement",
] as const;
type Category = typeof CATEGORIES[number];
type ScoreCategory = Exclude<Category, "description">;

const LABELS: Record<Category, string> = {
  description: "Description",
  bestCoaster: "Best Coaster",
  coasterDepth: "Coaster Depth",
  waterRides: "Water Rides",
  flatridesAndDarkrides: "Flat & Darkrides",
  parkAppearance: "Appearance",
  parkPracticality: "Practicality",
  food: "Food",
  snacksAndDrinks: "Snacks & Drinks",
  rideOperations: "Ride Operations",
  parkManagement: "Management",
};

// The page renders section titles from the key, not from LABELS; mirror that here.
const humanizeLabel = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();

const FOCUS_DEFAULT = "0.5 0.5 1";
// The description used to render its images full width under the text; keep that
// as its default so existing reviews look the same until someone picks a layout.
const DESCRIPTION_DEFAULT_LAYOUT: SectionLayout = "below";
const SCORE_STEP = 0.25;

type Draft = {
  text: string;
  images: string[];
  focuses: string[];
  layout: string | null;
  /** How many media slots the section offers (1..MAX_SECTION_IMAGES). */
  imageCount: number;
  isSpoiler: boolean;
};

const mediaEntries = (d: Draft) => d.images.map((u, i) => `${u}|${d.focuses[i] ?? FOCUS_DEFAULT}`);
const fingerprint = (d: Draft) => JSON.stringify([d.text, mediaEntries(d), d.layout ?? null, d.isSpoiler]);
const isEmptyDraft = (d: Draft) => !d.text.trim() && d.images.length === 0;

function buildDrafts(
  explanations: Record<string, string>,
  sectionImages: Record<string, string>,
  sectionLayouts: Record<string, string>,
  sectionSpoilers: Record<string, boolean>,
): Record<Category, Draft> {
  return Object.fromEntries(CATEGORIES.map(cat => {
    const parsed = (sectionImages[cat] || "").split(",").filter(Boolean).map(splitMedia);
    return [cat, {
      text: explanations[cat] ?? "",
      images: parsed.map(p => p.url),
      focuses: parsed.map(p => p.focus),
      layout: sectionLayouts[cat] ?? null,
      imageCount: Math.max(1, Math.min(MAX_SECTION_IMAGES, parsed.length)),
      isSpoiler: sectionSpoilers[cat] || false,
    }];
  })) as Record<Category, Draft>;
}

type Scores = Record<ScoreCategory, number>;
const scoresOf = (rating: Visit): Scores =>
  Object.fromEntries(CATEGORIES.filter(c => c !== "description").map(c => [c, Number((rating as unknown as Record<string, unknown>)[c]) || 0])) as Scores;

/** Which side the legacy alternating layout puts each section's image on (mirrors ParkText). */
function legacySides(drafts: Record<Category, Draft>): Record<Category, boolean> {
  let i = 0;
  const out = {} as Record<Category, boolean>;
  for (const cat of CATEGORIES) {
    if (cat === "description") { out[cat] = false; continue; }
    const d = drafts[cat];
    out[cat] = usesLegacyRow(d.layout, d.images.length) ? i++ % 2 !== 0 : false;
  }
  return out;
}

const keptKey = (ratingId: number) => `pr-review-draft:${ratingId}`;

// ── Text, written in place ────────────────────────────────────────────────────

/**
 * The section's text as the page shows it, editable. Uncontrolled: the HTML is
 * set when the section (or an outside change) arrives and read back on input.
 */
function EditableText({ cat, version, value, onChange, className, placeholder, editorRef }: {
  cat: Category;
  version: number;
  value: string;
  onChange: (md: string) => void;
  className: string;
  placeholder: string;
  editorRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = markdownToHtml(value);
    editorRef.current = el;
    // The caret lands at the end of the text, ready to write on.
    const sel = window.getSelection();
    if (sel && document.activeElement !== el) {
      el.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // version marks outside changes to the text; the value itself follows every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, version]);

  const read = () => { if (ref.current) onChange(htmlToMarkdown(ref.current)); };
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Only the words come in; the page's own styling applies.
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  };
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onInput={read}
      onBlur={read}
      onPaste={onPaste}
      className={`${className} outline-none caret-brand min-h-[1.6em] [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-0.5 [&_ul]:my-1 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600 empty:before:italic`}
    />
  );
}

/** Little formatting bar that appears above the selected text. */
function SelectionBar({ editorRef, onChanged }: { editorRef: React.MutableRefObject<HTMLDivElement | null>; onChanged: () => void }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      const el = editorRef.current;
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !el || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) { setPos(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) { setPos(null); return; }
      setPos({ left: Math.max(8, Math.min(window.innerWidth - 190, r.left + r.width / 2 - 90)), top: Math.max(8, r.top - 44) });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { document.removeEventListener("selectionchange", update); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [editorRef]);

  const keep = (e: React.MouseEvent) => e.preventDefault();
  const run = (fn: () => void) => { fn(); onChanged(); };
  const spoiler = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const inSpoiler = (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest("[data-spoiler]");
    if (inSpoiler) {
      // Already a spoiler: make it plain text again.
      const parent = inSpoiler.parentNode;
      while (inSpoiler.firstChild) parent?.insertBefore(inSpoiler.firstChild, inSpoiler);
      parent?.removeChild(inSpoiler);
      return;
    }
    const span = document.createElement("span");
    span.dataset.spoiler = "1";
    span.className = SPOILER_CLASS;
    try {
      range.surroundContents(span);
    } catch {
      // The selection crosses other marks: take its text out and put it back inside the span.
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    sel.removeAllRanges();
    const r = document.createRange(); r.selectNodeContents(span); sel.addRange(r);
  };
  const clear = () => {
    document.execCommand("removeFormat");
    const sel = window.getSelection();
    const el = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !el) return;
    const range = sel.getRangeAt(0);
    el.querySelectorAll("[data-spoiler]").forEach(s => {
      if (!range.intersectsNode(s)) return;
      const parent = s.parentNode;
      while (s.firstChild) parent?.insertBefore(s.firstChild, s);
      parent?.removeChild(s);
    });
  };
  if (!pos) return null;
  const btn = "w-8 h-7 rounded-md text-sm text-slate-100 hover:bg-slate-700 cursor-pointer";
  return (
    <div className="fixed z-[1015] flex items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-800 p-1 shadow-2xl" style={{ left: pos.left, top: pos.top }}>
      <button type="button" onMouseDown={keep} onClick={() => run(() => document.execCommand("bold"))} title="Bold" className={`${btn} font-bold`}>B</button>
      <button type="button" onMouseDown={keep} onClick={() => run(() => document.execCommand("italic"))} title="Italic" className={`${btn} italic`}>I</button>
      <button type="button" onMouseDown={keep} onClick={() => run(() => document.execCommand("insertUnorderedList"))} title="Bullet list" className={btn}>
        <svg className="w-4 h-4 mx-auto" viewBox="0 0 20 20" fill="currentColor"><circle cx="3" cy="5" r="1.5" /><circle cx="3" cy="10" r="1.5" /><circle cx="3" cy="15" r="1.5" /><rect x="7" y="4" width="11" height="2" rx="1" /><rect x="7" y="9" width="11" height="2" rx="1" /><rect x="7" y="14" width="11" height="2" rx="1" /></svg>
      </button>
      <button type="button" onMouseDown={keep} onClick={() => run(spoiler)} title="Spoiler" className={`${btn} font-bold font-mono text-red-300`}>S</button>
      <span className="w-px h-4 bg-slate-700 mx-0.5" />
      <button type="button" onMouseDown={keep} onClick={() => run(clear)} title="Clear formatting" className={btn}>
        <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5h12v2M8 5l-3 14M14 5l-1.5 7M3 21l6-6M9 21l-6-6" /></svg>
      </button>
    </div>
  );
}

// ── Photos, in place ──────────────────────────────────────────────────────────

/** A caption under a photo, typed where the page shows it; saved when you leave it. */
function CaptionLine({ value, onSave }: { value: string; onSave: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (ref.current && ref.current.textContent !== value) ref.current.textContent = value; }, [value]);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Add a caption"
      onBlur={() => { const t = (ref.current?.textContent ?? "").trim(); if (t !== value) onSave(t); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLDivElement).blur(); } }}
      className="mt-1.5 px-1 text-center text-xs sm:text-sm leading-snug text-slate-400 outline-none cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600"
    />
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

const ParkTextModal: React.FC<ParkTextsModalProps> = ({
  rating,
  explanations, sectionImages, sectionLayouts = {}, sectionSpoilers = {}, galleryImages, parkId, parkName, ratingId, onGalleryUpdate, onClose, onSave,
}) => {
  useScrollLock();
  const router = useRouter();

  const [drafts, setDrafts] = useState<Record<Category, Draft>>(() => buildDrafts(explanations, sectionImages, sectionLayouts, sectionSpoilers));
  // What the server currently has; drafts are compared against this to find unsaved work.
  const [saved, setSaved] = useState<Record<Category, Draft>>(() => buildDrafts(explanations, sectionImages, sectionLayouts, sectionSpoilers));
  const [persisted, setPersisted] = useState<Set<string>>(() => new Set(CATEGORIES.filter(c => explanations[c] !== undefined)));
  const [scores, setScores] = useState<Scores>(() => scoresOf(rating));
  const [savedScores, setSavedScores] = useState<Scores>(() => scoresOf(rating));

  const [selectedCat, setSelectedCat] = useState<Category>("description");
  // Bumped when a section's text changes from outside the editable (restore, reset), so it re-reads.
  const [textVersion, setTextVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [kept, setKept] = useState<string | null>(null);
  // Which image of the section is being positioned in place.
  const [posIndex, setPosIndex] = useState<number | null>(null);
  // The gallery over the page, filling this slot (the next free one when it is past the end).
  const [picker, setPicker] = useState<{ slot: number } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // The editor covers the page, yet the gallery clips and section videos behind it
  // keep decoding and make the editor stutter. Pause them while open, resume on close.
  useEffect(() => {
    const root = rootRef.current;
    const paused: HTMLVideoElement[] = [];
    document.querySelectorAll("video").forEach(v => {
      if (root?.contains(v) || v.paused) return;
      v.pause();
      paused.push(v);
    });
    return () => { paused.forEach(v => { v.play().catch(() => {}); }); };
  }, []);

  // Captions saved from this editor, layered over the gallery data until the page re-fetches.
  const [captionEdits, setCaptionEdits] = useState<Record<string, string>>({});
  // The picker opens on this visit's photos; the park's other visits are one tap away.
  const [pickerScope, setPickerScope] = useState<"this" | "others">("this");
  const [otherVisitImages, setOtherVisitImages] = useState<(VisitGalleryImage & { visit_date?: string })[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/park/${parkId}/gallery`)
      .then(r => (r.ok ? r.json() : { gallery: [] }))
      .then(d => { if (alive) setOtherVisitImages((d.gallery ?? []).filter((g: { visit_id?: number }) => g.visit_id !== ratingId)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [parkId, ratingId]);
  const othersLabel = otherVisitImages.every(g => !g.visit_date || Date.parse(g.visit_date) < Date.parse(rating.date))
    ? "Earlier visits" : "Other visits";
  const captions = useMemo(
    () => ({ ...mediaCaptions(otherVisitImages), ...mediaCaptions(galleryImages), ...captionEdits }),
    [otherVisitImages, galleryImages, captionEdits]
  );

  const saveCaption = useCallback(async (path: string, description: string) => {
    const img = galleryImages.find(g => g.path === path) ?? otherVisitImages.find(g => g.path === path);
    if (!img) { setSaveMsg({ kind: "err", text: "Caption not saved: this file is not in the gallery." }); return; }
    // Same title convention as the gallery lightbox editor.
    const title = `${parkName ?? ""} - ${description || "untitled"}`.replace(/^ - /, "");
    setCaptionEdits(c => ({ ...c, [path]: description }));
    try {
      const res = await fetch(`/api/gallery/${img.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, title }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onGalleryUpdate?.();
    } catch (err) {
      const status = err instanceof Error ? err.message : "";
      setSaveMsg({ kind: "err", text: status === "401" ? "Caption not saved: session expired. Log in to admin mode again." : "Failed to save the caption." });
    }
  }, [galleryImages, otherVisitImages, parkName, onGalleryUpdate]);

  const cur = drafts[selectedCat];
  const isDescription = selectedCat === "description";

  const dirtyCats = useMemo(
    () => CATEGORIES.filter(c => fingerprint(drafts[c]) !== fingerprint(saved[c])),
    [drafts, saved]
  );
  const dirtyScores = useMemo(
    () => (Object.keys(scores) as ScoreCategory[]).filter(c => scores[c] !== savedScores[c]),
    [scores, savedScores]
  );
  const dirtySet = useMemo(() => new Set<string>([...dirtyCats, ...dirtyScores]), [dirtyCats, dirtyScores]);
  const dirtyCount = dirtySet.size;
  const legacy = useMemo(() => legacySides(drafts), [drafts]);

  const defaultLayoutFor = useCallback((cat: Category): SectionLayout =>
    cat === "description" ? DESCRIPTION_DEFAULT_LAYOUT : legacy[cat] ? "right" : "left", [legacy]);
  // In multi-image mode, crop against the multi-image frame even while fewer are
  // picked, so image 1 is not positioned against a shape it will not get.
  const frameCount = Math.max(1, cur.imageCount);
  const activeLayout = normalizeSectionLayout(cur.layout, frameCount, defaultLayoutFor(selectedCat));
  const cropFrame = sectionImageFrame(cur.layout, frameCount, {
    defaultLayout: isDescription ? DESCRIPTION_DEFAULT_LAYOUT : null,
  });

  // Gallery images already placed in another section, so the picker can flag them.
  const usedIn = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cat of CATEGORIES) {
      if (cat === selectedCat) continue;
      for (const url of drafts[cat].images) (map[url] ??= []).push(LABELS[cat]);
    }
    return map;
  }, [drafts, selectedCat]);

  // ── Draft mutations ─────────────────────────────────────────────────────────
  const patch = useCallback((fn: (c: Draft) => Draft) =>
    setDrafts(d => ({ ...d, [selectedCat]: fn(d[selectedCat]) })), [selectedCat]);

  const updateText = useCallback((text: string) => patch(c => (c.text === text ? c : { ...c, text })), [patch]);
  const updateSpoiler = useCallback((isSpoiler: boolean) => patch(c => ({ ...c, isSpoiler })), [patch]);
  const updateLayout = useCallback((layout: SectionLayout) => {
    patch(c => ({ ...c, layout }));
    // A tall frame is a different crop: open the position tool for it right away.
    if (layout.startsWith("tall") && draftsRef.current[selectedCat].images[0]) setPosIndex(0);
  }, [patch, selectedCat]);
  const updateFocus = useCallback((index: number, focus: string) => patch(c => {
    const focuses = [...c.focuses];
    focuses[index] = withPhoneOf(focus, c.focuses[index]);
    return { ...c, focuses };
  }), [patch]);
  const stepScore = useCallback((cat: ScoreCategory, dir: -1 | 1) => setScores(s => ({
    ...s, [cat]: Math.max(0, Math.min(11, Math.round((s[cat] + dir * SCORE_STEP) / SCORE_STEP) * SCORE_STEP)),
  })), []);

  const setImageMode = useCallback((n: number) => {
    patch(c => ({
      ...c,
      imageCount: n,
      images: c.images.slice(0, n),
      focuses: c.focuses.slice(0, n),
      layout: n !== 2 && c.layout === "double" ? "above" : c.layout,
    }));
    setPosIndex(null);
  }, [patch]);

  const removeImageAt = useCallback((index: number) => {
    patch(c => ({
      ...c,
      images: c.images.filter((_, i) => i !== index),
      focuses: c.focuses.filter((_, i) => i !== index),
    }));
    setPosIndex(null);
  }, [patch]);

  /** Drop image `from` into position `to`, shifting the others along (crops travel with images). */
  const reorderImage = useCallback((from: number, to: number) => patch(c => {
    if (from === to || from < 0 || to < 0 || from >= c.images.length || to >= c.images.length) return c;
    const images = [...c.images];
    const focuses = c.images.map((_, i) => c.focuses[i] ?? FOCUS_DEFAULT);
    const [img] = images.splice(from, 1);
    const [foc] = focuses.splice(from, 1);
    images.splice(to, 0, img);
    focuses.splice(to, 0, foc);
    return { ...c, images, focuses };
  }), [patch]);

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  /** A gallery pick for the open slot (null clears the section's images). */
  const handlePick = useCallback((path: string | null) => {
    if (path === null) { patch(c => ({ ...c, images: [], focuses: [] })); setPicker(null); setPosIndex(null); return; }
    const slot = picker?.slot ?? draftsRef.current[selectedCat].images.length;
    const c = draftsRef.current[selectedCat];
    const target = Math.min(slot, c.images.length);
    const existing = c.images.indexOf(path);
    if (existing !== -1 && existing !== target && target < c.images.length) {
      reorderImage(existing, target);
    } else if (existing === -1) {
      patch(d => {
        const images = [...d.images];
        const focuses = d.images.map((_, i) => d.focuses[i] ?? FOCUS_DEFAULT);
        images[target] = path;
        focuses[target] = FOCUS_DEFAULT;
        return { ...d, images, focuses };
      });
    }
    setPicker(null);
    // A fresh photo in a frame wants positioning next.
    if (existing === -1) setPosIndex(target);
  }, [picker, selectedCat, patch, reorderImage]);

  const select = useCallback((cat: Category, pos: number | null = null) => {
    setSelectedCat(cat);
    setPosIndex(pos);
    setPicker(null);
  }, []);

  // Keep the section being written in view.
  const sectionRefs = useRef<Partial<Record<Category, HTMLDivElement | null>>>({});
  useEffect(() => {
    const el = sectionRefs.current[selectedCat];
    if (!el) return;
    const id = requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(id);
  }, [selectedCat]);

  // ── Kept in this browser ────────────────────────────────────────────────────
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(keptKey(ratingId));
      if (!raw) return;
      const stored = JSON.parse(raw) as { drafts?: Partial<Record<Category, Draft>>; scores?: Partial<Scores> };
      let restored = 0;
      setDrafts(d => {
        const next = { ...d };
        for (const c of CATEGORIES) {
          const s = stored.drafts?.[c];
          if (s && fingerprint(s) !== fingerprint(d[c])) { next[c] = s; restored++; }
        }
        return next;
      });
      if (stored.scores) setScores(s => ({ ...s, ...stored.scores }));
      if (restored > 0) { setKept(`${restored} unsaved section${restored === 1 ? "" : "s"} brought back from this browser`); setTextVersion(v => v + 1); }
    } catch {
      // A broken entry is just dropped.
    }
  }, [ratingId]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (dirtyCount === 0) window.localStorage.removeItem(keptKey(ratingId));
        else window.localStorage.setItem(keptKey(ratingId), JSON.stringify({ drafts, scores, at: Date.now() }));
      } catch {
        // Storage full or blocked: the save button still works.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [drafts, scores, dirtyCount, ratingId]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const dirtyRef = useRef(dirtyCats);
  dirtyRef.current = dirtyCats;
  const dirtyScoresRef = useRef(dirtyScores);
  dirtyScoresRef.current = dirtyScores;
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;

  useEffect(() => {
    const fresh = buildDrafts(explanations, sectionImages, sectionLayouts, sectionSpoilers);
    setDrafts(d => {
      const next = { ...d };
      for (const c of CATEGORIES) {
        if (fingerprint(d[c]) === fingerprint(savedRef.current[c])) next[c] = fresh[c];
      }
      return next;
    });
    setSaved(fresh);
    setPersisted(new Set(CATEGORIES.filter(c => explanations[c] !== undefined)));
  }, [explanations, sectionImages, sectionLayouts, sectionSpoilers]);
  useEffect(() => { const s = scoresOf(rating); setSavedScores(s); setScores(cur => { const next = { ...cur }; for (const c of Object.keys(s) as ScoreCategory[]) if (cur[c] === savedScoresRef.current[c]) next[c] = s[c]; return next; }); }, [rating]);
  const savedScoresRef = useRef(savedScores);
  savedScoresRef.current = savedScores;

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const cats = dirtyRef.current;
    const scoreCats = dirtyScoresRef.current;
    if (cats.length === 0 && scoreCats.length === 0) return;
    setIsSaving(true);
    setSaveMsg(null);
    // The text being typed is read on input, so it is already in the draft.

    const results = await Promise.all(cats.map(async cat => {
      const d = draftsRef.current[cat];
      const layout = d.layout === "double" && d.images.length !== 2 ? "above" : d.layout;
      const imgString = d.images.length > 0 ? mediaEntries(d).join(",") : null;
      const method = persistedRef.current.has(cat) ? "PUT" : "POST";
      try {
        const res = await fetch(`/api/park/${parkId}/parkTexts`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat, text: d.text, ratingId, imageUrl: imgString, imageLayout: layout ?? null, isSpoiler: d.isSpoiler }),
        });
        return { cat, ok: res.ok, status: res.status, draft: { ...d, layout } };
      } catch {
        return { cat, ok: false, status: 0, draft: d };
      }
    }));

    let scoresOk = true, scoresStatus = 200;
    if (scoreCats.length > 0) {
      try {
        const res = await fetch(`/api/ratings/${ratingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scores: Object.fromEntries(scoreCats.map(c => [c, scoresRef.current[c]])) }),
        });
        scoresOk = res.ok; scoresStatus = res.status;
      } catch { scoresOk = false; scoresStatus = 0; }
      if (scoresOk) { setSavedScores(s => ({ ...s, ...Object.fromEntries(scoreCats.map(c => [c, scoresRef.current[c]])) })); router.refresh(); }
    }

    const newSaved = { ...savedRef.current };
    const newPersisted = new Set(persistedRef.current);
    const failed: { name: string; status: number }[] = [];
    for (const r of results) {
      if (r.ok) { newSaved[r.cat] = r.draft; newPersisted.add(r.cat); }
      else failed.push({ name: LABELS[r.cat], status: r.status });
    }
    if (!scoresOk) failed.push({ name: "scores", status: scoresStatus });
    setSaved(newSaved);
    setPersisted(newPersisted);
    // Saved layouts that were normalised should show up in the draft too.
    setDrafts(d => {
      const next = { ...d };
      for (const r of results) if (r.ok && r.draft.layout !== d[r.cat].layout) next[r.cat] = { ...d[r.cat], layout: r.draft.layout };
      return next;
    });

    onSave?.(
      Object.fromEntries(CATEGORIES.filter(c => newSaved[c].text).map(c => [c, newSaved[c].text])),
      Object.fromEntries(CATEGORIES.filter(c => newSaved[c].images.length > 0).map(c => [c, mediaEntries(newSaved[c]).join(",")])),
      Object.fromEntries(CATEGORIES.filter(c => newSaved[c].layout).map(c => [c, newSaved[c].layout!])),
      Object.fromEntries(CATEGORIES.map(c => [c, newSaved[c].isSpoiler])),
    );

    if (failed.length > 0) {
      setSaveMsg({
        kind: "err",
        text: failed.some(f => f.status === 401)
          ? "Not saved: session expired. Log in to admin mode again."
          : failed.some(f => f.status === 0)
            ? "Save failed: network error."
            : `Failed to save: ${failed.map(f => f.name).join(", ")}`,
      });
    } else {
      const n = cats.length + (scoreCats.length ? 1 : 0);
      setSaveMsg({ kind: "ok", text: `Saved ${cats.length === 1 && !scoreCats.length ? LABELS[cats[0]] : `${n} change${n === 1 ? "" : "s"}`}` });
      setKept(null);
      setTimeout(() => setSaveMsg(m => (m?.kind === "ok" ? null : m)), 2500);
    }
    setIsSaving(false);
  }, [isSaving, parkId, ratingId, onSave, router]);

  const requestClose = useCallback(() => {
    const dirty = [...dirtyRef.current.map(c => LABELS[c]), ...(dirtyScoresRef.current.length ? ["scores"] : [])];
    if (dirty.length > 0) {
      if (!confirm(`Unsaved changes in: ${dirty.join(", ")}.\n\nThey stay in this browser. Close anyway?`)) return;
    }
    onClose();
  }, [onClose]);

  // Ctrl+S saves, Escape closes (the picker and the position tool close first).
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  const overlayRef = useRef({ picker: false, pos: false, upload: false });
  overlayRef.current = { picker: picker !== null, pos: posIndex !== null, upload: showUpload };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
        return;
      }
      if (e.key === "Escape") {
        if (overlayRef.current.upload) return;
        if (overlayRef.current.picker) { setPicker(null); return; }
        if (overlayRef.current.pos) { setPosIndex(null); return; }
        requestCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleUnpublish = async () => {
    if (!confirm("Unpublish this review?")) return;
    const res = await fetch(`/api/ratings/${ratingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: false }),
    });
    if (res.ok) window.location.reload();
    else setSaveMsg({ kind: "err", text: "Failed to unpublish." });
  };

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  const sectionButton = (cat: Category, compact: boolean) => {
    const d = drafts[cat];
    const filled = !isEmptyDraft(d);
    const dirty = dirtySet.has(cat);
    const active = selectedCat === cat;
    // A hollow dot: nothing written here yet.
    const dot = dirty ? "bg-amber-400" : filled ? "bg-green-500" : "border border-slate-500";
    if (compact) {
      return (
        <button key={cat} onClick={() => select(cat)}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${active ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 text-slate-400"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : dot}`} />
          {LABELS[cat]}
        </button>
      );
    }
    return (
      <button key={cat} onClick={() => select(cat)}
        title={dirty ? "Unsaved changes" : filled ? undefined : "Nothing written yet"}
        className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-left w-full transition-colors cursor-pointer rounded-lg ${active
          ? "bg-slate-800 text-white"
          : filled ? "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200" : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="flex-1 truncate">{LABELS[cat]}</span>
        {dirty && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">edited</span>}
      </button>
    );
  };

  // ── The section being written ───────────────────────────────────────────────
  const renderActive = (cat: Category) => {
    const d = drafts[cat];
    const media = mediaEntries(d);
    const layoutOptions: SectionLayout[] = layoutOptionsFor(d.imageCount);
    const imageModes = Array.from({ length: MAX_SECTION_IMAGES }, (_, i) => i + 1);
    const resolved = resolveSectionLayout(d.layout, media.length === 0 ? 0 : Math.min(d.imageCount, media.length + 1), {
      defaultLayout: cat === "description" ? DESCRIPTION_DEFAULT_LAYOUT : null,
      fallbackRight: legacy[cat],
    });
    const isRow = resolved.mode === "row";
    const isDouble = resolved.mode === "double";
    // A section with photos shows one empty frame for the next; one without none (the bar offers "Add image").
    const slotsShown = d.images.length === 0 ? 0 : Math.min(d.imageCount, d.images.length + 1);
    const sideBySide = resolved.mode === "stack" && slotsShown >= 2;
    const aspect = isRow && resolved.tall ? SECTION_IMAGE_ASPECT.tall : (isRow || sideBySide) ? SECTION_IMAGE_ASPECT.row : SECTION_IMAGE_ASPECT.full;
    const stats = countTextStats(d.text);
    const nextCat = CATEGORIES[CATEGORIES.indexOf(cat) + 1];
    const value = cat === "description" ? null : scores[cat];

    const slot = (i: number) => {
      const url = d.images[i];
      const isHalf = sideBySide;
      const wrap = `${isHalf ? "flex-1 min-w-0" : "w-full flex-shrink-0"} ${isDouble ? "mt-4 mb-4" : ""}`;
      if (!url) {
        return (
          <div key={`empty-${i}`} className={wrap}>
            <button type="button" onClick={() => { setPicker({ slot: i }); setPosIndex(null); }}
              className="w-full rounded-2xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-blue-400 hover:text-white text-sm font-bold transition-colors cursor-pointer"
              style={{ aspectRatio: aspect.desktop }}>
              + Add {isVideoUrl(url ?? "") ? "clip" : "image"}{d.imageCount > 1 ? ` ${i + 1}` : ""}
            </button>
          </div>
        );
      }
      const pair = splitFocusPair(d.focuses[i] ?? FOCUS_DEFAULT);
      const pan = parseFocusStr(pair.desktop);
      const panPhone = pair.phone ? parseFocusStr(pair.phone) : null;
      const video = isVideoUrl(url);
      const positioning = posIndex === i;
      const btn = "px-2 py-1 rounded-md bg-black/70 text-white text-[11px] font-bold hover:bg-blue-600 cursor-pointer";
      return (
        <figure key={`${i}-${url}`} className={wrap}
          draggable={!positioning}
          onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
          onDragEnd={() => setDragFrom(null)}
          onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
          onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) reorderImage(dragFrom, i); setDragFrom(null); }}>
          {positioning ? (
            <div className="rounded-2xl ring-2 ring-blue-500 p-2 bg-slate-950/60">
              <SectionImageCropper
                key={`crop-${cat}-${i}-${url}-${cropFrame.desktop}`}
                src={url}
                isVideo={video}
                mobileAspect={cropFrame.mobile}
                desktopAspect={cropFrame.desktop}
                value={d.focuses[i] ?? FOCUS_DEFAULT}
                onChange={(f) => updateFocus(i, f)}
              />
              <div className="mt-2 flex items-center justify-center gap-4 text-xs font-bold">
                <button type="button" onClick={() => removeImageAt(i)} className="text-red-400 hover:text-red-300 cursor-pointer">Remove</button>
                <button type="button" onClick={() => setPosIndex(null)} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer">Done</button>
              </div>
            </div>
          ) : (
            <div className={`relative w-full rounded-2xl overflow-hidden group shadow-sm ${dragFrom === i ? "opacity-50" : ""} cursor-grab`} title="Drag to reorder">
              {video ? (
                <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: aspect.desktop }}>
                  <LazyVideo src={url} className="absolute inset-0 w-full h-full object-cover rounded-2xl" style={{ objectPosition: `${pan.cx * 100}% ${pan.cy * 100}%` }} />
                </div>
              ) : (
                <SectionImage src={url} alt={humanizeLabel(cat)} cx={pan.cx} cy={pan.cy} mcx={panPhone?.cx} mcy={panPhone?.cy} zoom={pan.zoom} mzoom={panPhone?.zoom}
                  mobileAspect={aspect.mobile} desktopAspect={aspect.desktop}
                  sizes={isRow ? "(min-width: 1024px) 22vw, 94vw" : isHalf ? `(min-width: 1024px) ${Math.ceil(50 / slotsShown)}vw, 94vw` : "(min-width: 1024px) 50vw, 94vw"} />
              )}
              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">{i + 1}{video ? " · video" : ""}</span>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => setPosIndex(i)} className={btn}>Position</button>
                <button type="button" onClick={() => { setPicker({ slot: i }); setPosIndex(null); }} className={btn}>Replace</button>
                <button type="button" onClick={() => removeImageAt(i)} aria-label="Remove" className={`${btn} text-red-300 hover:bg-red-700`}>×</button>
              </div>
            </div>
          )}
          <CaptionLine value={captions[url] ?? ""} onSave={(t) => saveCaption(url, t)} />
        </figure>
      );
    };

    const slots = Array.from({ length: slotsShown }, (_, i) => slot(i));
    const textClass = cat === "description" ? "text-slate-300 text-base leading-relaxed" : "text-slate-200 leading-relaxed md:text-lg";
    const text = (
      <div className={`${d.isSpoiler && !previewAsVisitor ? "rounded-xl bg-red-900/10 ring-1 ring-red-900/30 p-4 -m-4" : ""} flex-1 min-w-0`}>
        <EditableText cat={cat} version={textVersion} value={d.text} onChange={updateText} className={textClass}
          placeholder={`Write about ${LABELS[cat].toLowerCase()}…`} editorRef={editorRef} />
      </div>
    );

    let body: React.ReactNode;
    if (slotsShown === 0 || resolved.mode === "none") body = <div>{text}</div>;
    else if (isDouble) body = <div className="flex flex-col">{slots[0]}{text}{slots[1]}</div>;
    else if (isRow) body = (
      <div className={`flex flex-col gap-6 items-start ${resolved.isRight ? "md:flex-row-reverse" : "md:flex-row"}`}>
        <div className="w-full md:w-[44%] flex-shrink-0 flex flex-col gap-4 mt-1.5">{slots}</div>
        {text}
      </div>
    );
    else body = (
      <div className={`flex gap-4 ${resolved.mode === "stack" && resolved.isAbove ? "flex-col" : "flex-col-reverse"}`}>
        <div className={`flex mt-1.5 ${sideBySide ? "flex-row gap-2 md:gap-3" : "flex-col gap-4"}`}>{slots}</div>
        {text}
      </div>
    );

    const seg = "flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-bold";
    const segBtn = (on: boolean) => `px-2.5 py-1 rounded-md cursor-pointer transition-colors ${on ? "bg-slate-700 text-blue-400" : "text-slate-500 hover:text-slate-300"}`;
    return (
      <div>
        {cat === "description" ? (
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-bold text-white tracking-tight">Introduction</h2>
              <div className="w-12 h-1 bg-brand rounded-full mt-3" />
            </div>
            <span className="text-xs text-slate-500 font-medium">{stats.words} words</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-3 border-l-4 border-brand pl-3">
            <h3 className="text-xl font-semibold text-white">{humanizeLabel(cat)}</h3>
            <span className="inline-flex items-center gap-1.5">
              <button type="button" onClick={() => stepScore(cat, -1)} aria-label="Score down" className="w-6 h-6 rounded-md border border-slate-700 bg-slate-800 text-slate-200 text-sm leading-none hover:bg-slate-700 cursor-pointer">−</button>
              <span className={`text-2xl font-bold tabular-nums ${getRatingColor(value ?? 0)}`}>{value}</span>
              <button type="button" onClick={() => stepScore(cat, 1)} aria-label="Score up" className="w-6 h-6 rounded-md border border-slate-700 bg-slate-800 text-slate-200 text-sm leading-none hover:bg-slate-700 cursor-pointer">+</button>
            </span>
            <span className="ml-auto text-xs text-slate-500 font-medium">{stats.words} words</span>
          </div>
        )}
        {/* The section's shape: how many photos, where they sit, and whether it is a spoiler. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <div className={seg}>
            {imageModes.map(n => (
              <button key={n} type="button" onClick={() => setImageMode(n)} className={segBtn(d.imageCount === n)}>{n === 1 ? "1 image" : `${n} images`}</button>
            ))}
          </div>
          {d.images.length === 0 && (
            <button type="button" onClick={() => { setPicker({ slot: 0 }); setPosIndex(null); }}
              className="px-2.5 py-1 rounded-lg border border-dashed border-slate-600 text-xs font-bold text-slate-300 hover:border-blue-400 hover:text-white cursor-pointer">
              + Add image
            </button>
          )}
          {d.images.length > 0 && (
            <div className={seg}>
              {layoutOptions.map(opt => (
                <button key={opt} type="button" onClick={() => updateLayout(opt)} title={opt === "double" ? "Image, text, image" : undefined} className={segBtn(activeLayout === opt)}>
                  {SECTION_LAYOUT_LABELS[opt]}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => updateSpoiler(!d.isSpoiler)} aria-pressed={d.isSpoiler}
            className={`ml-auto px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${d.isSpoiler ? "border-red-800/60 bg-red-900/30 text-red-300" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}>
            Spoiler section
          </button>
        </div>
        <div className="mt-4">{body}</div>
        {nextCat && (
          <button type="button" onClick={() => select(nextCat)} className="mt-4 text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer">
            Next: {LABELS[nextCat]} ›
          </button>
        )}
      </div>
    );
  };

  // ── The other sections, as the page shows them ──────────────────────────────
  const renderInactive = (cat: Category) => {
    const d = drafts[cat];
    const media = mediaEntries(d);
    const isAdminMode = !previewAsVisitor;
    const value = cat === "description" ? null : scores[cat];
    if (isEmptyDraft(d)) {
      return (
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-semibold text-slate-400">{cat === "description" ? "Introduction" : humanizeLabel(cat)}</h3>
          {value !== null && <span className={`text-lg font-bold ${getRatingColor(value)}`}>{value}</span>}
          <span className="text-sm text-slate-600">nothing yet</span>
        </div>
      );
    }
    if (cat === "description") {
      return (
        <div>
          <h2 className="text-4xl font-bold text-white tracking-tight">Introduction</h2>
          <div className="w-12 h-1 bg-brand rounded-full mt-3 mb-4" />
          <SectionBody text={d.text} media={media} layout={d.layout} defaultLayout={DESCRIPTION_DEFAULT_LAYOUT} isSpoiler={d.isSpoiler} isAdminMode={isAdminMode}
            altLabel="Introduction" textClassName="text-slate-400 text-base leading-relaxed" onMediaClick={(_u, i) => select(cat, i)} captions={captions} />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="flex items-baseline gap-3 border-l-4 border-brand pl-3">
          <h3 className="text-xl font-semibold text-white">{humanizeLabel(cat)}</h3>
          <span className={`text-2xl font-bold ${getRatingColor(value ?? 0)}`}>{value}</span>
          {isAdminMode && d.isSpoiler && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-900/40 text-red-400 border border-red-800/50">Spoiler</span>
          )}
        </div>
        <SectionBody text={d.text} media={media} layout={d.layout} fallbackRight={legacy[cat]} isSpoiler={d.isSpoiler} isAdminMode={isAdminMode}
          altLabel={humanizeLabel(cat)} onMediaClick={(_u, i) => select(cat, i)} captions={captions} />
      </div>
    );
  };

  const pickerImages = pickerScope === "this" ? galleryImages : otherVisitImages;
  const pickerSlot = picker ? Math.min(picker.slot, cur.images.length) : 0;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col text-slate-200">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14 border-b border-slate-800 flex-shrink-0 bg-slate-900/60">
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <h2 className="font-bold text-white text-base truncate">Edit review</h2>
          {parkName && <span className="hidden sm:inline text-sm text-slate-500 truncate">{parkName}</span>}
        </div>
        {saveMsg ? (
          <span className={`hidden md:inline text-sm font-medium ${saveMsg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{saveMsg.text}</span>
        ) : kept ? (
          <span className="hidden md:inline text-xs text-amber-300">{kept}</span>
        ) : dirtyCount > 0 ? (
          <span className="hidden md:inline text-xs text-slate-500">Kept in this browser until saved</span>
        ) : null}
        <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
          {([false, true] as const).map(v => (
            <button key={String(v)} onClick={() => setPreviewAsVisitor(v)}
              className={`px-2.5 py-0.5 rounded-md cursor-pointer transition-colors ${previewAsVisitor === v ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
              {v ? "As visitor" : "As admin"}
            </button>
          ))}
        </div>
        {rating.published && (
          <button onClick={handleUnpublish}
            className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-red-900/50 text-red-400 text-sm font-medium hover:bg-red-900/20 transition-colors cursor-pointer">
            Unpublish
          </button>
        )}
        <button onClick={handleSave} disabled={isSaving || dirtyCount === 0} title="Ctrl+S"
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-default text-white text-sm font-bold transition-colors cursor-pointer">
          {isSaving ? "Saving…" : dirtyCount > 0 ? `Save ${dirtyCount}` : "Saved"}
        </button>
        <button onClick={requestClose} aria-label="Close editor"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {saveMsg && (
        <div className={`md:hidden px-4 py-1.5 text-xs font-medium border-b border-slate-800 ${saveMsg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{saveMsg.text}</div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <nav className="hidden lg:flex flex-col w-52 border-r border-slate-800 overflow-y-auto flex-shrink-0 p-2 gap-0.5 bg-slate-900/40">
          {CATEGORIES.map(cat => sectionButton(cat, false))}
        </nav>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="lg:hidden flex gap-1.5 px-3 py-2 overflow-x-auto flex-shrink-0 border-b border-slate-800 no-scrollbar">
            {CATEGORIES.map(cat => sectionButton(cat, true))}
          </div>

          {/* Opaque background on purpose: Chrome only gives a scroller its own compositor layer
              when it is opaque. Without it the whole editor repaints on every scroll step. */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#0f172a]">
            <div className="max-w-[900px] mx-auto px-5 sm:px-8 py-8 space-y-8">
              {CATEGORIES.map(cat => {
                const active = cat === selectedCat;
                const empty = isEmptyDraft(drafts[cat]);
                return (
                  <React.Fragment key={cat}>
                    {cat === CATEGORIES[1] && (
                      <h2 className="text-3xl font-semibold text-white pt-2">{parkName ? `${parkName} Review` : "Review"}</h2>
                    )}
                    <div
                      ref={el => { sectionRefs.current[cat] = el; }}
                      onClick={active ? undefined : () => select(cat)}
                      title={active ? undefined : `Click to write ${LABELS[cat]}`}
                      className={`relative rounded-2xl scroll-mt-6 -mx-3 px-3 transition-[box-shadow,background-color] ${active
                        ? "ring-1 ring-blue-500/50 bg-blue-500/[0.05] py-4"
                        : `cursor-pointer hover:ring-1 hover:ring-slate-600/70 ${empty ? "py-2" : "py-3"}`}`}
                    >
                      {active ? renderActive(cat) : renderInactive(cat)}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!picker && !showUpload && (
        <SelectionBar editorRef={editorRef} onChanged={() => { if (editorRef.current) updateText(htmlToMarkdown(editorRef.current)); }} />
      )}

      {/* ── The gallery, over the page ──────────────────────────────────────── */}
      {picker && (
        <div className="fixed inset-0 z-[1010] flex items-center justify-center bg-slate-950/75 p-4" onClick={() => setPicker(null)}>
          <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl border border-blue-800/60 bg-slate-900 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 h-12 border-b border-slate-800 flex-shrink-0">
              <p className="text-sm font-bold text-white">
                {pickerSlot < cur.images.length ? `Replace ${cur.imageCount > 1 ? `image ${pickerSlot + 1}` : "the image"}` : `Add ${cur.imageCount > 1 ? `image ${pickerSlot + 1}` : "an image"}`}
                <span className="text-slate-500 font-normal"> · {LABELS[selectedCat]}</span>
              </p>
              {otherVisitImages.length > 0 && (
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
                  {([
                    { id: "this" as const, label: "This visit", n: galleryImages.length },
                    { id: "others" as const, label: othersLabel, n: otherVisitImages.length },
                  ]).map(t => (
                    <button key={t.id} onClick={() => setPickerScope(t.id)}
                      className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${pickerScope === t.id ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                      {t.label} <span className={pickerScope === t.id ? "text-slate-400" : "text-slate-600"}>{t.n}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setShowUpload(true)} className="ml-auto text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer">Upload</button>
              <button onClick={() => setPicker(null)} aria-label="Close" className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <ImagePickerGrid
                galleryImages={pickerImages}
                selected={cur.images}
                onSelect={handlePick}
                maxSelection={cur.imageCount}
                usedIn={usedIn}
                replacing
                captions={captions}
              />
              <p className="mt-3 text-xs text-slate-500">Rest on a photo for a large look. Photos marked Used are in another section; None takes every photo out of this section.</p>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <ImageUploaderModal
          visitId={ratingId}
          parkName={parkName ?? ""}
          onCloseAction={() => setShowUpload(false)}
          onUploadSuccessAction={() => onGalleryUpdate?.()}
        />
      )}
    </div>
  );
};

export default ParkTextModal;
