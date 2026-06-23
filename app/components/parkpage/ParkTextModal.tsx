"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { CropEditor } from "./ParkHeaderModal";
import { splitMedia } from "../FocusedImage";
import type { Rating } from "@/app/types";
import type { GalleryImage } from "./ParkGallery";
import { useScrollLock } from "@/app/hooks/useScrollLock";

interface ParkTextsModalProps {
  rating: Rating;
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

const countTextStats = (text: string) => {
  if (!text) return { words: 0, paragraphs: 0 };

  const paragraphs = text.split("\n").filter(line => line.trim() !== "").length;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  return { words, paragraphs };
};

const isVideo = (p: string) => /\.(mp4|webm|ogg)$/i.test(p);
const ImagePickerGrid = React.memo(function ImagePickerGrid({
  galleryImages, selected, onSelect, maxSelection
}: {
  galleryImages: GalleryImage[];
  selected: string[];
  onSelect: (path: string | null) => void;
  maxSelection: number;
}) {
  if (galleryImages.length === 0) {
    return <p className="text-sm text-slate-500">No gallery images available.</p>;
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
      <button onClick={() => onSelect(null)}
        className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${selected.length === 0
          ? "border-blue-500 bg-blue-500/20 text-blue-400"
          : "border-slate-700 text-slate-500 hover:border-slate-600"
          }`}>
        None
      </button>
      {galleryImages.map(img => {
        const selIndex = selected.indexOf(img.path);
        const sel = selIndex !== -1;
        // Single-image mode: clicking another image just replaces the current one.
        // Only block clicks in 2-image mode once both slots are full.
        const disabled = !sel && maxSelection > 1 && selected.length >= maxSelection;

        return (
          <button key={img.id} onClick={() => !disabled && onSelect(img.path)}
            disabled={disabled}
            className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${sel ? "border-blue-500 ring-2 ring-blue-500/30 cursor-pointer" : disabled ? "border-slate-800/60 opacity-30 cursor-not-allowed" : "border-slate-700 hover:border-slate-500 cursor-pointer"
              }`}>
            {isVideo(img.path) ? (
              <video src={img.path} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <Image src={img.path} alt="" fill sizes="(max-width: 640px) 25vw, 160px" quality={55} className="object-cover" />
            )}
            {sel && (
              <div className="absolute inset-0 bg-blue-500/25 flex items-center justify-center">
                {maxSelection === 2 ? (
                  <span className="bg-blue-600 text-white font-bold rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-lg border-2 border-white/20">
                    {selIndex + 1}
                  </span>
                ) : (
                  <svg className="w-5 h-5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
});

const ParkTextModal: React.FC<ParkTextsModalProps> = ({
  rating,
  explanations, sectionImages, sectionLayouts = {}, galleryImages, parkId, ratingId, onClose, onSave,
}) => {
  useScrollLock();
  const [selectedCat, setSelectedCat] = useState<Category>(CATEGORIES[0]);

  // Changed image to images array, and added useTwoImages toggle
  const [drafts, setDrafts] = useState<Record<string, { text: string; images: string[]; focuses: string[]; layout: string | null; useTwoImages: boolean }>>(() =>
    Object.fromEntries(CATEGORIES.map(cat => {
      const parsed = sectionImages[cat] ? sectionImages[cat].split(",").map(splitMedia) : [];
      return [cat, {
        text: explanations[cat] ?? "",
        images: parsed.map(p => p.url),
        focuses: parsed.map(p => p.focus),
        layout: sectionLayouts[cat] ?? null,
        useTwoImages: parsed.length > 1
      }];
    }))
  );

  const [persisted, setPersisted] = useState<Set<string>>(
    () => new Set(CATEGORIES.filter(c => explanations[c]))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cur = drafts[selectedCat];
  const textStats = countTextStats(cur.text);
  // Roughly match the on-page crop box so panning previews accurately.
  const cropAspect = cur.layout === "left" || cur.layout === "right" ? "16 / 9" : "21 / 9";

  // Validation function
  const canSwitchOrSave = () => {
    const c = drafts[selectedCat];
    if (c.useTwoImages && c.images.length === 1) {
      alert("You have '2 Images' enabled but only 1 selected. Please select a second image or switch to '1 Image Mode'.");
      return false;
    }
    return true;
  };

  const handleCatSelect = (cat: Category) => {
    if (canSwitchOrSave()) { setSelectedCat(cat); setCropIndex(null); }
  };

  const updateText = useCallback((t: string) =>
    setDrafts(d => ({ ...d, [selectedCat]: { ...d[selectedCat], text: t } })), [selectedCat]);

  // Updated image selection logic for arrays
  const updateImage = useCallback((img: string | null) => {
    setDrafts(d => {
      const c = d[selectedCat];
      if (img === null) return { ...d, [selectedCat]: { ...c, images: [], focuses: [] } };

      if (c.useTwoImages) {
        const idx = c.images.indexOf(img);
        if (idx !== -1) {
          return {
            ...d, [selectedCat]: {
              ...c,
              images: c.images.filter((_, i) => i !== idx),
              focuses: c.focuses.filter((_, i) => i !== idx),
            }
          };
        }
        if (c.images.length < 2) {
          return { ...d, [selectedCat]: { ...c, images: [...c.images, img], focuses: [...c.focuses, "0.5 0.5 1"] } };
        }
        return d;
      } else {
        return { ...d, [selectedCat]: { ...c, images: [img], focuses: ["0.5 0.5 1"] } };
      }
    });
  }, [selectedCat]);

  // Pan focus per selected image, committed by the CropEditor below the picker.
  const updateFocus = useCallback((index: number, focus: string) => {
    setDrafts(d => {
      const c = d[selectedCat];
      const focuses = [...c.focuses];
      focuses[index] = focus;
      return { ...d, [selectedCat]: { ...c, focuses } };
    });
  }, [selectedCat]);

  // Live ref so the picker handler stays stable (keeps the grid memoized).
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  // Picking an image opens the crop popup for it; clicking a selected one re-opens it.
  const handlePick = useCallback((path: string | null) => {
    if (path === null || isVideo(path)) { updateImage(path); return; }
    const c = draftsRef.current[selectedCat];
    const existing = c.images.indexOf(path);
    if (existing !== -1) { setCropIndex(existing); return; }
    if (c.useTwoImages && c.images.length >= 2) return;
    const newIndex = c.useTwoImages ? c.images.length : 0;
    updateImage(path);
    setCropIndex(newIndex);
  }, [selectedCat, updateImage]);

  const removeImageAt = useCallback((index: number) => {
    setDrafts(d => {
      const c = d[selectedCat];
      return {
        ...d, [selectedCat]: {
          ...c,
          images: c.images.filter((_, i) => i !== index),
          focuses: c.focuses.filter((_, i) => i !== index),
        }
      };
    });
    setCropIndex(null);
  }, [selectedCat]);

  useEffect(() => {
    if (cropIndex === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCropIndex(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cropIndex]);

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
    if (!canSwitchOrSave()) return;
    setIsSaving(true);
    setSaveError(null);
    const newPersisted = new Set(persisted);
    const outTexts: Record<string, string> = {};
    const outImages: Record<string, string> = {};
    const outLayouts: Record<string, string> = {};
    const failed: { cat: Category; status: number }[] = [];

    try {
      for (const cat of CATEGORIES) {
        const { text, images, focuses, layout } = drafts[cat];
        if (!text && images.length === 0 && !persisted.has(cat)) continue;

        const imgString = images.length > 0
          ? images.map((u, i) => `${u}|${focuses[i] ?? "0.5 0.5 1"}`).join(",")
          : null;
        const method = persisted.has(cat) ? "PUT" : "POST";
        const res = await fetch(`/api/park/${parkId}/parkTexts`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat, text, ratingId, imageUrl: imgString, imageLayout: layout ?? null }),
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
    const images = Object.fromEntries(CATEGORIES.filter(c => drafts[c].images.length > 0).map(c => [c, drafts[c].images.map((u, i) => `${u}|${drafts[c].focuses[i] ?? "0.5 0.5 1"}`).join(",")]));
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
              const filled = !!(drafts[cat].text || drafts[cat].images.length > 0);
              return (
                <button key={cat} onClick={() => handleCatSelect(cat)}
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
                const filled = !!(drafts[cat].text || drafts[cat].images.length > 0);
                return (
                  <button key={cat} onClick={() => handleCatSelect(cat)}
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

              {/* Category Title & Score Header */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {LABELS[selectedCat]}
                </h3>
                {selectedCat !== "description" && (
                  <div className="bg-slate-800/80 border border-slate-700 px-3 py-1 rounded-lg flex items-center gap-2 shadow-sm">
                    <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Score</span>
                    <span className="text-blue-400 font-bold text-lg">
                      {String(rating[selectedCat as keyof Rating] ?? "-")}
                    </span>
                  </div>
                )}
              </div>

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

              {/* Word and Paragraph Counter */}
              <div className="flex justify-end -mt-2 mb-2 pr-1">
                <span className="text-xs text-slate-500 font-medium tracking-wide">
                  Words: {textStats.words} &nbsp;|&nbsp; Paragraphs: {textStats.paragraphs}
                </span>
              </div>

              {/* Image picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-slate-300">
                      Section Image <span className="text-slate-500 font-normal">(optional)</span>
                    </p>
                    {selectedCat !== "description" && (
                      <button
                        onClick={() => setDrafts(d => {
                          const c = d[selectedCat];
                          const nextTwo = !c.useTwoImages;
                          return {
                            ...d, [selectedCat]: {
                              ...c,
                              useTwoImages: nextTwo,
                              images: nextTwo ? c.images : c.images.slice(0, 1),
                              focuses: nextTwo ? c.focuses : c.focuses.slice(0, 1),
                              layout: nextTwo
                                ? (c.layout === 'above' || c.layout === 'below' || c.layout === 'center' ? 'double' : c.layout)
                                : c.layout === 'double' ? 'above' : c.layout
                            }
                          };
                        })}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${cur.useTwoImages
                          ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                          }`}
                      >
                        {cur.useTwoImages ? '🖼️ 2 Images Active' : '🖼️ 1 Image Mode'}
                      </button>
                    )}
                  </div>

                  {cur.images.length > 0 && selectedCat !== "description" && (
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                      {(cur.useTwoImages ? ["left", "right", "double"] : ["left", "right", "above", "below"]).map(opt => {
                        const labels: Record<string, string> = { left: "⬅️ Left", right: "➡️ Right", above: "⬆️ Above", below: "⬇️ Below", double: "↕️ Double" };

                        let activeOpt = cur.layout;
                        if (activeOpt === "center") activeOpt = "above";
                        if (!activeOpt) activeOpt = "left";

                        return (
                          <button
                            key={opt}
                            onClick={() => updateLayout(opt)}
                            className={`px-2 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeOpt === opt ? "bg-slate-700 text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
                              }`}
                          >
                            {labels[opt]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <ImagePickerGrid galleryImages={galleryImages} selected={cur.images} onSelect={handlePick} maxSelection={cur.useTwoImages ? 2 : 1} />
                {cur.images.some(u => !isVideo(u)) && (
                  <p className="mt-2 text-xs text-slate-500">Tip: click a selected image to reposition it.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {cropIndex !== null && cur.images[cropIndex] && !isVideo(cur.images[cropIndex]) && (
        <div
          className="fixed inset-0 z-[1010] flex items-center justify-center bg-black/80 p-3 sm:p-4"
          onClick={() => setCropIndex(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col gap-3 p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-200">
                Position image{cur.images.length > 1 ? ` ${cropIndex + 1}` : ""}
                <span className="text-slate-500 font-normal"> · drag to choose what shows</span>
              </p>
              <button
                onClick={() => setCropIndex(null)}
                aria-label="Close"
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <CropEditor
              key={`popup-crop-${selectedCat}-${cropIndex}-${cur.images[cropIndex]}`}
              src={cur.images[cropIndex]}
              aspectRatio={cropAspect}
              focusStr={cur.focuses[cropIndex] ?? "0.5 0.5 1"}
              onCommit={(f) => updateFocus(cropIndex, f)}
              maxZoom={1}
              className="w-full rounded-xl"
            />
            <div className="flex gap-2">
              <button
                onClick={() => removeImageAt(cropIndex)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold border border-red-400/40 text-red-400 hover:border-red-400 transition-all cursor-pointer"
              >
                Remove
              </button>
              <button
                onClick={() => setCropIndex(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                Save crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkTextModal;