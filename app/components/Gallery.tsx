"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

interface GalleryProps {
  images: string[];
}

const Gallery: React.FC<GalleryProps> = ({ images }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  // ESC and arrow key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIndex(null);
      if (e.key === "ArrowLeft" && selectedIndex !== null && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
      if (e.key === "ArrowRight" && selectedIndex !== null && selectedIndex < images.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, images.length]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Gallery</h2>

      {/* Grid of thumbnails */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((src, index) => (
          <div
            key={index}
            onClick={() => setSelectedIndex(index)}
            className="cursor-pointer overflow-hidden rounded-lg hover:scale-105 transition-transform duration-300"
          >
            <img
              src={src}
              alt={`Gallery image ${index + 1}`}
              width={400}
              height={300}
              className="rounded-lg object-cover h-40 w-full"
            />
          </div>
        ))}
      </div>

      {/* Modal View */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] p-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedIndex(null)}
              className="absolute top-3 right-4 text-white text-3xl font-bold z-10"
              aria-label="Close"
            >
              &times;
            </button>

            {/* Left Arrow */}
            {selectedIndex !== null && selectedIndex > 0 && (
              <button
                onClick={() => setSelectedIndex((prev) => prev! - 1)}
                className="absolute left-[-5rem] top-1/2 -translate-y-1/2 text-white text-6xl z-10 hover:scale-110 hover:text-gray-300 transition-transform duration-200"
                aria-label="Previous image"
              >
                &#8592;
              </button>
            )}

            {/* Right Arrow */}
            {selectedIndex !== null && selectedIndex < images.length - 1 &&(
              <button
                onClick={() => setSelectedIndex((prev) => prev! + 1)}
                className="absolute right-[-5rem] top-1/2 -translate-y-1/2 text-white text-6xl z-10 hover:scale-110 hover:text-gray-300 transition-transform duration-200"
                aria-label="Next image"
              >
                &#8594;
              </button>
            )}

            {/* Image */}
            <Image
              src={selected}
              alt="Full Image"
              width={1200}
              height={800}
              className="rounded-xl object-contain w-full h-auto max-h-[80vh]"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
