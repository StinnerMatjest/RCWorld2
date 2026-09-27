"use client";

import React, { useState, useEffect } from "react";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useScrollLock } from "@/app/hooks/useScrollLock";

interface GalleryImage {
  id: number;
  path: string;
  title: string | null;
  park_name: string | null;
}

interface Props {
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
}

const ImageSelectorModal: React.FC<Props> = ({ onClose, onSelect }) => {
  useScrollLock();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string>("");

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const res = await fetch("/api/visit-gallery");
        if (res.ok) {
          const data = await res.json();
          setImages(data.images || []);
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, []);

  const handleConfirm = () => {
    if (selectedUrl) {
      onSelect(selectedUrl);
      onClose();
    }
  };

  const filteredImages = images.filter((img) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesTitle = img.title?.toLowerCase().includes(searchLower);
    const matchesPark = img.park_name?.toLowerCase().includes(searchLower);
    return matchesTitle || matchesPark;
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-slate-700">

        {/* Header & Search */}
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/50">
          <h3 className="text-xl font-black text-white uppercase tracking-wider">Select Image</h3>

          <input
            type="text"
            placeholder="Search by title or park..."
            className="w-full sm:max-w-md p-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Image Grid */}
        <div className="p-6 flex-grow overflow-y-auto bg-slate-950">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <LoadingSpinner />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center text-slate-500 py-20 text-lg font-medium">
              No images found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredImages.map((img) => {
                const isSelected = selectedUrl === img.path;
                return (
                  <div
                    key={img.id}
                    onClick={() => setSelectedUrl(img.path)}
                    className={`relative aspect-square cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 group ${isSelected ? "border-brand scale-95 shadow-[0_0_15px_rgba(var(--brand-rgb),0.3)]" : "border-transparent hover:border-slate-700"
                      }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.path}
                      alt={img.title || "Gallery image"}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    {/* Gradient overlay for title and park name */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-12">
                      <p className="text-white text-xs font-bold truncate drop-shadow-md">
                        {img.title || "Untitled"}
                      </p>
                      {img.park_name && (
                        <p className="text-slate-400 text-[10px] uppercase tracking-wide truncate mt-0.5">
                          {img.park_name}
                        </p>
                      )}
                    </div>
                    {/* Checkmark icon for selected state */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-brand text-white p-1.5 rounded-full shadow-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedUrl}
            className="px-6 py-2.5 bg-brand hover:bg-brand-light disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-black shadow-lg transition-colors cursor-pointer"
          >
            Confirm Selection
          </button>
        </div>

      </div>
    </div>
  );
};

export default ImageSelectorModal;