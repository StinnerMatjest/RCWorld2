"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import LoadingSpinner from "@/app/components/LoadingSpinner";

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
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string>("");

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const res = await fetch("/api/gallery");
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

  // Filter by image title OR park name
  const filteredImages = images.filter((img) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesTitle = img.title?.toLowerCase().includes(searchLower);
    const matchesPark = img.park_name?.toLowerCase().includes(searchLower);
    return matchesTitle || matchesPark;
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        
        {/* Header & Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-xl font-bold dark:text-white whitespace-nowrap">Select Image</h3>
          
          <input 
            type="text" 
            placeholder="Search by title or park..."
            className="w-full sm:max-w-xs p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Image Grid */}
        <div className="p-6 flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <LoadingSpinner />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-10">
              No images found.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredImages.map((img) => {
                const isSelected = selectedUrl === img.path;
                return (
                  <div 
                    key={img.id}
                    onClick={() => setSelectedUrl(img.path)}
                    className={`relative aspect-square cursor-pointer rounded-xl overflow-hidden border-4 transition-all ${
                      isSelected ? "border-blue-500 scale-95 shadow-lg" : "border-transparent hover:scale-105 hover:shadow-md"
                    }`}
                  >
                    <Image
                      src={img.path}
                      alt={img.title || "Gallery image"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    {/* Gradient overlay for title and park name */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
                      <p className="text-white text-xs font-semibold truncate">
                        {img.title || "Untitled"}
                      </p>
                      {img.park_name && (
                        <p className="text-gray-300 text-[10px] truncate">
                          {img.park_name}
                        </p>
                      )}
                    </div>
                    {/* Checkmark icon for selected state */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-md">
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-800">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={!selectedUrl}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md transition-colors"
          >
            Confirm Selection
          </button>
        </div>

      </div>
    </div>
  );
};

export default ImageSelectorModal;