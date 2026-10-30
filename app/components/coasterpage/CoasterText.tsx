"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAdminMode } from "../../context/AdminModeContext";
import CoasterReviewEditor from "./CoasterReviewEditor";
import { SectionBody, mediaCaptions } from "../parkpage/SectionBody";
import { usesLegacyRow } from "@/app/utils/sectionImageAspect";
import type { CoasterTextEntry, CoasterGalleryImage } from "./coasterPageTypes";

export type { CoasterTextEntry } from "./coasterPageTypes";

interface Props {
  coasterId: number;
  coasterName: string;
  initialTexts: CoasterTextEntry[];
  refreshTexts: () => void;
  /** The coaster's gallery: section pickers and captions. */
  galleryImages: CoasterGalleryImage[];
  onMediaClick?: (url: string) => void;
}

/**
 * The written review: ordered sections, each a headline plus text with up to
 * three chosen gallery images (same layouts as the park review). Only photos
 * placed in a section are shown; the page never adds photos by itself.
 */
const CoasterText: React.FC<Props> = ({ coasterId, coasterName, initialTexts, refreshTexts, galleryImages, onMediaClick }) => {
  const { isAdminMode } = useAdminMode();
  const [texts, setTexts] = useState<CoasterTextEntry[]>(initialTexts);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    setTexts(initialTexts);
  }, [initialTexts]);

  useEffect(() => {
    if (!isAdminMode) setEditorOpen(false);
  }, [isAdminMode]);

  const captions = useMemo(() => mediaCaptions(galleryImages), [galleryImages]);

  let legacyIndex = 0;

  return (
    <div className="w-full">
      {isAdminMode && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setEditorOpen(true)}
            className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-slate-100 hover:bg-white/10 rounded transition-colors text-[20px] leading-none cursor-pointer"
            title="Edit review"
          >
            🔧
          </button>
        </div>
      )}

      {!texts.length ? (
        <p className="text-slate-400 leading-relaxed">
          We haven&apos;t written up {coasterName} yet. The numbers above are what we have for now; the full review lands after our next visit.
        </p>
      ) : (
        <div className="flex flex-col gap-10 md:gap-12">
          {texts.map((entry) => {
            const media = (entry.imageUrl || "").split(",").filter(Boolean);
            const fallbackRight = usesLegacyRow(entry.imageLayout, media.length) ? legacyIndex++ % 2 !== 0 : false;

            return (
                <div key={entry.id} id={`section-${entry.id}`} className="space-y-3 scroll-mt-24">
                  {entry.headline && (
                    <div className="flex items-baseline gap-3 border-l-4 border-brand pl-3">
                      <h3 className="text-xl font-semibold text-white">{entry.headline}</h3>
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
                    onMediaClick={onMediaClick ? (url) => onMediaClick(url) : undefined}
                    captions={captions}
                  />
                </div>
            );
          })}
        </div>
      )}

      {isAdminMode && editorOpen && (
        <CoasterReviewEditor
          coasterId={coasterId}
          coasterName={coasterName}
          sections={texts}
          galleryImages={galleryImages}
          onClose={() => setEditorOpen(false)}
          onSaved={refreshTexts}
        />
      )}
    </div>
  );
};

export default CoasterText;
