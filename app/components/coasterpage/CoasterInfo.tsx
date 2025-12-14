import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { RollerCoaster } from "@/app/types";

interface CoasterInfoProps {
  coaster: RollerCoaster;
}

const CoasterInfo: React.FC<CoasterInfoProps> = ({ coaster }) => {
  const [parkName, setParkName] = useState<string | null>(null);

  useEffect(() => {
    if (!coaster.parkId) return;

    // Fetch the park name
    (async () => {
      try {
        const res = await fetch(`/api/park/${coaster.parkId}`);
        const data = await res.json();
        setParkName(data?.name ?? "Unknown Park");
      } catch {
        setParkName("Unknown Park");
      }
    })();
  }, [coaster.parkId]);

  return (
    <div className="space-y-6">
      <div className="text-lg space-y-1">
        <p className="text-gray-700 dark:text-gray-400">
          <strong className="font-semibold text-gray-900 dark:text-white">Name:</strong> {coaster.name}
        </p>
        <p className="text-gray-700 dark:text-gray-400">
          <strong className="font-semibold text-gray-900 dark:text-white">Year:</strong> {coaster.year}
        </p>
        <p className="text-gray-700 dark:text-gray-400">
          <strong className="font-semibold text-gray-900 dark:text-white">Park:</strong>{" "}
          {parkName ? (
            <Link
              href={`/park/${coaster.parkId}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {parkName}
            </Link>
          ) : (
            "Loading..."
          )}
        </p>
        <p className="text-gray-700 dark:text-gray-400">
          <strong className="font-semibold text-gray-900 dark:text-white">Manufacturer:</strong> {coaster.manufacturer}
        </p>
        <p className="text-gray-700 dark:text-gray-400">
          <strong className="font-semibold text-gray-900 dark:text-white">Model:</strong> {coaster.model}
        </p>
        <p className="text-gray-700 dark:text-gray-400">
          <strong className="font-semibold text-gray-900 dark:text-white">Scale:</strong> {coaster.scale}
        </p>
        <p className="text-gray-700 dark:text-gray-400">
          <strong className="font-semibold text-gray-900 dark:text-white">RCDB:</strong>{" "}
          {coaster.rcdbpath ? (
            <a href={coaster.rcdbpath} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Visit
            </a>
          ) : (
            "N/A"
          )}
        </p>
        <p className="text-gray-700 dark:text-gray-400">
          <strong className="font-semibold text-gray-900 dark:text-white">Ride Count:</strong> {coaster.ridecount ?? "N/A"}
        </p>
      </div>
    </div>
  );
};

export default CoasterInfo;
