"use client";

import React, { useEffect, useState } from "react";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useScrollLock } from "@/app/hooks/useScrollLock";

interface GalleryImage {
  id: number;
  title: string;
  path: string;
  is_header: boolean;
}

interface ModalProps {
  coasterId: string | number;
  coasterName: string;
  parkId: number;
  onClose: () => void;
  onUpdate: () => void;
}

const CoasterHeaderModal: React.FC<ModalProps> = ({ coasterId, coasterName, parkId, onClose, onUpdate }) => {
  useScrollLock();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/coasters/${coasterId}/gallery?name=${encodeURIComponent(coasterName)}&parkId=${parkId}`)
      .then((res) => res.json())
      .then((data) => {
        setImages(data.gallery || []);
        setLoading(false);
      });
  }, [coasterId, coasterName, parkId]);

  // Set an existing gallery image as the header
  const handleSelectHeader = async (selectedImage: GalleryImage) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/coasters/${coasterId}/gallery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: selectedImage.id }),
      });

      if (!res.ok) throw new Error("Failed to apply new header tag");

      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update header image.");
    } finally {
      setSubmitting(false);
    }
  };

  // Upload a brand new image directly as the header
  const handleUploadNewHeader = async (file: File | undefined) => {
    if (!file) return;
    setSubmitting(true);

    try {
      // 1. Upload new image to R2
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", `${coasterName} Header`);

      const r2Response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!r2Response.ok) throw new Error("Failed to upload image to R2");
      const { imagePath } = await r2Response.json();

      // 2. Save new image to database and flag it as the header
      const dbRes = await fetch(`/api/coasters/${coasterId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${coasterName} Header`,
          path: imagePath,
          description: "",
          isHeader: true, // This automatically un-headers the old one in the backend
        }),
      });

      if (!dbRes.ok) throw new Error(`DB Error`);

      onUpdate();
      onClose();
    } catch (err) {
      console.error("Header upload error:", err);
      alert("Failed to upload and set the new header image.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Removed backdrop-blur for performance, increased opacity to bg-black/90
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/90">
      <div className="bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-700">

        {/* Modal Header & Upload Area */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start gap-6 bg-slate-900/50">
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-wide mb-1">Select Header Image</h2>
            <p className="text-sm text-slate-400 mb-6">Pick an image from the gallery to represent {coasterName}</p>

            {/* Upload New Header Image Area */}
            <label className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-xl transition-all cursor-pointer
            ${submitting ? 'border-slate-700 bg-slate-800 opacity-50 cursor-not-allowed' : ' border-slate-600 hover:border-brand hover:bg-brand/10'}`}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUploadNewHeader(e.target.files?.[0])}
                disabled={submitting}
              />
              <span className="text-sm font-bold text-slate-300 flex items-center gap-2">
                {submitting ? (
                  <>Uploading & Setting Header...</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-brand">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Upload New Header Image
                  </>
                )}
              </span>
            </label>
          </div>

          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-white p-2 rounded-full transition-colors cursor-pointer disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Gallery Selection Grid */}
        <div className="p-6 overflow-y-auto bg-slate-950 flex-grow">
          {loading ? (
            <div className="py-20 flex justify-center"><LoadingSpinner /></div>
          ) : images.length === 0 ? (
            <p className="text-center text-slate-500 py-10 font-medium">No images available. Upload one above!</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => !submitting && handleSelectHeader(img)}
                  className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-4 transition-all group ${img.is_header ? "border-brand scale-95 shadow-[0_0_15px_rgba(var(--brand-rgb),0.3)]" : "border-transparent hover:border-slate-600"
                    }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.path} alt={img.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-black uppercase tracking-wider text-xs bg-brand px-3 py-1.5 rounded-md shadow-lg">Set as Header</span>
                  </div>

                  {/* Active Header Badge */}
                  {img.is_header && (
                    <div className="absolute top-2 left-2 bg-brand text-white text-[10px] px-2 py-1 rounded shadow-lg font-bold uppercase tracking-wider">
                      Current Header
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoasterHeaderModal;