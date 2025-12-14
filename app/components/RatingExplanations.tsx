"use client";

import React, { useState, useEffect } from "react";
import type { Rating, RatingWarningType } from "@/app/types";
import ParkRatingsModal from "./ParkTextsModal";
import { getRatingColor } from "@/app/utils/design";
import { ratingCategories } from "@/app/utils/ratings";
import RatingWarning from "./RatingWarning";
import { useAdminMode } from "../context/AdminModeContext";

interface RatingExplanationsProps {
  rating: Rating;
  explanations: Record<string, string>;
  parkId: number;
}

// helper to turn e.g. "parkAppearance" → "Park Appearance"
function humanizeLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

const RatingExplanations: React.FC<RatingExplanationsProps> = ({
  rating,
  explanations,
  parkId,
}) => {
  const { isAdminMode } = useAdminMode();
  const [showModal, setShowModal] = useState(false);
  const [localExplanations, setLocalExplanations] = useState(explanations);

  useEffect(() => {
    setLocalExplanations(explanations);
  }, [explanations]);

  // Auto-close modal if we leave admin mode
  useEffect(() => {
    if (!isAdminMode) {
      setShowModal(false);
    }
  }, [isAdminMode]);

  if (!rating) return <p>No rating available yet.</p>;

  const categoryWarningsMap: Record<string, RatingWarningType[]> = {};

  // Build the map
  rating.warnings?.forEach((warning) => {
    const normalizedCategory = warning.category.toLowerCase();
    if (!categoryWarningsMap[normalizedCategory]) {
      categoryWarningsMap[normalizedCategory] = [];
    }
    categoryWarningsMap[normalizedCategory].push(warning);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <h2 className="text-3xl font-semibold dark:text-white">
          Rating Explanations
        </h2>

        {isAdminMode && (
          <button
            onClick={() => setShowModal(true)}
            className="
      inline-flex items-center justify-center
      p-1
      text-gray-500 hover:text-gray-700
      dark:text-gray-400 dark:hover:text-gray-100
      hover:bg-gray-100 dark:hover:bg-white/10
      rounded
      transition-colors
      text-[15px] lg:text-[20px]
      leading-none
      cursor-pointer
    "
            aria-label="Edit Rating Explanations"
            title="Edit"
          >
            🔧
          </button>
        )}
      </div>

      {ratingCategories
        .filter((key) => key !== "description" && key !== "overall")
        .map((key) => {
          const value = (rating as any)[key] ?? 0;
          const text = localExplanations[key] ?? "";
          const normalizedKey = key.toLowerCase();
          const categoryWarnings = categoryWarningsMap[normalizedKey] ?? [];

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-baseline gap-3">
                <h3 className="text-xl font-semibold dark:text-white">
                  {humanizeLabel(key)}
                </h3>
                <span className={`text-2xl font-bold ${getRatingColor(value)}`}>
                  {value}
                </span>
                {categoryWarnings.length > 0 && (
                  <RatingWarning warning={categoryWarnings} />
                )}
              </div>
              <p className="text-gray-700 dark:text-gray-400">{text}</p>
            </div>
          );
        })}

      {isAdminMode && showModal && (
        <ParkRatingsModal
          explanations={localExplanations}
          parkId={Number(parkId)}
          onClose={() => setShowModal(false)}
          onSave={(updated) => setLocalExplanations(updated)}
        />
      )}
    </div>
  );
};

export default RatingExplanations;
