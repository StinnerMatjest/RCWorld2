"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAdminMode } from "../../context/AdminModeContext";
import CoasterTextModal from "./CoasterTextModal";
import { SectionBody, mediaCaptions } from "../parkpage/SectionBody";
import { SectionImage } from "../SectionImage";
import { SECTION_IMAGE_ASPECT, usesLegacyRow } from "@/app/utils/sectionImageAspect";
import { splitMedia } from "../FocusedImage";
import type { CoasterTextEntry, CoasterGalleryImage } from "./coasterPageTypes";

export type { CoasterTextEntry } from "./coasterPageTypes";

interface Props {
  coasterId: number;
  coasterName: string;
  initialTexts: CoasterTextEntry[];
  refreshTexts: () => void;
  /** The coaster's gallery: section pickers, captions and the automatic photo breaks. */
  galleryImages: CoasterGalleryImage[];
  /** The hero photo, so the photo breaks don't repeat it. */
  headerImage?: string | null;
  onMediaClick?: (url: string) => void;
}

/**
 * The written review: ordered sections, each a headline plus text with up to
 * three chosen gallery images (same layouts as the park review). Photos are the
 * star even when nobody picked any: gallery images that appear nowhere else on
 * the page are woven in as full-width photo breaks between sections, in gallery
 * order, one per gap, until they run out. A coaster with one photo gets none
 * (the hero already shows it); one with ten gets a photo every section.
 */
const CoasterText: React.FC<Props> = ({ coasterId, coasterName, initialTexts, refreshTexts, galleryImages, headerImage, onMediaClick }) => {
  const { isAdminMode } = useAdminMode();
  const [texts, setTexts] = useState<CoasterTextEntry[]>(initialTexts);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingText, setEditingText] = useState<CoasterTextEntry | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  useEffect(() => {
    setTexts(initialTexts);
  }, [initialTexts]);

  const captions = useMemo(() => mediaCaptions(galleryImages), [galleryImages]);

  // Which gallery paths each section already uses (for the editor's "Used" badges
  // and to keep the photo breaks to images the page shows nowhere else).
  const usedIn = useMemo(() => {
    const map: Record<string, string[]> = {};
    texts.forEach((t, i) => {
      for (const entry of (t.imageUrl || "").split(",").filter(Boolean)) {
        const { url } = splitMedia(entry);
        (map[url] ??= []).push(t.headline || `Section ${i + 1}`);
      }
    });
    return map;
  }, [texts]);

  const photoBreaks = useMemo(() => {
    const unused = galleryImages.filter((img) => img.path !== headerImage && !usedIn[img.path] && !/\.(mp4|webm|ogg)$/i.test(img.path));
    return unused;
  }, [galleryImages, headerImage, usedIn]);

  const onDragStart = (id: number) => setDraggingId(id);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>, overId: number) => {
    e.preventDefault();
    if (draggingId === null || draggingId === overId) return;
    const draggingIndex = texts.findIndex((t) => t.id === draggingId);
    const overIndex = texts.findIndex((t) => t.id === overId);
    const updated = [...texts];
    const [dragged] = updated.splice(draggingIndex, 1);
    updated.splice(overIndex, 0, dragged);
    setTexts(updated);
  };

  const onDragEnd = async () => {
    setDraggingId(null);
    try {
      await fetch(`/api/coasters/${coasterId}/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(texts.map((t, i) => ({ id: t.id, order: i }))),
      });
      refreshTexts();
    } catch (err) {
      console.error("Failed to update text order:", err);
    }
  };

  const usedInForEditor = (entry: CoasterTextEntry | null) => {
    if (!entry) return usedIn;
    const own = new Set((entry.imageUrl || "").split(",").filter(Boolean).map((e) => splitMedia(e).url));
    const out: Record<string, string[]> = {};
    for (const [path, names] of Object.entries(usedIn)) {
      if (own.has(path)) continue;
      out[path] = names;
    }
    return out;
  };

  let legacyIndex = 0;
  let breakIndex = 0;

  return (
    <div className="w-full">
      {isAdminMode && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand text-white text-sm font-bold rounded-full hover:opacity-90 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
            title="Add Section"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add section
          </button>
        </div>
      )}

      {!texts.length ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-slate-300 font-semibold">We haven&apos;t written up {coasterName} yet.</p>
          <p className="text-slate-500 text-sm mt-1">The numbers above are what we have for now. The full review lands after our next visit.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10 md:gap-12">
          {texts.map((entry, index) => {
            const media = (entry.imageUrl || "").split(",").filter(Boolean);
            const fallbackRight = usesLegacyRow(entry.imageLayout, media.length) ? legacyIndex++ % 2 !== 0 : false;
            const isLast = index === texts.length - 1;
            const photoBreak = !isLast && breakIndex < photoBreaks.length ? photoBreaks[breakIndex++] : null;

            return (
              <React.Fragment key={entry.id}>
                <div
                  id={`section-${entry.id}`}
                  draggable={isAdminMode}
                  onDragStart={() => onDragStart(entry.id)}
                  onDragOver={(e) => onDragOver(e, entry.id)}
                  onDragEnd={onDragEnd}
                  className={`relative group space-y-3 scroll-mt-24 ${isAdminMode ? "p-4 -m-4 border-2 border-dashed border-slate-800 cursor-move rounded-xl hover:bg-slate-800/40" : ""}`}
                >
                  {isAdminMode && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button
                        title="Edit"
                        className="p-1.5 bg-slate-700 text-slate-300 rounded hover:bg-blue-900 hover:text-blue-400 cursor-pointer"
                        onClick={() => setEditingText(entry)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {entry.headline && (
                    <div className="flex items-baseline gap-3 border-l-4 border-brand pl-3">
                      <h3 className="text-xl md:text-2xl font-semibold text-white">{entry.headline}</h3>
                      {isAdminMode && entry.isSpoiler && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-900/40 text-red-400 border border-red-800/50">
                          Spoiler
                        </span>
                      )}
                    </div>
                  )}

                  <SectionBody
                    text={entry.text || ""}
                    media={media}
                    layout={entry.imageLayout}
                    fallbackRight={fallbackRight}
                    isSpoiler={!!entry.isSpoiler}
                    isAdminMode={isAdminMode}
                    altLabel={entry.headline || coasterName}
                    textClassName="text-slate-300 leading-relaxed text-base md:text-lg"
                    onMediaClick={onMediaClick ? (url) => onMediaClick(url) : undefined}
                    captions={captions}
                  />
                </div>

                {photoBreak && (
                  <figure className="w-full">
                    <div
                      className={`w-full rounded-2xl overflow-hidden shadow-sm relative group ${onMediaClick ? "cursor-zoom-in" : ""}`}
                      onClick={onMediaClick ? () => onMediaClick(photoBreak.path) : undefined}
                    >
                      <SectionImage
                        src={photoBreak.path}
                        alt={photoBreak.description || photoBreak.title || coasterName}
                        cx={0.5}
                        cy={0.5}
                        mobileAspect={SECTION_IMAGE_ASPECT.full.mobile}
                        desktopAspect={SECTION_IMAGE_ASPECT.full.desktop}
                        sizes="(min-width: 1024px) 60vw, 100vw"
                      />
                    </div>
                    {photoBreak.description && (
                      <figcaption className="mt-1.5 px-1 text-center text-xs sm:text-sm text-slate-500 leading-snug">{photoBreak.description}</figcaption>
                    )}
                  </figure>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {modalOpen || editingText ? (
        <CoasterTextModal
          coasterId={coasterId}
          textEntry={editingText || undefined}
          galleryImages={galleryImages}
          usedIn={usedInForEditor(editingText)}
          onClose={() => {
            setModalOpen(false);
            setEditingText(null);
          }}
          onSuccess={refreshTexts}
        />
      ) : null}
    </div>
  );
};

export default CoasterText;
