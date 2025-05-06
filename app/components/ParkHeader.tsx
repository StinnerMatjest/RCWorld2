import React from "react";
import type { Park } from "@/app/types";

interface ParkHeaderProps {
  park: Park;
}

const ParkHeader: React.FC<ParkHeaderProps> = ({ park }) => (
  <div className="relative w-full h-100">
    <img
      src={park.imagepath}
      alt={park.name}
      className="w-full h-full object-cover"
    />
    {/* Gradient Overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />

    {/* Park name */}
    <h1 className="absolute bottom-6 left-6 text-6xl font-bold text-white">
      {park.name}
    </h1>
  </div>
);

export default ParkHeader;
