"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { Park } from "@/app/types";

interface ParkHeaderProps {
  park: Park;
}

const ParkHeader: React.FC<ParkHeaderProps> = ({ park }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div 
      className="relative w-full aspect-[16/8] md:aspect-[16/4] max-h-screen overflow-hidden cursor-pointer group bg-gray-200 dark:bg-gray-800"
      onClick={() => {
          if (park.imagepath) {
              window.open(park.imagepath, '_blank');
          }
      }}
      title="Click to view full image"
    >
      <Image
        src={park.imagepath}
        alt={park.name}
        fill
        className={`object-cover transition-all duration-750 group-hover:scale-103 ${
          imageLoaded ? "opacity-100 blur-0" : "opacity-0 blur-lg"
        }`}
        priority
        unoptimized
        onLoad={() => setImageLoaded(true)}
      />
      
      {/* Optional: Gradient to make text pop against any image */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 pointer-events-none" />

      {/* Title */}
      <h1 className="absolute bottom-6 left-6 text-4xl md:text-5xl font-bold text-white z-20 drop-shadow-lg pointer-events-none">
        {park.name}
      </h1>
    </div>
  );
};

export default ParkHeader;