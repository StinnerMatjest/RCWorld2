import React from "react";
import Image from "next/image";
import type { Park } from "@/app/types";

interface ParkHeaderProps {
  park: Park;
}

const ParkHeader: React.FC<ParkHeaderProps> = ({ park }) => (
  <div className="relative w-full h-150">
    <Image
      src={park.imagepath}
      alt={park.name}
      fill
      className="object-contain cursor-pointer"
      unoptimized
    />
    {/* Gradient Overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
    <h1 className="absolute bottom-6 left-6 text-6xl font-bold text-white">
      {park.name}
    </h1>
  </div>
);

export default ParkHeader;
