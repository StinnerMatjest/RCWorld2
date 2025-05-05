// app/components/ParkInfo.tsx
import React from "react";
import type { Park } from "@/app/types";

interface ParkInfoProps {
  park: Park;
}

const ParkInfo: React.FC<ParkInfoProps> = ({ park }) => (
  <div className="space-y-6">
    <div className="text-lg">
      <p><strong>Continent:</strong> {park.continent}</p>
      <p><strong>Country:</strong> {park.country}</p>
      <p><strong>City:</strong> {park.city}</p>
    </div>
  </div>
);

export default ParkInfo;
