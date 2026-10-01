"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { R2Image } from "../R2Image";
import ImageUploaderModal from "@/app/components/ImageUploaderModal";
import { useAdminMode } from "../../context/AdminModeContext";
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from "react-zoom-pan-pinch";

export type VisitGalleryImage = {
  id: number;
  visitId: number;
  title: string;
  path: string;
  description: string;
};

interface GalleryProps {
  visitId: number;
  parkName: string;
  initialImages: VisitGalleryImage[];
  refreshImages: () => void;
  loading?: boolean;
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

const DescriptionEditor = ({
  initialText,
  onSave,
  onCancel,
  saving
}: {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  saving: boolean;
}) => {
  const [text, setText] = useState(initialText);

  return (
    <div className="flex flex-col gap-2 animate-fadeIn" id="desc-editor-container">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full p-2.5 rounded-lg bg-black/60 text-white border border-white/20 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-sm md:text-base resize-none backdrop-blur-md"
        rows={2}
        placeholder="Enter image description..."
        autoFocus
      />
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm font-bold text-white/70 hover:text-white transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(text)}
          disabled={saving}
          className="px-4 py-1.5 text-sm font-bold bg-brand hover:bg-brand-light text-white rounded-md transition disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving..." : "Save Description"}
        </button>
      </div>
    </div>
  );
};

const VisitGallery: React.FC<GalleryProps> = ({ visitId, parkName, initialImages, refreshImages, loading = false }) => {
  const { isAdminMode } = useAdminMode();

  const [images, setImages] = useState<VisitGalleryImage[]>(initialImages);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const mouseDownTarget = useRef<EventTarget | null>(null);
  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  // --- DRAG AND DROP & BATCH SAVE STATE ---
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hasUnsavedOrder, setHasUnsavedOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const wasDragged = useRef(false);

  // Browser-level unsaved changes warning
  useEffect(() => {
    if (!hasUnsavedOrder) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // This triggers the browser's native "Leave site?" prompt
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedOrder]);

  useEffect(() => {
    if (selectedIndex !== null) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [selectedIndex]);

  useEffect(() => {
    setIsEditingDesc(false);
  }, [selectedIndex, selected]);

  // Only sync with parent images if we aren't actively editing the order locally
  useEffect(() => {
    if (!hasUnsavedOrder) {
      setImages(initialImages);
    }
  }, [initialImages, hasUnsavedOrder]);

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isAdminMode || isSavingOrder) return;
    wasDragged.current = true;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isAdminMode || draggedIndex === null || draggedIndex === index || isSavingOrder) return;
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTimeout(() => { wasDragged.current = false; }, 100);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!isAdminMode || draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    // Instantly update the local UI array and flag it as unsaved
    const newImages = [...images];
    const [movedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, movedImage);

    setImages(newImages);
    setHasUnsavedOrder(true);
    handleDragEnd();
  };

  // --- BATCH SAVE ACTIONS ---
  const handleCancelOrder = () => {
    setImages(initialImages);
    setHasUnsavedOrder(false);
  };

  const handleSaveOrder = async () => {
    if (!hasUnsavedOrder) return;
    setIsSavingOrder(true);

    try {
      const reorderedIds = images.map(img => img.id);
      const res = await fetch(`/api/visits/${visitId}/gallery`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorderedIds }),
      });

      if (!res.ok) throw new Error("Failed to save new order");

      setHasUnsavedOrder(false);
      refreshImages(); // Sync fresh DB state just to be safe
    } catch (err) {
      console.error(err);
      alert("Failed to save image order. Please try again.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSaveDescription = async (newText: string) => {
    if (!selected) return;
    setSavingDesc(true);

    const newTitle = `${parkName} - ${newText || "untitled"}`;

    try {
      const res = await fetch(`/api/visit-gallery/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newText,
          title: newTitle
        }),
      });

      if (res.ok) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === selected.id
              ? { ...img, description: newText, title: newTitle }
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

  const handleDeleteImage = async () => {
    if (!selected) return;

    if (!window.confirm("Are you sure you want to permanently delete this image?")) return;

    setIsDeleting(true);
    try {
      const r2Res = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: selected.path }),
      });

      if (!r2Res.ok) console.error("Failed to delete from R2, proceeding to DB deletion anyway.");

      const dbRes = await fetch(`/api/image/${selected.id}`, {
        method: "DELETE",
      });

      if (!dbRes.ok) throw new Error("Failed to delete image from database.");

      setSelectedIndex(null);
      refreshImages();
    } catch (error) {
      console.error(error);
      alert("An error occurred while deleting the image.");
    } finally {
      setIsDeleting(false);
    }
  };

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
      toggleFullscreen();
    } else {
      if (selected?.path) {
        window.open(selected.path, '_blank');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        else setSelectedIndex(null);
      }

      if (e.key === "ArrowLeft" && selectedIndex !== null && selectedIndex > 0) {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight" && selectedIndex !== null && selectedIndex < images.length - 1) {
        e.preventDefault();
        goNext();
      }
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

  const isDraggingAnything = draggedIndex !== null;

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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Gallery</h2>
        {isAdminMode && (
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition text-sm cursor-pointer shadow-md">
            + Upload
          </button>
        )}
      </div>

      {/* UNSAVED CHANGES BANNER */}
      {hasUnsavedOrder && isAdminMode && (
        <div className="bg-brand/10 border border-brand/50 text-brand p-3 rounded-xl flex items-center justify-between mb-4 shadow-lg animate-fadeIn">
          <span className="text-sm font-bold tracking-wide">You have unsaved layout changes.</span>
          <div className="flex gap-2">
            <button
              onClick={handleCancelOrder}
              disabled={isSavingOrder}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveOrder}
              disabled={isSavingOrder}
              className="px-4 py-2 bg-brand hover:bg-brand-light text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {isSavingOrder ? "Saving..." : "Save Layout"}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {!images.length ? (
        loading ? (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
            <span className="h-4 w-4 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
            <span className="italic">Loading images, sit tight…</span>
          </div>
        ) : (
          <p className="text-center py-10 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
            No images available yet.
          </p>
        )
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((img, index) => {
            const isDraggingThis = draggedIndex === index;
            const isDragOverThis = dragOverIndex === index;

            return (
              <div
                key={img.id}
                id={`gallery-img-${index}`}
                draggable={isAdminMode && !isSavingOrder}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => handleDragLeave(index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  // Prevent opening image while dragging or saving
                  if (isSavingOrder || isDraggingAnything || wasDragged.current) return;
                  setDirection(null);
                  setSelectedIndex(index);
                }}
                className={`group cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200 relative transform-gpu select-none
                  ${isAdminMode && !isSavingOrder ? "active:cursor-grabbing" : ""}
                  ${isDraggingThis ? "opacity-30 grayscale scale-90 border-dashed border-slate-500 z-0" : ""}
                  ${!isDraggingThis && isDraggingAnything && !isDragOverThis ? "opacity-80 scale-95 border-transparent" : ""}
                  ${!isDraggingAnything ? "border-transparent hover:border-brand/50 hover:shadow-[0_0_15px_rgba(var(--brand-rgb),0.1)] scale-100" : ""}
                  ${isDragOverThis ? "!opacity-100 !scale-105 shadow-2xl !border-brand z-10" : ""}
                `}
              >
                {/* DROP INDICATOR LINE */}
                {isDragOverThis && draggedIndex !== null && (
                  <div className={`absolute inset-y-0 w-2.5 bg-brand shadow-[0_0_15px_rgba(255,255,255,0.4)] z-30 ${draggedIndex < index ? "right-0" : "left-0"}`} />
                )}

                {isVideo(img.path) ? (
                  <video
                    src={img.path}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="rounded-xl object-cover h-40 md:h-48 w-full bg-black transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                  />
                ) : (
                  <R2Image
                    src={img.path}
                    alt={img.title || "Gallery"}
                    width={400}
                    height={300}
                    className="rounded-xl object-cover h-40 md:h-48 w-full transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {selected && (
        <div
          ref={modalContainerRef}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
          onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
          onClick={() => {
            if ((mouseDownTarget.current as Element)?.closest('#desc-editor-container')) {
              return;
            }

            if (!swipe.didDrag()) {
              if (isEditingDesc) {
                setIsEditingDesc(false);
                return;
              }
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
              <div className="pointer-events-auto flex items-center gap-4">
                {/* --- DELETE BUTTON --- */}
                {isAdminMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(); }}
                    disabled={isDeleting}
                    className="text-red-500/70 hover:text-red-500 transition cursor-pointer disabled:opacity-50 bg-black/40 p-2 rounded-full backdrop-blur-md"
                    title="Delete Image"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <a
                  href={`/api/download?url=${encodeURIComponent(selected.path)}`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="text-white/70 hover:text-white transition bg-black/40 p-2 rounded-full backdrop-blur-md"
                  title="Download image"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                </a>
                <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(null); }} className="text-white/80 hover:text-white text-3xl font-bold cursor-pointer bg-black/40 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-md pb-1">
                  &times;
                </button>
              </div>
            </div>

            {selectedIndex !== null && selectedIndex > 0 && (
              <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-6xl hidden md:block z-[60] transition-colors pb-2 cursor-pointer">
                &#8249;
              </button>
            )}
            {selectedIndex !== null && selectedIndex < images.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="absolute right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-6xl hidden md:block z-[60] transition-colors pb-2 cursor-pointer">
                &#8250;
              </button>
            )}

            <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
              <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
                {selectedIndex !== null && selectedIndex > 0 && !isVideo(images[selectedIndex - 1].path) && (
                  <Image src={images[selectedIndex - 1].path} alt="prev" width={1920} height={1080} unoptimized priority />
                )}
                {selectedIndex !== null && selectedIndex < images.length - 1 && !isVideo(images[selectedIndex + 1].path) && (
                  <Image src={images[selectedIndex + 1].path} alt="next" width={1920} height={1080} unoptimized priority />
                )}
              </div>
              <div
                className={`relative ${animClass} w-full h-full flex items-center justify-center p-4 md:p-12`}
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
                    className="w-auto h-auto max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg"
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
                        unoptimized
                        onClick={handleImageClick}
                        className="w-auto h-auto max-w-full max-h-[85vh] object-contain cursor-pointer shadow-2xl rounded-lg block mx-auto"
                        draggable={false}
                        priority
                      />
                    </TransformComponent>
                  </TransformWrapper>
                )}
              </div>
            </div>

            <div className="p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-50">
              <div className="w-full max-w-2xl mx-auto mb-6" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                {isEditingDesc ? (
                  <DescriptionEditor
                    initialText={selected.description || ""}
                    onSave={handleSaveDescription}
                    onCancel={() => setIsEditingDesc(false)}
                    saving={savingDesc}
                  />
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
                <div className="px-3 py-2 rounded-full bg-black/50 border border-white/10 backdrop-blur-xl" style={{ transform: `scale(${scale})`, transformOrigin: "center center" }} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setSelectedIndex(i); setDirection(i > (selectedIndex || 0) ? "right" : "left"); }}
                        className={`h-2 rounded-full transition-all duration-300 ${i === selectedIndex ? "w-6 bg-brand shadow-[0_0_8px_rgba(var(--brand-rgb),0.8)]" : "w-2 bg-white/30 hover:bg-white/60"}`}
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
          visitId={visitId}
          parkName={parkName}
          onCloseAction={() => setShowModal(false)}
          onUploadSuccessAction={refreshImages}
        />
      )}
    </div>
  );
};

export default VisitGallery;