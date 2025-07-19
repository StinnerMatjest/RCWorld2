import React from "react";
import Image from "next/image";
import type { Park } from "@/app/types";

interface ParkHeaderProps {
  park: Park;
}

const ParkHeader: React.FC<ParkHeaderProps> = ({ park }) => (
<div className="relative w-full aspect-[16/8] md:aspect-[16/4] max-h-screen overflow-hidden">
    <Image
      src={park.imagepath}
      alt={park.name}
      fill
      className="object-cover"
      priority
      unoptimized
    />

    {/* Overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-10" />

    {/* Title */}
    <h1 className="absolute bottom-6 left-6 text-3xl md:text-5xl font-bold text-white z-20 drop-shadow-lg">
      {park.name}
    </h1>
  </div>
);

export default ParkHeader;
