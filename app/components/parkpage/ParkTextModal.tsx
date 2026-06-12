"use client";

import React, { useState, useRef, useCallback } from "react";
import Image from "next/image";
import type { GalleryImage } from "./ParkGallery";
import { useScrollLock } from "@/app/hooks/useScrollLock";

interface ParkTextsModalProps {
  explanations: Record<string, string>;
  sectionImages: Record<string, string>;
  sectionLayouts?: Record<string, string>;
  galleryImages: GalleryImage[];
  parkId: number;
  ratingId: number;
  onClose: () => void;
  onSave?: (updatedText: Record<string, string>, updatedImages: Record<string, string>, updatedLayouts: Record<string, string>) => void;
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

const isVideo = (p: string) => /\.(mp4|webm|ogg)$/i.test(p);

// Memoized so typing in the textarea doesn't re-render the whole grid, and
// served as real thumbnails via next/image instead of decoding R2 originals.
const ImagePickerGrid = React.memo(function ImagePickerGrid({
  galleryImages, selected, onSelect,
}: {
  galleryImages: GalleryImage[];
  selected: string | null;
  onSelect: (path: string | null) => void;
}) {
  if (galleryImages.length === 0) {
    return <p className="text-sm text-slate-500">No gallery images available.</p>;
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
      <button onClick={() => onSelect(null)}
        className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${selected === null
            ? "border-blue-500 bg-blue-500/20 text-blue-400"
            : "border-slate-700 text-slate-500 hover:border-slate-600"
          }`}>
        None
      </button>
      {galleryImages.map(img => {
        const sel = selected === img.path;
        return (
          <button key={img.id} onClick={() => onSelect(img.path)}
            className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all cursor-pointer ${sel ? "border-blue-500 ring-2 ring-blue-500/30" : "border-slate-700 hover:border-slate-500"
              }`}>
            {isVideo(img.path) ? (
              <video src={img.path} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <Image src={img.path} alt="" fill sizes="(max-width: 640px) 25vw, 160px" quality={55} className="object-cover" />
            )}
            {sel && (
              <div className="absolute inset-0 bg-blue-500/25 flex items-center justify-center">
                <svg className="w-5 h-5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
});

const ParkTextModal: React.FC<ParkTextsModalProps> = ({
  explanations, sectionImages, sectionLayouts = {}, galleryImages, parkId, ratingId, onClose, onSave,
}) => {
  useScrollLock();
  const [selectedCat, setSelectedCat] = useState<Category>(CATEGORIES[0]);
  const [drafts, setDrafts] = useState<Record<string, { text: string; image: string | null; layout: string | null }>>(() =>
    Object.fromEntries(CATEGORIES.map(cat => [cat, {
      text: explanations[cat] ?? "",
      image: sectionImages[cat] ?? null,
      layout: sectionLayouts[cat] ?? null,
    }]))
  );

  const [persisted, setPersisted] = useState<Set<string>>(
    () => new Set(CATEGORIES.filter(c => explanations[c]))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cur = drafts[selectedCat];

  const updateText = useCallback((t: string) =>
    setDrafts(d => ({ ...d, [selectedCat]: { ...d[selectedCat], text: t } })), [selectedCat]);
  const updateImage = useCallback((img: string | null) =>
    setDrafts(d => ({ ...d, [selectedCat]: { ...d[selectedCat], image: img } })), [selectedCat]);
  const updateLayout = useCallback((layout: string | null) =>
    setDrafts(d => ({ ...d, [selectedCat]: { ...d[selectedCat], layout } })), [selectedCat]);

  // ── Markdown toolbar ────────────────────────────────────────────────────────
  const wrapSelection = (before: string, after = before) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const next = cur.text.slice(0, s) + before + cur.text.slice(s, e) + after + cur.text.slice(e);
    updateText(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + before.length, e + before.length); }, 0);
  };

  const insertBullet = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = cur.text.lastIndexOf("\n", s - 1) + 1;
    const next = cur.text.slice(0, lineStart) + "- " + cur.text.slice(lineStart);
    updateText(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + 2, s + 2); }, 0);
  };

  // ── Save all ────────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveError(null);
    const newPersisted = new Set(persisted);
    const outTexts: Record<string, string> = {};
    const outImages: Record<string, string> = {};
    const outLayouts: Record<string, string> = {};
    const failed: { cat: Category; status: number }[] = [];

    try {
      for (const cat of CATEGORIES) {
        const { text, image, layout } = drafts[cat];
        if (!text && !image && !persisted.has(cat)) continue;

        const method = persisted.has(cat) ? "PUT" : "POST";
        const res = await fetch(`/api/park/${parkId}/parkTexts`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat, text, ratingId, imageUrl: image ?? null, imageLayout: layout ?? null }),
        });
        if (res.ok) {
          const saved = await res.json();
          newPersisted.add(cat);
          if (saved.text) outTexts[cat] = saved.text;
          if (saved.imageUrl) outImages[cat] = saved.imageUrl;
          if (saved.imageLayout) outLayouts[cat] = saved.imageLayout;
          else if (drafts[cat].layout) outLayouts[cat] = drafts[cat].layout!;
        } else {
          failed.push({ cat, status: res.status });
        }
      }
      setPersisted(newPersisted);
      onSave?.(outTexts, outImages, outLayouts);
      if (failed.length > 0) {
        setSaveError(
          failed.some(f => f.status === 401)
            ? "Not saved: session expired. Log in to admin mode again."
            : `Failed to save: ${failed.map(f => LABELS[f.cat]).join(", ")}`
        );
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveError("Save failed: network error.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    const texts = Object.fromEntries(CATEGORIES.filter(c => drafts[c].text).map(c => [c, drafts[c].text]));
    const images = Object.fromEntries(CATEGORIES.filter(c => drafts[c].image).map(c => [c, drafts[c].image!]));
    const layouts = Object.fromEntries(CATEGORIES.filter(c => drafts[c].layout).map(c => [c, drafts[c].layout!]));
    onSave?.(texts, images, layouts);
    onClose();
  };

  const handleUnpublish = async () => {
    if (!confirm("Unpublish this review?")) return;
    const res = await fetch(`/api/ratings/${ratingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: false }),
    });
    if (res.ok) window.location.reload();
    else alert("Failed to unpublish.");
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl h-[93vh] flex flex-col overflow-hidden">

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <h2 className="font-bold text-white text-base flex-1">Edit Sections</h2>
          {saveSuccess && <span className="text-green-400 text-sm font-medium">Saved ✓</span>}
          {saveError && <span className="text-red-400 text-sm font-medium">{saveError}</span>}
          <button onClick={handleUnpublish}
            className="px-3 py-1.5 rounded-lg border border-red-900/50 text-red-400 text-sm font-medium hover:bg-red-900/20 transition-colors cursor-pointer">
            Unpublish
          </button>
          <button onClick={handleSaveAll} disabled={isSaving}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold transition-colors cursor-pointer">
            {isSaving ? "Saving…" : "Save all"}
          </button>
          <button onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* Sidebar — desktop only */}
          <div className="hidden sm:flex flex-col w-44 border-r border-slate-800 overflow-y-auto flex-shrink-0 py-1">
            {CATEGORIES.map(cat => {
              const filled = !!(drafts[cat].text || drafts[cat].image);
              return (
                <button key={cat} onClick={() => setSelectedCat(cat)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-left w-full transition-colors cursor-pointer ${selectedCat === cat
                      ? "bg-slate-800 text-blue-400 border-r-2 border-blue-500"
                      : "text-slate-400 hover:bg-slate-800/50"
                    }`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${filled ? "bg-green-500" : "bg-slate-600"}`} />
                  {LABELS[cat]}
                </button>
              );
            })}
          </div>

          {/* Right panel */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

            {/* Category pills — mobile only */}
            <div className="sm:hidden flex gap-1.5 px-3 py-2 overflow-x-auto flex-shrink-0 border-b border-slate-800 no-scrollbar">
              {CATEGORIES.map(cat => {
                const filled = !!(drafts[cat].text || drafts[cat].image);
                return (
                  <button key={cat} onClick={() => setSelectedCat(cat)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${selectedCat === cat
                        ? "bg-blue-600 border-blue-600 text-white"
                        : filled
                          ? "border-green-500 text-green-400 bg-green-900/20"
                          : "border-slate-700 text-slate-500"
                      }`}>
                    {LABELS[cat]}
                  </button>
                );
              })}
            </div>

            {/* Scrollable editor area */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">

              {/* Toolbar */}
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => wrapSelection("**")} title="Bold"
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-700 hover:bg-slate-800 font-bold text-sm text-slate-200 cursor-pointer transition-colors">
                  B
                </button>
                <button type="button" onClick={() => wrapSelection("*")} title="Italic"
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-700 hover:bg-slate-800 italic text-sm text-slate-200 cursor-pointer transition-colors">
                  I
                </button>
                <button type="button" onClick={insertBullet} title="Bullet list"
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-700 hover:bg-slate-800 text-sm text-slate-200 cursor-pointer transition-colors">
                  •—
                </button>
                <span className="text-xs text-slate-500 ml-1.5">**bold** &nbsp;*italic* &nbsp;- bullet</span>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none text-sm leading-relaxed"
                rows={10}
                value={cur.text}
                onChange={e => updateText(e.target.value)}
                placeholder={`Write about ${LABELS[selectedCat].toLowerCase()}…`}
              />

              {/* Image picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-300">
                    Section Image <span className="text-slate-500 font-normal">(optional)</span>
                  </p>
                  {cur.image && (
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                      {(["side", "center"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => updateLayout(opt === "side" ? null : "center")}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${(opt === "center" ? cur.layout === "center" : cur.layout !== "center")
                              ? "bg-slate-700 text-blue-400 shadow-sm"
                              : "text-slate-500 hover:text-slate-300"
                            }`}
                        >
                          {opt === "side" ? "⬛ Side" : "⬜ Center"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ImagePickerGrid galleryImages={galleryImages} selected={cur.image} onSelect={updateImage} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParkTextModal;