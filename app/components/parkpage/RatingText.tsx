"use client";

import React, { useState, useEffect, useCallback } from "react";
import { splitMedia, parseFocusStr } from "../FocusedImage";
import { SectionImage } from "../SectionImage";
import { SECTION_IMAGE_ASPECT } from "@/app/utils/sectionImageAspect";
import type { Rating, RatingWarningType } from "@/app/types";
import ParkRatingsModal from "./ParkTextModal";
import { getRatingColor } from "@/app/utils/design";
import { ratingCategories } from "@/app/utils/ratings";
import RatingWarning from "../warnings/RatingWarning";
import WarningCreatorModal from "../warnings/WarningCreatorModal";
import { useAdminMode } from "../../context/AdminModeContext";
import { MarkdownText } from "../MarkdownText";
import type { GalleryImage } from "../parkpage/ParkGallery";

interface RatingTextProps {
  rating: Rating;
  explanations: Record<string, string>;
  sectionImages: Record<string, string>;
  sectionLayouts?: Record<string, string>;
  galleryImages: GalleryImage[];
  parkId: number;
  parkName: string;
  onWarningsUpdate: () => void;
  onSectionImagesUpdate: (images: Record<string, string>) => void;
  coasters: import("@/app/types").RollerCoaster[];
}

function humanizeLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).trim();
}

function isVideo(src: string) {
  return /\.(mp4|webm|ogg)$/i.test(src);
}

const RatingText: React.FC<RatingTextProps> = ({
  rating,
  explanations,
  sectionImages,
  sectionLayouts = {},
  galleryImages,
  parkId,
  parkName,
  onWarningsUpdate,
  onSectionImagesUpdate,
  coasters,
}) => {
  const { isAdminMode } = useAdminMode();
  const [showModal, setShowModal] = useState(false);
  const [showWarningManager, setShowWarningManager] = useState(false);
  const [localExplanations, setLocalExplanations] = useState(explanations);
  const [localImages, setLocalImages] = useState(sectionImages);
  const [localLayouts, setLocalLayouts] = useState(sectionLayouts);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // State for publishing
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => { setLocalExplanations(explanations); }, [explanations]);
  useEffect(() => { setLocalImages(sectionImages); }, [sectionImages]);

  useEffect(() => {
    if (!isAdminMode) {
      setShowModal(false);
      setShowWarningManager(false);
    }
  }, [isAdminMode]);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox]);

  const handlePublish = async () => {
    if (!confirm("Are you sure you want to publish this review? It will become visible to all users.")) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/ratings/${rating.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      if (res.ok) {
        onWarningsUpdate(); // This triggers the refresh/refetch function passed down from ParkPageClient
      } else {
        alert("Failed to publish rating. Ensure you have created the PATCH route at /api/ratings/[id]/route.ts");
      }
    } catch (error) {
      console.error("Failed to publish:", error);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!rating) return <p>No rating available yet.</p>;

  const categoryWarningsMap: Record<string, RatingWarningType[]> = {};
  rating.warnings?.forEach((warning) => {
    const key = warning.category.toLowerCase();
    if (!categoryWarningsMap[key]) categoryWarningsMap[key] = [];
    categoryWarningsMap[key].push(warning);
  });

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <h2 className="text-3xl font-semibold text-white flex items-center flex-wrap gap-3">
          {parkName} Review
          {!rating.published && (
            <span className="bg-red-900/30 text-red-400 text-sm uppercase font-bold px-3 py-1 rounded-md tracking-wider border border-red-800">
              Unpublished Draft
            </span>
          )}
        </h2>

        {isAdminMode && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-slate-100 hover:bg-white/10 rounded transition-colors text-[20px] leading-none cursor-pointer"
              title="Edit Explanations"
            >
              🔧
            </button>
            <button
              onClick={() => setShowWarningManager(true)}
              className="bg-blue-900 text-blue-300 hover:bg-blue-800 px-3 py-1 rounded text-sm font-semibold transition-colors cursor-pointer"
            >
              Warnings
            </button>
          </div>
        )}
      </div>

      {(() => {
        let imageIndex = 0;
        return ratingCategories
          .filter((key) => key !== "description" && key !== "overall")
          .map((key) => {
            const value = (rating as any)[key] ?? 0;
            const text = localExplanations[key] ?? "";
            const categoryWarnings = categoryWarningsMap[key.toLowerCase()] ?? [];

            // Unpack images
            const mediaUrls = (localImages[key] || "").split(",").filter(Boolean);
            const hasMedia = mediaUrls.length > 0;
            const layoutPref = localLayouts[key];

            let isRow = false;
            let isRight = false;
            let isAbove = true;
            let isDouble = false;

            if (mediaUrls.length === 2 && layoutPref === "double") {
              isDouble = true;
            } else if (layoutPref === "left") {
              isRow = true;
              isRight = false;
            } else if (layoutPref === "right") {
              isRow = true;
              isRight = true;
            } else if (layoutPref === "above" || layoutPref === "center") {
              isRow = false;
              isAbove = true;
            } else if (layoutPref === "below") {
              isRow = false;
              isAbove = false;
            } else if (hasMedia) {
              isRow = true;
              isRight = imageIndex++ % 2 !== 0;
            }

            // Helper to render an individual media block. The value may carry a
            // packed pan focus ("url|cx cy zoom"), honored via FocusedImage.
            const renderMedia = (entry: string) => {
              const { url, focus } = splitMedia(entry);
              const pan = parseFocusStr(focus);
              const a = isRow ? SECTION_IMAGE_ASPECT.row : SECTION_IMAGE_ASPECT.full;
              return (
                <div
                  key={entry}
                  className={`w-full flex-shrink-0 rounded-2xl overflow-hidden cursor-zoom-in group relative shadow-sm ${isDouble ? "mt-4 mb-4" : ""}`}
                  onClick={() => setLightbox(url)}
                >
                  {isVideo(url) ? (
                    <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: a.desktop }}>
                      <video src={url} className="absolute inset-0 w-full h-full object-cover rounded-2xl" muted loop autoPlay playsInline />
                    </div>
                  ) : (
                    <SectionImage
                      src={url}
                      alt={humanizeLabel(key)}
                      cx={pan.cx}
                      cy={pan.cy}
                      mobileAspect={a.mobile}
                      desktopAspect={a.desktop}
                      sizes={isRow ? "(min-width: 768px) 30vw, 100vw" : "(min-width: 768px) 60vw, 100vw"}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-2xl pointer-events-none">
                    <svg className="w-8 h-8 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM11 8v6M8 11h6" /></svg>
                  </div>
                </div>
              );
            };

            return (
              <div key={key} id={`section-${key}`} className="space-y-3 scroll-mt-6">
                <div className="flex items-baseline gap-3 border-l-4 border-brand pl-3">
                  <h3 className="text-xl font-semibold text-white">{humanizeLabel(key)}</h3>
                  <span className={`text-2xl font-bold ${getRatingColor(value)}`}>{value}</span>
                  {categoryWarnings.length > 0 && (
                    <RatingWarning warning={categoryWarnings} isAdminMode={isAdminMode} ratingId={rating.id} onUpdate={onWarningsUpdate} coasters={coasters} />
                  )}
                </div>

                {!hasMedia ? (
                  <MarkdownText text={text} className="text-slate-400 leading-relaxed md:text-lg" />
                ) : isDouble ? (
                  <div className="flex flex-col">
                    {renderMedia(mediaUrls[0])}
                    <MarkdownText text={text} className="text-slate-400 leading-relaxed md:text-lg" />
                    {renderMedia(mediaUrls[1])}
                  </div>
                ) : isRow ? (
                  <div className={`flex flex-col gap-6 items-start ${isRight ? "md:flex-row-reverse" : "md:flex-row"}`}>
                    <div className="w-full md:w-1/2 flex-shrink-0 flex flex-col gap-4 mt-1.5">
                      {mediaUrls.map(url => renderMedia(url))}
                    </div>
                    <MarkdownText text={text} className="text-slate-400 leading-relaxed md:text-lg flex-1" />
                  </div>
                ) : (
                  <div className={`flex gap-4 ${isAbove ? "flex-col" : "flex-col-reverse"}`}>
                    <div className="flex flex-col gap-4 mt-1.5">
                      {mediaUrls.map(url => renderMedia(url))}
                    </div>
                    <MarkdownText text={text} className="text-slate-400 leading-relaxed md:text-lg" />
                  </div>
                )}
              </div>
            );
          });
      })()}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
          {isVideo(lightbox) ? (
            <video
              src={lightbox}
              controls
              autoPlay
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightbox}
              alt=""
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {isAdminMode && showModal && (
        <ParkRatingsModal
          rating={rating}
          explanations={localExplanations}
          sectionImages={localImages}
          sectionLayouts={localLayouts}
          galleryImages={galleryImages}
          parkId={Number(parkId)}
          ratingId={rating.id}
          onClose={() => setShowModal(false)}
          onSave={(updatedText, updatedImages, updatedLayouts) => {
            setLocalExplanations(updatedText);
            setLocalImages(updatedImages);
            setLocalLayouts(updatedLayouts ?? {});
            onSectionImagesUpdate(updatedImages);
          }}
        />
      )}

      {isAdminMode && showWarningManager && (
        <WarningCreatorModal
          ratingId={rating.id}
          existingWarnings={rating.warnings || []}
          onClose={() => setShowWarningManager(false)}
          onSaved={onWarningsUpdate}
          coasters={coasters}
        />
      )}

      {/* PUBLISH BUTTON */}
      {isAdminMode && !rating.published && (
        <div className="flex justify-center pt-8 pb-4 mt-8 border-t border-slate-800">
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="bg-blue-500 hover:bg-blue-400 text-white font-bold text-lg md:text-xl py-4 px-8 md:px-12 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-3 cursor-pointer"
          >
            {isPublishing ? "PUBLISHING..." : "PUBLISH REVIEW"}
          </button>
        </div>
      )}
    </div>
  );
};

export default RatingText;