import React from "react";
import Image from "next/image";
import type { Park } from "@/app/types";

interface ParkHeaderProps {
  park: Park;
}

const ParkHeader: React.FC<ParkHeaderProps> = ({ park }) => (
<div className="relative w-full aspect-[16/9] md:aspect-[16/4] max-h-screen overflow-hidden">
    <Image
      src={park.imagepath}
      alt={park.name}
      fill
      className="object-cover"
      priority
      unoptimized
    />
  {/* Title */}
<h1 className="absolute bottom-6 left-6 text-4xl md:text-5xl font-bold text-white z-20 drop-shadow-lg">
      {park.name}
    </h1>
  </div>
);

export default ParkHeader;
