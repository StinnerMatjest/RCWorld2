"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import ImageUploaderModal from "@/app/components/ImageUploaderModal";

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

/** Swipe helper (pointer events) — mobile friendly with pointercancel + drag guard */
function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  opts?: { threshold?: number; verticalRestraint?: number }
) {
  const { threshold = 55, verticalRestraint = 120 } = opts || {};
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dy) > verticalRestraint) return; // ignore vertical
    if (dx <= -threshold) onSwipeLeft(); // next
    else if (dx >= threshold) onSwipeRight(); // prev
  };

  const onPointerCancel = () => {
    start.current = null;
    moved.current = false;
  };

  const didDrag = () => moved.current;

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, didDrag };
}

const Gallery: React.FC<GalleryProps> = ({ parkId }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  const fetchGalleryImages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/park/${parkId}/gallery`);
      const data = await res.json();
      const gallery: GalleryImage[] = data.gallery;
      setImages(gallery);
    } catch (err) {
      console.error("Failed to fetch gallery images", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGalleryImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIndex(null);
      if (e.key === "ArrowLeft" && selectedIndex !== null && selectedIndex > 0) {
        goPrev();
      }
      if (
        e.key === "ArrowRight" &&
        selectedIndex !== null &&
        selectedIndex < images.length - 1
      ) {
        goNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, images.length]);

  // Preload neighbors
  useEffect(() => {
    if (selectedIndex == null) return;
    const preload = (idx: number) => {
      const src = images[idx]?.path;
      if (!src) return;
      const img = new window.Image();
      img.src = src;
    };
    preload(selectedIndex + 1);
    preload(selectedIndex - 1);
  }, [selectedIndex, images]);

  // Nav helpers
  const goNext = () => {
    setDirection("right");
    setSelectedIndex((p) => (p !== null && p < images.length - 1 ? p + 1 : p));
  };
  const goPrev = () => {
    setDirection("left");
    setSelectedIndex((p) => (p !== null && p > 0 ? p - 1 : p));
  };
  const goTo = (i: number) => {
    if (selectedIndex == null || i === selectedIndex) return;
    setDirection(i > selectedIndex ? "right" : "left");
    setSelectedIndex(i);
  };

  // Swipe anywhere in modal content
  const swipe = useSwipe(goNext, goPrev, { threshold: 55, verticalRestraint: 120 });

  // Direction-aware animation
  const animClass =
    direction === "right"
      ? "animate-slide-in-right"
      : direction === "left"
      ? "animate-slide-in-left"
      : "";

  // ---- Auto-scaling progress dots (never cut off) ----
  const dotsContainerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const DOT = 8; // h-2 w-2
  const GAP = 6; // gap-1.5
  const HPAD = 20; // inner pill padding total allowance
  const recalcScale = () => {
    if (!dotsContainerRef.current) return;
    const available = dotsContainerRef.current.clientWidth;
    const n = images.length || 1;
    const required = n * DOT + (n - 1) * GAP + HPAD;
    setScale(Math.min(1, available / Math.max(required, 1)));
  };
  useEffect(() => {
    recalcScale();
    const ro = new ResizeObserver(recalcScale);
    if (dotsContainerRef.current) ro.observe(dotsContainerRef.current);
    const onWin = () => recalcScale();
    window.addEventListener("resize", onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  return (
    <div className="space-y-4">
      {/* Keyframes for subtle slide/fade */}
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

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gallery</h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm cursor-pointer"
        >
          + Upload
        </button>
      </div>

      {loading ? (
        <p className="text-center py-4 italic text-gray-600">Loading images...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((img, index) => (
            <div
              key={img.id}
              onClick={() => {
                setDirection(null);
                setSelectedIndex(index);
              }}
              className="cursor-pointer overflow-hidden rounded-lg hover:scale-105 transition-transform duration-300"
            >
              <Image
                src={img.path}
                alt={img.title || `Gallery image ${index + 1}`}
                width={400}
                height={300}
                className="rounded-lg object-cover h-40 w-full"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}

      {selected && (
        // Clicking overlay closes
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Modal content: swipe anywhere; tap on empty areas inside will bubble and close */}
          <div
            className="relative max-w-4xl w-full max-h-[90vh] h-[90vh] p-4 animate-fade-in flex flex-col touch-pan-y select-none"
            onPointerDown={swipe.onPointerDown}
            onPointerMove={swipe.onPointerMove}
            onPointerUp={swipe.onPointerUp}
            onPointerCancel={swipe.onPointerCancel}
            onClickCapture={(e) => {
              // if a drag occurred, don't let the click close the modal
              if (swipe.didDrag()) e.stopPropagation();
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex(null);
              }}
              className="absolute top-3 right-4 text-white text-3xl font-bold z-10"
              aria-label="Close"
            >
              &times;
            </button>

            {selectedIndex !== null && selectedIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-[-5rem] top-1/2 -translate-y-1/2 text-white text-6xl z-10 hover:scale-110 hover:text-gray-300 transition-transform duration-200"
                aria-label="Previous image"
              >
                &#8592;
              </button>
            )}

            {selectedIndex !== null && selectedIndex < images.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-[-5rem] top-1/2 -translate-y-1/2 text-white text-6xl z-10 hover:scale-110 hover:text-gray-300 transition-transform duration-200"
                aria-label="Next image"
              >
                &#8594;
              </button>
            )}

            {/* Image area (clicks here do NOT close) */}
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <div
                className={`rounded-xl ${animClass}`}
                onClick={(e) => e.stopPropagation()}
                key={selected.id}
              >
                <Image
                  src={selected.path}
                  alt={selected.title || "Full Image"}
                  width={1200}
                  height={800}
                  className="rounded-xl object-contain w-full h-auto max-h-[75vh]"
                  unoptimized
                  draggable={false}
                />
              </div>
            </div>

            {selected.description && (
              <p
                className="mt-2 text-white text-center text-sm line-clamp-2"
                onClick={(e) => e.stopPropagation()}
              >
                {selected.description}
              </p>
            )}

            {/* Static bottom progress: pill with dots (auto-scales to fit) */}
            <div className="mt-3 w-full flex items-center justify-center" ref={dotsContainerRef}>
              <div
                className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm"
                role="group"
                aria-label="Image progress"
                style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5">
                  {images.map((_, i) => {
                    const active = i === selectedIndex;
                    return (
                      <button
                        key={i}
                        onClick={() => goTo(i)}
                        aria-label={`Go to image ${i + 1} of ${images.length}`}
                        aria-current={active ? "true" : "false"}
                        className={`h-2 w-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/40 ${
                          active
                            ? "bg-blue-500 shadow-[0_0_0_2px_rgba(255,255,255,0.15)]"
                            : "bg-white/30 hover:bg-white/50"
                        }`}
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
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
