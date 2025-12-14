"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { RollerCoaster } from "@/app/types";

interface CoasterInfoProps {
  coaster: RollerCoaster;
}

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-baseline py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <span className="text-sm font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide">
      {label}
    </span>
    <span className="text-base font-semibold text-gray-900 dark:text-gray-200 text-right">
      {value}
    </span>
  </div>
);

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
    <div className="flex flex-col w-full">
      <InfoRow label="Name" value={coaster.name} />

      <InfoRow label="Year" value={coaster.year} />

      <InfoRow
        label="Park"
        value={
          parkName ? (
            <Link
              href={`/park/${coaster.parkId}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {parkName}
            </Link>
          ) : (
            <span className="text-gray-400 italic text-sm">Loading...</span>
          )
        }
      />

      <InfoRow label="Manufacturer" value={coaster.manufacturer} />
      <InfoRow label="Model" value={coaster.model} />
      <InfoRow label="Scale" value={coaster.scale} />
      <InfoRow label="Database" value={coaster.rcdbpath ? (
        <a
          href={coaster.rcdbpath}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          RCDB Entry
        </a>) : ("N/A")} />
      <InfoRow label="Ride Count" value={coaster.ridecount ?? "0"} />
    </div>
  );
};

export default CoasterInfo;