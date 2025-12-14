"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { RollerCoaster } from "@/app/types";

interface CoasterRankingProps {
  coaster: RollerCoaster;
  allCoasters: RollerCoaster[];
}

const CoasterRanking: React.FC<CoasterRankingProps> = ({ coaster, allCoasters }) => {
  const [parkRank, setParkRank] = useState<number | null>(null);
  const [manufacturerRank, setManufacturerRank] = useState<number | null>(null);
  const [parkName, setParkName] = useState<string | null>(null);

  // Compute ranks
  useEffect(() => {
    if (!coaster || !allCoasters.length) return;

    const parkCoasters = allCoasters
      .filter(c => c.parkId === coaster.parkId)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const parkPosition = parkCoasters.findIndex(c => c.id === coaster.id) + 1;

    const manufacturerCoasters = allCoasters
      .filter(c => c.manufacturer === coaster.manufacturer)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const manufacturerPosition = manufacturerCoasters.findIndex(c => c.id === coaster.id) + 1;

    setParkRank(parkPosition > 0 ? parkPosition : null);
    setManufacturerRank(manufacturerPosition > 0 ? manufacturerPosition : null);
  }, [coaster, allCoasters]);

  // Fetch park name
  useEffect(() => {
    if (!coaster.parkId) return;

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
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md space-y-2">
      <p className="text-gray-700 dark:text-gray-400">
        <strong className="font-semibold text-gray-900 dark:text-white"></strong>{" "}
        {parkName ? (
          <Link
            // FIX: Removed "park:" prefix so search works directly
            href={`/coasterratings?q=${encodeURIComponent(parkName)}`}
            className="underline hover:text-blue-600"
          >
            {parkName}
          </Link>
        ) : (
          "Loading..."
        )}{" "}
        – <strong className="font-semibold text-gray-900 dark:text-white">Rank:</strong>{" "}
        {parkRank !== null ? `#${parkRank}` : "N/A"}
      </p>

      <p className="text-gray-700 dark:text-gray-400">
        <strong className="font-semibold text-gray-900 dark:text-white"></strong>{" "}
        <Link
          // FIX: Removed "manufacturer:" prefix so search works directly
          href={`/coasterratings?q=${encodeURIComponent(coaster.manufacturer)}`}
          className="underline hover:text-blue-600"
        >
          {coaster.manufacturer}
        </Link>{" "}
        – <strong className="font-semibold text-gray-900 dark:text-white">Rank:</strong>{" "}
        {manufacturerRank !== null ? `#${manufacturerRank}` : "N/A"}
      </p>
    </div>
  );
};

export default CoasterRanking;