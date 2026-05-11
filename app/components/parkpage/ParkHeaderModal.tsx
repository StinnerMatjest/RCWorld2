"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { getParkFlag, getRatingColor } from "@/app/utils/design";

interface GalleryImage {
  id: number;
  title: string;
  path: string;
}

interface ParkHeaderModalProps {
  parkId: number;
  parkName: string;
  parkCountry?: string;
  currentImagePath: string | null;
  currentFocus?: string;
  currentHeaderFocus?: string;
  overall?: number;
  onClose: () => void;
  onSuccess: () => void;
}

function parseFocus(f?: string): { x: number; y: number } {
  if (!f) return { x: 50, y: 50 };
  const [x, y] = f.split(" ").map((v) => parseInt(v));
  return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
}

const CARD_PREVIEW_GROUPS = [
  { emoji: "🎢", label: "Coasters", value: "8.50" },
  { emoji: "🎡", label: "Rides",    value: "7.25" },
  { emoji: "🏞️", label: "Park",     value: "9.00" },
  { emoji: "🍔", label: "Food",     value: "7.75" },
  { emoji: "📋", label: "Mgmt",     value: "8.25" },
];

const ParkHeaderModal: React.FC<ParkHeaderModalProps> = ({
  parkId, parkName, parkCountry, currentImagePath,
  currentFocus, currentHeaderFocus, overall, onClose, onSuccess,
}) => {
  const [tab, setTab] = useState<"header" | "card-focal" | "header-focal">("header");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cardFocus, setCardFocus] = useState(parseFocus(currentFocus));
  const [headerFocus, setHeaderFocus] = useState(parseFocus(currentHeaderFocus));
  const [zoom, setZoom] = useState(1);
  const [savingFocus, setSavingFocus] = useState(false);
  const draggingRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeFocus = tab === "header-focal" ? headerFocus : cardFocus;
  const setActiveFocus = tab === "header-focal" ? setHeaderFocus : setCardFocus;
  const focusStr = `${activeFocus.x}% ${activeFocus.y}%`;

  const applyPosition = (clientX: number, clientY: number) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
    setActiveFocus({ x, y });
  };

  useEffect(() => {
    fetch(`/api/park/${parkId}/gallery`)
      .then((res) => res.json())
      .then((data) => { setImages(data.gallery || []); setLoading(false); });
  }, [parkId]);

  const cleanupOldHeader = async () => {
    if (!currentImagePath || !currentImagePath.includes("r2.dev")) return;
    const isGalleryImage = images.some((img) => img.path === currentImagePath);
    if (!isGalleryImage) {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentImagePath }),
      }).catch((err) => console.warn("Failed to delete old header from R2", err));
    }
  };

  const handleSelectHeader = async (selectedImage: GalleryImage) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/park/${parkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagepath: selectedImage.path }),
      });
      if (!res.ok) throw new Error("Database update failed");
      await cleanupOldHeader();
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update header image.");
      setSubmitting(false);
    }
  };

  const handleUploadNew = async (file: File | undefined) => {
    if (!file) return;
    setSubmitting(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", `${parkName}-header`);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { imagePath: newImagePath } = JSON.parse(xhr.responseText);
          const res = await fetch(`/api/park/${parkId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imagepath: newImagePath }),
          });
          if (!res.ok) throw new Error("Database update failed");
          await cleanupOldHeader();
          onSuccess();
          onClose();
        } catch (error) {
          console.error(error);
          alert("Failed to save new header to database.");
          setSubmitting(false);
        }
      } else {
        alert("Upload failed.");
        setSubmitting(false);
      }
    });
    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  };

  const handleSaveFocus = async () => {
    setSavingFocus(true);
    const field = tab === "header-focal" ? "headerFocus" : "imageFocus";
    await fetch(`/api/park/${parkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: focusStr }),
    });
    setSavingFocus(false);
    onSuccess();
    onClose();
  };

  const editorProps = {
    onMouseDown: (e: React.MouseEvent) => { draggingRef.current = true; applyPosition(e.clientX, e.clientY); },
    onMouseMove: (e: React.MouseEvent) => { if (draggingRef.current) applyPosition(e.clientX, e.clientY); },
    onMouseUp: () => { draggingRef.current = false; },
    onMouseLeave: () => { draggingRef.current = false; },
    onTouchStart: (e: React.TouchEvent) => { draggingRef.current = true; applyPosition(e.touches[0].clientX, e.touches[0].clientY); },
    onTouchMove: (e: React.TouchEvent) => { if (draggingRef.current) applyPosition(e.touches[0].clientX, e.touches[0].clientY); },
    onTouchEnd: () => { draggingRef.current = false; },
  };

  const isFocalTab = tab === "card-focal" || tab === "header-focal";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-5xl h-[92vh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/10">

        {/* Header bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white truncate">{parkName}</h2>
            <div className="flex gap-1 flex-shrink-0">
              {(["header", "card-focal", "header-focal"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setZoom(1); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
                  className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                    tab === t ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {t === "header" ? "Header" : t === "card-focal" ? "📍 Card" : "🏔️ Header"}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Header image tab */}
        {tab === "header" && (
          <div className="flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="px-4 sm:px-6 py-3 flex-shrink-0">
              <label className={`flex items-center justify-center w-full p-3 border-2 border-dashed rounded-xl transition-all cursor-pointer relative overflow-hidden ${
                submitting
                  ? "border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed"
                  : "border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              }`}>
                {submitting && uploadProgress > 0 && (
                  <div className="absolute left-0 top-0 bottom-0 bg-blue-100 dark:bg-blue-900/30 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadNew(e.target.files?.[0])} disabled={submitting} />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2 relative z-10">
                  {submitting ? (
                    <span>Uploading... {uploadProgress}%</span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Upload New Custom Header
                    </>
                  )}
                </span>
              </label>
            </div>
            <div className="px-4 sm:px-6 pb-4 overflow-y-auto flex-1">
              {loading ? (
                <div className="py-20 flex justify-center"><LoadingSpinner /></div>
              ) : images.length === 0 ? (
                <p className="text-center text-gray-500 py-10">No images in gallery yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images.map((img) => {
                    const isCurrent = img.path === currentImagePath;
                    return (
                      <div
                        key={img.id}
                        onClick={() => { if (!submitting && !isCurrent) handleSelectHeader(img); }}
                        className={`relative aspect-video rounded-xl overflow-hidden border-4 transition-all group ${
                          isCurrent
                            ? "border-blue-600 ring-4 ring-blue-600/20 cursor-default"
                            : "border-transparent hover:border-blue-400 cursor-pointer"
                        } ${submitting ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <Image src={img.path} alt={img.title || "Gallery image"} fill className="object-cover" unoptimized />
                        {!isCurrent && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white font-bold text-sm bg-blue-600 px-3 py-1 rounded-full">Set as Header</span>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-md font-bold uppercase shadow-lg">
                            Current Header
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Focal point tabs */}
        {isFocalTab && currentImagePath && (
          <div ref={scrollRef} className="flex flex-col p-4 gap-4 overflow-y-auto flex-1 min-h-0">

            {/* Editor — shared for both focal tabs */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Drag to set focal point
                <span className="normal-case font-normal text-gray-500 ml-2">{focusStr}</span>
              </p>
              <div
                className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-crosshair select-none"
                {...editorProps}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={currentImagePath}
                  alt={parkName}
                  className="block select-none"
                  style={{ width: "100%", maxHeight: "200px", objectFit: "contain" }}
                  draggable={false}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{ left: `${activeFocus.x}%`, top: `${activeFocus.y}%`, transform: "translate(-50%,-50%)" }}
                >
                  <div className="w-7 h-7 rounded-full border-[2.5px] border-white shadow-lg bg-white/20" />
                  <div className="absolute top-1/2 left-1/2 h-px w-12 -translate-y-1/2 -translate-x-full bg-white/90" />
                  <div className="absolute top-1/2 left-1/2 h-px w-12 -translate-y-1/2 bg-white/90" />
                  <div className="absolute top-1/2 left-1/2 w-px h-12 -translate-x-1/2 -translate-y-full bg-white/90" />
                  <div className="absolute top-1/2 left-1/2 w-px h-12 -translate-x-1/2 bg-white/90" />
                </div>
              </div>
            </div>

            {/* Header focal preview */}
            {tab === "header-focal" && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Park page header preview</p>
                <div className="relative w-full rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: "16/4" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentImagePath}
                    alt=""
                    draggable={false}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: focusStr, transform: `scale(${zoom})`, transformOrigin: focusStr }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-5 text-white font-bold text-lg drop-shadow pointer-events-none">{parkName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-bold">1×</span>
                  <input type="range" min={1} max={4} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-blue-600" />
                  <span className="text-xs text-gray-400 font-bold">4×</span>
                  <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">{zoom.toFixed(1)}×</span>
                </div>
              </div>
            )}

            {/* Card focal preview */}
            {tab === "card-focal" && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Card preview</p>
                  <div className="flex justify-center sm:block">
                    <div className="relative rounded-2xl overflow-hidden bg-gray-900 w-48 sm:w-full" style={{ aspectRatio: "3/4" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentImagePath}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover opacity-70"
                        style={{ objectPosition: focusStr, transform: `scale(${zoom})`, transformOrigin: focusStr }}
                      />
                      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/85 to-transparent px-3 pt-3 pb-10 pointer-events-none">
                        <div className="flex items-center gap-1.5">
                          {parkCountry && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getParkFlag(parkCountry)} alt="" width={16} height={11} className="rounded-sm shrink-0" />
                          )}
                          <span className="text-white font-bold text-sm leading-tight drop-shadow-md truncate">{parkName}</span>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pt-10 pb-3 pointer-events-none">
                        <div className={`text-3xl font-black tabular-nums text-center leading-none mb-2 ${getRatingColor(overall ?? 8.5)}`}>
                          {(overall ?? 8.5).toFixed(2)}
                        </div>
                        <div className="grid grid-cols-5 gap-0.5">
                          {CARD_PREVIEW_GROUPS.map((g) => (
                            <div key={g.label} className="flex flex-col items-center gap-0.5">
                              <span className="text-xs">{g.emoji}</span>
                              <span className="text-[10px] font-bold text-green-400 tabular-nums">{g.value}</span>
                              <span className="text-[8px] text-white/40 uppercase">{g.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:w-36 sm:flex-shrink-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Zoom</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-bold">1×</span>
                    <input type="range" min={1} max={4} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-blue-600" />
                    <span className="text-xs text-gray-400 font-bold">4×</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSaveFocus}
              disabled={savingFocus}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {savingFocus ? "Saving…" : "Save focal point"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ParkHeaderModal;
