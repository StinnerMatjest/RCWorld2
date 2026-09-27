"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAdminMode } from "../../context/AdminModeContext";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import LoadingSpinner from "@/app/components/LoadingSpinner";

interface CoasterGalleryProps {
    coasterId: number;
    coasterName: string;
    parkId: number;
}

type GalleryImage = {
    id: number;
    title: string;
    path: string;
    description: string;
    is_header: boolean;
};

const CoasterImageManagerModal = ({
    coasterId, coasterName, parkId, onClose, onSuccess
}: {
    coasterId: number; coasterName: string; parkId: number; onClose: () => void; onSuccess: () => void;
}) => {
    useScrollLock();
    const [mode, setMode] = useState<"upload" | "select">("select");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Form State
    const [description, setDescription] = useState("");
    const [isHeader, setIsHeader] = useState(false);

    // Select Mode State
    const [parkImages, setParkImages] = useState<any[]>([]);
    const [selectedParkImageUrl, setSelectedParkImageUrl] = useState<string | null>(null);
    const [loadingParkImages, setLoadingParkImages] = useState(true);

    // Upload Mode State
    const [files, setFiles] = useState<File[]>([]);

    useEffect(() => {
        if (mode === "select" && parkImages.length === 0) {
            const fetchParkImages = async () => {
                try {
                    const res = await fetch(`/api/park/${parkId}/gallery`);
                    const data = await res.json();
                    setParkImages(data.gallery || []);
                } catch (err) {
                    console.error("Failed to load park images", err);
                } finally {
                    setLoadingParkImages(false);
                }
            };
            fetchParkImages();
        }
    }, [mode, parkId, parkImages.length]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setUploadProgress(0);

        try {
            if (mode === "select") {
                if (!selectedParkImageUrl) throw new Error("Please select an image first.");

                const title = `${coasterName}${isHeader ? " - HEADER" : ""}`;
                const res = await fetch(`/api/coasters/${coasterId}/gallery`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: selectedParkImageUrl, title, description, isHeader })
                });
                if (!res.ok) throw new Error("Failed to save image to coaster gallery.");

            } else {
                if (files.length === 0) throw new Error("Please select files to upload.");
                const isBulk = files.length > 1;

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const formData = new FormData();
                    formData.append("file", file);

                    const fileSuffix = isBulk ? ` (${i + 1})` : "";
                    const r2Title = `${coasterName}${fileSuffix}`;
                    formData.append("title", r2Title);

                    // 1. Upload to R2
                    const r2Res = await fetch("/api/upload", { method: "POST", body: formData });
                    if (!r2Res.ok) throw new Error(`Upload failed for ${file.name}`);
                    const { imagePath } = await r2Res.json();

                    // 2. Save to DB
                    const dbTitle = `${coasterName}${fileSuffix}${!isBulk && isHeader ? " - HEADER" : ""}`;
                    const dbRes = await fetch(`/api/coasters/${coasterId}/gallery`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            path: imagePath,
                            title: dbTitle,
                            description: isBulk ? "" : description,
                            isHeader: isBulk ? false : isHeader
                        })
                    });
                    if (!dbRes.ok) throw new Error(`Database save failed for ${file.name}`);
                    setUploadProgress(i + 1);
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                {/* Header Tabs */}
                <div className="flex border-b border-slate-700 bg-slate-900/50">
                    <button
                        onClick={() => setMode("select")}
                        className={`flex-1 py-4 font-bold text-sm tracking-wide transition-colors cursor-pointer ${mode === "select" ? "text-brand border-b-2 border-brand bg-slate-800/50" : "text-slate-400 hover:text-white"}`}
                    >
                        Select from Park Gallery
                    </button>
                    <button
                        onClick={() => setMode("upload")}
                        className={`flex-1 py-4 font-bold text-sm tracking-wide transition-colors cursor-pointer ${mode === "upload" ? "text-brand border-b-2 border-brand bg-slate-800/50" : "text-slate-400 hover:text-white"}`}
                    >
                        Upload New File(s)
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <LoadingSpinner />
                            <p className="text-white font-bold">
                                {mode === "upload" ? `Uploading ${uploadProgress} of ${files.length}...` : "Saving to gallery..."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Selection Grid */}
                            {mode === "select" && (
                                <div className="space-y-4">
                                    {loadingParkImages ? (
                                        <div className="flex justify-center py-10"><LoadingSpinner /></div>
                                    ) : parkImages.length === 0 ? (
                                        <p className="text-center text-slate-400 py-10">No images found in the park gallery.</p>
                                    ) : (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[40vh] overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                                            {parkImages.map(img => (
                                                <div
                                                    key={img.id}
                                                    onClick={() => setSelectedParkImageUrl(img.path)}
                                                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedParkImageUrl === img.path ? "border-brand scale-95 shadow-[0_0_15px_rgba(var(--brand-rgb),0.3)]" : "border-transparent hover:border-slate-600"}`}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={img.path} alt="Park Image" className="w-full h-full object-cover" />
                                                    {selectedParkImageUrl === img.path && (
                                                        <div className="absolute top-2 right-2 bg-brand text-white p-1 rounded-full"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Upload Input */}
                            {mode === "upload" && (
                                <div>
                                    <label className="block text-sm font-bold mb-2 text-slate-300">Select Files</label>
                                    <input
                                        type="file"
                                        accept="image/*,video/*"
                                        multiple
                                        onChange={(e) => setFiles(Array.from(e.target.files || []))}
                                        className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-800 file:text-white hover:file:bg-slate-700 bg-slate-950 border border-slate-700 rounded-xl p-2 cursor-pointer transition-colors"
                                    />
                                    {files.length > 0 && <p className="mt-2 text-xs text-brand font-semibold">{files.length} file(s) selected.</p>}
                                </div>
                            )}

                            {/* Shared Metadata Form */}
                            <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2 text-slate-300">Caption / Description</label>
                                    <textarea
                                        value={mode === "upload" && files.length > 1 ? "" : description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        disabled={mode === "upload" && files.length > 1}
                                        placeholder={mode === "upload" && files.length > 1 ? "Disabled for bulk uploads" : "Optional image description"}
                                        rows={2}
                                        className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:ring-1 focus:ring-brand focus:border-brand outline-none disabled:opacity-50"
                                    />
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={mode === "upload" && files.length > 1 ? false : isHeader}
                                        onChange={(e) => setIsHeader(e.target.checked)}
                                        disabled={mode === "upload" && files.length > 1}
                                        className="w-5 h-5 accent-brand disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-bold ${mode === "upload" && files.length > 1 ? "text-slate-600" : "text-slate-300"}`}>
                                        Set as Header Image
                                    </span>
                                </label>
                            </div>

                            {error && <p className="text-red-400 text-sm font-semibold">{error}</p>}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-end gap-3">
                    <button onClick={onClose} disabled={loading} className="px-6 py-2.5 rounded-xl text-slate-300 font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-light text-white font-black shadow-lg transition-colors disabled:opacity-50 cursor-pointer">
                        Save to Coaster Gallery
                    </button>
                </div>
            </div>
        </div>
    );
}

const CoasterGallery: React.FC<CoasterGalleryProps> = ({ coasterId, coasterName, parkId }) => {
    const { isAdminMode } = useAdminMode();
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState<"left" | "right" | null>(null);
    const [scale, setScale] = useState(1);

    // Manage Modal State
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (selectedIndex !== null) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => { document.body.style.overflow = prev; };
        }
    }, [selectedIndex]);

    const dotsContainerRef = useRef<HTMLDivElement | null>(null);
    const modalContainerRef = useRef<HTMLDivElement>(null);
    const selected = selectedIndex !== null ? images[selectedIndex] : null;

    const fetchImages = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/coasters/${coasterId}/gallery?name=${encodeURIComponent(coasterName)}&parkId=${parkId}`);
            const data = await res.json();
            setImages(data.gallery || []);
        } catch (err) {
            console.error("Failed to fetch coaster gallery images", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchImages();
    }, [coasterName]);

    const handleDeleteImage = async () => {
        if (!selected) return;
        if (!window.confirm("Are you sure you want to remove this image from the coaster gallery?")) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/coasters/${coasterId}/gallery?imageId=${selected.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            setSelectedIndex(null);
            fetchImages();
        } catch (err) {
            console.error(err);
            alert("Failed to delete image.");
        } finally {
            setIsDeleting(false);
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

        return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, didDrag: () => moved.current };
    }

    const goNext = () => {
        setDirection("right");
        setSelectedIndex((p) => (p !== null && p < (images?.length ?? 0) - 1 ? p + 1 : p));
    };

    const goPrev = () => {
        setDirection("left");
        setSelectedIndex((p) => (p !== null && p > 0 ? p - 1 : p));
    };

    const swipe = useSwipe(goNext, goPrev, { threshold: 55, verticalRestraint: 120 });

    const isDesktop = () => typeof window !== "undefined" && window.innerWidth > 768;

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

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (document.fullscreenElement) document.exitFullscreen();
                setSelectedIndex(null);
            }
            if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
            if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [selectedIndex, images]);

    const recalcScale = () => {
        if (!dotsContainerRef.current) return;
        const len = images?.length ?? 0;
        const required = len * 8 + Math.max(0, len - 1) * 6 + 20;
        setScale(Math.min(1, dotsContainerRef.current.clientWidth / Math.max(required, 1)));
    };

    useEffect(() => {
        recalcScale();
        window.addEventListener("resize", recalcScale);
        return () => window.removeEventListener("resize", recalcScale);
    }, [images]);

    const animClass = direction === "right" ? "animate-slide-in-right" : direction === "left" ? "animate-slide-in-left" : "";

    return (
        <div className="space-y-6">
            <style>{`
                @keyframes slideInRight { 0% { opacity: 0.7; transform: translateX(16px) scale(0.985); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
                @keyframes slideInLeft { 0% { opacity: 0.7; transform: translateX(-16px) scale(0.985); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
                .animate-slide-in-right { animation: slideInRight 220ms cubic-bezier(0.22, 1, 0.36, 1); }
                .animate-slide-in-left { animation: slideInLeft 220ms cubic-bezier(0.22, 1, 0.36, 1); }
            `}</style>

            {/* Manage Modal */}
            {isManageModalOpen && (
                <CoasterImageManagerModal
                    coasterId={coasterId}
                    coasterName={coasterName}
                    parkId={parkId}
                    onClose={() => setIsManageModalOpen(false)}
                    onSuccess={fetchImages}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold dark:text-white flex items-center gap-3">
                    Gallery
                </h2>
                {isAdminMode && (
                    <button
                        onClick={() => setIsManageModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors cursor-pointer"
                    >
                        + Upload
                    </button>
                )}
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : !images?.length ? (
                <p className="text-center py-10 text-gray-500 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
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
                            className="group cursor-pointer overflow-hidden rounded-xl border border-transparent hover:border-brand/50 hover:shadow-[0_0_15px_rgba(var(--brand-rgb),0.1)] transition-all duration-300 relative"
                        >
                            {img.is_header && (
                                <div className="absolute top-2 left-2 z-10 bg-brand text-white text-[10px] font-bold px-2 py-1 rounded shadow-md uppercase tracking-wider">
                                    Header
                                </div>
                            )}
                            {img.path.match(/\.(mp4|webm|ogg)$/i) ? (
                                <video
                                    src={img.path}
                                    className="rounded-xl object-cover h-40 md:h-48 w-full transition-transform duration-500 group-hover:scale-105"
                                    muted autoPlay loop playsInline
                                />
                            ) : (
                                <Image
                                    src={img.path}
                                    alt={img.title || "Gallery"}
                                    width={400} height={300}
                                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                                    quality={85}
                                    className="rounded-xl object-cover h-40 md:h-48 w-full transition-transform duration-500 group-hover:scale-105"
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* FULLSCREEN MODAL VIEWER */}
            {selected && (
                <div
                    ref={modalContainerRef}
                    className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-sm flex items-center justify-center"
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
                        {/* Top Controls */}
                        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-[60] pointer-events-none">
                            <div className="pointer-events-auto flex items-center gap-4">
                                {isAdminMode && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteImage(); }}
                                        disabled={isDeleting}
                                        className="text-red-500/70 hover:text-red-500 transition cursor-pointer disabled:opacity-50 bg-black/40 p-2 rounded-full backdrop-blur-md"
                                        title="Remove Image from Coaster"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                                {!selected.path.match(/\.(mp4|webm|ogg)$/i) && (
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
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedIndex(null); }}
                                    className="text-white/80 hover:text-white text-3xl font-bold cursor-pointer bg-black/40 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-md pb-1"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        {/* Arrows */}
                        {selectedIndex! > 0 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                                className="absolute left-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-6xl hidden md:block z-[60] transition-colors pb-2"
                            >
                                &#8249;
                            </button>
                        )}

                        {selectedIndex !== null && selectedIndex < (images?.length ?? 0) - 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); goNext(); }}
                                className="absolute right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-6xl hidden md:block z-[60] transition-colors pb-2"
                            >
                                &#8250;
                            </button>
                        )}

                        {/* Image Viewer */}
                        <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
                            <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
                                {selectedIndex !== null && selectedIndex > 0 && !images[selectedIndex - 1].path.match(/\.(mp4|webm|ogg)$/i) && (
                                    <Image src={images[selectedIndex - 1].path} alt="prev" width={1920} height={1080} unoptimized priority />
                                )}
                                {selectedIndex !== null && selectedIndex < (images?.length ?? 0) - 1 && !images[selectedIndex + 1].path.match(/\.(mp4|webm|ogg)$/i) && (
                                    <Image src={images[selectedIndex + 1].path} alt="next" width={1920} height={1080} unoptimized priority />
                                )}
                            </div>
                            <div className={`relative ${animClass} w-full h-full flex items-center justify-center p-4 md:p-12`}>
                                {selected.path.match(/\.(mp4|webm|ogg)$/i) ? (
                                    <video src={selected.path} controls autoPlay loop className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                                ) : (
                                    <Image
                                        src={selected.path} alt={selected.title || "Full Image"}
                                        width={1920} height={1080} unoptimized priority draggable={false}
                                        onClick={handleImageClick}
                                        className="w-auto h-auto max-w-full max-h-[85vh] object-contain cursor-pointer shadow-2xl rounded-lg"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Bottom Bar: Descriptions and Dots */}
                        <div className="p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-50">
                            {selected.description && (
                                <p className="text-white text-center text-sm md:text-base font-medium mb-6 max-w-3xl mx-auto drop-shadow-md" onClick={(e) => e.stopPropagation()}>
                                    {selected.description}
                                </p>
                            )}
                            <div className="w-full flex items-center justify-center" ref={dotsContainerRef}>
                                <div
                                    className="px-3 py-2 rounded-full bg-black/50 border border-white/10 backdrop-blur-xl"
                                    style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-2">
                                        {images.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDirection(i > (selectedIndex || 0) ? "right" : "left");
                                                    setSelectedIndex(i);
                                                }}
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
        </div>
    );
};

export default CoasterGallery;