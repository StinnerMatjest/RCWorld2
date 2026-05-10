"use client";

import React, { useState, useEffect } from "react";
import type { GalleryImage } from "./ParkGallery";

interface ParkTextsModalProps {
  explanations: Record<string, string>;
  sectionImages: Record<string, string>;
  galleryImages: GalleryImage[];
  parkId: number;
  ratingId: number;
  onClose: () => void;
  onSave?: (updatedText: Record<string, string>, updatedImages: Record<string, string>) => void;
}

const categories = [
  "description",
  "parkAppearance",
  "bestCoaster",
  "coasterDepth",
  "waterRides",
  "flatridesAndDarkrides",
  "food",
  "snacksAndDrinks",
  "parkPracticality",
  "rideOperations",
  "parkManagement",
];

const humanizeLabel = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();

const ParkTextModal: React.FC<ParkTextsModalProps> = ({
  explanations,
  sectionImages,
  galleryImages,
  parkId,
  ratingId,
  onClose,
  onSave,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [localExplanations, setLocalExplanations] = useState<Record<string, string>>(explanations);
  const [localImages, setLocalImages] = useState<Record<string, string>>(sectionImages);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setText(localExplanations[selectedCategory] || "");
    setSelectedImage(localImages[selectedCategory] || null);
  }, [selectedCategory, localExplanations, localImages]);

  const handleClose = () => {
    onSave?.(localExplanations, localImages);
    onClose();
  };

  const handleUnpublish = async () => {
    if (!confirm("Are you sure you want to unpublish this review? It will be moved back to drafts.")) return;
    try {
      const res = await fetch(`/api/ratings/${ratingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to unpublish rating.");
      }
    } catch (error) {
      console.error("Failed to unpublish:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const method = localExplanations[selectedCategory] ? "PUT" : "POST";

      const res = await fetch(`/api/park/${parkId}/parkTexts`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          text,
          ratingId,
          imageUrl: selectedImage ?? null,
        }),
      });

      if (!res.ok) {
        console.error(`Failed to ${method} text`);
        return;
      }

      const saved = await res.json();

      const updatedTexts = { ...localExplanations, [selectedCategory]: saved.text };
      const updatedImages = { ...localImages };
      if (saved.imageUrl) {
        updatedImages[selectedCategory] = saved.imageUrl;
      } else {
        delete updatedImages[selectedCategory];
      }

      setLocalExplanations(updatedTexts);
      setLocalImages(updatedImages);
      onSave?.(updatedTexts, updatedImages);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Error submitting request:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const imageOptions = galleryImages;
  const isVideo = (path: string) => /\.(mp4|webm|ogg)$/i.test(path);

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-gray-800 dark:text-gray-100 border border-transparent dark:border-white/10 p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition cursor-pointer"
        >
          ✕
        </button>

        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Edit Section</h2>

        {/* Category selector */}
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
        <select
          className="w-full p-2 rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 mb-4"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{humanizeLabel(cat)}</option>
          ))}
        </select>

        {/* Text */}
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Text</label>
        <textarea
          className="w-full p-3 h-36 resize-none rounded-md border border-gray-300 bg-white text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 mb-5"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {/* Image picker */}
        <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Section Image <span className="text-gray-400 font-normal">(optional)</span>
        </label>

        {imageOptions.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">No gallery images available yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
            {/* Clear option */}
            <button
              onClick={() => setSelectedImage(null)}
              className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all ${selectedImage === null
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300"
                }`}
            >
              None
            </button>

            {imageOptions.map((img) => {
              const isSelected = selectedImage === img.path;
              return (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(img.path)}
                  className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-400"
                    }`}
                >
                  {isVideo(img.path) ? (
                    <>
                      <video src={img.path} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                        <svg className="w-6 h-6 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <img src={img.path} alt={img.description || ""} className="w-full h-full object-cover" />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedImage && (
          <p className="text-xs text-gray-400 mb-4 truncate">Selected: {selectedImage!.split("/").pop()}</p>
        )}

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleUnpublish}
              className="px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/30 text-sm font-medium transition-colors cursor-pointer"
            >
              Unpublish
            </button>
            {saveSuccess && (
              <span className="text-green-600 dark:text-green-400 text-sm font-medium">Saved!</span>
            )}
          </div>

          <div className="flex items-center justify-end w-full sm:w-auto gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 cursor-pointer dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-md text-white transition-colors ${isSaving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer"
                }`}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ParkTextModal;