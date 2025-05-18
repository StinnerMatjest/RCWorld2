// app/components/RatingExplanations.tsx

import React from "react";
import type { Rating } from "@/app/types";
import { getRatingColor } from "@/app/utils";

interface RatingExplanationsProps {
  ratings: Rating[];
  explanations: Record<string, string>;
}

// helper to turn e.g. "parkAppearance" → "Park Appearance"
function humanizeLabel(key: string) {
  return key
    // insert space before each uppercase letter
    .replace(/([A-Z])/g, " $1")
    // capitalize first char
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

const RatingExplanations: React.FC<RatingExplanationsProps> = ({
  ratings,
  explanations,
}) => {
  if (ratings.length === 0) return <p>No ratings available yet.</p>;

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-semibold mb-2">Rating Explanations</h2>
          <div className="border-t border-gray-300 mt-3 mb-5" />
      {ratings.map((r) => (
        <div key={r.id} className="space-y-7">
          {Object.entries(explanations).map(([key, text]) => {
            const fieldKey =
              key === "snacksAndDrinks"
                ? "snacksAndDrinks"
                : key.charAt(0).toLowerCase() + key.slice(1);
                const value = r[fieldKey as keyof Rating] as number;

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-xl font-semibold">
                    {humanizeLabel(key)}
                  </h3>
                  <span className={`text-2xl font-bold ${getRatingColor(value)}`}>
                    {value}
                  </span>
                </div>
                <p className="text-gray-700">{text}</p>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default RatingExplanations;
