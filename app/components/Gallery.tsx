"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import ImageUploaderModal from "@/app/components/ImageUploaderModal";

interface GalleryProps {
  parkId: number;
}

type GalleryImage = {
  id: number;
  parkId: number;
  title: string;
  path: string;
  description: string;
};

const Gallery: React.FC<GalleryProps> = ({ parkId }) => {
  const [images, setImages] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  const fetchGalleryImages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/park/${parkId}/gallery`);
      const data = await res.json();
      const gallery: GalleryImage[] = data.gallery;
      setImages(gallery.map((img) => img.path));
    } catch (err) {
      console.error("Failed to fetch gallery images", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGalleryImages();
  }, [parkId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIndex(null);
      if (
        e.key === "ArrowLeft" &&
        selectedIndex !== null &&
        selectedIndex > 0
      ) {
        setSelectedIndex(selectedIndex - 1);
      }
      if (
        e.key === "ArrowRight" &&
        selectedIndex !== null &&
        selectedIndex < images.length - 1
      ) {
        setSelectedIndex(selectedIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, images.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gallery</h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm cursor-pointer"
        >
          + Upload
        </button>
      </div>

      {loading ? (
        <p className="text-center py-4 italic text-gray-600">
          Loading images...
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((src, index) => (
            <div
              key={index}
              onClick={() => setSelectedIndex(index)}
              className="cursor-pointer overflow-hidden rounded-lg hover:scale-105 transition-transform duration-300"
            >
              <Image
                src={src}
                alt={`Gallery image ${index + 1}`}
                width={400}
                height={300}
                className="rounded-lg object-cover h-40 w-full"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] p-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedIndex(null)}
              className="absolute top-3 right-4 text-white text-3xl font-bold z-10"
              aria-label="Close"
            >
              &times;
            </button>

            {selectedIndex !== null && selectedIndex > 0 && (
              <button
                onClick={() =>
                  setSelectedIndex((prev) => (prev !== null ? prev - 1 : null))
                }
                className="absolute left-[-5rem] top-1/2 -translate-y-1/2 text-white text-6xl z-10 hover:scale-110 hover:text-gray-300 transition-transform duration-200"
                aria-label="Previous image"
              >
                &#8592;
              </button>
            )}

            {selectedIndex !== null && selectedIndex < images.length - 1 && (
              <button
                onClick={() =>
                  setSelectedIndex((prev) => (prev !== null ? prev + 1 : null))
                }
                className="absolute right-[-5rem] top-1/2 -translate-y-1/2 text-white text-6xl z-10 hover:scale-110 hover:text-gray-300 transition-transform duration-200"
                aria-label="Next image"
              >
                &#8594;
              </button>
            )}

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

      {showModal && (
        <ImageUploaderModal
          parkId={parkId}
          onClose={() => setShowModal(false)}
          onUploadSuccess={fetchGalleryImages}
        />
      )}
    </div>
  );
};

export default Gallery;
