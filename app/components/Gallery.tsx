"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import ImageUploaderModal from "@/app/components/ImageUploaderModal";
import { useAdminMode } from "../context/AdminModeContext";

interface GalleryProps {
  parkId: number;
}

type GalleryImage = {
  id: number;
  parkId: number;
  title: string;
  path: string;
  description: string;
};

/** STABLE SWIPE HOOK */
function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  opts?: { threshold?: number; verticalRestraint?: number }
) {
  const { threshold = 55, verticalRestraint = 120 } = opts || {};
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
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

const Gallery: React.FC<GalleryProps> = ({ parkId }) => {
  const { isAdminMode } = useAdminMode();

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Helper to detect Desktop vs Mobile
  const isDesktop = () => typeof window !== 'undefined' && window.innerWidth > 768;

  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  const fetchGalleryImages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/park/${parkId}/gallery`);
      const data = await res.json();
      setImages(data.gallery);
    } catch (err) {
      console.error("Failed to fetch gallery images", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGalleryImages(); }, [parkId]);

  // FULLSCREEN LOGIC (Desktop)
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

  const goNext = () => {
    setDirection("right");
    setSelectedIndex((p) => (p !== null && p < images.length - 1 ? p + 1 : p));
  };
  const goPrev = () => {
    setDirection("left");
    setSelectedIndex((p) => (p !== null && p > 0 ? p - 1 : p));
  };

  const swipe = useSwipe(goNext, goPrev, { threshold: 55, verticalRestraint: 120 });

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
      {loading ? (
        <p className="text-center py-4 italic text-gray-600">Loading images...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((img, index) => (
            <div
              key={img.id}
              onClick={() => { setDirection(null); setSelectedIndex(index); }}
              className="cursor-pointer overflow-hidden rounded-lg hover:scale-105 transition-transform duration-300"
            >
              <Image src={img.path} alt={img.title || "Gallery"} width={400} height={300} className="rounded-lg object-cover h-40 w-full" unoptimized />
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
            // Close if background clicked
            if (!swipe.didDrag()) {
              if (document.fullscreenElement) document.exitFullscreen();
              setSelectedIndex(null);
            }
          }}
        >
          <div
            className="relative w-full h-full flex flex-col touch-pan-y select-none cursor-grab active:cursor-grabbing"
            // SWIPE EVENTS
            onPointerDown={swipe.onPointerDown}
            onPointerMove={swipe.onPointerMove}
            onPointerUp={swipe.onPointerUp}
            onPointerCancel={swipe.onPointerCancel}
            onPointerLeave={swipe.onPointerLeave}
            onClick={(e) => {
              if (swipe.didDrag()) e.stopPropagation();
            }}
          >
            {/* CONTROLS */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-[60] pointer-events-none">
              {/* Left Side Actions */}
              <div className="flex gap-2 pointer-events-auto">
                <a
                  href={selected.path}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-bold transition backdrop-blur-md cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Original ↗
                </a>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setSelectedIndex(null); }}
                className="pointer-events-auto text-white/80 hover:text-white text-4xl leading-none font-bold transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* ARROWS */}
            {selectedIndex !== null && selectedIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl md:text-6xl z-[60] transition-all p-4 cursor-pointer hidden md:block"
              >
                &#8249;
              </button>
            )}

            {selectedIndex !== null && selectedIndex < images.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl md:text-6xl z-[60] transition-all p-4 cursor-pointer hidden md:block"
              >
                &#8250;
              </button>
            )}

            {/* IMAGE AREA */}
            <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
              <div className={`relative transition-all duration-200 ${animClass} w-full h-full flex items-center justify-center p-4`}>
                <Image
                  src={selected.path}
                  alt={selected.title || "Full Image"}
                  width={1920}
                  height={1080}
                  onClick={handleImageClick}
                  className="w-auto h-auto max-w-full max-h-[80vh] object-contain cursor-pointer shadow-2xl rounded-sm"
                  unoptimized
                  draggable={false}
                />
              </div>
            </div>

            {/* FOOTER */}
            <div className="p-4 bg-gradient-to-t from-black/80 to-transparent z-50">
              {selected.description && (
                <p className="text-white text-center text-sm md:text-base font-medium drop-shadow-md mb-4 max-w-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
                  {selected.description}
                </p>
              )}

              <div className="w-full flex items-center justify-center pb-2" ref={dotsContainerRef}>
                <div
                  className="px-2.5 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-md"
                  style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
                  onClick={(e) => e.stopPropagation()}
                >
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
        <ImageUploaderModal
          parkId={parkId}
          onClose={() => setShowModal(false)}
          onUploadSuccess={fetchGalleryImages}
        />
      )}
    </div>
  );
};

export default Gallery;