"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import LoadingSpinner from "@/app/components/LoadingSpinner";

interface GalleryImage {
  id: number;
  title: string;
  path: string;
}

interface ParkHeaderModalProps {
  parkId: number;
  parkName: string;
  currentImagePath: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ParkHeaderModal: React.FC<ParkHeaderModalProps> = ({ parkId, parkName, currentImagePath, onClose, onSuccess }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetch(`/api/park/${parkId}/gallery`)
      .then((res) => res.json())
      .then((data) => {
        setImages(data.gallery || []);
        setLoading(false);
      });
  }, [parkId]);

  // Delete old image from R2 if it's NOT part of the gallery
  const cleanupOldHeader = async () => {
    if (!currentImagePath || !currentImagePath.includes("r2.dev")) return;
    
    const isGalleryImage = images.some(img => img.path === currentImagePath);
    if (!isGalleryImage) {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentImagePath }),
      }).catch(err => console.warn("Failed to delete old header from R2", err));
    }
  };

  // Option 1: Select existing image from Gallery
  const handleSelectHeader = async (selectedImage: GalleryImage) => {
    setSubmitting(true);
    try {
      const updateRes = await fetch(`/api/park/${parkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagepath: selectedImage.path }),
      });

      if (!updateRes.ok) throw new Error("Database update failed");

      await cleanupOldHeader();
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update header image.");
      setSubmitting(false);
    }
  };

  // Option 2: Upload brand new image
  const handleUploadNew = async (file: File | undefined) => {
    if (!file) return;
    setSubmitting(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", `${parkName}-header`);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { imagePath: newImagePath } = JSON.parse(xhr.responseText);

          // Update PostgreSQL
          const updateRes = await fetch(`/api/park/${parkId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imagepath: newImagePath }),
          });

          if (!updateRes.ok) throw new Error("Database update failed");

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/10">
        
        {/* MODAL HEADER & UPLOAD BUTTON */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div className="w-full pr-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Park Header</h2>
            <p className="text-sm text-gray-500 mb-4">Pick an image from the gallery to represent {parkName}</p>
            
            {/* Upload New Image Area */}
            <label className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-xl transition-all cursor-pointer relative overflow-hidden
              ${submitting ? 'border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed' : 'border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
            >
              {/* Progress Bar Background */}
              {submitting && uploadProgress > 0 && (
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-blue-100 dark:bg-blue-900/30 transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }} 
                />
              )}
              
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadNew(e.target.files?.[0])} disabled={submitting} />
              
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2 relative z-10">
                {submitting ? (
                  <>Uploading... {uploadProgress}%</>
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

          <button onClick={onClose} disabled={submitting} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer self-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* GALLERY GRID */}
        <div className="p-6 overflow-y-auto grow">
          {loading ? (
            <div className="py-20 flex justify-center"><LoadingSpinner /></div>
          ) : images.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No images in gallery yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img) => {
                const isCurrentHeader = img.path === currentImagePath;
                return (
                  <div
                    key={img.id}
                    onClick={() => !submitting && !isCurrentHeader && handleSelectHeader(img)}
                    className={`relative aspect-video rounded-xl overflow-hidden border-4 transition-all group 
                      ${isCurrentHeader ? "border-blue-600 ring-4 ring-blue-600/20 cursor-default" : "border-transparent hover:border-blue-400 cursor-pointer"}
                      ${submitting ? "opacity-50 pointer-events-none" : ""}
                    `}
                  >
                    <Image src={img.path} alt={img.title || "Gallery image"} fill className="object-cover" unoptimized />
                    
                    {!isCurrentHeader && (
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <span className="text-white font-bold text-sm bg-blue-600 px-3 py-1 rounded-full">Set as Header</span>
                      </div>
                    )}

                    {isCurrentHeader && (
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

export default ParkHeaderModal;