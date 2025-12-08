"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAdminMode } from "../../context/AdminModeContext";

interface CoasterGalleryProps {
    coasterId: number;
    coasterName: string;
}

type GalleryImage = {
    id: number;
    title: string;
    path: string;
    description: string;
};

const CoasterGallery: React.FC<CoasterGalleryProps> = ({ coasterId, coasterName }) => {
    const { isAdminMode } = useAdminMode();

    const [images, setImages] = useState<GalleryImage[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState<"left" | "right" | null>(null);

    const [scale, setScale] = useState(1);
    const dotsContainerRef = useRef<HTMLDivElement | null>(null);

    const modalContainerRef = useRef<HTMLDivElement>(null);

    const selected = selectedIndex !== null ? images[selectedIndex] : null;

    /** Fetch coaster-specific images */
    const fetchImages = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/coasters/${coasterId}/gallery?name=${encodeURIComponent(coasterName)}`
            );
            const data = await res.json();
            setImages(data.gallery);
        } catch (err) {
            console.error("Failed to fetch coaster gallery images", err);
        } finally {
            setLoading(false);
        }
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

    useEffect(() => {
        fetchImages();
    }, [coasterName]);

    /** Swipe functionality */
    const goNext = () => {
        setDirection("right");
        setSelectedIndex((p) => (p !== null && p < images.length - 1 ? p + 1 : p));
    };

    const goPrev = () => {
        setDirection("left");
        setSelectedIndex((p) => (p !== null && p > 0 ? p - 1 : p));
    };

    const swipe = useSwipe(goNext, goPrev, { threshold: 55, verticalRestraint: 120 });

    /** Desktop vs mobile fullscreen logic */
    const isDesktop = () =>
        typeof window !== "undefined" && window.innerWidth > 768;

    const handleImageClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (swipe.didDrag()) return;

        if (isDesktop()) {
            if (!document.fullscreenElement) {
                modalContainerRef.current?.requestFullscreen().catch(() => { });
            } else {
                document.exitFullscreen();
            }
        } else {
            if (selected?.path) window.open(selected.path, "_blank");
        }
    };

    /** Keyboard navigation */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (document.fullscreenElement) document.exitFullscreen();
                setSelectedIndex(null);
            }
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "ArrowRight") goNext();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [selectedIndex, images.length]);

    /** Dot scaling recalculation */
    const recalcScale = () => {
        if (!dotsContainerRef.current) return;
        const required =
            images.length * 8 + Math.max(0, images.length - 1) * 6 + 20;
        setScale(
            Math.min(1, dotsContainerRef.current.clientWidth / Math.max(required, 1))
        );
    };

    useEffect(() => {
        recalcScale();
        window.addEventListener("resize", recalcScale);
        return () => window.removeEventListener("resize", recalcScale);
    }, [images.length]);

    const animClass =
        direction === "right"
            ? "animate-slide-in-right"
            : direction === "left"
                ? "animate-slide-in-left"
                : "";

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
                <h2 className="text-2xl font-bold">{coasterName} Gallery</h2>
            </div>

            {/* Grid */}
            {loading ? (
                <p className="text-center py-4 italic text-gray-600">
                    Loading images...
                </p>
            ) : images.length === 0 ? (
                <p className="text-center py-4 text-gray-400">
                    No images found for this coaster.
                </p>
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
                            {img.path.match(/\.(mp4|webm|ogg)$/i) ? (
                                <video
                                    src={img.path}
                                    className="rounded-lg object-cover h-40 w-full"
                                    muted
                                    autoPlay
                                    loop
                                    playsInline
                                />
                            ) : (
                                <Image
                                    src={img.path}
                                    alt={img.title || "Gallery"}
                                    width={400}
                                    height={300}
                                    className="rounded-lg object-cover h-40 w-full"
                                    unoptimized
                                />
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
                        className="relative w-full h-full flex flex-col touch-pan-y select-none cursor-grab active:cursor-grabbing"
                        onPointerDown={swipe.onPointerDown}
                        onPointerMove={swipe.onPointerMove}
                        onPointerUp={swipe.onPointerUp}
                        onPointerCancel={swipe.onPointerCancel}
                        onPointerLeave={swipe.onPointerLeave}
                        onClick={(e) => {
                            if (swipe.didDrag()) e.stopPropagation();
                        }}
                    >
                        {/* Controls */}
                        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-[60] pointer-events-none">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIndex(null);
                                }}
                                className="pointer-events-auto text-white/80 hover:text-white text-4xl font-bold cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Arrows */}
                        {selectedIndex! > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goPrev();
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-6xl hidden md:block z-[60]"
                            >
                                &#8249;
                            </button>
                        )}

                        {selectedIndex! < images.length - 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goNext();
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-6xl hidden md:block z-[60]"
                            >
                                &#8250;
                            </button>
                        )}

                        {/* Image */}
                        <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
                            <div
                                className={`relative transition-all duration-200 ${animClass} w-full h-full flex items-center justify-center p-4`}
                            >
                                {selected.path.match(/\.(mp4|webm|ogg)$/i) ? (
                                    <video
                                        src={selected.path}
                                        controls
                                        autoPlay
                                        loop
                                        className="w-auto h-auto max-w-full max-h-[80vh] object-contain rounded-sm shadow-2xl"
                                    />
                                ) : (
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
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gradient-to-t from-black/80 to-transparent z-50">
                            {selected.description && (
                                <p
                                    className="text-white text-center text-sm md:text-base mb-4 max-w-2xl mx-auto"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {selected.description}
                                </p>
                            )}

                            {/* Dots */}
                            <div
                                className="w-full flex items-center justify-center pb-2"
                                ref={dotsContainerRef}
                            >
                                <div
                                    className="px-2.5 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-md"
                                    style={{
                                        transform: `scale(${scale})`,
                                        transformOrigin: "center center",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {images.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDirection(
                                                        i > (selectedIndex || 0) ? "right" : "left"
                                                    );
                                                    setSelectedIndex(i);
                                                }}
                                                className={`h-2 w-2 rounded-full transition-all duration-200 ${i === selectedIndex
                                                    ? "bg-blue-500 scale-125"
                                                    : "bg-white/40 hover:bg-white/60"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoasterGallery;
