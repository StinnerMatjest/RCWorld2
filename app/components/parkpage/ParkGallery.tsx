"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import ImageUploaderModal from "@/app/components/ImageUploaderModal";
import { useAdminMode } from "../../context/AdminModeContext";
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

export type GalleryImage = {
  id: number;
  parkId: number;
  title: string;
  path: string;
  description: string;
};

interface GalleryProps {
  parkId: number;
  parkName: string;
  initialImages: GalleryImage[];
  refreshImages: () => void;
}

function isVideo(path: string) {
  const videoExtensions = [".mp4", ".webm", ".ogg"];
  return videoExtensions.some((ext) => path.toLowerCase().endsWith(ext));
}

function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  opts?: { threshold?: number; verticalRestraint?: number },
  shouldAllowSwipe?: () => boolean
) {
  const { threshold = 55, verticalRestraint = 120 } = opts || {};
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (shouldAllowSwipe && !shouldAllowSwipe()) {
      start.current = null;
      return;
    }
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved.current = true;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dy) > verticalRestraint) return;
    if (dx <= -threshold) onSwipeLeft();
    else if (dx >= threshold) onSwipeRight();
  };

  const onPointerCancel = () => {
    start.current = null;
    moved.current = false;
  };

  const onPointerLeave = (e: React.PointerEvent) => {
    if (start.current) onPointerUp(e);
  };

  const didDrag = () => moved.current;

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, didDrag };
}

const ParkGallery: React.FC<GalleryProps> = ({ parkId, parkName, initialImages, refreshImages }) => {
  const { isAdminMode } = useAdminMode();

  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescText, setEditDescText] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  // Reset edit mode if they swipe to a new image
  useEffect(() => {
    setIsEditingDesc(false);
    setEditDescText(selected?.description || "");
  }, [selectedIndex, selected]);

  const handleSaveDescription = async () => {
    if (!selected) return;
    setSavingDesc(true);

    // Automatically rebuild the title using the exact same format as your upload modal
    const newTitle = `${parkName} - ${editDescText || "untitled"}`;

    try {
      const res = await fetch(`/api/gallery/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDescText,
          title: newTitle
        }),
      });

      if (res.ok) {
        // Update local state for BOTH description and title so it shows instantly
        setImages((prev) =>
          prev.map((img) =>
            img.id === selected.id
              ? { ...img, description: editDescText, title: newTitle }
              : img
          )
        );
        setIsEditingDesc(false);
      } else {
        alert("Failed to save description");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving.");
    } finally {
      setSavingDesc(false);
    }
  };

  // Sync state if the parent updates the images
  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  // STATE: Track zoom to disable/enable panning props
  const [isZoomed, setIsZoomed] = useState(false);

  // REF: To control zoom programmatically (Reset button)
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const modalContainerRef = useRef<HTMLDivElement>(null);
  const isDesktop = () => typeof window !== 'undefined' && window.innerWidth > 768;

  const toggleFullscreen = () => {
    if (!document || !modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      if (modalContainerRef.current.requestFullscreen) {
        modalContainerRef.current.requestFullscreen().catch(err => console.log(err));
      }
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  // CLICK HANDLER
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (swipe.didDrag()) return;

    if (isDesktop()) {
      // DESKTOP: Toggle Fullscreen
      toggleFullscreen();
    } else {
      // MOBILE: Open in new tab
      if (selected?.path) {
        window.open(selected.path, '_blank');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        else setSelectedIndex(null);
      }

      if (e.key === "ArrowLeft" && selectedIndex !== null && selectedIndex > 0) goPrev();
      if (e.key === "ArrowRight" && selectedIndex !== null && selectedIndex < images.length - 1) goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, images.length]);

  useEffect(() => {
    setIsZoomed(false);
  }, [selectedIndex]);

  const goNext = () => {
    setDirection("right");
    setSelectedIndex((p) => (p !== null && p < images.length - 1 ? p + 1 : p));
  };
  const goPrev = () => {
    setDirection("left");
    setSelectedIndex((p) => (p !== null && p > 0 ? p - 1 : p));
  };

  const swipe = useSwipe(goNext, goPrev, { threshold: 55, verticalRestraint: 120 }, () => !isZoomed);

  const handleTransform = (ref: ReactZoomPanPinchRef) => {
    const scale = ref.state.scale;
    if (scale > 1.01 && !isZoomed) setIsZoomed(true);
    if (scale <= 1.01 && isZoomed) setIsZoomed(false);
  };

  // RESET ZOOM HANDLER
  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (transformRef.current) {
      transformRef.current.resetTransform(); // Resets to scale 1
    }
  };

  const animClass = direction === "right" ? "animate-slide-in-right" : direction === "left" ? "animate-slide-in-left" : "";
  const [scale, setScale] = useState(1);
  const dotsContainerRef = useRef<HTMLDivElement | null>(null);

  const recalcScale = () => {
    if (!dotsContainerRef.current) return;
    const required = (images.length || 1) * 8 + (Math.max(0, (images.length || 1) - 1)) * 6 + 20;
    setScale(Math.min(1, dotsContainerRef.current.clientWidth / Math.max(required, 1)));
  };

  useEffect(() => {
    recalcScale();
    window.addEventListener("resize", recalcScale);
    return () => window.removeEventListener("resize", recalcScale);
  }, [images.length]);

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes slideInRight {
          0% { opacity: 0.7; transform: translateX(16px) scale(0.985); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideInLeft {
          0% { opacity: 0.7; transform: translateX(-16px) scale(0.985); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        .animate-slide-in-right { animation: slideInRight 220ms cubic-bezier(0.22, 1, 0.36, 1); }
        .animate-slide-in-left { animation: slideInLeft 220ms cubic-bezier(0.22, 1, 0.36, 1); }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gallery</h2>
        {isAdminMode && (
          <button onClick={() => setShowModal(true)} className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm cursor-pointer">
            + Upload
          </button>
        )}
      </div>

      {/* Grid */}
      {!images.length ? (
        <p className="text-center py-4 italic text-gray-600">No images available yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((img, index) => (
            <div
              key={img.id}
              onClick={() => { setDirection(null); setSelectedIndex(index); }}
              className="cursor-pointer overflow-hidden rounded-lg hover:scale-105 transition-transform duration-300 transform-gpu will-change-transform"
            >
              {isVideo(img.path) ? (
                <video
                  src={img.path}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="rounded-lg object-cover h-40 w-full bg-black"
                />
              ) : (
                <Image src={img.path} alt={img.title || "Gallery"} width={400} height={300} className="rounded-lg object-cover h-40 w-full" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {selected && (
        <div
          ref={modalContainerRef}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
          onClick={() => {
            if (!swipe.didDrag()) {
              if (document.fullscreenElement) document.exitFullscreen();
              setSelectedIndex(null);
            }
          }}
        >
          <div
            className="relative w-full h-full flex flex-col touch-pan-y select-none"
            onPointerDown={swipe.onPointerDown}
            onPointerMove={swipe.onPointerMove}
            onPointerUp={swipe.onPointerUp}
            onPointerCancel={swipe.onPointerCancel}
            onPointerLeave={swipe.onPointerLeave}
            onClick={(e) => { if (swipe.didDrag()) e.stopPropagation(); }}
          >
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-[60] pointer-events-none">
              <div className="pointer-events-auto min-h-[32px] flex items-center">
                {isZoomed && (
                  <button
                    onClick={handleResetZoom}
                    className="bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-bold transition backdrop-blur-md cursor-pointer animate-fadeIn"
                  >
                    Reset Zoom
                  </button>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(null); }} className="pointer-events-auto text-white/80 hover:text-white text-4xl leading-none font-bold transition cursor-pointer">
                &times;
              </button>
            </div>

            {selectedIndex !== null && selectedIndex > 0 && (
              <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl md:text-6xl z-[60] transition-all p-4 cursor-pointer hidden md:block">
                &#8249;
              </button>
            )}
            {selectedIndex !== null && selectedIndex < images.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl md:text-6xl z-[60] transition-all p-4 cursor-pointer hidden md:block">
                &#8250;
              </button>
            )}

            <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
              <div
                className={`relative transition-all duration-200 ${animClass} w-full h-full flex items-center justify-center`}
                onClick={(e) => e.stopPropagation()}
              >
                {isVideo(selected.path) ? (
                  <video
                    src={selected.path}
                    controls
                    autoPlay
                    muted
                    loop
                    preload="metadata"
                    className="w-auto h-auto max-w-full max-h-[80vh] object-contain cursor-pointer shadow-2xl rounded-sm"
                  />
                ) : (
                  <TransformWrapper
                    ref={transformRef}
                    initialScale={1}
                    minScale={1}
                    maxScale={8}
                    centerOnInit={true}
                    wheel={{ step: 0.5 }}
                    panning={{ disabled: !isZoomed }}
                    onTransformed={handleTransform}
                    doubleClick={{ disabled: false }}
                  >
                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                      contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Image
                        src={selected.path}
                        alt={selected.title || "Full Image"}
                        width={1920}
                        height={1080}
                        onClick={handleImageClick}
                        className="w-auto h-auto max-w-full max-h-[80vh] object-contain cursor-pointer shadow-2xl rounded-sm block mx-auto"
                        draggable={false}
                        priority
                      />
                    </TransformComponent>
                  </TransformWrapper>
                )}
              </div>
            </div>

            <div className="p-4 bg-gradient-to-t from-black/80 to-transparent z-50">
              <div className="w-full max-w-2xl mx-auto mb-4" onClick={(e) => e.stopPropagation()}>
                {isEditingDesc ? (
                  <div className="flex flex-col gap-2 animate-fadeIn">
                    <textarea
                      value={editDescText}
                      onChange={(e) => setEditDescText(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-black/60 text-white border border-white/20 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm md:text-base resize-none backdrop-blur-md"
                      rows={2}
                      placeholder="Enter image description..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setIsEditingDesc(false)}
                        className="px-4 py-1.5 text-sm font-bold text-white/70 hover:text-white transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveDescription}
                        disabled={savingDesc}
                        className="px-4 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition disabled:opacity-50 cursor-pointer"
                      >
                        {savingDesc ? "Saving..." : "Save Description"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-center justify-center gap-2.5 min-h-[32px] px-4">
                    <p className="text-white text-center text-sm md:text-base font-medium drop-shadow-md">
                      {selected.description || (isAdminMode && <span className="text-white/40 italic">No description</span>)}
                    </p>

                    {isAdminMode && (
                      <button
                        onClick={() => setIsEditingDesc(true)}
                        className="opacity-100 md:opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
                        title="Edit Description"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="w-full flex items-center justify-center pb-2" ref={dotsContainerRef}>
                <div className="px-2.5 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-md" style={{ transform: `scale(${scale})`, transformOrigin: "center center" }} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setSelectedIndex(i); setDirection(i > (selectedIndex || 0) ? "right" : "left"); }}
                        className={`h-2 w-2 rounded-full transition-all duration-200 ${i === selectedIndex ? "bg-blue-500 scale-125" : "bg-white/40 hover:bg-white/60"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdminMode && showModal && (
        <ImageUploaderModal parkId={parkId} parkName={parkName} onClose={() => setShowModal(false)} onUploadSuccess={refreshImages} />
      )}
    </div>
  );
};

export default ParkGallery;