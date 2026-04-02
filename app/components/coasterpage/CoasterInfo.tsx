"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { RollerCoaster } from "@/app/types";
import { useAdminMode } from "@/app/context/AdminModeContext";
import CoasterCreatorModal from "@/app/components/CoasterCreatorModal";

interface CoasterInfoProps {
  coaster: RollerCoaster;
  onUpdate?: () => void;
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

const CoasterInfo: React.FC<CoasterInfoProps> = ({ coaster, onUpdate }) => {
  const [parkName, setParkName] = useState<string | null>(null);
  const { isAdminMode } = useAdminMode();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const identifier = coaster.parkSlug || coaster.parkId;
    if (!identifier) return;

    (async () => {
      try {
        const res = await fetch(`/api/park/${identifier}`);
        const data = await res.json();
        setParkName(data?.name ?? "Unknown Park");
      } catch {
        setParkName("Unknown Park");
      }
    })();
  }, [coaster.parkSlug, coaster.parkId]);

  return (
    <div className="flex flex-col w-full relative">
      <InfoRow label="Name" value={coaster.name} />
      <InfoRow label="Year" value={coaster.year} />
      <InfoRow
        label="Park"
        value={
          parkName ? (
            <Link
              href={`/park/${coaster.parkSlug || coaster.parkId}`}
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
      <InfoRow
        label="Database"
        value={
          coaster.rcdbpath ? (
            <a
              href={coaster.rcdbpath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              RCDB Entry
            </a>
          ) : (
            "N/A"
          )
        }
      />
      <InfoRow label="Ride Count" value={coaster.ridecount ?? "0"} />

      {/* Admin Edit Button */}
      {isAdminMode && (
        <button
          onClick={() => setShowModal(true)}
          className="absolute -top-10 right-0 p-1 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
          title="Edit Coaster Info"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
      )}

      {/* Edit Modal */}
      {showModal && (
        <CoasterCreatorModal
          parkId={coaster.parkId}
          coaster={coaster}
          onClose={() => setShowModal(false)}
          onCoasterAdded={() => {
            setShowModal(false);
            if (onUpdate) onUpdate();
          }}
          onDelete={() => {
            // Redirect back to parkpage on coaster deletion
            window.location.href = `/park/${coaster.parkSlug || coaster.parkId}`;
          }}
        />
      )}
    </div>
  );
};

export default CoasterInfo;