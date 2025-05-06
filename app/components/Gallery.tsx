"use client";

import React, { useState } from "react";
import Image from "next/image";

interface GalleryProps {
  images: string[];
}

const Gallery: React.FC<GalleryProps> = ({ images }) => {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Gallery</h2>

      {/* Grid of thumbnails */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((src, index) => (
          <div
            key={index}
            onClick={() => setSelected(src)}
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
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setSelected(null)}
        >
          <div className="max-w-3xl max-h-[90vh] overflow-auto">
            <Image
              src={selected}
              alt="Full Image"
              width={800}
              height={600}
              className="rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
