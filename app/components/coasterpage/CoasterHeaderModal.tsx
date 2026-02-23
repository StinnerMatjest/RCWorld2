"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import LoadingSpinner from "@/app/components/LoadingSpinner";

interface GalleryImage {
  id: number;
  title: string;
  path: string;
}

interface ModalProps {
  coasterId: string | number;
  coasterName: string;
  parkId: number;
  onClose: () => void;
  onUpdate: () => void;
}

const CoasterHeaderModal: React.FC<ModalProps> = ({ coasterId, coasterName, parkId, onClose, onUpdate }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeHeader, setActiveHeader] = useState<GalleryImage | null>(null);
  const [allActiveHeaders, setAllActiveHeaders] = useState<GalleryImage[]>([]); // NEW STATE
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/coasters/${coasterId}/gallery?name=${encodeURIComponent(coasterName)}&parkId=${parkId}`)
      .then((res) => res.json())
      .then((data) => {
        setImages(data.gallery || []);
        setActiveHeader(data.activeHeader || null);
        setAllActiveHeaders(data.allActiveHeaders || []); // Capture all accumulated headers
        setLoading(false);
      });
  }, [coasterId, coasterName, parkId]);

  const cleanupExistingHeader = async () => {
    if (allActiveHeaders.length === 0) return;
    const cleanupPromises = allActiveHeaders.map(async (header) => {
      const isHeaderOnly = header.title.toUpperCase().includes("HEADER ONLY");

      if (isHeaderOnly) {
        // Delete from R2
        await fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: header.path }),
        }).catch(() => console.warn("Failed to delete from R2"));

        // Delete from Database
        const dbRes = await fetch(`/api/image/${header.id}`, { method: "DELETE" });
        if (!dbRes.ok) throw new Error(`Failed to delete old header ${header.id} from DB`);

      } else if (header.title.toUpperCase().includes("HEADER")) {
        // Just downgrade it back to the gallery
        const newTitle = header.title.replace(/ - HEADER/gi, "").trim();
        const patchRes = await fetch(`/api/image/${header.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        if (!patchRes.ok) throw new Error("Failed to remove header tag from existing image");
      }
    });

    await Promise.all(cleanupPromises);
  };

  const handleSelectHeader = async (selectedImage: GalleryImage) => {
    setSubmitting(true);
    try {
      await cleanupExistingHeader();

      // Add " - HEADER" to the new selection
      const baseTitle = selectedImage.title.replace(/ - HEADER/gi, "").trim();
      const finalTitle = `${baseTitle} - HEADER`;

      // UPDATED URL
      const patchRes = await fetch(`/api/image/${selectedImage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: finalTitle }),
      });

      if (!patchRes.ok) throw new Error("Failed to apply new header tag");

      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update header image.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadHeaderOnly = async (file: File | undefined) => {
    if (!file) return;
    setSubmitting(true);

    try {
      // Upload new image to R2
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", `${coasterName}-header-only`);

      const r2Response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!r2Response.ok) throw new Error("Failed to upload image to R2");
      const { imagePath } = await r2Response.json();

      // Clean up the old header
      await cleanupExistingHeader();

      // Save new image to database
      const dbRes = await fetch(`/api/park/${parkId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${coasterName} - HEADER ONLY`,
          path: imagePath,
          description: `${coasterName} Header Image`,
          parkId: Number(parkId),
        }),
      });

      if (!dbRes.ok) {
        const errText = await dbRes.text();
        throw new Error(`DB Error: ${errText}`);
      }

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/10">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Header Image</h2>
            <p className="text-sm text-gray-500">Pick an image from the gallery to represent {coasterName}</p>
            {/* Upload New Header Image Area */}
            <div className="px-6 pt-6 pb-2">
              <label className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-xl transition-all cursor-pointer
            ${submitting ? 'border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed' : 'border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadHeaderOnly(e.target.files?.[0])}
                  disabled={submitting}
                />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  {submitting ? (
                    <>Uploading & Setting Header...</>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Upload New "Header Only" Image
                    </>
                  )}
                </span>
              </label>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto grow">
          {loading ? (
            <div className="py-20 flex justify-center"><LoadingSpinner /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img) => {
                const isHeader = img.title.toUpperCase().includes(" - HEADER");
                return (
                  <div
                    key={img.id}
                    onClick={() => !submitting && handleSelectHeader(img)}
                    className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-4 transition-all group ${isHeader ? "border-blue-600 ring-4 ring-blue-600/20" : "border-transparent hover:border-blue-400"
                      }`}
                  >
                    <Image src={img.path} alt={img.title} fill className="object-cover" unoptimized />
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <span className="text-white font-bold text-sm bg-blue-600 px-3 py-1 rounded-full">Set as Header</span>
                    </div>
                    {isHeader && (
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
    </div>
  );
};

export default CoasterHeaderModal;