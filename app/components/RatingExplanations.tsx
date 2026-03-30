"use client";

import React, { useState, useEffect } from "react";
import type { Rating, RatingWarningType } from "@/app/types";
import ParkRatingsModal from "./ParkTextsModal";
import { getRatingColor } from "@/app/utils/design";
import { ratingCategories } from "@/app/utils/ratings";
import RatingWarning from "./warnings/RatingWarning";
import WarningCreatorModal from "./warnings/WarningCreatorModal";
import { useAdminMode } from "../context/AdminModeContext";

interface RatingExplanationsProps {
  rating: Rating;
  explanations: Record<string, string>;
  parkId: number;
  onWarningsUpdate: () => void;
  coasters: import("@/app/types").RollerCoaster[];
}

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
  onWarningsUpdate,
  coasters,
}) => {
  const { isAdminMode } = useAdminMode();
  const [showModal, setShowModal] = useState(false);
  const [showWarningManager, setShowWarningManager] = useState(false);
  const [localExplanations, setLocalExplanations] = useState(explanations);

  useEffect(() => {
    setLocalExplanations(explanations);
  }, [explanations]);

  useEffect(() => {
    if (!isAdminMode) {
      setShowModal(false);
      setShowWarningManager(false);
    }
  }, [isAdminMode]);

  if (!rating) return <p>No rating available yet.</p>;

  const categoryWarningsMap: Record<string, RatingWarningType[]> = {};

  rating.warnings?.forEach((warning) => {
    const normalizedCategory = warning.category.toLowerCase();
    if (!categoryWarningsMap[normalizedCategory]) {
      categoryWarningsMap[normalizedCategory] = [];
    }
    categoryWarningsMap[normalizedCategory].push(warning);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <h2 className="text-3xl font-semibold dark:text-white">
          Rating Explanations
        </h2>

        {/* Admin Buttons */}
        {isAdminMode && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="
                inline-flex items-center justify-center p-1
                text-gray-500 hover:text-gray-700
                dark:text-gray-400 dark:hover:text-gray-100
                hover:bg-gray-100 dark:hover:bg-white/10
                rounded transition-colors text-[20px] leading-none cursor-pointer
              "
              title="Edit Explanations"
            >
              🔧
            </button>
            <button
              onClick={() => setShowWarningManager(true)}
              className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 px-3 py-1 rounded text-sm font-semibold transition-colors cursor-pointer"
            >
              Warnings
            </button>
          </div>
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
                  <RatingWarning
                    warning={categoryWarnings}
                    isAdminMode={isAdminMode}
                    ratingId={rating.id}
                    onUpdate={onWarningsUpdate}
                    coasters={coasters}
                  />
                )}
              </div>
              <p className="text-gray-700 dark:text-gray-400">{text}</p>
            </div>
          );
        })}

      {/* Rating Explanations Modal */}
      {isAdminMode && showModal && (
        <ParkRatingsModal
          explanations={localExplanations}
          parkId={Number(parkId)}
          ratingId={rating.id}
          onClose={() => setShowModal(false)}
          onSave={(updated) => setLocalExplanations(updated)}
        />
      )}

      {/* Warning Creator Modal */}
      {isAdminMode && showWarningManager && (
        <WarningCreatorModal
          ratingId={rating.id}
          existingWarnings={rating.warnings || []}
          onClose={() => setShowWarningManager(false)}
          onSaved={onWarningsUpdate}
          coasters={coasters}
        />
      )}
    </div>
  );
};

export default RatingExplanations;