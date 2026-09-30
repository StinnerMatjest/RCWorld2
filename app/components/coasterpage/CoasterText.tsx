"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAdminMode } from "../../context/AdminModeContext";
import CoasterReviewEditor from "./CoasterReviewEditor";
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
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    setTexts(initialTexts);
  }, [initialTexts]);

  useEffect(() => {
    if (!isAdminMode) setEditorOpen(false);
  }, [isAdminMode]);

  const captions = useMemo(() => mediaCaptions(galleryImages), [galleryImages]);

  const usedPaths = useMemo(() => {
    const set = new Set<string>();
    for (const t of texts) {
      for (const entry of (t.imageUrl || "").split(",").filter(Boolean)) set.add(splitMedia(entry).url);
    }
    return set;
  }, [texts]);

  const photoBreaks = useMemo(
    () => galleryImages.filter((img) => img.path !== headerImage && !usedPaths.has(img.path) && !/\.(mp4|webm|ogg)$/i.test(img.path)),
    [galleryImages, headerImage, usedPaths]
  );

  let legacyIndex = 0;
  let breakIndex = 0;

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
          {texts.map((entry, index) => {
            const media = (entry.imageUrl || "").split(",").filter(Boolean);
            const fallbackRight = usesLegacyRow(entry.imageLayout, media.length) ? legacyIndex++ % 2 !== 0 : false;
            const isLast = index === texts.length - 1;
            const photoBreak = !isLast && breakIndex < photoBreaks.length ? photoBreaks[breakIndex++] : null;

            return (
              <React.Fragment key={entry.id}>
                <div id={`section-${entry.id}`} className="space-y-3 scroll-mt-24">
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
