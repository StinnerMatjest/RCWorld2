import React from "react";
import type { Park } from "@/app/types";

interface ParkInfoProps {
  park: Park;
}

const ParkInfo: React.FC<ParkInfoProps> = ({ park }) => (
  <div className="space-y-6">
    <div className="text-lg">
      <p className="text-gray-700 dark:text-gray-400">
        <strong className="font-semibold text-gray-900 dark:text-white">Continent:</strong> {park.continent}
      </p>
      <p className="text-gray-700 dark:text-gray-400">
        <strong className="font-semibold text-gray-900 dark:text-white">Country:</strong> {park.country}
      </p>
      <p className="text-gray-700 dark:text-gray-400">
        <strong className="font-semibold text-gray-900 dark:text-white">City:</strong> {park.city}
      </p>
    </div>
  </div>
);

export default ParkInfo;
