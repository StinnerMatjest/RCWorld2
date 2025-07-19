"use client";

import React, { useState, useEffect } from "react";
import type { Rating } from "@/app/types";
import ParkRatingsModal from "./ParkTextsModal";
import { getRatingColor } from "@/app/utils/design";
import { ratingCategories } from "@/app/utils/ratings";

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
  const [showModal, setShowModal] = useState(false);
  const [localExplanations, setLocalExplanations] = useState(explanations);

  useEffect(() => {
    setLocalExplanations(explanations);
  }, [explanations]);

  if (!rating) return <p>No rating available yet.</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <h2 className="text-3xl font-semibold">Rating Explanations</h2>
        <button
          onClick={() => setShowModal(true)}
          className="text-gray-500 hover:text-gray-700 cursor-pointer"
          aria-label="Edit Rating Explanations"
        >
          🔧
        </button>
      </div>

      {ratingCategories
        .filter((key) => key !== "description" && key !== "overall")
        .map((key) => {
          const text = localExplanations[key] ?? "";
          const value = rating[key as keyof Rating] as number;

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-baseline gap-3">
                <h3 className="text-xl font-semibold">{humanizeLabel(key)}</h3>
                <span className={`text-2xl font-bold ${getRatingColor(value)}`}>
                  {value}
                </span>
              </div>
              <p className="text-gray-700">{text}</p>
            </div>
          );
        })}

      {showModal && (
        <ParkRatingsModal
          explanations={localExplanations}
          parkId={Number(parkId)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default RatingExplanations;
